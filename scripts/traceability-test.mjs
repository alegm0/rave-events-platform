// Deep cross-role traceability test against the REAL Firestore project.
//
// Goal: prove that what an ORGANIZER defines is exactly what a RAVER sees, and
// that the venue/accessibility experience layer resolves per-person. It also
// probes the known gaps (dead comfort prefs, venue-authored immunity to
// backfill, per-tier consistency) so the thesis review is honest about them.
//
// Uses the same pure functions as the app (copied from src/lib/venue.js) and
// the same data-layer logic (createTicket/validateTicket). All data is flagged
// `ttest: true` and deleted at the end.
//
//   node scripts/traceability-test.mjs
//
import { readFileSync } from 'node:fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const KEY = new URL('../rave-platform-firebase-adminsdk-fbsvc-e51b46af1f.json', import.meta.url)
initializeApp({ credential: cert(JSON.parse(readFileSync(KEY))) })
const db = getFirestore()

let passed = 0, failed = 0, warned = 0
const results = []
const ok = (n, c, d = '') => { if (c) { passed++; results.push(`  ✓ ${n}`) } else { failed++; results.push(`  ✗ ${n}${d ? `  → ${d}` : ''}`) } }
const warn = (n, d = '') => { warned++; results.push(`  ⚠ ${n}${d ? `  → ${d}` : ''}`) }
const genId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 11)

// ── pure venue functions copied verbatim from src/lib/venue.js ──
const PREF_TO_SERVICE = {
  stepFree: { serviceTypes: ['entrance'], accessibleOnly: true, reason: 'Rutas sin escalones' },
  accessibleToilets: { serviceTypes: ['toilet'], accessibleOnly: true, reason: 'Baños accesibles' },
  restAreas: { serviceTypes: ['rest'], accessibleOnly: false, reason: 'Zonas de descanso' },
  quieterAreas: { serviceTypes: [], zoneTypes: ['quiet'], reason: 'Zonas tranquilas' },
}
const findServices = (venue, type, accessibleOnly = false) =>
  (venue?.services || []).filter((s) => s.type === type && (!accessibleOnly || s.accessible))
const resolveDestination = (venue, type, comfortProfile = {}) => {
  const all = findServices(venue, type)
  if (all.length === 0) return null
  const wantsAccessible =
    (type === 'toilet' && comfortProfile.accessibleToilets) ||
    (type === 'entrance' && comfortProfile.stepFree) ||
    (type === 'exit' && comfortProfile.stepFree)
  if (wantsAccessible) {
    const acc = all.find((s) => s.accessible)
    if (acc) return { service: acc, reason: type === 'toilet' ? 'Baño accesible' : 'Ruta sin escalones', stepFree: true }
  }
  return { service: all[0], reason: null, stepFree: !!all[0].accessible }
}
const getHighlights = (venue, comfortProfile = {}) => {
  const serviceIds = new Set(), zoneIds = new Set(), reasons = new Set()
  if (!venue) return { serviceIds, zoneIds, reasons: [] }
  Object.entries(comfortProfile).forEach(([key, on]) => {
    if (!on) return
    const rule = PREF_TO_SERVICE[key]
    if (!rule) return
    ;(venue.services || []).forEach((s) => {
      if (!rule.serviceTypes?.includes(s.type)) return
      if (rule.accessibleOnly && !s.accessible) return
      serviceIds.add(s.id); reasons.add(rule.reason)
    })
    ;(venue.zones || []).forEach((z) => {
      if (!rule.zoneTypes?.includes(z.type)) return
      zoneIds.add(z.id); reasons.add(rule.reason)
    })
  })
  return { serviceIds, zoneIds, reasons: [...reasons] }
}

// ── data-layer logic (mirror db.js) ──
const getEvent = async (id) => { const s = await db.collection('events').doc(id).get(); return s.exists ? { id: s.id, ...s.data() } : null }
const getTicketsByEvent = async (eid) => (await db.collection('tickets').where('eventId', '==', eid).get()).docs.map(d => ({ id: d.id, ...d.data() }))
const getEvents = async () => (await db.collection('events').get()).docs.map(d => ({ id: d.id, ...d.data() }))
const isGoing = async (uid, eid) => !(await db.collection('going').where('userId', '==', uid).where('eventId', '==', eid).get()).empty
const getNotifs = async (uid) => (await db.collection('notifications').where('userId', '==', uid).get()).docs.map(d => d.data())
const getReviews = async (eid) => (await db.collection('reviews').where('eventId', '==', eid).get()).docs.map(d => d.data())

