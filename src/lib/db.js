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

  const sampleEvents = [
    { id: 'ev1', title: 'Berghain Nights', description: 'Una noche de techno industrial en el warehouse más icónico. Sonido envolvente, visuales inmersivos y la mejor selección de DJs underground.', date: '2026-04-12', time: '23:00', location: 'Warehouse District', genre: 'techno', price: 25, capacity: 500, imageUrl: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&q=80', organizerId: 'demo-org', ticketsSold: 127, status: 'active', lineup: ['Amelie Lens', 'FJAAK', 'Kobosil'] },
    { id: 'ev2', title: 'Deep Connection', description: 'Sesión de deep house en un club subterráneo. Ambiente íntimo, sonido cristalino y una comunidad que vive la música.', date: '2026-04-18', time: '22:00', location: 'Club Subterráneo', genre: 'house', price: 20, capacity: 300, imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80', organizerId: 'demo-org', ticketsSold: 89, status: 'active', lineup: ['Solomun', 'Dixon'] },
    { id: 'ev3', title: 'Acid Rain', description: 'Acid techno en una bodega industrial abandonada. Máquinas analógicas, luces estroboscópicas y puro underground.', date: '2026-04-25', time: '00:00', location: 'Bodega Industrial', genre: 'techno', price: 30, capacity: 400, imageUrl: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=800&q=80', organizerId: 'demo-org', ticketsSold: 203, status: 'active' },
    { id: 'ev4', title: 'Euphoria Festival', description: 'Festival al aire libre de 12 horas. Tres escenarios, food trucks, zona chill y los mejores artistas de trance.', date: '2026-05-02', time: '14:00', location: 'Open Air Park', genre: 'trance', price: 45, capacity: 2000, imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&q=80', organizerId: 'demo-org', ticketsSold: 856, status: 'active', duration: 12 },
    { id: 'ev5', title: 'Minimal Affairs', description: 'Minimal techno en un espacio de galería de arte. Donde la música se encuentra con el arte visual contemporáneo.', date: '2026-05-10', time: '21:00', location: 'Gallery Space', genre: 'house', price: 15, capacity: 200, imageUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80', organizerId: 'demo-org', ticketsSold: 45, status: 'active' },
    { id: 'ev6', title: 'Dark Matter', description: 'Techno oscuro en un bunker subterráneo. Sin teléfonos, sin fotos. Solo tú y el sonido.', date: '2026-05-16', time: '23:30', location: 'Underground Bunker', genre: 'techno', price: 35, capacity: 350, imageUrl: 'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=800&q=80', organizerId: 'demo-org', ticketsSold: 178, status: 'active', duration: 10 },
  ]
  setStore('events', sampleEvents)
}
