// Surgical repair: enrich any ACTIVE past event that has no reviews yet.
// This happens when the system clock moves forward and an event that was
// "today/future" at seed time becomes "past" — leaving it with a hardcoded
// ticketsSold but 0 real tickets/reviews. We reuse the exact seed logic:
// real crowd + checked-in tickets + reviews, flagged seed:true so unseed
// cleans them. We respect any going docs that already exist (no duplicates).
//
//   node scripts/fix-past-events.mjs
//
import { readFileSync } from 'node:fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const KEY = new URL('../rave-platform-firebase-adminsdk-fbsvc-e51b46af1f.json', import.meta.url)
initializeApp({ credential: cert(JSON.parse(readFileSync(KEY))) })
const db = getFirestore()

const genId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 11)
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const sample = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n)

const REVIEW_TEXTS = [
  { rating: 5, text: 'Increíble producción, el sonido estuvo impecable toda la noche.' },
  { rating: 5, text: 'La mejor fiesta a la que he ido este año. Line-up brutal.' },
  { rating: 4, text: 'Muy buen ambiente, aunque las filas en la barra fueron largas.' },
  { rating: 4, text: 'El venue estaba espectacular, volvería sin dudarlo.' },
  { rating: 3, text: 'Buena música pero demasiado lleno para mi gusto.' },
  { rating: 5, text: 'Sistema de sonido de otro nivel, me encantó la zona chill.' },
  { rating: 5, text: 'La iluminación y los visuales estuvieron a otro nivel. Experiencia completa.' },
  { rating: 4, text: 'Gran organización, entrada rápida con el QR. Solo faltó más variedad en la barra.' },
  { rating: 5, text: 'El cierre fue épico, el DJ principal lo dio todo. 10/10.' },
  { rating: 4, text: 'Buen flujo de gente, nunca me sentí demasiado apretado. Repetiría.' },
  { rating: 3, text: 'La música genial pero tardaron en abrir puertas. Mejorable.' },
  { rating: 5, text: 'Ambiente súper seguro y buena vibra toda la noche. Me encantó.' },
  { rating: 4, text: 'El venue tenía buenos espacios para descansar. Se agradece.' },
  { rating: 5, text: 'Primera vez en este colectivo y no será la última. Impecable.' },
  { rating: 2, text: 'Esperaba más del sonido en la pista secundaria, se escuchaba bajo.' },
  { rating: 4, text: 'Precio justo para la calidad de la producción. Buen trabajo.' },
]

const run = async () => {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  console.log('HOY =', startOfToday.toISOString().slice(0, 10))

  const [usersSnap, eventsSnap, goingSnap, reviewsSnap] = await Promise.all([
    db.collection('users').get(),
    db.collection('events').get(),
    db.collection('going').get(),
    db.collection('reviews').get(),
  ])

  // Raver pool = real "user" accounts (same crowd the app shows elsewhere)
  const ravers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => u.role === 'user')
  const goingByEvent = {}
  goingSnap.docs.forEach((d) => {
    const g = d.data(); (goingByEvent[g.eventId] ||= new Set()).add(g.userId)
  })
  const reviewedEvents = new Set(reviewsSnap.docs.map((d) => d.data().eventId))

  let fixed = 0
  const batch = db.batch()
  let batchCount = 0
  const commitIfNeeded = async () => { if (batchCount >= 450) { await batch.commit(); batchCount = 0 } }

  for (const docSnap of eventsSnap.docs) {
    const ev = docSnap.data()
    if (ev.status !== 'active') continue
    if (ev.id === 'ev-live') continue
    const isPast = new Date(`${ev.date}T00:00:00`) < startOfToday
    if (!isPast) continue
    if (reviewedEvents.has(ev.id)) continue   // already enriched

    // This past event is empty — give it a real crowd + reviews.
    const crowd = sample(ravers, Math.min(ravers.length, pick([28, 32, 36, 40])))
    const tier = ev.pricingMode === 'tiers' && ev.tiers?.length ? ev.tiers[0] : null
    const already = goingByEvent[ev.id] || new Set()

    for (const person of crowd) {
      // Going (skip if this person is already marked going — avoid dupes)
      if (!already.has(person.id)) {
        const gid = genId()
        batch.set(db.collection('going').doc(gid), { id: gid, userId: person.id, eventId: ev.id, seed: true })
        batchCount++
      }
      // Ticket (mostly checked-in since it already happened)
      const tid = genId()
      const used = Math.random() < 0.85
      batch.set(db.collection('tickets').doc(tid), {
        id: tid, eventId: ev.id, userId: person.id,
        tierName: tier?.name || null,
        pricePaid: tier ? parseFloat(tier.price) : ev.price,
        purchaseDate: new Date().toISOString(),
        status: used ? 'used' : 'valid',
        usedAt: used ? new Date().toISOString() : null,
        qrCode: `RAVE-${Date.now()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        seed: true,
      })
      batchCount++
      await commitIfNeeded()
    }

    const reviewers = sample(crowd, Math.min(crowd.length, pick([10, 12, 15, 18])))
    for (const r of reviewers) {
      const rv = pick(REVIEW_TEXTS)
      const rid = genId()
      batch.set(db.collection('reviews').doc(rid), {
        id: rid, userId: r.id, eventId: ev.id,
        userName: r.displayName || r.name || null,
        rating: rv.rating, text: rv.text,
        createdAt: new Date().toISOString(), seed: true,
      })
      batchCount++
      await commitIfNeeded()
    }

    // Align the public counter with the real crowd.
    batch.update(db.collection('events').doc(ev.id), { ticketsSold: crowd.length })
    batchCount++
    await commitIfNeeded()

    console.log(`  · ${ev.title} (${ev.date}): ${crowd.length} asistieron, ${reviewers.length} reseñas`)
    fixed++
  }

  if (batchCount > 0) await batch.commit()
  console.log(fixed === 0 ? '\nNada que reparar — todos los eventos pasados ya tienen datos.' : `\n${fixed} evento(s) pasado(s) reparado(s).`)
  process.exit(0)
}

run().catch((e) => { console.error(e); process.exit(1) })
