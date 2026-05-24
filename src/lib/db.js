// Local database using localStorage - FREE, no setup needed
// Replaces Firebase for thesis demo purposes

const DB_PREFIX = 'rave_'

const getStore = (name) => {
  try {
    return JSON.parse(localStorage.getItem(DB_PREFIX + name)) || []
  } catch { return [] }
}

const setStore = (name, data) => {
  localStorage.setItem(DB_PREFIX + name, JSON.stringify(data))
}

const genId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9)

// ── Users ──
export const createUser = (userData) => {
  const users = getStore('users')
  const exists = users.find(u => u.email === userData.email)
  if (exists) throw new Error('El correo ya está en uso')
  const user = { id: genId(), ...userData, createdAt: new Date().toISOString() }
  users.push(user)
  setStore('users', users)
  return user
}

export const loginUser = (email, password) => {
  const users = getStore('users')
  const user = users.find(u => u.email === email && u.password === password)
  if (!user) throw new Error('Credenciales incorrectas')
  return user
}

export const getUser = (id) => getStore('users').find(u => u.id === id) || null

export const updateUser = (id, data) => {
  const users = getStore('users')
  const idx = users.findIndex(u => u.id === id)
  if (idx === -1) return null
  users[idx] = { ...users[idx], ...data }
  setStore('users', users)
  return users[idx]
}

// ── Events ──
export const createEvent = (eventData) => {
  const events = getStore('events')
  const event = { id: genId(), ...eventData, createdAt: new Date().toISOString(), ticketsSold: 0 }
  events.push(event)
  setStore('events', events)
  return event
}

export const getEvents = () => getStore('events').sort((a, b) => new Date(a.date) - new Date(b.date))

export const getEvent = (id) => getStore('events').find(e => e.id === id) || null

export const getEventsByOrganizer = (organizerId) => getStore('events').filter(e => e.organizerId === organizerId)

export const updateEvent = (id, data) => {
  const events = getStore('events')
  const idx = events.findIndex(e => e.id === id)
  if (idx === -1) return null
  events[idx] = { ...events[idx], ...data }
  setStore('events', events)
  return events[idx]
}

export const deleteEvent = (id) => {
  setStore('events', getStore('events').filter(e => e.id !== id))
  // Also delete related tickets
  setStore('tickets', getStore('tickets').filter(t => t.eventId !== id))
}

// ── Get attendees for an event ──
export const getEventAttendees = (eventId) => {
  const tickets = getTicketsByEvent(eventId)
  return tickets.map(t => {
    const user = getUser(t.userId)
    return { ...t, user }
  })
}

// ── Tickets ──
export const createTicket = (ticketData) => {
  const tickets = getStore('tickets')
  const ticket = {
    id: genId(),
    ...ticketData,
    purchaseDate: new Date().toISOString(),
    status: 'valid',
    qrCode: `RAVE-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`
  }
  tickets.push(ticket)
  setStore('tickets', tickets)

  // Update event ticket count
  const events = getStore('events')
  const eIdx = events.findIndex(e => e.id === ticketData.eventId)
  if (eIdx !== -1) {
    events[eIdx].ticketsSold = (events[eIdx].ticketsSold || 0) + 1
    setStore('events', events)
  }

  return ticket
}

export const getTicketsByUser = (userId) => getStore('tickets').filter(t => t.userId === userId)

export const getTicketsByEvent = (eventId) => getStore('tickets').filter(t => t.eventId === eventId)

export const getTicket = (id) => getStore('tickets').find(t => t.id === id) || null

export const cancelTicket = (ticketId) => {
  const tickets = getStore('tickets')
  const idx = tickets.findIndex(t => t.id === ticketId)
  if (idx === -1) return false
  const ticket = tickets[idx]
  if (ticket.status === 'used') return false
  // Remove ticket
  tickets.splice(idx, 1)
  setStore('tickets', tickets)
  // Decrement event ticket count
  const events = getStore('events')
  const eIdx = events.findIndex(e => e.id === ticket.eventId)
  if (eIdx !== -1) {
    events[eIdx].ticketsSold = Math.max(0, (events[eIdx].ticketsSold || 1) - 1)
    setStore('events', events)
  }
  return true
}