const hasTiers = (e) => e?.pricingMode === 'tiers' && Array.isArray(e.tiers) && e.tiers.length > 0
const getTierStatus = (event, tickets = null) => {
  if (!hasTiers(event)) return []
  let found = false
  return event.tiers.map((tier, i) => {
    const qty = parseInt(tier.qty) || 0
    const sold = Array.isArray(tickets) ? tickets.filter(t => (t.tierName || '') === tier.name).length : (event.tierSold?.[tier.name] || 0)
    const remaining = qty > 0 ? Math.max(0, qty - sold) : null
    const soldOut = remaining === 0
    const active = !soldOut && !found
    if (active) found = true
    return { name: tier.name, price: parseFloat(tier.price) || 0, sold, remaining, soldOut, active }
  })
}
const getActiveTier = (e, t = null) => getTierStatus(e, t).find(x => x.active) || null

const createTicket = async ({ eventId, userId, tierName }) => {
  const event = await getEvent(eventId)
  const existing = (await db.collection('tickets').where('userId', '==', userId).get()).docs.map(d => d.data())
  if (existing.some(t => t.eventId === eventId)) throw new Error('Ya tienes un ticket para este evento')
  if ((event.capacity || 0) > 0 && (event.ticketsSold || 0) >= event.capacity) throw new Error('El evento está agotado')
  let pricePaid = event.price || 0, resolvedTier = null
  if (hasTiers(event)) {
    const active = getActiveTier(event)
    if (!active) throw new Error('No hay fases disponibles')
    if (tierName && tierName !== active.name) throw new Error('Fase no disponible')
    resolvedTier = active.name; pricePaid = active.price
  }
  const id = genId()
  const ticket = { eventId, userId, id, tierName: resolvedTier, pricePaid, purchaseDate: new Date().toISOString(), status: 'valid', qrCode: `RAVE-${Date.now()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`, ttest: true }
  await db.collection('tickets').doc(id).set(ticket)
  const counters = { ticketsSold: FieldValue.increment(1) }
  if (resolvedTier) counters.tierSold = { ...(event.tierSold || {}), [resolvedTier]: (event.tierSold?.[resolvedTier] || 0) + 1 }
  await db.collection('events').doc(eventId).update(counters)
  return ticket
}
const markGoing = async (uid, eid) => { await db.collection('going').doc(genId()).set({ id: genId(), userId: uid, eventId: eid, ttest: true }) }
const addNotification = async (uid, n) => { const id = genId(); await db.collection('notifications').doc(id).set({ id, userId: uid, read: false, createdAt: new Date().toISOString(), ttest: true, ...n }) }
const validateTicket = async (qr, eid) => {
  const t = (await getTicketsByEvent(eid)).find(x => x.qrCode === qr)
  if (!t) return { success: false }
  if (t.status === 'used') return { success: false }
  await db.collection('tickets').doc(t.id).update({ status: 'used', usedAt: new Date().toISOString() })
  return { success: true }
}
const addReview = async (uid, eid, rating, text) => {
  const dup = (await db.collection('reviews').where('userId', '==', uid).where('eventId', '==', eid).get())
  if (!dup.empty) return null
  const id = genId(); await db.collection('reviews').doc(id).set({ id, userId: uid, eventId: eid, rating, text, createdAt: new Date().toISOString(), ttest: true }); return id
}

