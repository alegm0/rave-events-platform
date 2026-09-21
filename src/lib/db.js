// Firestore database layer
// Replaces localStorage with Firebase Firestore

import { db } from '../firebase/config'
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, setDoc, serverTimestamp, writeBatch
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

export const loginUser = async (email, password) => {
  const users = await getCollection('users')
  const user = users.find(u => u.email === email && u.password === password)
  if (!user) throw new Error('Credenciales incorrectas')
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
// stock left. Everything here is derived from the tickets already sold, so the
// organizer's configuration is what actually drives the sale.
export const hasTiers = (event) =>
  event?.pricingMode === 'tiers' && Array.isArray(event.tiers) && event.tiers.length > 0

export const getTierStatus = (event, tickets = []) => {
  if (!hasTiers(event)) return []
  let activeFound = false
  return event.tiers.map((tier, i) => {
    const qty = parseInt(tier.qty) || 0
    const sold = tickets.filter(t => (t.tierName || '') === tier.name).length
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

export const getActiveTier = (event, tickets = []) =>
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
  // currently on sale and it must still have stock.
  let pricePaid = event.price || 0
  let resolvedTier = null
  if (hasTiers(event)) {
    const eventTickets = await getTicketsByEvent(eventId, { fresh: true })
    const tiers = getTierStatus(event, eventTickets)
    const active = tiers.find(t => t.active)
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

  // Update event ticket count
  await updateDoc(doc(db, 'events', eventId), {
    ticketsSold: sold + 1
  })
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

  // Decrement event ticket count
  const event = await getEvent(ticket.eventId)
  if (event) {
    await updateDoc(doc(db, 'events', ticket.eventId), {
      ticketsSold: Math.max(0, (event.ticketsSold || 1) - 1)
    })
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

export const getNotifications = async (userId) => {
  const notifs = await getCollection('notifications')
  return notifs.filter(n => n.userId === userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export const markNotificationRead = async (id) => {
  await updateDoc(doc(db, 'notifications', id), { read: true })
  invalidateCache('notifications')
}

export const markAllRead = async (userId) => {
  const notifs = await getCollection('notifications')
  const batch = writeBatch(db)
  notifs.filter(n => n.userId === userId && !n.read).forEach(n => {
    batch.update(doc(db, 'notifications', n.id), { read: true })
  })
  await batch.commit()
  invalidateCache('notifications')
}

export const getUnreadCount = async (userId) => {
  const notifs = await getCollection('notifications')
  return notifs.filter(n => n.userId === userId && !n.read).length
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

// ── Featured events: live-now demo + real Ibiza events ──
// Idempotent upsert (runs on load). The live event's date/times are computed
// dynamically so a set is always "playing now" whenever the app is opened.

const IBIZA_ORGANIZERS = [
  {
    id: 'org-ibiza-amnesia',
    email: 'amnesia@rave.com', password: 'demo123', displayName: 'Amnesia Ibiza', role: 'organizer',
    createdAt: '2024-01-01T00:00:00.000Z',
    brand: {
      name: 'Amnesia Ibiza',
      bio: 'Club legendario de Ibiza desde 1976. Cuna del terraza sound y hogar de Cocoon, Pyramid y Elrow.',
      logo: 'https://images.unsplash.com/photo-1571266028243-3716f02d2d2e?w=200&q=80',
      cover: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&q=80',
      city: 'Ibiza', instagram: '@amnesiaibiza', website: 'amnesia.es', founded: '1976',
    },
  },
  {
    id: 'org-hi-ibiza',
    email: 'hi@rave.com', password: 'demo123', displayName: 'Hï Ibiza', role: 'organizer',
    createdAt: '2024-01-01T00:00:00.000Z',
    brand: {
      name: 'Hï Ibiza',
      bio: 'El club número uno del mundo según DJ Mag. Sede de Black Coffee, Tale Of Us y Glitterbox en Playa d\'en Bossa.',
      logo: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&q=80',
      cover: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&q=80',
      city: 'Ibiza', instagram: '@hiibizaofficial', website: 'hiibiza.com', founded: '2017',
    },
  },
  {
    id: 'org-ushuaia',
    email: 'ushuaia@rave.com', password: 'demo123', displayName: 'Ushuaïa Ibiza', role: 'organizer',
    createdAt: '2024-01-01T00:00:00.000Z',
    brand: {
      name: 'Ushuaïa Ibiza',
      bio: 'El open-air más icónico de Ibiza. Fiestas de día bajo el sol con los headliners más grandes del mundo.',
      logo: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=200&q=80',
      cover: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200&q=80',
      city: 'Ibiza', instagram: '@ushuaiaibiza', website: 'ushuaiaibiza.com', founded: '2011',
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
    title: 'Cocoon — Live Tonight',
    description: 'Techno hipnótico en la terraza. El evento está sucediendo AHORA: entra a Rave Mode para ver quién toca en este momento.',
    date, time: t(doorHour), duration: 8,
    location: 'Amnesia Terrace', city: 'Ibiza', genre: 'Techno', price: 60, capacity: 3000,
    imageUrl: 'https://images.unsplash.com/photo-1493676304819-0d7a8d026dcf?w=800&q=80',
    organizerId: 'org-ibiza-amnesia', ticketsSold: 1840, status: 'active', minAge: 18,
    lineup: [
      { name: 'Ricardo Villalobos', time: t(set1) },
      { name: 'Sven Väth', time: t(set2) },
      { name: 'Dubfire', time: t(set3) },
      { name: 'Ilario Alicante', time: t(set4) },
    ],
    venue: VENUE_TEMPLATES.warehouse,
  }
}

// Real Ibiza clubs + real top-DJ residencies/lineups (2026 season dates).
const IBIZA_EVENTS = [
  {
    id: 'ev-hi-afterlife',
    title: 'Afterlife',
    description: 'Tale Of Us presentan Afterlife en Hï Ibiza: melodic techno cinematográfico con producción audiovisual de otro nivel.',
    date: '2026-07-03', time: '23:00', duration: 7,
    location: 'Hï Ibiza', city: 'Ibiza', genre: 'Melodic Techno', price: 80, capacity: 3000,
    imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80',
    organizerId: 'org-hi-ibiza', ticketsSold: 2100, status: 'active', minAge: 18,
    lineup: [
      { name: 'Anyma', time: '23:00' },
      { name: 'Mathame', time: '01:00' },
      { name: 'Kevin de Vries', time: '03:00' },
      { name: 'MRAK', time: '05:00' },
    ],
    venue: VENUE_TEMPLATES.warehouse,
  },
  {
    id: 'ev-hi-blackcoffee',
    title: 'Black Coffee',
    description: 'La residencia de los domingos de Black Coffee en Hï Ibiza. Afro house y deep house hasta el amanecer.',
    date: '2026-07-12', time: '23:30', duration: 7,
    location: 'Hï Ibiza', city: 'Ibiza', genre: 'Afro House', price: 75, capacity: 3000,
    imageUrl: 'https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=800&q=80',
    organizerId: 'org-hi-ibiza', ticketsSold: 1750, status: 'active', minAge: 18,
    lineup: [
      { name: 'Black Coffee', time: '23:30' },
      { name: 'Keinemusik', time: '02:00' },
      { name: 'Themba', time: '04:30' },
    ],
    venue: VENUE_TEMPLATES.warehouse,
  },
  {
    id: 'ev-amnesia-pyramid',
    title: 'Pyramid',
    description: 'Pyramid en Amnesia: techno y house crudo en las dos salas más icónicas de la isla.',
    date: '2026-06-20', time: '23:59', duration: 8,
    location: 'Amnesia Ibiza', city: 'Ibiza', genre: 'Techno', price: 55, capacity: 5000,
    imageUrl: 'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=800&q=80',
    organizerId: 'org-ibiza-amnesia', ticketsSold: 3200, status: 'active', minAge: 18,
    lineup: [
      { name: 'Charlotte de Witte', time: '00:00' },
      { name: 'Adam Beyer', time: '02:00' },
      { name: 'Enrico Sangiuliano', time: '04:00' },
      { name: 'Amelie Lens', time: '06:00' },
    ],
    venue: VENUE_TEMPLATES.warehouse,
  },
  {
    id: 'ev-ushuaia-armin',
    title: 'Armin van Buuren — A State Of Trance',
    description: 'Armin van Buuren toma Ushuaïa al aire libre para una sesión épica de trance bajo las estrellas de Ibiza.',
    date: '2026-08-01', time: '17:00', duration: 8,
    location: 'Ushuaïa Ibiza', city: 'Ibiza', genre: 'Trance', price: 90, capacity: 8000,
    imageUrl: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80',
    organizerId: 'org-ushuaia', ticketsSold: 5600, status: 'active', minAge: 18,
    lineup: [
      { name: 'Armin van Buuren', time: '17:00' },
      { name: 'Above & Beyond', time: '20:00' },
      { name: 'Ferry Corsten', time: '22:30' },
    ],
    venue: VENUE_TEMPLATES.festival,
  },
  {
    id: 'ev-ushuaia-david',
    title: 'David Guetta — F*** Me I\'m Famous',
    description: 'La fiesta open-air más grande de Ushuaïa. David Guetta y sus invitados para un día inolvidable.',
    date: '2026-08-15', time: '17:00', duration: 8,
    location: 'Ushuaïa Ibiza', city: 'Ibiza', genre: 'House', price: 95, capacity: 8000,
    imageUrl: 'https://images.unsplash.com/photo-1642178225043-f299dbea9f8d?w=800&q=80',
    organizerId: 'org-ushuaia', ticketsSold: 6100, status: 'active', minAge: 18,
    lineup: [
      { name: 'David Guetta', time: '17:00' },
      { name: 'Martin Garrix', time: '20:00' },
      { name: 'Nicky Romero', time: '22:30' },
    ],
    venue: VENUE_TEMPLATES.festival,
  },
]

export const ensureFeaturedEvents = async () => {
  const batch = writeBatch(db)

  // Organizers (upsert with merge so we don't clobber anything else)
  IBIZA_ORGANIZERS.forEach((o) => batch.set(doc(db, 'users', o.id), o, { merge: true }))

  // Live event (dynamic) + Ibiza events
  const liveEvent = buildLiveEvent()
  batch.set(doc(db, 'events', liveEvent.id), liveEvent, { merge: true })
  IBIZA_EVENTS.forEach((e) => batch.set(doc(db, 'events', e.id), e, { merge: true }))

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
    password: 'demo123',
    displayName: 'NOCTURN Collective',
    role: 'organizer',
    createdAt: '2025-06-01T00:00:00.000Z',
    brand: {
      name: 'NOCTURN Collective',
      bio: 'Colectivo de música electrónica underground. Desde 2019 creando experiencias sonoras inmersivas en espacios no convencionales.',
      logo: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&q=80',
      cover: 'https://images.unsplash.com/photo-1571266028243-3716f02d2d2e?w=1200&q=80',
      city: 'Bogotá',
      instagram: '@nocturn.co',
      website: 'nocturn.co',
      founded: '2019',
    }
  }
  batch.set(doc(db, 'users', 'demo-org'), demoOrg)

  // Create demo ravers
  const ravers = [
    { id: 'demo-raver', email: 'maria@rave.com', password: 'demo123', displayName: 'Maria Torres', role: 'user', createdAt: '2025-09-15T00:00:00.000Z' },
    { id: 'r2', email: 'carlos@gmail.com', password: 'x', displayName: 'Carlos Mendez', role: 'user', createdAt: '2025-10-01T00:00:00.000Z' },
    { id: 'r3', email: 'valentina@gmail.com', password: 'x', displayName: 'Valentina Rios', role: 'user', createdAt: '2025-10-05T00:00:00.000Z' },
    { id: 'r4', email: 'santiago@gmail.com', password: 'x', displayName: 'Santiago Herrera', role: 'user', createdAt: '2025-11-01T00:00:00.000Z' },
    { id: 'r5', email: 'camila@gmail.com', password: 'x', displayName: 'Camila Duarte', role: 'user', createdAt: '2025-11-15T00:00:00.000Z' },
  ]
  ravers.forEach(r => batch.set(doc(db, 'users', r.id), r))

  // Venue templates come from the module-level VENUE_TEMPLATES constant
  const venueWarehouse = VENUE_TEMPLATES.warehouse
  const venueClub = VENUE_TEMPLATES.club
  const venueFestival = VENUE_TEMPLATES.festival
  const venueGallery = VENUE_TEMPLATES.gallery

  // Sample events
  const sampleEvents = [
    { id: 'ev1', title: 'Berghain Nights', description: 'Una noche de techno industrial en el warehouse mas iconico.', date: '2026-09-12', time: '23:00', duration: 10, location: 'Warehouse District', city: 'Bogota', genre: 'Techno', price: 45, capacity: 500, imageUrl: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&q=80', organizerId: 'demo-org', ticketsSold: 7, status: 'active', minAge: 18, lineup: [{name: 'Amelie Lens', time: '23:00'}, {name: 'FJAAK', time: '01:30'}, {name: 'Kobosil', time: '04:00'}], venue: venueWarehouse },
    { id: 'ev2', title: 'Deep Connection', description: 'Sesion de deep house en un club subterraneo.', date: '2026-09-18', time: '22:00', duration: 8, location: 'Club Subterraneo', city: 'Medellin', genre: 'Deep House', price: 35, capacity: 300, imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80', organizerId: 'demo-org', ticketsSold: 5, status: 'active', minAge: 18, lineup: [{name: 'Solomun', time: '22:00'}, {name: 'Dixon', time: '01:00'}, {name: 'Ame', time: '03:30'}], venue: venueClub },
    { id: 'ev3', title: 'Acid Rain', description: 'Acid techno en una bodega industrial abandonada.', date: '2026-09-25', time: '00:00', duration: 12, location: 'Bodega Industrial', city: 'Bogota', genre: 'Acid', price: 30, capacity: 400, imageUrl: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=800&q=80', organizerId: 'demo-org', ticketsSold: 4, status: 'active', minAge: 21, lineup: [{name: '999999999', time: '00:00'}, {name: 'Dax J', time: '02:30'}, {name: 'SPFDJ', time: '05:00'}], venue: venueWarehouse },
    { id: 'ev4', title: 'Euphoria Festival', description: 'Festival al aire libre de 24 horas. Tres escenarios.', date: '2026-10-02', time: '14:00', duration: 24, location: 'Parque Metropolitano', city: 'Cali', genre: 'Trance', price: 85, capacity: 2000, imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&q=80', organizerId: 'demo-org', ticketsSold: 12, status: 'active', minAge: 16, lineup: [{name: 'Armin van Buuren', time: '14:00'}, {name: 'Above & Beyond', time: '17:00'}, {name: 'Paul van Dyk', time: '20:00'}], venue: venueFestival },
    { id: 'ev5', title: 'Minimal Affairs', description: 'Minimal techno en galeria de arte.', date: '2026-10-10', time: '21:00', duration: 6, location: 'Galeria Central', city: 'Bogota', genre: 'Minimal', price: 25, capacity: 200, imageUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80', organizerId: 'demo-org', ticketsSold: 3, status: 'active', minAge: 18, lineup: [{name: 'Ricardo Villalobos', time: '21:00'}, {name: 'Zip', time: '00:00'}], venue: venueGallery },
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
    { id: 'n1', userId: 'demo-raver', type: 'purchase', title: 'Ticket comprado: Berghain Nights', message: 'Tu entrada esta lista.', eventId: 'ev1', image: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=200&q=80', read: false, createdAt: '2026-08-20T15:30:00.000Z' },
    { id: 'n2', userId: 'demo-raver', type: 'purchase', title: 'Ticket comprado: Euphoria Festival', message: 'Tu entrada esta lista.', eventId: 'ev4', image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=200&q=80', read: false, createdAt: '2026-08-22T10:15:00.000Z' },
  ]
  notifs.forEach(n => batch.set(doc(db, 'notifications', n.id), n))

  await batch.commit()
  invalidateCache('events')
  invalidateCache('users')
  invalidateCache('tickets')
  invalidateCache('going')
  invalidateCache('notifications')
}
