// Realistic, fully-traceable sales for a DEMO (hundreds, not thousands).
//
// Previous approach inflated ticketsSold as a public counter while keeping only
// ~40 real tickets. That broke Analytics/LiveOps, which count REAL tickets, so
// those screens showed "5% sold" again. Two sources of truth fighting.
//
// New approach (what the user asked for): small, believable venues (≈100-cap)
// and REAL tickets that match. ticketsSold == real tickets == what every screen
// counts. A show with 42/50 reads as a 84% success everywhere, and it's true.
//
// Constraint: we only have ~40 real raver accounts, and a raver can't buy the
// same event twice. So max real tickets per event ≈ 40. We size venues around
// that (50-140) so the sell-through looks healthy and consistent.
//
//   node scripts/fix-sales.mjs
//
import { readFileSync } from 'node:fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const KEY = new URL('../rave-platform-firebase-adminsdk-fbsvc-e51b46af1f.json', import.meta.url)
initializeApp({ credential: cert(JSON.parse(readFileSync(KEY))) })
const db = getFirestore()

const genId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 11)
const pick = (a) => a[Math.floor(Math.random() * a.length)]
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const sample = (a, n) => [...a].sort(() => Math.random() - 0.5).slice(0, n)

// We only have ~40 real raver accounts, so real tickets per event cap at ~40.
// Instead of fixing capacity and getting silly percentages, we DERIVE capacity
// from the ticket count and the target sell-through, so every event reads as a
// believable, successful, fully-traceable show (tickets == ticketsSold).

const run = async () => {
  const [eventsSnap, usersSnap, ticketsSnap] = await Promise.all([
    db.collection('events').get(),
    db.collection('users').get(),
    db.collection('tickets').get(),
  ])

  const ravers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => u.role === 'user')
  const now = new Date()

  // Index existing tickets per event (to top up / trim toward the target)
  const ticketsByEvent = {}
  ticketsSnap.docs.forEach((d) => {
    const t = { _ref: d.ref, ...d.data() }
    ;(ticketsByEvent[t.eventId] ||= []).push(t)
  })

  let created = 0, trimmed = 0, eventsDone = 0
  const summary = []

  for (const docSnap of eventsSnap.docs) {
    const e = docSnap.data()
    if (e.status !== 'active' || e.id === 'ev-live') continue

    const past = new Date(`${e.date}T00:00:00`) < now
    const daysAway = Math.ceil((new Date(e.date) - now) / 86400000)

    // How many REAL tickets this event will have (capped by raver pool).
    let target
    if (past) target = randInt(32, 40)              // past: nearly full house
    else if (daysAway <= 30) target = randInt(26, 38) // soon: filling fast
    else if (daysAway <= 120) target = randInt(16, 28) // mid: steady
    else target = randInt(8, 18)                     // far: just announced
    target = Math.min(target, ravers.length)

    // Target sell-through, then DERIVE capacity so the % looks right.
    let frac
    if (past) frac = randInt(82, 96) / 100
    else if (daysAway <= 30) frac = randInt(60, 85) / 100
    else if (daysAway <= 120) frac = randInt(35, 60) / 100
    else frac = randInt(15, 35) / 100
    // capacity = tickets / sell-through, rounded to a tidy number >= target
    let capacity = Math.max(target + 2, Math.round(target / frac))
    // round capacity up to a nice venue-ish number
    capacity = Math.ceil(capacity / 10) * 10

    const existing = ticketsByEvent[e.id] || []
    const buyersWithTicket = new Set(existing.map((t) => t.userId))

    const batch = db.batch()

    // Top up: add real tickets from ravers who don't have one yet for this event
    if (existing.length < target) {
      const available = ravers.filter((r) => !buyersWithTicket.has(r.id))
      const toAdd = sample(available, target - existing.length)
      const tier = e.pricingMode === 'tiers' && e.tiers?.length ? e.tiers[0] : null
      for (const person of toAdd) {
        const tid = genId()
        const used = past ? Math.random() < 0.82 : false
        batch.set(db.collection('tickets').doc(tid), {
          id: tid, eventId: e.id, userId: person.id,
          tierName: tier?.name || null,
          pricePaid: tier ? parseFloat(tier.price) : e.price,
          // Spread each purchase across a unique day/hour/minute so sales look
          // organic (no 30 tickets in the same second → no false fraud spike).
          purchaseDate: new Date(now.getTime() - randInt(1, 60 * 24 * 60) * 60000).toISOString(),
          status: used ? 'used' : 'valid',
          usedAt: used ? new Date().toISOString() : null,
          qrCode: `RAVE-${Date.now()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
          seed: true,
        })
        created++
      }
    } else if (existing.length > target) {
      // Trim surplus (only seed tickets, keep any demo-raver's real purchases)
      const removable = existing.filter((t) => t.seed)
      const toRemove = removable.slice(0, existing.length - target)
      toRemove.forEach((t) => { batch.delete(t._ref); trimmed++ })
    }

    // Commit the ticket add/trim first, THEN recount so the counter is exact.
    await batch.commit()
    const evTicketsSnap = await db.collection('tickets').where('eventId', '==', e.id).get()
    const realCount = evTicketsSnap.size

    // Re-spread purchase dates of ALL this event's tickets (existing ones from
    // earlier enrichment shared the same timestamp → false fraud spike). Give
    // each a unique minute within the 60 days before the event.
    const spreadBatch = db.batch()
    evTicketsSnap.docs.forEach((d) => {
      const minsBack = randInt(1, 60 * 24 * 60)
      spreadBatch.update(d.ref, { purchaseDate: new Date(now.getTime() - minsBack * 60000).toISOString() })
    })
    await spreadBatch.commit()

    const updates = { capacity, ticketsSold: realCount }

    // Tier distribution if phased
    if (e.pricingMode === 'tiers' && Array.isArray(e.tiers) && e.tiers.length) {
      const tierSold = {}
      let remaining = realCount
      for (const t of e.tiers) {
        const qty = parseInt(t.qty) || Math.ceil(capacity / e.tiers.length)
        const inThis = Math.min(qty, remaining)
        tierSold[t.name] = inThis
        remaining -= inThis
        if (remaining <= 0) break
      }
      updates.tierSold = tierSold
    }

    await docSnap.ref.update(updates)

    eventsDone++
    summary.push({ title: e.title, cap: capacity, sold: realCount, pct: Math.round((realCount / capacity) * 100), past })
  }

  console.log(`Eventos: ${eventsDone} | tickets creados: ${created} | tickets recortados: ${trimmed}\n`)
  console.log('EVENTO'.padEnd(34), 'CAP'.padStart(5), 'VEND'.padStart(6), '%'.padStart(5), ' P/F')
  summary.sort((a, b) => a.pct - b.pct)
  summary.forEach((s) => console.log(s.title.slice(0, 33).padEnd(34), String(s.cap).padStart(5), String(s.sold).padStart(6), (s.pct + '%').padStart(5), s.past ? ' PAS' : ' FUT'))
  process.exit(0)
}

run().catch((e) => { console.error(e); process.exit(1) })