const run = async () => {
  console.log('\n== Test PROFUNDO de trazabilidad organizador ↔ raver (datos ttest:true) ==\n')

  const orgId = `ttest-org-${genId()}`
  const raverId = `ttest-raver-${genId()}`
  // Raver with accessibility needs turned on
  await db.collection('users').doc(orgId).set({ id: orgId, email: `${orgId}@t.com`, displayName: 'Org Traza', role: 'organizer', brand: { name: 'Colectivo Traza', bio: 'test', city: 'Bogotá' }, ttest: true })
  await db.collection('users').doc(raverId).set({
    id: raverId, email: `${raverId}@t.com`, displayName: 'Raver Traza', role: 'user',
    comfortProfile: { stepFree: true, accessibleToilets: true, quieterAreas: true, restAreas: true, simpleNavigation: true, minimalText: true },
    ttest: true,
  })

  // Organizer authors an event WITH a full venue (zones, services, accessibility)
  console.log('[A] El organizador define un evento completo (con venue autorizado)')
  const evId = `ttest-ev-${genId()}`
  const authoredVenue = {
    kind: 'custom', layout: 'indoor', setting: 'Bodega de prueba · 2 escenarios',
    zones: [
      { id: 'main', label: 'Main Stage', type: 'stage', x: 6, y: 8, w: 88, h: 34 },
      { id: 'quiet1', label: 'Zona Chill', type: 'quiet', x: 6, y: 46, w: 42, h: 34 },
    ],
    services: [
      { id: 'gate-norm', type: 'entrance', label: 'Entrada con escaleras', x: 20, y: 90, accessible: false, walkMin: 0 },
      { id: 'gate-acc', type: 'entrance', label: 'Entrada sin escalones', x: 40, y: 90, accessible: true, walkMin: 1 },
      { id: 'wc-norm', type: 'toilet', label: 'Baños', x: 18, y: 60, accessible: false, walkMin: 2 },
      { id: 'wc-acc', type: 'toilet', label: 'Baño accesible', x: 84, y: 60, accessible: true, walkMin: 3 },
      { id: 'water1', type: 'water', label: 'Agua', x: 62, y: 30, walkMin: 2 },
      { id: 'rest1', type: 'rest', label: 'Descanso', x: 71, y: 68, accessible: true, walkMin: 4 },
      { id: 'exit1', type: 'exit', label: 'Salida', x: 64, y: 90, walkMin: 3 },
    ],
    knowBeforeYouGo: ['Trae documento', 'Sin guardarropa'],
  }
  await db.collection('events').doc(evId).set({
    id: evId, title: 'Evento Traza', organizerId: orgId, price: 40000, capacity: 5,
    pricingMode: 'tiers', tierSold: {},
    tiers: [{ name: 'Early Bird', price: '40000', qty: '2' }, { name: 'General', price: '70000', qty: '' }],
    date: '2027-05-01', time: '22:00', ticketsSold: 0, genre: 'Techno', status: 'active',
    lineup: [{ name: 'DJ Uno', time: '22:00' }, { name: 'DJ Dos', time: '00:00' }],
    venue: authoredVenue, venueAuthored: true, venueVersion: 4, ttest: true,
  })

  // ── TRACE 1: publish → raver listing ──
  console.log('\n[B] Trazabilidad: publicar → el raver lo ve en el listado')
  const listed = (await getEvents()).find(e => e.id === evId)
  ok('El evento publicado aparece en el listado público (getEvents)', !!listed)
  ok('El raver ve el mismo line-up que definió el organizador',
    listed.lineup?.length === 2 && listed.lineup[0].name === 'DJ Uno')
  ok('El raver ve el mismo venue autorizado (no una plantilla adivinada)',
    listed.venueAuthored === true && listed.venue?.setting === 'Bodega de prueba · 2 escenarios')

  // ── TRACE 2: venue backfill immunity ──
  console.log('\n[C] El backfill NO sobreescribe un venue autorizado')
  const stale = (!listed.venueAuthored && (!listed.venue || (listed.venueVersion || 1) < 4))
  ok('El evento con venueAuthored=true es inmune al backfill', stale === false)

  // ── TRACE 3: accessibility resolves per-person ──
  console.log('\n[D] Accesibilidad: mismo venue, distinta info por persona')
  const comfort = (await db.collection('users').doc(raverId).get()).data().comfortProfile
  const entrance = resolveDestination(authoredVenue, 'entrance', comfort)
  ok('Raver con stepFree=true es dirigido a la entrada SIN escalones',
    entrance?.service.id === 'gate-acc', `dio=${entrance?.service.id}`)
  const toilet = resolveDestination(authoredVenue, 'toilet', comfort)
  ok('Raver con accessibleToilets=true es dirigido al baño accesible',
    toilet?.service.id === 'wc-acc', `dio=${toilet?.service.id}`)
  // A raver WITHOUT prefs gets the first (non-accessible) option
  const entranceNoPref = resolveDestination(authoredVenue, 'entrance', {})
  ok('Raver sin preferencias es dirigido a la primera entrada (comportamiento distinto)',
    entranceNoPref?.service.id === 'gate-norm', `dio=${entranceNoPref?.service.id}`)
  const hl = getHighlights(authoredVenue, comfort)
  ok('El mapa resalta la entrada accesible, el baño accesible, descanso y zona quiet',
    hl.serviceIds.has('gate-acc') && hl.serviceIds.has('wc-acc') && hl.serviceIds.has('rest1') && hl.zoneIds.has('quiet1'))
  ok('El mapa NO resalta la entrada con escaleras para este raver', !hl.serviceIds.has('gate-norm'))

  // ── GAP CHECK: dead comfort prefs ──
  console.log('\n[E] Revisión de huecos conocidos (se reportan como advertencia)')
  const consumed = Object.keys(PREF_TO_SERVICE)
  const deadPrefs = ['simpleNavigation', 'minimalText'].filter(p => !consumed.includes(p))
  if (deadPrefs.length) warn(`Preferencias que el raver puede activar pero ningún mapa usa: ${deadPrefs.join(', ')}`,
    'considerar implementarlas o quitarlas del perfil')

  // ── TRACE 4: purchase → going + notification + organizer visibility ──
  console.log('\n[F] Trazabilidad de compra: raver compra → organizador y raver lo ven')
  const t1 = await createTicket({ eventId: evId, userId: raverId, tierName: 'Early Bird' })
  await markGoing(raverId, evId)
  await addNotification(raverId, { type: 'purchase', title: 'Ticket comprado: Evento Traza', eventId: evId })
  ok('La compra cobró el precio de Early Bird (40000)', t1.pricePaid === 40000, `paid=${t1.pricePaid}`)
  ok('El raver queda marcado como "va" al evento (going)', await isGoing(raverId, evId))
  const notifs = await getNotifs(raverId)
  ok('El raver recibe la notificación de compra', notifs.some(n => n.type === 'purchase' && n.eventId === evId))
  const orgSees = await getTicketsByEvent(evId)
  ok('El organizador ve el ticket del raver (getTicketsByEvent)', orgSees.length === 1)
  const evAfterBuy = await getEvent(evId)
  ok('Consistencia: contador ticketsSold == documentos de ticket', evAfterBuy.ticketsSold === orgSees.length,
    `contador=${evAfterBuy.ticketsSold} docs=${orgSees.length}`)

  // ── TRACE 5: check-in → raver sees "used" + LiveOps counts it ──
  console.log('\n[G] Trazabilidad de check-in: organizador valida → raver ve "usado"')
  const res = await validateTicket(t1.qrCode, evId)
  ok('El organizador valida el QR con éxito', res.success)
  const raverTicket = (await getTicketsByEvent(evId)).find(t => t.id === t1.id)
  ok('El raver ve su ticket como "usado" (visible en Mi Ticket)', raverTicket.status === 'used')
  const insideCount = (await getTicketsByEvent(evId)).filter(t => t.status === 'used').length
  ok('LiveOps del organizador contaría 1 persona "dentro"', insideCount === 1, `dentro=${insideCount}`)

  // ── TRACE 6: reviews only after the event, and shown to organizer analytics ──
  console.log('\n[H] Reseñas: el raver reseña → el organizador la ve en analytics')
  const rid = await addReview(raverId, evId, 5, 'Brutal, sonido impecable')
  ok('El raver puede publicar una reseña', !!rid)
  const dup = await addReview(raverId, evId, 4, 'otra vez')
  ok('No puede reseñar dos veces el mismo evento', dup === null)
  const evReviews = await getReviews(evId)
  ok('La reseña del raver es visible para el organizador (analytics)', evReviews.length === 1 && evReviews[0].rating === 5)

  // ── TRACE 7: tier roll-over consistency across roles ──
  console.log('\n[I] Fases: al agotar Early Bird, todos ven General')
  const r2 = `ttest-r2-${genId()}`, r3 = `ttest-r3-${genId()}`
  await db.collection('users').doc(r2).set({ id: r2, email: `${r2}@t.com`, displayName: 'R2', role: 'user', ttest: true })
  await db.collection('users').doc(r3).set({ id: r3, email: `${r3}@t.com`, displayName: 'R3', role: 'user', ttest: true })
  const t2 = await createTicket({ eventId: evId, userId: r2 }) // 2nd Early Bird (qty=2)
  ok('Segundo ticket aún es Early Bird', t2.pricePaid === 40000, `paid=${t2.pricePaid}`)
  const t3 = await createTicket({ eventId: evId, userId: r3 }) // Early Bird agotado → General
  ok('Tercer ticket rueda a General (70000) para el raver', t3.pricePaid === 70000, `paid=${t3.pricePaid}`)
  const evFinal = await getEvent(evId)
  const ticketsFinal = await getTicketsByEvent(evId)
  const tierFromCounter = getTierStatus(evFinal).find(t => t.name === 'Early Bird').sold
  const tierFromDocs = getTierStatus(evFinal, ticketsFinal).find(t => t.name === 'Early Bird').sold
  ok('Consistencia: fase vendida por contador == por documentos (organizador vs público)',
    tierFromCounter === tierFromDocs, `contador=${tierFromCounter} docs=${tierFromDocs}`)

  // report
  console.log('\n' + results.join('\n'))
  console.log(`\n== Resultado: ${passed} pasaron, ${failed} fallaron, ${warned} advertencias ==\n`)
  return failed === 0
}

const cleanup = async () => {
  console.log('Limpiando datos de prueba (ttest:true)...')
  for (const coll of ['tickets', 'events', 'users', 'going', 'notifications', 'reviews']) {
    const snap = await db.collection(coll).where('ttest', '==', true).get()
    if (snap.empty) continue
    const batch = db.batch()
    snap.docs.forEach(d => batch.delete(d.ref))
    await batch.commit()
    console.log(`  ${coll}: ${snap.size} eliminados`)
  }
}

let success = false
try { success = await run() }
catch (e) { console.error('\nERROR:', e) }
finally { await cleanup() }
process.exit(success ? 0 : 1)
