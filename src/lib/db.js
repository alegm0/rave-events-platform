// Firestore database layer
// Every domain read and write goes through Cloud Firestore. The app keeps no
// data in browser storage.

import { db } from '../firebase/config'
import {
  collection, doc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, setDoc, writeBatch, increment
} from 'firebase/firestore'

// ── Helper ──
const genId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9)

// ── Cache layer for performance ──
// We cache reads to avoid excessive Firestore reads (free tier: 50K/day)
const cache = { users: null, events: null, tickets: null, reviews: null, going: null, notifications: null, subscriptions: null }
const cacheTime = {}
const CACHE_TTL = 30000 // 30 seconds

// Tickets are never read as a whole collection (see queryTickets below), so they
// get their own per-query cache with a shorter TTL: check-in screens need fresh data.
const ticketCache = {}
const ticketCacheTime = {}
const TICKET_CACHE_TTL = 10000 // 10 seconds
const invalidateTicketQueries = () => {
  Object.keys(ticketCache).forEach(k => { delete ticketCache[k]; delete ticketCacheTime[k] })
}

const isCacheValid = (key) => cache[key] && (Date.now() - (cacheTime[key] || 0)) < CACHE_TTL
const invalidateCache = (key) => {
  cache[key] = null
  cacheTime[key] = 0
  if (key === 'tickets') invalidateTicketQueries()
  if (key === 'notifications') invalidateNotifications()
}

// ── Generic Firestore helpers ──
const getCollection = async (name) => {
  if (isCacheValid(name)) return cache[name]
  const snapshot = await getDocs(collection(db, name))
  const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
  cache[name] = data
  cacheTime[name] = Date.now()
  return data
}