// ── Reviews ──
export const addReview = (reviewData) => {
  const reviews = getStore('reviews')
  const exists = reviews.find(r => r.userId === reviewData.userId && r.eventId === reviewData.eventId)
  if (exists) return null
  const review = { id: genId(), ...reviewData, createdAt: new Date().toISOString() }
  reviews.push(review)
  setStore('reviews', reviews)
  return review
}

export const getReviewsByEvent = (eventId) => getStore('reviews').filter(r => r.eventId === eventId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

export const getAverageRating = (eventId) => {
  const reviews = getReviewsByEvent(eventId)
  if (reviews.length === 0) return 0
  return Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
}

// ── Search ──
export const searchAll = (query) => {
  const q = query.toLowerCase().trim()
  if (!q) return { events: [], organizers: [] }
  const events = getEvents().filter(e =>
    e.title.toLowerCase().includes(q) ||
    e.location?.toLowerCase().includes(q) ||
    e.genre?.toLowerCase().includes(q) ||
    e.city?.toLowerCase().includes(q) ||
    (e.lineup || []).some(a => a.toLowerCase().includes(q))
  )
  const users = getStore('users')
  const organizers = users.filter(u => u.role === 'organizer' && (
    u.displayName?.toLowerCase().includes(q) ||
    u.brand?.name?.toLowerCase().includes(q) ||
    u.brand?.city?.toLowerCase().includes(q)
  ))
  return { events, organizers }
}

// ── "Going" / Friends ──
export const markGoing = (userId, eventId) => {
  const going = getStore('going')
  if (going.find(g => g.userId === userId && g.eventId === eventId)) return false
  going.push({ id: genId(), userId, eventId })
  setStore('going', going)
  return true
}

export const getGoingCount = (eventId) => getStore('going').filter(g => g.eventId === eventId).length

export const isGoing = (userId, eventId) => getStore('going').some(g => g.userId === userId && g.eventId === eventId)

export const getGoingUsers = (eventId) => {
  const going = getStore('going')
  return going.filter(g => g.eventId === eventId).map(g => getUser(g.userId)).filter(Boolean)
}

export const validateTicket = (qrCode, eventId) => {
  const tickets = getStore('tickets')
  const idx = tickets.findIndex(t => t.qrCode === qrCode && t.eventId === eventId)
  if (idx === -1) return { success: false, message: 'Ticket inválido' }
  if (tickets[idx].status === 'used') return { success: false, message: 'Ticket ya utilizado' }
  tickets[idx].status = 'used'
  tickets[idx].usedAt = new Date().toISOString()
  setStore('tickets', tickets)
  return { success: true, message: 'Acceso concedido' }
}

// ── Notifications ──
export const addNotification = (userId, notification) => {
  const notifs = getStore('notifications')
  const notif = { id: genId(), userId, read: false, createdAt: new Date().toISOString(), ...notification }
  notifs.push(notif)
  setStore('notifications', notifs)
  return notif
}

export const getNotifications = (userId) => getStore('notifications').filter(n => n.userId === userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

export const markNotificationRead = (id) => {
  const notifs = getStore('notifications')
  const idx = notifs.findIndex(n => n.id === id)
  if (idx !== -1) { notifs[idx].read = true; setStore('notifications', notifs) }
}

export const markAllRead = (userId) => {
  const notifs = getStore('notifications')
  notifs.forEach(n => { if (n.userId === userId) n.read = true })
  setStore('notifications', notifs)
}

export const getUnreadCount = (userId) => getStore('notifications').filter(n => n.userId === userId && !n.read).length

// ── Subscriptions (notify me) ──
export const subscribe = (userId, eventId) => {
  const subs = getStore('subscriptions')
  if (subs.find(s => s.userId === userId && s.eventId === eventId)) return false
  subs.push({ id: genId(), userId, eventId, createdAt: new Date().toISOString() })
  setStore('subscriptions', subs)
  return true
}

export const isSubscribed = (userId, eventId) => getStore('subscriptions').some(s => s.userId === userId && s.eventId === eventId)

export const getUserSubscriptions = (userId) => getStore('subscriptions').filter(s => s.userId === userId)

// ── Seed sample data ──
export const seedData = () => {
  if (getStore('events').length > 0) return // Already seeded

  // Create demo organizer brand
  const demoOrg = {
    id: 'demo-org',
    email: 'demo@rave.com',
    password: 'demo123',
    displayName: 'NOCTURN Collective',
    role: 'organizer',
    createdAt: '2025-06-01T00:00:00.000Z',
    brand: {
      name: 'NOCTURN Collective',
      bio: 'Colectivo de música electrónica underground. Desde 2019 creando experiencias sonoras inmersivas en espacios no convencionales. Techno, house, ambient.',
      logo: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&q=80',
      cover: 'https://images.unsplash.com/photo-1571266028243-3716f02d2d2e?w=1200&q=80',
      city: 'Bogotá',
      instagram: '@nocturn.co',
      website: 'nocturn.co',
      founded: '2019',
    }
  }
  const users = getStore('users')
  if (!users.find(u => u.id === 'demo-org')) {
    users.push(demoOrg)
    setStore('users', users)
  }

  // Create demo ravers
  const ravers = [
    { id: 'demo-raver', email: 'maria@rave.com', password: 'demo123', displayName: 'Maria Torres', role: 'user', createdAt: '2025-09-15T00:00:00.000Z' },
    { id: 'r2', email: 'carlos@gmail.com', password: 'x', displayName: 'Carlos Mendez', role: 'user', createdAt: '2025-10-01T00:00:00.000Z' },
    { id: 'r3', email: 'valentina@gmail.com', password: 'x', displayName: 'Valentina Rios', role: 'user', createdAt: '2025-10-05T00:00:00.000Z' },
    { id: 'r4', email: 'santiago@gmail.com', password: 'x', displayName: 'Santiago Herrera', role: 'user', createdAt: '2025-11-01T00:00:00.000Z' },
    { id: 'r5', email: 'camila@gmail.com', password: 'x', displayName: 'Camila Duarte', role: 'user', createdAt: '2025-11-15T00:00:00.000Z' },
    { id: 'r6', email: 'andres@gmail.com', password: 'x', displayName: 'Andres Parra', role: 'user', createdAt: '2025-12-01T00:00:00.000Z' },
    { id: 'r7', email: 'laura@gmail.com', password: 'x', displayName: 'Laura Gomez', role: 'user', createdAt: '2026-01-10T00:00:00.000Z' },
    { id: 'r8', email: 'daniel@gmail.com', password: 'x', displayName: 'Daniel Ortiz', role: 'user', createdAt: '2026-01-20T00:00:00.000Z' },
    { id: 'r9', email: 'paula@gmail.com', password: 'x', displayName: 'Paula Vargas', role: 'user', createdAt: '2026-02-05T00:00:00.000Z' },
    { id: 'r10', email: 'nicolas@gmail.com', password: 'x', displayName: 'Nicolas Castro', role: 'user', createdAt: '2026-02-15T00:00:00.000Z' },
    { id: 'r11', email: 'isabella@gmail.com', password: 'x', displayName: 'Isabella Moreno', role: 'user', createdAt: '2026-03-01T00:00:00.000Z' },
    { id: 'r12', email: 'mateo@gmail.com', password: 'x', displayName: 'Mateo Silva', role: 'user', createdAt: '2026-03-10T00:00:00.000Z' },
  ]
  ravers.forEach(r => { if (!users.find(u => u.id === r.id)) users.push(r) })
  setStore('users', users)

  const sampleEvents = [
    { id: 'ev1', title: 'Berghain Nights', description: 'Una noche de techno industrial en el warehouse mas iconico. Sonido envolvente, visuales inmersivos y la mejor seleccion de DJs underground. Prepara tus oidos para un viaje sonico de 10 horas.', date: '2026-05-12', time: '23:00', duration: 10, location: 'Warehouse District', city: 'Bogota', genre: 'Techno', price: 45, capacity: 500, imageUrl: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&q=80', organizerId: 'demo-org', ticketsSold: 327, status: 'active', minAge: 18, lineup: [{name: 'Amelie Lens', time: '23:00'}, {name: 'FJAAK', time: '01:30'}, {name: 'Kobosil', time: '04:00'}, {name: 'Rebekah', time: '06:00'}] },
    { id: 'ev2', title: 'Deep Connection', description: 'Sesion de deep house en un club subterraneo. Ambiente intimo, sonido cristalino y una comunidad que vive la musica. Capacidad limitada para mantener la esencia.', date: '2026-05-18', time: '22:00', duration: 8, location: 'Club Subterraneo', city: 'Medellin', genre: 'Deep House', price: 35, capacity: 300, imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80', organizerId: 'demo-org', ticketsSold: 189, status: 'active', minAge: 18, lineup: [{name: 'Solomun', time: '22:00'}, {name: 'Dixon', time: '01:00'}, {name: 'Ame', time: '03:30'}] },
    { id: 'ev3', title: 'Acid Rain', description: 'Acid techno en una bodega industrial abandonada. Maquinas analogicas, luces estroboscopicas y puro underground. Solo para los que entienden.', date: '2026-05-25', time: '00:00', duration: 12, location: 'Bodega Industrial', city: 'Bogota', genre: 'Acid', price: 30, capacity: 400, imageUrl: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=800&q=80', organizerId: 'demo-org', ticketsSold: 203, status: 'active', minAge: 21, lineup: [{name: '999999999', time: '00:00'}, {name: 'Dax J', time: '02:30'}, {name: 'SPFDJ', time: '05:00'}] },
    { id: 'ev4', title: 'Euphoria Festival', description: 'Festival al aire libre de 24 horas. Tres escenarios, food trucks, zona chill, arte interactivo y los mejores artistas de trance y progressive. La experiencia definitiva.', date: '2026-06-02', time: '14:00', duration: 24, location: 'Parque Metropolitano', city: 'Cali', genre: 'Trance', price: 85, capacity: 2000, imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&q=80', organizerId: 'demo-org', ticketsSold: 1256, status: 'active', minAge: 16, pricingMode: 'tiers', tiers: [{name: 'Early Bird', price: '65', qty: '500'}, {name: 'First Release', price: '85', qty: '1000'}, {name: 'Door', price: '120', qty: '500'}], lineup: [{name: 'Armin van Buuren', time: '14:00'}, {name: 'Above & Beyond', time: '17:00'}, {name: 'Paul van Dyk', time: '20:00'}, {name: 'Infected Mushroom', time: '23:00'}, {name: 'Vini Vici', time: '02:00'}] },
    { id: 'ev5', title: 'Minimal Affairs', description: 'Minimal techno en un espacio de galeria de arte. Donde la musica se encuentra con el arte visual contemporaneo. Proyecciones en vivo y sonido envolvente.', date: '2026-06-10', time: '21:00', duration: 6, location: 'Galeria Central', city: 'Bogota', genre: 'Minimal', price: 25, capacity: 200, imageUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80', organizerId: 'demo-org', ticketsSold: 145, status: 'active', minAge: 18, lineup: [{name: 'Ricardo Villalobos', time: '21:00'}, {name: 'Zip', time: '00:00'}] },
    { id: 'ev6', title: 'Dark Matter', description: 'Techno oscuro en un bunker subterraneo. Sin telefonos, sin fotos. Solo tu y el sonido. La experiencia mas pura de techno que encontraras.', date: '2026-06-16', time: '23:30', duration: 10, location: 'Bunker Underground', city: 'Bogota', genre: 'Dark Techno', price: 40, capacity: 350, imageUrl: 'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=800&q=80', organizerId: 'demo-org', ticketsSold: 278, status: 'active', minAge: 21, lineup: [{name: 'Blawan', time: '23:30'}, {name: 'Surgeon', time: '02:00'}, {name: 'Ancient Methods', time: '04:30'}] },
    { id: 'ev7', title: 'Afro Beats & House', description: 'Una fusion de ritmos africanos con house electronico. Percusion en vivo, DJs internacionales y una pista que no para. Celebra la diversidad del sonido.', date: '2026-06-22', time: '20:00', duration: 8, location: 'Terraza del Sol', city: 'Cartagena', genre: 'Afro House', price: 55, capacity: 600, imageUrl: 'https://images.unsplash.com/photo-1504680177321-2e6a879aac86?w=800&q=80', organizerId: 'demo-org', ticketsSold: 312, status: 'active', minAge: 18, lineup: [{name: 'Black Coffee', time: '20:00'}, {name: 'Themba', time: '22:30'}, {name: 'Da Capo', time: '01:00'}] },
    { id: 'ev8', title: 'Sunrise Sessions', description: 'Sesion de melodic techno al amanecer en la montana. Yoga al inicio, musica hasta el mediodia. Conecta con la naturaleza y el sonido.', date: '2026-07-04', time: '05:00', duration: 8, location: 'Cerro de Monserrate', city: 'Bogota', genre: 'Melodic Techno', price: 60, capacity: 250, imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80', organizerId: 'demo-org', ticketsSold: 198, status: 'active', minAge: 16, lineup: [{name: 'Tale Of Us', time: '05:00'}, {name: 'Anyma', time: '08:00'}, {name: 'Colyn', time: '10:30'}] },
    { id: 'ev9', title: 'Bass Culture', description: 'Drum and bass, dubstep y bass music en el venue mas grande de la ciudad. Tres salas, visuales LED y el mejor sistema de sonido.', date: '2026-07-18', time: '21:00', duration: 9, location: 'Arena Centro', city: 'Medellin', genre: 'Drum & Bass', price: 38, capacity: 1500, imageUrl: 'https://images.unsplash.com/photo-1571266028243-3716f02d2d2e?w=800&q=80', organizerId: 'demo-org', ticketsSold: 876, status: 'active', minAge: 18, lineup: [{name: 'Andy C', time: '21:00'}, {name: 'Sub Focus', time: '23:00'}, {name: 'Dimension', time: '01:00'}, {name: 'Netsky', time: '03:00'}] },
  ]
  setStore('events', sampleEvents)

  // Create demo tickets - many ravers bought tickets
  const demoTickets = [
    // Berghain Nights - ev1
    { id: 'tk1', eventId: 'ev1', userId: 'demo-raver', purchaseDate: '2026-04-20T15:30:00.000Z', status: 'valid', qrCode: 'RAVE-BN2026-A7K9M3P2' },
    { id: 'tk2', eventId: 'ev1', userId: 'r2', purchaseDate: '2026-04-18T10:00:00.000Z', status: 'valid', qrCode: 'RAVE-BN2026-C3M8N1X4' },
    { id: 'tk3', eventId: 'ev1', userId: 'r3', purchaseDate: '2026-04-19T14:20:00.000Z', status: 'valid', qrCode: 'RAVE-BN2026-D5P2Q7R9' },
    { id: 'tk4', eventId: 'ev1', userId: 'r5', purchaseDate: '2026-04-21T09:45:00.000Z', status: 'valid', qrCode: 'RAVE-BN2026-F1K6L8W3' },
    { id: 'tk5', eventId: 'ev1', userId: 'r7', purchaseDate: '2026-04-22T16:30:00.000Z', status: 'valid', qrCode: 'RAVE-BN2026-G4N9P2S7' },
    { id: 'tk6', eventId: 'ev1', userId: 'r9', purchaseDate: '2026-04-23T11:15:00.000Z', status: 'valid', qrCode: 'RAVE-BN2026-H8R3T5V1' },
    { id: 'tk7', eventId: 'ev1', userId: 'r11', purchaseDate: '2026-04-24T08:00:00.000Z', status: 'valid', qrCode: 'RAVE-BN2026-J2W6X9Z4' },
    // Deep Connection - ev2
    { id: 'tk8', eventId: 'ev2', userId: 'r2', purchaseDate: '2026-04-15T12:00:00.000Z', status: 'valid', qrCode: 'RAVE-DC2026-A1B3C5D7' },
    { id: 'tk9', eventId: 'ev2', userId: 'r4', purchaseDate: '2026-04-16T18:30:00.000Z', status: 'valid', qrCode: 'RAVE-DC2026-E9F1G3H5' },
    { id: 'tk10', eventId: 'ev2', userId: 'r6', purchaseDate: '2026-04-17T20:00:00.000Z', status: 'valid', qrCode: 'RAVE-DC2026-I7J9K1L3' },
    { id: 'tk11', eventId: 'ev2', userId: 'r8', purchaseDate: '2026-04-18T09:00:00.000Z', status: 'valid', qrCode: 'RAVE-DC2026-M5N7P9Q1' },
    { id: 'tk12', eventId: 'ev2', userId: 'r10', purchaseDate: '2026-04-19T14:45:00.000Z', status: 'valid', qrCode: 'RAVE-DC2026-R3S5T7V9' },
    // Acid Rain - ev3
    { id: 'tk13', eventId: 'ev3', userId: 'r3', purchaseDate: '2026-04-20T10:00:00.000Z', status: 'valid', qrCode: 'RAVE-AR2026-W1X3Y5Z7' },
    { id: 'tk14', eventId: 'ev3', userId: 'r5', purchaseDate: '2026-04-21T15:30:00.000Z', status: 'valid', qrCode: 'RAVE-AR2026-A2B4C6D8' },
    { id: 'tk15', eventId: 'ev3', userId: 'r7', purchaseDate: '2026-04-22T11:00:00.000Z', status: 'valid', qrCode: 'RAVE-AR2026-E0F2G4H6' },
    { id: 'tk16', eventId: 'ev3', userId: 'r12', purchaseDate: '2026-04-23T17:20:00.000Z', status: 'valid', qrCode: 'RAVE-AR2026-I8J0K2L4' },
    // Euphoria Festival - ev4 (most popular)
    { id: 'tk17', eventId: 'ev4', userId: 'demo-raver', purchaseDate: '2026-04-22T10:15:00.000Z', status: 'valid', qrCode: 'RAVE-EF2026-X4R8N1Q5' },
    { id: 'tk18', eventId: 'ev4', userId: 'r2', purchaseDate: '2026-04-10T08:00:00.000Z', status: 'valid', qrCode: 'RAVE-EF2026-M6N8P0Q2' },
    { id: 'tk19', eventId: 'ev4', userId: 'r3', purchaseDate: '2026-04-11T09:30:00.000Z', status: 'valid', qrCode: 'RAVE-EF2026-R4S6T8V0' },
    { id: 'tk20', eventId: 'ev4', userId: 'r4', purchaseDate: '2026-04-12T14:00:00.000Z', status: 'valid', qrCode: 'RAVE-EF2026-W2X4Y6Z8' },
    { id: 'tk21', eventId: 'ev4', userId: 'r5', purchaseDate: '2026-04-13T16:45:00.000Z', status: 'valid', qrCode: 'RAVE-EF2026-A0B2C4D6' },
    { id: 'tk22', eventId: 'ev4', userId: 'r6', purchaseDate: '2026-04-14T11:20:00.000Z', status: 'valid', qrCode: 'RAVE-EF2026-E8F0G2H4' },
    { id: 'tk23', eventId: 'ev4', userId: 'r7', purchaseDate: '2026-04-15T13:00:00.000Z', status: 'valid', qrCode: 'RAVE-EF2026-I6J8K0L2' },
    { id: 'tk24', eventId: 'ev4', userId: 'r8', purchaseDate: '2026-04-16T10:30:00.000Z', status: 'valid', qrCode: 'RAVE-EF2026-M4N6P8Q0' },
    { id: 'tk25', eventId: 'ev4', userId: 'r9', purchaseDate: '2026-04-17T15:15:00.000Z', status: 'valid', qrCode: 'RAVE-EF2026-R2S4T6V8' },
    { id: 'tk26', eventId: 'ev4', userId: 'r10', purchaseDate: '2026-04-18T09:45:00.000Z', status: 'valid', qrCode: 'RAVE-EF2026-W0X2Y4Z6' },
    { id: 'tk27', eventId: 'ev4', userId: 'r11', purchaseDate: '2026-04-19T12:00:00.000Z', status: 'valid', qrCode: 'RAVE-EF2026-A8B0C2D4' },
    { id: 'tk28', eventId: 'ev4', userId: 'r12', purchaseDate: '2026-04-20T17:30:00.000Z', status: 'valid', qrCode: 'RAVE-EF2026-E6F8G0H2' },
    // Minimal Affairs - ev5
    { id: 'tk29', eventId: 'ev5', userId: 'r4', purchaseDate: '2026-04-25T10:00:00.000Z', status: 'valid', qrCode: 'RAVE-MA2026-I4J6K8L0' },
    { id: 'tk30', eventId: 'ev5', userId: 'r6', purchaseDate: '2026-04-26T14:30:00.000Z', status: 'valid', qrCode: 'RAVE-MA2026-M2N4P6Q8' },
    { id: 'tk31', eventId: 'ev5', userId: 'r10', purchaseDate: '2026-04-27T09:15:00.000Z', status: 'valid', qrCode: 'RAVE-MA2026-R0S2T4V6' },
    // Dark Matter - ev6
    { id: 'tk32', eventId: 'ev6', userId: 'demo-raver', purchaseDate: '2026-04-28T11:00:00.000Z', status: 'valid', qrCode: 'RAVE-DM2026-W8X0Y2Z4' },
    { id: 'tk33', eventId: 'ev6', userId: 'r3', purchaseDate: '2026-04-25T16:00:00.000Z', status: 'valid', qrCode: 'RAVE-DM2026-A6B8C0D2' },
    { id: 'tk34', eventId: 'ev6', userId: 'r5', purchaseDate: '2026-04-26T13:30:00.000Z', status: 'valid', qrCode: 'RAVE-DM2026-E4F6G8H0' },
    { id: 'tk35', eventId: 'ev6', userId: 'r8', purchaseDate: '2026-04-27T10:45:00.000Z', status: 'valid', qrCode: 'RAVE-DM2026-I2J4K6L8' },
    { id: 'tk36', eventId: 'ev6', userId: 'r11', purchaseDate: '2026-04-28T15:00:00.000Z', status: 'valid', qrCode: 'RAVE-DM2026-M0N2P4Q6' },
    // Afro Beats - ev7
    { id: 'tk37', eventId: 'ev7', userId: 'demo-raver', purchaseDate: '2026-05-01T10:00:00.000Z', status: 'valid', qrCode: 'RAVE-AB2026-Q1W2E3R4' },
    { id: 'tk38', eventId: 'ev7', userId: 'r2', purchaseDate: '2026-05-02T14:00:00.000Z', status: 'valid', qrCode: 'RAVE-AB2026-T5Y6U7I8' },
    { id: 'tk39', eventId: 'ev7', userId: 'r4', purchaseDate: '2026-05-03T09:30:00.000Z', status: 'valid', qrCode: 'RAVE-AB2026-O9P0A1S2' },
    { id: 'tk40', eventId: 'ev7', userId: 'r6', purchaseDate: '2026-05-04T16:00:00.000Z', status: 'valid', qrCode: 'RAVE-AB2026-D3F4G5H6' },
    { id: 'tk41', eventId: 'ev7', userId: 'r9', purchaseDate: '2026-05-05T11:15:00.000Z', status: 'valid', qrCode: 'RAVE-AB2026-J7K8L9Z0' },
    // Sunrise Sessions - ev8
    { id: 'tk42', eventId: 'ev8', userId: 'r3', purchaseDate: '2026-05-10T08:00:00.000Z', status: 'valid', qrCode: 'RAVE-SS2026-X1C2V3B4' },
    { id: 'tk43', eventId: 'ev8', userId: 'r7', purchaseDate: '2026-05-11T12:30:00.000Z', status: 'valid', qrCode: 'RAVE-SS2026-N5M6Q7W8' },
    { id: 'tk44', eventId: 'ev8', userId: 'r10', purchaseDate: '2026-05-12T15:00:00.000Z', status: 'valid', qrCode: 'RAVE-SS2026-E9R0T1Y2' },
    // Bass Culture - ev9
    { id: 'tk45', eventId: 'ev9', userId: 'r2', purchaseDate: '2026-05-15T10:00:00.000Z', status: 'valid', qrCode: 'RAVE-BC2026-U3I4O5P6' },
    { id: 'tk46', eventId: 'ev9', userId: 'r5', purchaseDate: '2026-05-16T14:30:00.000Z', status: 'valid', qrCode: 'RAVE-BC2026-A7S8D9F0' },
    { id: 'tk47', eventId: 'ev9', userId: 'r8', purchaseDate: '2026-05-17T09:00:00.000Z', status: 'valid', qrCode: 'RAVE-BC2026-G1H2J3K4' },
    { id: 'tk48', eventId: 'ev9', userId: 'r11', purchaseDate: '2026-05-18T16:45:00.000Z', status: 'valid', qrCode: 'RAVE-BC2026-L5Z6X7C8' },
    { id: 'tk49', eventId: 'ev9', userId: 'r12', purchaseDate: '2026-05-19T11:20:00.000Z', status: 'valid', qrCode: 'RAVE-BC2026-V9B0N1M2' },
  ]
  if (getStore('tickets').length === 0) setStore('tickets', demoTickets)

  // Going data
  const demoGoing = [
    { id: 'g1', userId: 'demo-raver', eventId: 'ev1' }, { id: 'g2', userId: 'demo-raver', eventId: 'ev4' }, { id: 'g3', userId: 'demo-raver', eventId: 'ev6' },
    { id: 'g4', userId: 'r2', eventId: 'ev1' }, { id: 'g5', userId: 'r2', eventId: 'ev2' }, { id: 'g6', userId: 'r2', eventId: 'ev4' },
    { id: 'g7', userId: 'r3', eventId: 'ev1' }, { id: 'g8', userId: 'r3', eventId: 'ev3' }, { id: 'g9', userId: 'r3', eventId: 'ev4' }, { id: 'g10', userId: 'r3', eventId: 'ev6' },
    { id: 'g11', userId: 'r4', eventId: 'ev2' }, { id: 'g12', userId: 'r4', eventId: 'ev4' }, { id: 'g13', userId: 'r4', eventId: 'ev5' },
    { id: 'g14', userId: 'r5', eventId: 'ev1' }, { id: 'g15', userId: 'r5', eventId: 'ev3' }, { id: 'g16', userId: 'r5', eventId: 'ev4' }, { id: 'g17', userId: 'r5', eventId: 'ev6' },
    { id: 'g18', userId: 'r6', eventId: 'ev2' }, { id: 'g19', userId: 'r6', eventId: 'ev4' }, { id: 'g20', userId: 'r6', eventId: 'ev5' },
    { id: 'g21', userId: 'r7', eventId: 'ev1' }, { id: 'g22', userId: 'r7', eventId: 'ev3' }, { id: 'g23', userId: 'r7', eventId: 'ev4' },
    { id: 'g24', userId: 'r8', eventId: 'ev2' }, { id: 'g25', userId: 'r8', eventId: 'ev4' }, { id: 'g26', userId: 'r8', eventId: 'ev6' },
    { id: 'g27', userId: 'r9', eventId: 'ev1' }, { id: 'g28', userId: 'r9', eventId: 'ev4' },
    { id: 'g29', userId: 'r10', eventId: 'ev2' }, { id: 'g30', userId: 'r10', eventId: 'ev4' }, { id: 'g31', userId: 'r10', eventId: 'ev5' },
    { id: 'g32', userId: 'r11', eventId: 'ev1' }, { id: 'g33', userId: 'r11', eventId: 'ev4' }, { id: 'g34', userId: 'r11', eventId: 'ev6' },
    { id: 'g35', userId: 'r12', eventId: 'ev3' }, { id: 'g36', userId: 'r12', eventId: 'ev4' },
    { id: 'g37', userId: 'demo-raver', eventId: 'ev7' },
    { id: 'g38', userId: 'r2', eventId: 'ev7' }, { id: 'g39', userId: 'r4', eventId: 'ev7' }, { id: 'g40', userId: 'r6', eventId: 'ev7' }, { id: 'g41', userId: 'r9', eventId: 'ev7' },
    { id: 'g42', userId: 'r3', eventId: 'ev8' }, { id: 'g43', userId: 'r7', eventId: 'ev8' }, { id: 'g44', userId: 'r10', eventId: 'ev8' },
    { id: 'g45', userId: 'r2', eventId: 'ev9' }, { id: 'g46', userId: 'r5', eventId: 'ev9' }, { id: 'g47', userId: 'r8', eventId: 'ev9' }, { id: 'g48', userId: 'r11', eventId: 'ev9' }, { id: 'g49', userId: 'r12', eventId: 'ev9' },
  ]
  if (getStore('going').length === 0) setStore('going', demoGoing)

  // Notifications for demo raver
  const demoNotifs = [
    { id: 'n1', userId: 'demo-raver', type: 'purchase', title: 'Ticket comprado: Berghain Nights', message: 'Tu entrada esta lista. Revisa tu QR en Mis Tickets.', eventId: 'ev1', image: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=200&q=80', read: false, createdAt: '2026-04-20T15:30:00.000Z' },
    { id: 'n2', userId: 'demo-raver', type: 'purchase', title: 'Ticket comprado: Euphoria Festival', message: 'Tu entrada esta lista. Revisa tu QR en Mis Tickets.', eventId: 'ev4', image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=200&q=80', read: false, createdAt: '2026-04-22T10:15:00.000Z' },
    { id: 'n3', userId: 'demo-raver', type: 'purchase', title: 'Ticket comprado: Dark Matter', message: 'Tu entrada esta lista. Revisa tu QR en Mis Tickets.', eventId: 'ev6', image: 'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=200&q=80', read: false, createdAt: '2026-04-28T11:00:00.000Z' },
    { id: 'n4', userId: 'demo-raver', type: 'purchase', title: 'Ticket comprado: Afro Beats & House', message: 'Tu entrada esta lista. Nos vemos en Cartagena!', eventId: 'ev7', image: 'https://images.unsplash.com/photo-1504680177321-2e6a879aac86?w=200&q=80', read: false, createdAt: '2026-05-01T10:00:00.000Z' },
  ]
  if (getStore('notifications').length === 0) setStore('notifications', demoNotifs)
}
