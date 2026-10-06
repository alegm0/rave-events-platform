// End-to-end consistency test against the REAL Firestore project.
//
// It reimplements the exact data-layer logic from src/lib/db.js (createTicket,
// validateTicket, cancelTicket, sumRevenue, getTierStatus...) so it exercises
// the same rules the app relies on, then checks that what a RAVER does stays
// consistent with what an ORGANIZER sees — and vice versa — across screens.
//
// All test data is namespaced with `ctest: true` and deleted at the end, so it
// never mixes with the seeded demo data.
//
//   node scripts/consistency-test.mjs
//
import { readFileSync } from 'node:fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const KEY_PATH = new URL('../rave-platform-firebase-adminsdk-fbsvc-e51b46af1f.json', import.meta.url)
initializeApp({ credential: cert(JSON.parse(readFileSync(KEY_PATH))) })
const db = getFirestore()

// ── tiny test harness ──
let passed = 0, failed = 0
const results = []
const check = (name, cond, detail = '') => {
  if (cond) { passed++; results.push(`  ✓ ${name}`) }
  else { failed++; results.push(`  ✗ ${name}${detail ? `  → ${detail}` : ''}`) }
}
const genId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 11)

// ── reimplemented data-layer helpers (mirror src/lib/db.js) ──
const getEvent = async (id) => {
  const s = await db.collection('events').doc(id).get()
  return s.exists ? { id: s.id, ...s.data() } : null
}
const getTicketsByEvent = async (eventId) =>
  (await db.collection('tickets').where('eventId', '==', eventId).get()).docs.map(d => ({ id: d.id, ...d.data() }))
const getTicketsByUser = async (userId) =>
  (await db.collection('tickets').where('userId', '==', userId).get()).docs.map(d => ({ id: d.id, ...d.data() }))

const hasTiers = (e) => e?.pricingMode === 'tiers' && Array.isArray(e.tiers) && e.tiers.length > 0
const getTierStatus = (event, tickets = null) => {
  if (!hasTiers(event)) return []
  let activeFound = false
  return event.tiers.map((tier, i) => {
    const qty = parseInt(tier.qty) || 0
    const sold = Array.isArray(tickets)
      ? tickets.filter(t => (t.tierName || '') === tier.name).length
      : (event.tierSold?.[tier.name] || 0)
    const remaining = qty > 0 ? Math.max(0, qty - sold) : null
    const soldOut = remaining === 0
    const active = !soldOut && !activeFound
    if (active) activeFound = true
    return { index: i, name: tier.name, price: parseFloat(tier.price) || 0, qty, sold, remaining, soldOut, active }
  })
}
const getActiveTier = (event, tickets = null) => getTierStatus(event, tickets).find(t => t.active) || null
const sumRevenue = (tickets = [], event = null) =>
  tickets.reduce((s, t) => s + (typeof t.pricePaid === 'number' ? t.pricePaid : (event?.price || 0)), 0)