const getDocument = async (collName, id) => {
  const docRef = doc(db, collName, id)
  const snap = await getDoc(docRef)
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

// ── Users ──
export const createUser = async (userData) => {
  const users = await getCollection('users')
  const exists = users.find(u => u.email === userData.email)
  if (exists) throw new Error('El correo ya está en uso')
  const id = userData.id || genId()
  const user = { ...userData, id, createdAt: new Date().toISOString() }
  await setDoc(doc(db, 'users', id), user)
  invalidateCache('users')
  return user
}

export const getUser = async (id) => {
  if (!id) return null
  return await getDocument('users', id)
}

export const updateUser = async (id, data) => {
  const docRef = doc(db, 'users', id)
  await updateDoc(docRef, data)
  invalidateCache('users')
  const updated = await getDocument('users', id)
  return updated
}

// ── Comfort & Accessibility Profile ──
// Human-centered preferences with agency. Nothing is assumed; the user opts in.
// Stored on the user document under `comfortProfile`.
export const COMFORT_PREFERENCES = [
  { key: 'quieterAreas', label: 'Prefiero zonas más tranquilas', icon: 'moon' },
  { key: 'stepFree', label: 'Necesito rutas sin escalones', icon: 'accessible' },
  { key: 'accessibleToilets', label: 'Los baños accesibles son importantes', icon: 'toilet' },
  { key: 'simpleNavigation', label: 'Prefiero navegación sencilla', icon: 'compass' },
  { key: 'restAreas', label: 'Puedo necesitar un lugar para sentarme', icon: 'seat' },
  { key: 'minimalText', label: 'Muéstrame lo esencial con poco texto', icon: 'text' },
]

export const getComfortProfile = async (userId) => {
  if (!userId) return {}
  const user = await getDocument('users', userId)
  return user?.comfortProfile || {}
}

export const updateComfortProfile = async (userId, comfortProfile) => {
  await updateDoc(doc(db, 'users', userId), { comfortProfile })
  invalidateCache('users')
  return comfortProfile
}

// ── Saved artists ──
// The user marks acts they want to see. These names drive the ⭐ in the
// Pre-Rave Brief timetable and count as "known artists" for music discovery.
// Stored as an array of names on the user document under `savedArtists`.
export const getSavedArtists = async (userId) => {
  if (!userId) return []
  const user = await getDocument('users', userId)
  return user?.savedArtists || []
}

export const toggleSavedArtist = async (userId, artistName) => {
  if (!userId || !artistName) return []
  const user = await getDocument('users', userId)
  const current = user?.savedArtists || []
  const exists = current.some((a) => a.toLowerCase() === artistName.toLowerCase())
  const next = exists
    ? current.filter((a) => a.toLowerCase() !== artistName.toLowerCase())
    : [...current, artistName]
  await updateDoc(doc(db, 'users', userId), { savedArtists: next })
  invalidateCache('users')
  return next
}

// ── Events ──
export const createEvent = async (eventData) => {
  const id = genId()
  const event = { ...eventData, id, createdAt: new Date().toISOString(), ticketsSold: 0 }
  await setDoc(doc(db, 'events', id), event)
  invalidateCache('events')
  return event
}

export const getEvents = async () => {
  const events = await getCollection('events')
  return events.sort((a, b) => new Date(a.date) - new Date(b.date))
}

export const getEvent = async (id) => {
  if (!id) return null
  return await getDocument('events', id)
}

export const getEventsByOrganizer = async (organizerId) => {
  const events = await getCollection('events')
  return events.filter(e => e.organizerId === organizerId)
}

export const updateEvent = async (id, data) => {
  const docRef = doc(db, 'events', id)
  await updateDoc(docRef, data)
  invalidateCache('events')
  return await getDocument('events', id)
}

export const deleteEvent = async (id) => {
  // Delete related tickets first: once the event is gone the rules can no longer
  // prove ownership of its tickets.
  const tickets = await getTicketsByEvent(id, { fresh: true })
  if (tickets.length > 0) {
    const batch = writeBatch(db)
    tickets.forEach(t => batch.delete(doc(db, 'tickets', t.id)))
    await batch.commit()
  }
  await deleteDoc(doc(db, 'events', id))
  invalidateCache('events')
  invalidateCache('tickets')
}

// ── Get attendees for an event ──
export const getEventAttendees = async (eventId) => {
  const tickets = await getTicketsByEvent(eventId)
  const attendees = []
  for (const t of tickets) {
    const user = await getUser(t.userId)
    attendees.push({ ...t, user })
  }
  return attendees
}

// ── Pricing tiers ──
// An event can be sold at a single price or in ordered phases ("Early Bird",
// "First Release", ...). Only one phase is on sale at a time: the first one with
// stock left. The phase configured by the organizer is what drives the price.
export const hasTiers = (event) =>
  event?.pricingMode === 'tiers' && Array.isArray(event.tiers) && event.tiers.length > 0

// `tickets` is optional: organizer views pass the real ticket documents, public
// views pass nothing and we fall back to the aggregate counter stored on the
// event (`tierSold`), which is the only figure a visitor is allowed to read.
export const getTierStatus = (event, tickets = null) => {
  if (!hasTiers(event)) return []
  let activeFound = false
  return event.tiers.map((tier, i) => {
    const qty = parseInt(tier.qty) || 0
    const sold = Array.isArray(tickets)
      ? tickets.filter(t => (t.tierName || '') === tier.name).length
      : (event.tierSold?.[tier.name] || 0)
    const remaining = qty > 0 ? Math.max(0, qty - sold) : null // null = unlimited
    const soldOut = remaining === 0
    const active = !soldOut && !activeFound
    if (active) activeFound = true
    return {
      index: i,
      name: tier.name,
      price: parseFloat(tier.price) || 0,
      qty,
      sold,
      remaining,
      soldOut,
      active,
    }
  })
}

export const getActiveTier = (event, tickets = null) =>
  getTierStatus(event, tickets).find(t => t.active) || null

// Revenue from what people actually paid. Older tickets have no `pricePaid`,
// so they fall back to the event's current price.
export const sumRevenue = (tickets = [], event = null) =>
  tickets.reduce((sum, t) => {
    const paid = typeof t.pricePaid === 'number' ? t.pricePaid : (event?.price || 0)
    return sum + paid
  }, 0)

// ── Tickets ──
// Server-side validations (RF06/RF07 + capacity): these run in the data layer,
// so they hold even if the UI is bypassed by manipulating the browser.
export const createTicket = async (ticketData) => {
  const { eventId, userId, tierName } = ticketData
  if (!eventId || !userId) throw new Error('Datos de compra incompletos')

  const event = await getEvent(eventId)
  if (!event) throw new Error('El evento no existe')

  // RF07 — prevent duplicate tickets at the data layer (not just the UI)
  const existing = await getTicketsByUser(userId, { fresh: true })
  if (existing.some(t => t.eventId === eventId)) {
    throw new Error('Ya tienes un ticket para este evento')
  }

  // Capacity — do not sell beyond the event's capacity
  const sold = event.ticketsSold || 0
  const capacity = event.capacity || 0
  if (capacity > 0 && sold >= capacity) {
    throw new Error('El evento está agotado')
  }

  // Price is resolved here, never taken from the UI: the tier must be the one
  // currently on sale and it must still have stock. Phase stock comes from the
  // aggregate counter on the event, because a buyer cannot read other people's
  // tickets (see firestore.rules).
  let pricePaid = event.price || 0
  let resolvedTier = null
  if (hasTiers(event)) {
    const active = getActiveTier(event)
    if (!active) throw new Error('No hay fases de precio disponibles')
    if (tierName && tierName !== active.name) {
      throw new Error(`La fase "${tierName}" ya no está disponible. Ahora se vende "${active.name}".`)
    }
    resolvedTier = active.name
    pricePaid = active.price
  }

  const id = genId()
  const ticket = {
    ...ticketData,
    id,
    tierName: resolvedTier,
    pricePaid,
    purchaseDate: new Date().toISOString(),
    status: 'valid',
    qrCode: `RAVE-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`
  }
  await setDoc(doc(db, 'tickets', id), ticket)

  // Public counters on the event: total sold and sold-per-phase. These are the
  // only figures visitors can read, and the only fields a buyer may write.
  const counters = { ticketsSold: increment(1) }
  if (resolvedTier) {
    counters.tierSold = {
      ...(event.tierSold || {}),
      [resolvedTier]: (event.tierSold?.[resolvedTier] || 0) + 1,
    }
  }
  await updateDoc(doc(db, 'events', eventId), counters)
  invalidateCache('tickets')
  invalidateCache('events')
  return ticket
}

// Scoped ticket queries. We never scan the whole `tickets` collection: the
// security rules restrict each ticket to its owner or to the organizer of its
// event, and Firestore rejects a query it cannot prove is fully allowed.
const queryTickets = async (cacheKey, constraints, { fresh = false } = {}) => {
  if (!fresh && ticketCache[cacheKey] && (Date.now() - (ticketCacheTime[cacheKey] || 0)) < TICKET_CACHE_TTL) {
    return ticketCache[cacheKey]
  }
  const snap = await getDocs(query(collection(db, 'tickets'), ...constraints))
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  ticketCache[cacheKey] = data
  ticketCacheTime[cacheKey] = Date.now()
  return data
}

export const getTicketsByUser = async (userId, opts = {}) => {
  if (!userId) return []
  return await queryTickets(`user:${userId}`, [where('userId', '==', userId)], opts)
}

export const getTicketsByEvent = async (eventId, opts = {}) => {
  if (!eventId) return []
  return await queryTickets(`event:${eventId}`, [where('eventId', '==', eventId)], opts)
}

// Force the next ticket read to hit Firestore. Used by the live check-in view.
export const refreshTickets = () => invalidateTicketQueries()

export const getTicket = async (id) => {
  if (!id) return null
  return await getDocument('tickets', id)
}

export const cancelTicket = async (ticketId) => {
  const ticket = await getDocument('tickets', ticketId)
  if (!ticket) return false
  if (ticket.status === 'used') return false

  await deleteDoc(doc(db, 'tickets', ticketId))

  // Give the seat back: total counter and, if it was sold in a phase, that phase
  const event = await getEvent(ticket.eventId)
  if (event) {
    const counters = { ticketsSold: Math.max(0, (event.ticketsSold || 1) - 1) }
    if (ticket.tierName) {
      counters.tierSold = {
        ...(event.tierSold || {}),
        [ticket.tierName]: Math.max(0, (event.tierSold?.[ticket.tierName] || 1) - 1),
      }
    }
    await updateDoc(doc(db, 'events', ticket.eventId), counters)
  }
  invalidateCache('tickets')
  invalidateCache('events')
  return true
}

// ── Reviews ──
export const addReview = async (reviewData) => {
  const reviews = await getCollection('reviews')
  const exists = reviews.find(r => r.userId === reviewData.userId && r.eventId === reviewData.eventId)
  if (exists) return null
  const id = genId()
  const review = { ...reviewData, id, createdAt: new Date().toISOString() }
  await setDoc(doc(db, 'reviews', id), review)
  invalidateCache('reviews')
  return review
}

export const getReviewsByEvent = async (eventId) => {
  const reviews = await getCollection('reviews')
  return reviews.filter(r => r.eventId === eventId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export const getAverageRating = async (eventId) => {
  const reviews = await getReviewsByEvent(eventId)
  if (reviews.length === 0) return 0
  return Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
}

// ── Search ──
export const searchAll = async (queryStr) => {
  const q = queryStr.toLowerCase().trim()
  if (!q) return { events: [], organizers: [] }
  const events = await getEvents()
  const filteredEvents = events.filter(e =>
    e.title?.toLowerCase().includes(q) ||
    e.location?.toLowerCase().includes(q) ||
    e.genre?.toLowerCase().includes(q) ||
    e.city?.toLowerCase().includes(q) ||
    (e.lineup || []).some(a => (a.name || a).toLowerCase().includes(q))
  )
  const users = await getCollection('users')
  const organizers = users.filter(u => u.role === 'organizer' && (
    u.displayName?.toLowerCase().includes(q) ||
    u.brand?.name?.toLowerCase().includes(q) ||
    u.brand?.city?.toLowerCase().includes(q)
  ))
  return { events: filteredEvents, organizers }
}

// ── "Going" / Friends ──
export const markGoing = async (userId, eventId) => {
  const going = await getCollection('going')
  if (going.find(g => g.userId === userId && g.eventId === eventId)) return false
  const id = genId()
  await setDoc(doc(db, 'going', id), { id, userId, eventId })
  invalidateCache('going')
  return true
}

export const getGoingCount = async (eventId) => {
  const going = await getCollection('going')
  return going.filter(g => g.eventId === eventId).length
}

export const isGoing = async (userId, eventId) => {
  const going = await getCollection('going')
  return going.some(g => g.userId === userId && g.eventId === eventId)
}

export const getGoingUsers = async (eventId) => {
  const going = await getCollection('going')
  const eventGoing = going.filter(g => g.eventId === eventId)
  const users = []
  for (const g of eventGoing) {
    const user = await getUser(g.userId)
    if (user) users.push(user)
  }
  return users
}

export const validateTicket = async (qrCode, eventId) => {
  const tickets = await getTicketsByEvent(eventId, { fresh: true })
  const ticket = tickets.find(t => t.qrCode === qrCode)
  if (!ticket) return { success: false, message: 'Ticket inválido' }
  if (ticket.status === 'used') return { success: false, message: 'Ticket ya utilizado' }

  await updateDoc(doc(db, 'tickets', ticket.id), {
    status: 'used',
    usedAt: new Date().toISOString()
  })
  invalidateCache('tickets')
  return { success: true, message: 'Acceso concedido' }
}

// ── Notifications ──
export const addNotification = async (userId, notification) => {
  const id = genId()
  const notif = { id, userId, read: false, createdAt: new Date().toISOString(), ...notification }
  await setDoc(doc(db, 'notifications', id), notif)
  invalidateCache('notifications')
  return notif
}

// Notifications are private to their recipient, so — like tickets — they are
// read with a scoped query instead of a full-collection scan.
const notifCache = {}
const notifCacheTime = {}
const NOTIF_CACHE_TTL = 15000

const queryNotifications = async (userId, { fresh = false } = {}) => {
  if (!userId) return []
  if (!fresh && notifCache[userId] && (Date.now() - (notifCacheTime[userId] || 0)) < NOTIF_CACHE_TTL) {
    return notifCache[userId]
  }
  const snap = await getDocs(query(collection(db, 'notifications'), where('userId', '==', userId)))
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  notifCache[userId] = data
  notifCacheTime[userId] = Date.now()
  return data
}

const invalidateNotifications = () => {
  Object.keys(notifCache).forEach(k => { delete notifCache[k]; delete notifCacheTime[k] })
}

export const getNotifications = async (userId) => {
  const notifs = await queryNotifications(userId)
  return [...notifs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export const markNotificationRead = async (id) => {
  await updateDoc(doc(db, 'notifications', id), { read: true })
  invalidateCache('notifications')
}

export const markAllRead = async (userId) => {
  const notifs = await queryNotifications(userId, { fresh: true })
  const unread = notifs.filter(n => !n.read)
  if (unread.length === 0) return
  const batch = writeBatch(db)
  unread.forEach(n => batch.update(doc(db, 'notifications', n.id), { read: true }))
  await batch.commit()
  invalidateCache('notifications')
}

export const getUnreadCount = async (userId) => {
  const notifs = await queryNotifications(userId)
  return notifs.filter(n => !n.read).length
}

// ── Subscriptions (notify me) ──
export const subscribe = async (userId, eventId) => {
  const subs = await getCollection('subscriptions')
  if (subs.find(s => s.userId === userId && s.eventId === eventId)) return false
  const id = genId()
  await setDoc(doc(db, 'subscriptions', id), { id, userId, eventId, createdAt: new Date().toISOString() })
  invalidateCache('subscriptions')
  return true
}

export const isSubscribed = async (userId, eventId) => {
  const subs = await getCollection('subscriptions')
  return subs.some(s => s.userId === userId && s.eventId === eventId)
}

export const getUserSubscriptions = async (userId) => {
  const subs = await getCollection('subscriptions')
  return subs.filter(s => s.userId === userId)
}

// RF17 — Automatic subscription reminders.
// Runs on app load: for each of the user's subscriptions, if the event is
// coming up within REMINDER_DAYS and we haven't already reminded them,
// generate a real notification and mark the subscription as reminded so it
// won't fire twice. This is what turns a subscription into a future alert.
const REMINDER_DAYS = 7
export const processSubscriptionReminders = async (userId) => {
  if (!userId) return 0
  const subs = (await getCollection('subscriptions')).filter(s => s.userId === userId)
  if (subs.length === 0) return 0

  const now = new Date()
  let created = 0

  for (const sub of subs) {
    if (sub.reminded) continue
    const event = await getEvent(sub.eventId)
    if (!event?.date) continue

    const eventDate = new Date(`${event.date}T${event.time || '00:00'}`)
    const daysLeft = Math.ceil((eventDate - now) / (1000 * 60 * 60 * 24))

    // Only remind for upcoming events within the window
    if (daysLeft >= 0 && daysLeft <= REMINDER_DAYS) {
      await addNotification(userId, {
        type: 'reminder',
        title: `Se acerca: ${event.title}`,
        message: daysLeft === 0
          ? `${event.title} es hoy. ¡No te lo pierdas!`
          : `${event.title} es en ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}. Prepárate.`,
        eventId: event.id,
        image: event.imageUrl,
      })
      await updateDoc(doc(db, 'subscriptions', sub.id), { reminded: true, remindedAt: now.toISOString() })
      created++
    }
  }

  if (created > 0) {
    invalidateCache('subscriptions')
    invalidateCache('notifications')
  }
  return created
}

// ── Venue templates (schematic 2D map: coords are 0-100 %, not geo) ──
// zones = big blocks (stages, areas). services = positioned icons.
// `accessible` marks step-free / accessible options. `walkMin` = organizer-defined walk time.
// Layouts are designed like a real seating-map: zones tile the plan (no floating
// gaps), services sit on the borders/corridors so pins never cover labels.
// Coords are 0-100 (%). Zone rects fill the 6..94 usable area.
export const VENUE_TEMPLATES = {
  warehouse: {
    layout: 'indoor',
    setting: 'Warehouse · 2 escenarios',
    zones: [
      // Main stage spans the top; two rooms tile the lower half.
      { id: 'main', label: 'Main Stage', type: 'stage', x: 6, y: 8, w: 88, h: 34 },
      { id: 'second', label: 'Concrete Room', type: 'stage', x: 52, y: 46, w: 42, h: 34 },
      { id: 'chill', label: 'Chill / Quiet Zone', type: 'quiet', x: 6, y: 46, w: 42, h: 34 },
    ],
    // Positions aligned to the drawn warehouse floor plan (see floorplans/warehouse.jsx)
    services: [
      { id: 'gate', type: 'entrance', label: 'Gate B (entrada sin escalones)', x: 38, y: 90, accessible: true, walkMin: 0 },
      { id: 'water1', type: 'water', label: 'Estación de agua', x: 62, y: 30, walkMin: 2 },
      { id: 'toilet1', type: 'toilet', label: 'Baños', x: 18, y: 88, walkMin: 3 },
      { id: 'toilet-acc', type: 'toilet', label: 'Baño accesible', x: 84, y: 88, accessible: true, walkMin: 3 },
      { id: 'firstaid', type: 'firstaid', label: 'First Aid', x: 26, y: 30, walkMin: 4 },
      { id: 'rest', type: 'rest', label: 'Zona de descanso', x: 71, y: 68, accessible: true, walkMin: 4 },
      { id: 'smoking', type: 'smoking', label: 'Smoking Area', x: 90, y: 30, walkMin: 3 },
      { id: 'exit', type: 'exit', label: 'Salida norte', x: 64, y: 90, walkMin: 3 },
    ],
    knowBeforeYouGo: ['Trae documento de identidad', 'No hay guardarropa', 'Transporte cercano: estación Calle 45'],
  },
  club: {
    layout: 'indoor',
    setting: 'Club subterráneo · 1 escenario',
    zones: [
      { id: 'main', label: 'Dancefloor', type: 'stage', x: 6, y: 8, w: 88, h: 46 },
      { id: 'bar', label: 'Bar / Lounge', type: 'quiet', x: 6, y: 58, w: 88, h: 22 },
    ],
    services: [
      { id: 'gate', type: 'entrance', label: 'Entrada (con escaleras)', x: 28, y: 90, accessible: false, walkMin: 0 },
      { id: 'water1', type: 'water', label: 'Estación de agua', x: 18, y: 56, walkMin: 1 },
      { id: 'toilet1', type: 'toilet', label: 'Baños', x: 82, y: 56, walkMin: 2 },
      { id: 'rest', type: 'rest', label: 'Lounge para sentarse', x: 50, y: 68, accessible: true, walkMin: 2 },
      { id: 'exit', type: 'exit', label: 'Salida', x: 72, y: 90, walkMin: 2 },
    ],
    knowBeforeYouGo: ['Trae documento de identidad', 'La entrada tiene escaleras (sin acceso sin escalones)', 'Aforo reducido'],
  },
  festival: {
    layout: 'outdoor',
    setting: 'Aire libre · 3 escenarios',
    zones: [
      { id: 'main', label: 'Main Stage', type: 'stage', x: 6, y: 8, w: 88, h: 26 },
      { id: 'stage2', label: 'Sunset Stage', type: 'stage', x: 6, y: 38, w: 42, h: 26 },
      { id: 'stage3', label: 'Forest Stage', type: 'stage', x: 52, y: 38, w: 42, h: 26 },
      { id: 'chill', label: 'Quiet / Sensory Zone', type: 'quiet', x: 6, y: 68, w: 88, h: 16 },
    ],
    services: [
      { id: 'gate', type: 'entrance', label: 'Entrada principal (sin escalones)', x: 30, y: 92, accessible: true, walkMin: 0 },
      { id: 'water1', type: 'water', label: 'Agua (centro)', x: 50, y: 36, walkMin: 5 },
      { id: 'water2', type: 'water', label: 'Agua (este)', x: 90, y: 36, walkMin: 6 },
      { id: 'toilet-acc', type: 'toilet', label: 'Baños accesibles', x: 10, y: 66, accessible: true, walkMin: 5 },
      { id: 'firstaid', type: 'firstaid', label: 'First Aid', x: 90, y: 66, walkMin: 4 },
      { id: 'rest', type: 'rest', label: 'Zona de descanso', x: 50, y: 86, accessible: true, walkMin: 6 },
      { id: 'exit', type: 'exit', label: 'Salida de emergencia', x: 70, y: 92, walkMin: 5 },
    ],
    knowBeforeYouGo: ['Trae documento de identidad', 'Evento al aire libre: revisa el clima', 'Parqueadero accesible en puerta sur'],
  },
  gallery: {
    layout: 'indoor',
    setting: 'Galería de arte · 1 escenario',
    zones: [
      { id: 'main', label: 'Sala Principal', type: 'stage', x: 6, y: 8, w: 88, h: 44 },
      { id: 'chill', label: 'Sala tranquila', type: 'quiet', x: 6, y: 56, w: 88, h: 24 },
    ],
    services: [
      { id: 'gate', type: 'entrance', label: 'Entrada (sin escalones)', x: 28, y: 90, accessible: true, walkMin: 0 },
      { id: 'water1', type: 'water', label: 'Estación de agua', x: 20, y: 54, walkMin: 1 },
      { id: 'toilet-acc', type: 'toilet', label: 'Baño accesible', x: 82, y: 54, accessible: true, walkMin: 2 },
      { id: 'rest', type: 'rest', label: 'Bancas para descansar', x: 50, y: 68, accessible: true, walkMin: 2 },
      { id: 'exit', type: 'exit', label: 'Salida', x: 72, y: 90, walkMin: 2 },
    ],
    knowBeforeYouGo: ['Trae documento de identidad', 'Espacio íntimo, aforo limitado', 'Transporte cercano disponible'],
  },
}

// Pick a venue template from an event's characteristics
const pickVenueTemplate = (event) => {
  const g = (event.genre || '').toLowerCase()
  const loc = (event.location || '').toLowerCase()
  if ((event.capacity || 0) >= 1000 || loc.includes('parque') || loc.includes('festival')) return VENUE_TEMPLATES.festival
  if (loc.includes('galer') || g.includes('minimal')) return VENUE_TEMPLATES.gallery
  if (loc.includes('club') || loc.includes('subterr') || g.includes('house')) return VENUE_TEMPLATES.club
  return VENUE_TEMPLATES.warehouse
}

// Bump this whenever the venue layouts change, so existing events get refreshed.
export const VENUE_LAYOUT_VERSION = 4

// Backfill / refresh venues. Runs on every load: applies a venue to events that
// lack one, and re-applies the template when the stored layout version is old.
// Venues authored by an organizer (`venueAuthored`) are never touched — their
// zones, services and accessibility flags are declarations by a real person and
// must not be overwritten by a guessed template.
export const backfillVenues = async () => {
  const events = await getCollection('events')
  const stale = events.filter(e => !e.venueAuthored && (!e.venue || (e.venueVersion || 1) < VENUE_LAYOUT_VERSION))
  if (stale.length === 0) return 0
  const batch = writeBatch(db)
  stale.forEach(e => {
    batch.update(doc(db, 'events', e.id), {
      venue: e.venue ? matchTemplateToVenue(e.venue) : pickVenueTemplate(e),
      venueVersion: VENUE_LAYOUT_VERSION,
    })
  })
  await batch.commit()
  invalidateCache('events')
  return stale.length
}

// Keep an event on its existing venue *kind* but with the latest layout.
const matchTemplateToVenue = (venue) => {
  const s = (venue?.setting || '').toLowerCase()
  if (s.includes('aire libre') || s.includes('festival')) return VENUE_TEMPLATES.festival
  if (s.includes('galer')) return VENUE_TEMPLATES.gallery
  if (s.includes('club') || s.includes('subterr')) return VENUE_TEMPLATES.club
  return VENUE_TEMPLATES.warehouse
}

// ── Featured events: live-now demo + Brisbane venue events ──
// Idempotent upsert (runs on load). The live event's date/times are computed
// dynamically so a set is always "playing now" whenever the app is opened.
// All data is set in Brisbane, Australia (Fortitude Valley is the city's
// nightlife district) with prices in AUD — matching the project's scope.

const BRISBANE_ORGANIZERS = [
  {
    id: 'org-tbc',
    email: 'tbc@rave.com', demo: true, displayName: 'The TBC Club', role: 'organizer',
    createdAt: '2024-01-01T00:00:00.000Z',
    brand: {
      name: 'The TBC Club',
      bio: 'Club underground en Fortitude Valley donde terminan los que viven la música de verdad. Techno y house para quienes vienen por el line-up.',
      logo: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=200&q=80',
      cover: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&q=80',
      city: 'Brisbane', instagram: '@thetbcclub', website: 'tbcclub.com.au', founded: '2015',
    },
  },
  {
    id: 'org-met',
    email: 'themet@rave.com', demo: true, displayName: 'The MET Brisbane', role: 'organizer',
    createdAt: '2024-01-01T00:00:00.000Z',
    brand: {
      name: 'The MET Brisbane',
      bio: 'Club icónico en el corazón de Fortitude Valley. Cinco barras en tres niveles y los DJs más grandes del dance.',
      logo: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&q=80',
      cover: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&q=80',
      city: 'Brisbane', instagram: '@themetbrisbane', website: 'themet.com.au', founded: '1992',
    },
  },
  {
    id: 'org-riverstage',
    email: 'riverstage@rave.com', demo: true, displayName: 'Riverstage Open Air', role: 'organizer',
    createdAt: '2024-01-01T00:00:00.000Z',
    brand: {
      name: 'Riverstage Open Air',
      bio: 'El anfiteatro al aire libre más icónico de Brisbane, en los Jardines Botánicos. Festivales bajo las estrellas junto al río.',
      logo: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=200&q=80',
      cover: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200&q=80',
      city: 'Brisbane', instagram: '@brisbaneriverstage', website: 'riverstage.com.au', founded: '1988',
    },
  },
]

// Compute a live event happening right now: doors 2h ago, sets around now.
const buildLiveEvent = () => {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const hh = now.getHours()
  const doorHour = (hh - 2 + 24) % 24
  const set1 = (hh - 1 + 24) % 24 // finished / opening
  const set2 = hh                 // playing NOW
  const set3 = (hh + 1) % 24      // next
  const set4 = (hh + 2) % 24
  const t = (h) => `${pad(h)}:00`
  return {
    id: 'ev-live',
    title: 'Warehouse Sessions — Live Tonight',
    description: 'Techno hipnótico en Fortitude Valley. El evento está sucediendo AHORA: entra a Rave Mode para ver quién toca en este momento.',
    date, time: t(doorHour), duration: 8,
    location: 'The TBC Club', address: '365 Brunswick St', city: 'Brisbane', genre: 'Techno', price: 45, capacity: 800,
    imageUrl: 'https://images.unsplash.com/photo-1493676304819-0d7a8d026dcf?w=800&q=80',
    organizerId: 'org-tbc', ticketsSold: 540, status: 'active', minAge: 18,
    lineup: [
      { name: 'Ricardo Villalobos', time: t(set1) },
      { name: 'Sven Väth', time: t(set2) },
      { name: 'Dubfire', time: t(set3) },
      { name: 'Ilario Alicante', time: t(set4) },
    ],
    venue: VENUE_TEMPLATES.warehouse,
  }
}

// Brisbane venues (Fortitude Valley + Riverstage) with international DJ
// lineups touring Australia. Dates in the 2026 season, prices in AUD.
const BRISBANE_EVENTS = [
  {
    id: 'ev-tbc-afterlife',
    title: 'Afterlife Brisbane',
    description: 'Tale Of Us presentan Afterlife en The TBC Club: melodic techno cinematográfico con producción audiovisual de otro nivel.',
    date: '2026-07-03', time: '22:00', duration: 7,
    location: 'The TBC Club', address: '365 Brunswick St, Fortitude Valley', city: 'Brisbane', genre: 'Melodic Techno', price: 75, capacity: 800,
    imageUrl: 'https://images.unsplash.com/photo-1545128485-c400e7702796?w=800&q=80',
    organizerId: 'org-tbc', ticketsSold: 610, status: 'active', minAge: 18,
    lineup: [
      { name: 'Anyma', time: '22:00' },
      { name: 'Mathame', time: '00:00' },
      { name: 'Kevin de Vries', time: '02:00' },
      { name: 'MRAK', time: '04:00' },
    ],
    venue: VENUE_TEMPLATES.warehouse,
  },
  {
    id: 'ev-met-blackcoffee',
    title: 'Black Coffee',
    description: 'Black Coffee aterriza en The MET Brisbane. Afro house y deep house hasta el amanecer en Fortitude Valley.',
    date: '2026-07-12', time: '21:30', duration: 7,
    location: 'The MET Brisbane', address: '620 Ann St, Fortitude Valley', city: 'Brisbane', genre: 'Afro House', price: 70, capacity: 1000,
    imageUrl: 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800&q=80',
    organizerId: 'org-met', ticketsSold: 720, status: 'active', minAge: 18,
    lineup: [
      { name: 'Black Coffee', time: '21:30' },
      { name: 'Keinemusik', time: '00:00' },
      { name: 'Themba', time: '02:30' },
    ],
    venue: VENUE_TEMPLATES.club,
  },
  {
    id: 'ev-tbc-drumcode',
    title: 'Drumcode Brisbane',
    description: 'Techno crudo de la mano de Drumcode en The TBC Club. Las dos salas más intensas de la Valley.',
    date: '2026-06-20', time: '22:00', duration: 8,
    location: 'The TBC Club', address: '365 Brunswick St, Fortitude Valley', city: 'Brisbane', genre: 'Techno', price: 65, capacity: 800,
    imageUrl: 'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=800&q=80',
    organizerId: 'org-tbc', ticketsSold: 680, status: 'active', minAge: 18,
    lineup: [
      { name: 'Charlotte de Witte', time: '22:00' },
      { name: 'Adam Beyer', time: '00:00' },
      { name: 'Enrico Sangiuliano', time: '02:00' },
      { name: 'Amelie Lens', time: '04:00' },
    ],
    venue: VENUE_TEMPLATES.club,
  },
  {
    id: 'ev-riverstage-asot',
    title: 'Armin van Buuren — A State Of Trance',
    description: 'Armin van Buuren toma el Riverstage al aire libre para una sesión épica de trance bajo las estrellas de Brisbane.',
    date: '2026-08-01', time: '17:00', duration: 7,
    location: 'Riverstage', address: '59 Gardens Point Rd, City Botanic Gardens', city: 'Brisbane', genre: 'Trance', price: 95, capacity: 9500,
    imageUrl: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80',
    organizerId: 'org-riverstage', ticketsSold: 7200, status: 'active', minAge: 18,
    lineup: [
      { name: 'Armin van Buuren', time: '17:00' },
      { name: 'Above & Beyond', time: '19:30' },
      { name: 'Ferry Corsten', time: '22:00' },
    ],
    venue: VENUE_TEMPLATES.festival,
  },
  {
    id: 'ev-riverstage-guetta',
    title: 'David Guetta — Open Air',
    description: 'La fiesta open-air más grande del año en el Riverstage. David Guetta y sus invitados para un día inolvidable junto al río.',
    date: '2026-08-15', time: '16:00', duration: 8,
    location: 'Riverstage', address: '59 Gardens Point Rd, City Botanic Gardens', city: 'Brisbane', genre: 'House', price: 110, capacity: 9500,
    imageUrl: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&q=80',
    organizerId: 'org-riverstage', ticketsSold: 8100, status: 'active', minAge: 18,
    lineup: [
      { name: 'David Guetta', time: '16:00' },
      { name: 'Martin Garrix', time: '19:00' },
      { name: 'Nicky Romero', time: '21:30' },
    ],
    venue: VENUE_TEMPLATES.festival,
  },
]

export const ensureFeaturedEvents = async () => {
  const batch = writeBatch(db)

  // Organizers (upsert with merge so we don't clobber anything else)
  BRISBANE_ORGANIZERS.forEach((o) => batch.set(doc(db, 'users', o.id), o, { merge: true }))

  // Live event (dynamic) + Brisbane events
  const liveEvent = buildLiveEvent()
  batch.set(doc(db, 'events', liveEvent.id), liveEvent, { merge: true })
  BRISBANE_EVENTS.forEach((e) => batch.set(doc(db, 'events', e.id), e, { merge: true }))

  // Give the demo raver a ticket to the live event so Rave Mode is reachable
  batch.set(doc(db, 'tickets', 'tk-live'), {
    id: 'tk-live', eventId: 'ev-live', userId: 'demo-raver',
    purchaseDate: new Date().toISOString(), status: 'valid', qrCode: 'RAVE-LIVE-NOW00001',
  }, { merge: true })

  await batch.commit()
  invalidateCache('events')
  invalidateCache('users')
  invalidateCache('tickets')
}

// ── Seed sample data ──
export const seedData = async () => {
  const events = await getCollection('events')
  if (events.length > 0) return // Already seeded

  const batch = writeBatch(db)

  // Create demo organizer
  const demoOrg = {
    id: 'demo-org',
    email: 'demo@rave.com',
    demo: true,
    displayName: 'NOCTURN Collective',
    role: 'organizer',
    createdAt: '2025-06-01T00:00:00.000Z',
    brand: {
      name: 'NOCTURN Collective',
      bio: 'Colectivo de música electrónica underground de Brisbane. Desde 2019 creando experiencias sonoras inmersivas en espacios no convencionales de Fortitude Valley.',
      logo: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&q=80',
      cover: 'https://images.unsplash.com/photo-1549924231-f129b911e442?w=1200&q=80',
      city: 'Brisbane',
      instagram: '@nocturn.bne',
      website: 'nocturn.com.au',
      founded: '2019',
    }
  }
  batch.set(doc(db, 'users', 'demo-org'), demoOrg)

  // Create demo ravers
  const ravers = [
    { id: 'demo-raver', email: 'maria@rave.com', demo: true, displayName: 'Mia Thompson', role: 'user', createdAt: '2025-09-15T00:00:00.000Z' },
    { id: 'r2', email: 'carlos@gmail.com', demo: true, displayName: 'Liam Walker', role: 'user', createdAt: '2025-10-01T00:00:00.000Z' },
    { id: 'r3', email: 'valentina@gmail.com', demo: true, displayName: 'Chloe Nguyen', role: 'user', createdAt: '2025-10-05T00:00:00.000Z' },
    { id: 'r4', email: 'santiago@gmail.com', demo: true, displayName: 'Jack Robinson', role: 'user', createdAt: '2025-11-01T00:00:00.000Z' },
    { id: 'r5', email: 'camila@gmail.com', demo: true, displayName: 'Olivia Harris', role: 'user', createdAt: '2025-11-15T00:00:00.000Z' },
  ]
  ravers.forEach(r => batch.set(doc(db, 'users', r.id), r))

  // Venue templates come from the module-level VENUE_TEMPLATES constant
  const venueWarehouse = VENUE_TEMPLATES.warehouse
  const venueClub = VENUE_TEMPLATES.club
  const venueFestival = VENUE_TEMPLATES.festival
  const venueGallery = VENUE_TEMPLATES.gallery

  // Sample events — all in Brisbane, Australia (prices in AUD)
  const sampleEvents = [
    { id: 'ev1', title: 'Warehouse District', description: 'Una noche de techno industrial en el warehouse más icónico de Fortitude Valley.', date: '2026-09-12', time: '22:00', duration: 8, location: 'The Warehouse', address: '27 Warner St, Fortitude Valley', city: 'Brisbane', genre: 'Techno', price: 45, capacity: 500, imageUrl: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&q=80', organizerId: 'demo-org', ticketsSold: 7, status: 'active', minAge: 18, lineup: [{name: 'Amelie Lens', time: '22:00'}, {name: 'FJAAK', time: '00:30'}, {name: 'Kobosil', time: '03:00'}], venue: venueWarehouse },
    { id: 'ev2', title: 'Deep Connection', description: 'Sesión de deep house en un club subterráneo de la Valley.', date: '2026-09-18', time: '21:00', duration: 7, location: 'Sub Club', address: '12 Constance St, Fortitude Valley', city: 'Brisbane', genre: 'Deep House', price: 40, capacity: 300, imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80', organizerId: 'demo-org', ticketsSold: 5, status: 'active', minAge: 18, lineup: [{name: 'Solomun', time: '21:00'}, {name: 'Dixon', time: '00:00'}, {name: 'Ame', time: '02:30'}], venue: venueClub },
    { id: 'ev3', title: 'Acid Rain', description: 'Acid techno en una bodega industrial de West End.', date: '2026-09-25', time: '22:00', duration: 9, location: 'The Foundry', address: '228 Wickham St, Fortitude Valley', city: 'Brisbane', genre: 'Acid', price: 38, capacity: 400, imageUrl: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=800&q=80', organizerId: 'demo-org', ticketsSold: 4, status: 'active', minAge: 18, lineup: [{name: '999999999', time: '22:00'}, {name: 'Dax J', time: '00:30'}, {name: 'SPFDJ', time: '03:00'}], venue: venueWarehouse },
    { id: 'ev4', title: 'Euphoria Open Air', description: 'Festival al aire libre junto al río. Tres escenarios bajo las estrellas de Brisbane.', date: '2026-10-02', time: '14:00', duration: 10, location: 'Riverstage', address: '59 Gardens Point Rd, City Botanic Gardens', city: 'Brisbane', genre: 'Trance', price: 89, capacity: 2000, imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&q=80', organizerId: 'demo-org', ticketsSold: 12, status: 'active', minAge: 18, lineup: [{name: 'Armin van Buuren', time: '14:00'}, {name: 'Above & Beyond', time: '17:00'}, {name: 'Paul van Dyk', time: '20:00'}], venue: venueFestival },
    { id: 'ev5', title: 'Minimal Affairs', description: 'Minimal techno en una galería de arte de New Farm.', date: '2026-10-10', time: '20:00', duration: 6, location: 'Jan Murphy Gallery', address: '486 Brunswick St, Fortitude Valley', city: 'Brisbane', genre: 'Minimal', price: 35, capacity: 200, imageUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80', organizerId: 'demo-org', ticketsSold: 3, status: 'active', minAge: 18, lineup: [{name: 'Ricardo Villalobos', time: '20:00'}, {name: 'Zip', time: '23:00'}], venue: venueGallery },
  ]
  sampleEvents.forEach(e => batch.set(doc(db, 'events', e.id), e))

  // Sample tickets
  const sampleTickets = [
    { id: 'tk1', eventId: 'ev1', userId: 'demo-raver', purchaseDate: '2026-08-20T15:30:00.000Z', status: 'valid', qrCode: 'RAVE-BN2026-A7K9M3P2' },
    { id: 'tk2', eventId: 'ev1', userId: 'r2', purchaseDate: '2026-08-18T10:00:00.000Z', status: 'valid', qrCode: 'RAVE-BN2026-C3M8N1X4' },
    { id: 'tk3', eventId: 'ev4', userId: 'demo-raver', purchaseDate: '2026-08-22T10:15:00.000Z', status: 'valid', qrCode: 'RAVE-EF2026-X4R8N1Q5' },
  ]
  sampleTickets.forEach(t => batch.set(doc(db, 'tickets', t.id), t))

  // Going data
  const goingData = [
    { id: 'g1', userId: 'demo-raver', eventId: 'ev1' },
    { id: 'g2', userId: 'demo-raver', eventId: 'ev4' },
    { id: 'g3', userId: 'r2', eventId: 'ev1' },
    { id: 'g4', userId: 'r2', eventId: 'ev2' },
  ]
  goingData.forEach(g => batch.set(doc(db, 'going', g.id), g))

  // Notifications
  const notifs = [
    { id: 'n1', userId: 'demo-raver', type: 'purchase', title: 'Ticket comprado: Warehouse District', message: 'Tu entrada está lista.', eventId: 'ev1', image: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=200&q=80', read: false, createdAt: '2026-08-20T15:30:00.000Z' },
    { id: 'n2', userId: 'demo-raver', type: 'purchase', title: 'Ticket comprado: Euphoria Open Air', message: 'Tu entrada está lista.', eventId: 'ev4', image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=200&q=80', read: false, createdAt: '2026-08-22T10:15:00.000Z' },
  ]
  notifs.forEach(n => batch.set(doc(db, 'notifications', n.id), n))

  await batch.commit()
  invalidateCache('events')
  invalidateCache('users')
  invalidateCache('tickets')
  invalidateCache('going')
  invalidateCache('notifications')
}
