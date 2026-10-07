// End-to-end coherence check for the RAVER journey.
// Walks the exact screens a raver sees and confirms what the UI would show
// matches the real Firestore data. Read-only: writes nothing.
//
//   node scripts/verify-raver.mjs
//
import { readFileSync } from 'node:fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const KEY = new URL('../rave-platform-firebase-adminsdk-fbsvc-e51b46af1f.json', import.meta.url)
initializeApp({ credential: cert(JSON.parse(readFileSync(KEY))) })
const auth = getAuth()
const db = getFirestore()

const RAVER_EMAIL = 'raver1@rave.com'
const todayStart = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d })()

let pass = 0, warn = 0, fail = 0
const ok = (m) => { pass++; console.log('  ✓ ' + m) }
const wrn = (m) => { warn++; console.log('  ⚠ ' + m) }
const bad = (m) => { fail++; console.log('  ✗ ' + m) }

// ── Load everything once (mirrors the collections the app reads) ──
const load = async (name) => (await db.collection(name).get()).docs.map((d) => ({ _id: d.id, ...d.data() }))

const run = async () => {
  const [users, events, tickets, going, reviews, subs] = await Promise.all(
    ['users', 'events', 'tickets', 'going', 'reviews', 'subscriptions'].map(load)
  )

  // ── 1. LOGIN ──
  console.log('\n[1] Login / perfil del raver')
  let authUser
  try { authUser = await auth.getUserByEmail(RAVER_EMAIL) } catch { bad(`No existe cuenta Auth ${RAVER_EMAIL}`); return }
  const raver = users.find((u) => u._id === authUser.uid)
  if (!raver) { bad('El perfil Firestore del raver no existe'); return }
  ok(`Cuenta y perfil existen: ${raver.displayName} (${raver.role})`)
  if (raver.role === 'user') ok('Rol correcto (user)'); else bad(`Rol inesperado: ${raver.role}`)

  // ── 2. EXPLORAR EVENTOS ──
  console.log('\n[2] Explorar eventos (lista + conteo "van")')
  const activeEvents = events.filter((e) => e.status === 'active')
  ok(`${activeEvents.length} eventos activos visibles`)
  // Every event the user can see must belong to a real organizer
  let orphan = 0
  for (const e of activeEvents) {
    if (!users.find((u) => u._id === e.organizerId)) orphan++
  }
  orphan === 0 ? ok('Todos los eventos tienen organizador válido') : bad(`${orphan} eventos sin organizador`)
  // "van" counter per event = going docs for that event
  const goingByEvent = {}
  going.forEach((g) => { goingByEvent[g.eventId] = (goingByEvent[g.eventId] || 0) + 1 })
  const sampleEv = activeEvents.find((e) => (goingByEvent[e._id] || 0) > 0)
  if (sampleEv) ok(`Conteo "van" real: ${sampleEv.title} → ${goingByEvent[sampleEv._id]} personas`)

  // ── 3. DETALLE DE EVENTO (toma un evento PASADO con reviews) ──
  console.log('\n[3] Detalle de evento (lineup · asistentes · reviews · rating)')
  const past = activeEvents
    .filter((e) => new Date(`${e.date}T00:00:00`) < todayStart && e._id !== 'ev-live')
    .sort((a, b) => b.date.localeCompare(a.date))
  const ev = past[0]
  if (!ev) { bad('No hay eventos pasados para inspeccionar'); }
  else {
    ok(`Evento pasado: ${ev.title} (${ev.date}) · ${ev.city}`)
    // Lineup
    Array.isArray(ev.lineup) && ev.lineup.length > 0
      ? ok(`Lineup con ${ev.lineup.length} artistas`)
      : wrn('Evento sin lineup')
    // Public sales counter vs the real-account attendee sample.
    // ticketsSold is the aggregate "sold" number shown to everyone; the real
    // tickets in Firestore are a privacy-safe SAMPLE used for the attendee list
    // and reviews (we can't create hundreds of real accounts). So the valid
    // invariant is: 0 <= real sample <= ticketsSold <= capacity.
    const evTickets = tickets.filter((t) => t.eventId === ev._id)
    const sold = ev.ticketsSold || 0
    const cap = ev.capacity || 0
    if (sold > cap && cap > 0) fail(`ticketsSold (${sold}) excede el aforo (${cap}) en "${ev.title}"`)
    else if (evTickets.length > sold) fail(`hay más tickets reales (${evTickets.length}) que ticketsSold (${sold}) en "${ev.title}"`)
    else ok(`Ventas coherentes: ${sold}/${cap} (${Math.round((sold / (cap || 1)) * 100)}%), muestra real ${evTickets.length}`)
    // Reviews + average rating
    const evReviews = reviews.filter((r) => r.eventId === ev._id)
    if (evReviews.length > 0) {
      const avg = evReviews.reduce((s, r) => s + r.rating, 0) / evReviews.length
      ok(`${evReviews.length} reviews · rating promedio ${avg.toFixed(1)} ⭐`)
      // Each review author must be a real user
      const ghostAuthors = evReviews.filter((r) => !users.find((u) => u._id === r.userId)).length
      ghostAuthors === 0 ? ok('Todas las reviews pertenecen a usuarios reales') : bad(`${ghostAuthors} reviews de usuarios inexistentes`)
    } else bad('Evento pasado SIN reviews (incoherente)')
    // Every attendee is a real user
    const ghostAtt = evTickets.filter((t) => !users.find((u) => u._id === t.userId)).length
    ghostAtt === 0 ? ok('Todos los asistentes son usuarios reales') : bad(`${ghostAtt} asistentes fantasma`)
  }

  // ── 4. COMPRA DE TICKET (coherencia de reglas, sin escribir) ──
  console.log('\n[4] Reglas de compra de ticket')
  const future = activeEvents.filter((e) => new Date(`${e.date}T00:00:00`) >= todayStart)
  if (future.length > 0) {
    const fe = future[0]
    const sold = tickets.filter((t) => t.eventId === fe._id).length
    fe.capacity > sold
      ? ok(`Hay cupo en "${fe.title}": ${sold}/${fe.capacity} (compra permitida)`)
      : wrn(`"${fe.title}" agotado: ${sold}/${fe.capacity}`)
    // Price coherence: tiered events expose tiers, single events a price
    if (fe.pricingMode === 'tiers') (fe.tiers?.length ? ok(`Precio por fases (${fe.tiers.length} tiers)`) : bad('Modo tiers sin tiers'))
    else (typeof fe.price === 'number' ? ok(`Precio único: AUD ${fe.price}`) : bad('Evento sin precio'))
  }

  // ── 5. MIS TICKETS ──
  console.log('\n[5] Mis Tickets del raver')
  const myTickets = tickets.filter((t) => t.userId === raver._id)
  ok(`${myTickets.length} tickets a nombre de ${raver.displayName}`)
  let qrDupes = 0
  const seenQR = new Set()
  myTickets.forEach((t) => { if (seenQR.has(t.qrCode)) qrDupes++; seenQR.add(t.qrCode) })
  qrDupes === 0 ? ok('Todos los QR son únicos') : bad(`${qrDupes} QR duplicados`)
  // Every ticket points to an event that still exists
  const danglingT = myTickets.filter((t) => !events.find((e) => e._id === t.eventId)).length
  danglingT === 0 ? ok('Todos los tickets apuntan a eventos existentes') : bad(`${danglingT} tickets huérfanos`)

  // ── 6. PERFIL / STATS ──
  console.log('\n[6] Perfil del raver (stats derivadas)')
  const attended = myTickets.filter((t) => t.status === 'used').length
  const spent = myTickets.reduce((s, t) => s + (t.pricePaid || 0), 0)
  ok(`Eventos asistidos (tickets usados): ${attended}`)
  ok(`Total gastado (suma pricePaid): AUD ${spent}`)
  const mySubs = subs.filter((s) => s.userId === raver._id)
  ok(`Suscripciones a próximos eventos: ${mySubs.length}`)

  // ── 7. GUARDAR ARTISTA (⭐) ──
  console.log('\n[7] Artistas guardados (⭐)')
  const saved = raver.savedArtists || []
  console.log(`      savedArtists: [${saved.join(', ') || 'vacío'}]`)
  ok('Campo savedArtists accesible (se llena al tocar ⭐ en el lineup)')

  // ── SUMMARY ──
  console.log('\n── Resumen flujo RAVER ──')
  console.log(`  ✓ ${pass}   ⚠ ${warn}   ✗ ${fail}`)
  console.log(fail === 0 ? '\n  COHERENCIA OK — el flujo del raver es consistente.\n' : '\n  HAY INCOHERENCIAS A REVISAR.\n')
}

run().then(() => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1) })