// createTicket — same validation order and writes as db.js
const createTicket = async ({ eventId, userId, tierName }) => {
  if (!eventId || !userId) throw new Error('Datos de compra incompletos')
  const event = await getEvent(eventId)
  if (!event) throw new Error('El evento no existe')
  const existing = await getTicketsByUser(userId)
  if (existing.some(t => t.eventId === eventId)) throw new Error('Ya tienes un ticket para este evento')
  const sold = event.ticketsSold || 0
  const capacity = event.capacity || 0
  if (capacity > 0 && sold >= capacity) throw new Error('El evento está agotado')

  let pricePaid = event.price || 0
  let resolvedTier = null
  if (hasTiers(event)) {
    const active = getActiveTier(event)
    if (!active) throw new Error('No hay fases de precio disponibles')
    if (tierName && tierName !== active.name) throw new Error(`La fase "${tierName}" ya no está disponible.`)
    resolvedTier = active.name
    pricePaid = active.price
  }
  const id = genId()
  const ticket = {
    eventId, userId, id, tierName: resolvedTier, pricePaid,
    purchaseDate: new Date().toISOString(), status: 'valid',
    qrCode: `RAVE-${Date.now()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
    ctest: true,
  }
  await db.collection('tickets').doc(id).set(ticket)
  const counters = { ticketsSold: FieldValue.increment(1) }
  if (resolvedTier) counters.tierSold = { ...(event.tierSold || {}), [resolvedTier]: (event.tierSold?.[resolvedTier] || 0) + 1 }
  await db.collection('events').doc(eventId).update(counters)
  return ticket
}

const validateTicket = async (qrCode, eventId) => {
  const tickets = await getTicketsByEvent(eventId)
  const ticket = tickets.find(t => t.qrCode === qrCode)
  if (!ticket) return { success: false, message: 'Ticket inválido' }
  if (ticket.status === 'used') return { success: false, message: 'Ticket ya utilizado' }
  await db.collection('tickets').doc(ticket.id).update({ status: 'used', usedAt: new Date().toISOString() })
  return { success: true, message: 'Acceso concedido' }
}

const cancelTicket = async (ticketId) => {
  const s = await db.collection('tickets').doc(ticketId).get()
  if (!s.exists) return false
  const ticket = { id: s.id, ...s.data() }
  if (ticket.status === 'used') return false
  await db.collection('tickets').doc(ticketId).delete()
  const event = await getEvent(ticket.eventId)
  if (event) {
    const counters = { ticketsSold: Math.max(0, (event.ticketsSold || 1) - 1) }
    if (ticket.tierName) counters.tierSold = { ...(event.tierSold || {}), [ticket.tierName]: Math.max(0, (event.tierSold?.[ticket.tierName] || 1) - 1) }
    await db.collection('events').doc(ticket.eventId).update(counters)
  }
  return true
}

// ── track created docs for cleanup ──
const created = { users: [], events: [], tickets: [] }

const run = async () => {
  console.log('\n== Test de consistencia (proyecto real, datos aislados con ctest:true) ==\n')

  // Actors
  const orgId = `ctest-org-${genId()}`
  const raverAId = `ctest-raver-a-${genId()}`
  const raverBId = `ctest-raver-b-${genId()}`
  await db.collection('users').doc(orgId).set({ id: orgId, email: `${orgId}@t.com`, displayName: 'Org Test', role: 'organizer', ctest: true })
  await db.collection('users').doc(raverAId).set({ id: raverAId, email: `${raverAId}@t.com`, displayName: 'Raver A', role: 'user', ctest: true })
  await db.collection('users').doc(raverBId).set({ id: raverBId, email: `${raverBId}@t.com`, displayName: 'Raver B', role: 'user', ctest: true })
  created.users.push(orgId, raverAId, raverBId)

  // ── TEST GROUP 1: single-price event, purchase visibility across users ──
  console.log('[1] Evento de precio único — compra visible para el organizador')
  const ev1Id = `ctest-ev1-${genId()}`
  await db.collection('events').doc(ev1Id).set({
    id: ev1Id, title: 'Test Single', organizerId: orgId, price: 50000, capacity: 3,
    pricingMode: 'single', tiers: [], date: '2027-01-01', time: '22:00', ticketsSold: 0,
    genre: 'Techno', status: 'active', ctest: true,
  })
  created.events.push(ev1Id)

  const tA = await createTicket({ eventId: ev1Id, userId: raverAId })
  created.tickets.push(tA.id)

  // Raver side: MyTickets reads getTicketsByUser
  const raverATickets = await getTicketsByUser(raverAId)
  check('El ticket aparece en "Mis Tickets" del raver', raverATickets.some(t => t.eventId === ev1Id))
  check('El precio pagado se registró (pricePaid=50000)', tA.pricePaid === 50000, `pricePaid=${tA.pricePaid}`)

  // Organizer side: Dashboard/Analytics read getTicketsByEvent (doc count)
  const ev1Tickets = await getTicketsByEvent(ev1Id)
  check('El organizador ve 1 ticket vendido (conteo de documentos)', ev1Tickets.length === 1, `count=${ev1Tickets.length}`)

  // CONSISTENCY: counter vs doc count (the dual-source-of-truth check)
  const ev1After = await getEvent(ev1Id)
  check('Consistencia contador ticketsSold == conteo de documentos',
    ev1After.ticketsSold === ev1Tickets.length, `contador=${ev1After.ticketsSold} docs=${ev1Tickets.length}`)

  // Revenue consistency
  check('Ingresos del organizador == suma de pricePaid',
    sumRevenue(ev1Tickets, ev1After) === 50000, `rev=${sumRevenue(ev1Tickets, ev1After)}`)

  // ── TEST GROUP 2: duplicate prevention (RF07) ──
  console.log('\n[2] Prevención de duplicados (RF07)')
  let dupBlocked = false
  try { await createTicket({ eventId: ev1Id, userId: raverAId }) }
  catch (e) { dupBlocked = e.message.includes('Ya tienes un ticket') }
  check('Un raver no puede comprar dos veces el mismo evento', dupBlocked)
  const ev1TicketsAfterDup = await getTicketsByEvent(ev1Id)
  check('El conteo sigue en 1 tras intento de duplicado', ev1TicketsAfterDup.length === 1, `count=${ev1TicketsAfterDup.length}`)

  // ── TEST GROUP 3: capacity limit ──
  console.log('\n[3] Límite de aforo')
  const tB = await createTicket({ eventId: ev1Id, userId: raverBId })
  created.tickets.push(tB.id)
  // capacity is 3, sold is now 2. Add a 3rd distinct raver to hit the limit.
  const raverCId = `ctest-raver-c-${genId()}`
  await db.collection('users').doc(raverCId).set({ id: raverCId, email: `${raverCId}@t.com`, displayName: 'Raver C', role: 'user', ctest: true })
  created.users.push(raverCId)
  const tC = await createTicket({ eventId: ev1Id, userId: raverCId })
  created.tickets.push(tC.id)
  // Now sold == capacity (3). A 4th raver must be rejected.
  const raverDId = `ctest-raver-d-${genId()}`
  await db.collection('users').doc(raverDId).set({ id: raverDId, email: `${raverDId}@t.com`, displayName: 'Raver D', role: 'user', ctest: true })
  created.users.push(raverDId)
  let soldOutBlocked = false
  try { await createTicket({ eventId: ev1Id, userId: raverDId }) }
  catch (e) { soldOutBlocked = e.message.includes('agotado') }
  check('Se rechaza la compra cuando el evento está agotado', soldOutBlocked)
  const ev1Full = await getEvent(ev1Id)
  check('El contador no supera el aforo', ev1Full.ticketsSold <= ev1Full.capacity, `sold=${ev1Full.ticketsSold} cap=${ev1Full.capacity}`)

  // ── TEST GROUP 4: check-in flow, visible to both sides ──
  console.log('\n[4] Check-in (validación QR) y su visibilidad')
  const before = await getTicketsByEvent(ev1Id)
  const checkedInBefore = before.filter(t => t.status === 'used').length
  const res1 = await validateTicket(tA.qrCode, ev1Id)
  check('Primer escaneo del QR concede acceso', res1.success === true, res1.message)
  const res2 = await validateTicket(tA.qrCode, ev1Id)
  check('Segundo escaneo del mismo QR es rechazado (ya usado)', res2.success === false && res2.message.includes('utilizado'))
  const resBad = await validateTicket('RAVE-NO-EXISTE', ev1Id)
  check('Un QR inexistente es inválido', resBad.success === false && resBad.message.includes('inválido'))

  // Organizer scanner stats: checkedIn from doc status
  const afterCheckin = await getTicketsByEvent(ev1Id)
  check('El contador de check-in del organizador sube en 1',
    afterCheckin.filter(t => t.status === 'used').length === checkedInBefore + 1)

  // Raver side: MyTickets should now show that ticket as "used"/asistido
  const raverAAfter = await getTicketsByUser(raverAId)
  const tAused = raverAAfter.find(t => t.id === tA.id)
  check('El raver ve su ticket como "Asistido" (status=used)', tAused?.status === 'used', `status=${tAused?.status}`)

  // ── TEST GROUP 5: tiered pricing consistency ──
  console.log('\n[5] Fases de precio — precio correcto y consistencia de tierSold')
  const ev2Id = `ctest-ev2-${genId()}`
  await db.collection('events').doc(ev2Id).set({
    id: ev2Id, title: 'Test Tiers', organizerId: orgId, price: 30000, capacity: 100,
    pricingMode: 'tiers', tierSold: {},
    tiers: [
      { name: 'Early Bird', price: '30000', qty: '2' },
      { name: 'General', price: '60000', qty: '' },
    ],
    date: '2027-02-01', time: '22:00', ticketsSold: 0, genre: 'House', status: 'active', ctest: true,
  })
  created.events.push(ev2Id)

  // First two buyers get Early Bird
  const teb1 = await createTicket({ eventId: ev2Id, userId: raverAId }); created.tickets.push(teb1.id)
  const teb2 = await createTicket({ eventId: ev2Id, userId: raverBId }); created.tickets.push(teb2.id)
  check('Fase 1 cobra el precio de Early Bird (30000)', teb1.pricePaid === 30000 && teb2.pricePaid === 30000,
    `t1=${teb1.pricePaid} t2=${teb2.pricePaid}`)
  check('Los tickets de fase 1 registran tierName correcto', teb1.tierName === 'Early Bird')

  // Early Bird qty was 2 → now sold out → third buyer rolls to General at 60000
  const tgen = await createTicket({ eventId: ev2Id, userId: raverCId }); created.tickets.push(tgen.id)
  check('Al agotarse la fase, la siguiente se activa (General 60000)', tgen.pricePaid === 60000, `paid=${tgen.pricePaid}`)
  check('El ticket rueda a la fase General', tgen.tierName === 'General', `tier=${tgen.tierName}`)

  // Consistency: event.tierSold (public counter) vs actual ticket docs per tier
  const ev2After = await getEvent(ev2Id)
  const ev2Tickets = await getTicketsByEvent(ev2Id)
  const tierStatusFromDocs = getTierStatus(ev2After, ev2Tickets)
  const earlyFromDocs = tierStatusFromDocs.find(t => t.name === 'Early Bird').sold
  const earlyFromCounter = ev2After.tierSold?.['Early Bird'] || 0
  check('Consistencia tierSold[Early Bird] (contador) == tickets de esa fase (docs)',
    earlyFromCounter === earlyFromDocs, `contador=${earlyFromCounter} docs=${earlyFromDocs}`)
  check('Consistencia ticketsSold total == suma de fases',
    ev2After.ticketsSold === ev2Tickets.length, `sold=${ev2After.ticketsSold} docs=${ev2Tickets.length}`)

  // Revenue with mixed tiers
  check('Ingresos con fases mezcladas == 30000+30000+60000',
    sumRevenue(ev2Tickets, ev2After) === 120000, `rev=${sumRevenue(ev2Tickets, ev2After)}`)

  // ── TEST GROUP 6: cancellation returns the seat (counter consistency) ──
  console.log('\n[6] Cancelación devuelve el cupo')
  const ev2SoldBefore = (await getEvent(ev2Id)).ticketsSold
  const cancelled = await cancelTicket(tgen.id)
  created.tickets = created.tickets.filter(id => id !== tgen.id) // already deleted
  check('Se puede cancelar un ticket válido', cancelled === true)
  const ev2SoldAfter = (await getEvent(ev2Id)).ticketsSold
  check('El contador baja en 1 tras cancelar', ev2SoldAfter === ev2SoldBefore - 1, `antes=${ev2SoldBefore} despues=${ev2SoldAfter}`)
  const ev2TicketsAfterCancel = await getTicketsByEvent(ev2Id)
  check('Consistencia contador == docs tras cancelar', ev2SoldAfter === ev2TicketsAfterCancel.length,
    `contador=${ev2SoldAfter} docs=${ev2TicketsAfterCancel.length}`)
  check('No se puede cancelar un ticket ya usado', (await cancelTicket(tA.id)) === false)

  // ── TEST GROUP 7: ownership / cross-organizer isolation ──
  console.log('\n[7] Aislamiento entre organizadores')
  const org2Id = `ctest-org2-${genId()}`
  await db.collection('users').doc(org2Id).set({ id: org2Id, email: `${org2Id}@t.com`, displayName: 'Org 2', role: 'organizer', ctest: true })
  created.users.push(org2Id)
  const org1Events = (await db.collection('events').where('organizerId', '==', orgId).get()).docs
  const org2Events = (await db.collection('events').where('organizerId', '==', org2Id).get()).docs
  check('El organizador 1 ve solo sus eventos', org1Events.every(d => d.data().organizerId === orgId) && org1Events.length >= 2)
  check('El organizador 2 no ve eventos ajenos', org2Events.length === 0, `count=${org2Events.length}`)

  // ── report ──
  console.log('\n' + results.join('\n'))
  console.log(`\n== Resultado: ${passed} pasaron, ${failed} fallaron ==\n`)
  return failed === 0
}

const cleanup = async () => {
  console.log('Limpiando datos de prueba (ctest:true)...')
  for (const coll of ['tickets', 'events', 'users']) {
    const snap = await db.collection(coll).where('ctest', '==', true).get()
    if (snap.empty) continue
    const batch = db.batch()
    snap.docs.forEach(d => batch.delete(d.ref))
    await batch.commit()
    console.log(`  ${coll}: ${snap.size} eliminados`)
  }
}

let ok = false
try {
  ok = await run()
} catch (err) {
  console.error('\nERROR en la ejecución:', err)
} finally {
  await cleanup()
}
process.exit(ok ? 0 : 1)
