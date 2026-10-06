// Add more 2027 events (Apr–Sep) so the calendar shows a full year ahead.
// Idempotent: skips any event whose title already exists. Reuses the real
// Brisbane organizers already in Firestore and real artist names. Each new
// future event gets subscribers (not tickets) so it looks alive but unsold.
//
//   node scripts/add-2027-events.mjs
//
import { readFileSync } from 'node:fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { venueForEvent, VENUE_LAYOUT_VERSION } from './venue-templates.mjs'

const KEY = new URL('../rave-platform-firebase-adminsdk-fbsvc-e51b46af1f.json', import.meta.url)
initializeApp({ credential: cert(JSON.parse(readFileSync(KEY))) })
const db = getFirestore()

const genId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 11)
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const sample = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n)

const GENRES = ['Techno', 'House', 'Trance', 'Melodic Techno', 'Drum & Bass', 'Minimal', 'Acid', 'Afro House']
const ARTISTS = [
  'Amelie Lens', 'FJAAK', 'Kobosil', 'I Hate Models', 'Charlotte de Witte',
  'Boris Brejcha', 'Tale Of Us', 'ANNA', 'Reinier Zonneveld', 'Nina Kraviz',
  'Ben Klock', 'Marcel Dettmann', 'Dax J', '999999999', 'SAMA Abdulhadi',
]
const EVENT_IMAGES = [
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&q=80',
  'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=1200&q=80',
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&q=80',
  'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&q=80',
]
const buildLineup = (n) => sample(ARTISTS, n).map((name, i) => ({
  name, time: `${String((22 + i * 2) % 24).padStart(2, '0')}:00`,
}))

const PLANS = [
  { title: 'Autumn Warehouse',          date: '2027-04-18', tiered: false },
  { title: 'Riverbank Winter Open Air', date: '2027-05-22', tiered: true  },
  { title: 'Subterranean',              date: '2027-06-12', tiered: false },
  { title: 'Solstice Techno',           date: '2027-07-10', tiered: true  },
  { title: 'Deep Valley Sessions',      date: '2027-08-14', tiered: false },
  { title: 'Spring Awakening Brisbane', date: '2027-09-18', tiered: true  },
]

const run = async () => {
  // Real Brisbane organizers already in Firestore
  const orgs = (await db.collection('users').get()).docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((u) => u.role === 'organizer')
  if (orgs.length === 0) { console.error('No hay organizadores en Firestore. Corre el seed primero.'); process.exit(1) }

  const ravers = (await db.collection('users').get()).docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((u) => u.role === 'user')

  const existingTitles = new Set((await db.collection('events').get()).docs.map((d) => d.data().title))

  let created = 0
  for (let i = 0; i < PLANS.length; i++) {
    const plan = PLANS[i]
    if (existingTitles.has(plan.title)) { console.log(`  = ${plan.title} ya existe, se omite`); continue }

    const org = orgs[i % orgs.length]
    const id = genId()
    const capacity = pick([300, 500, 800, 1200])
    const tiers = plan.tiered
      ? [
          { name: 'Early Bird', price: '45', qty: '100' },
          { name: 'First Release', price: '65', qty: '200' },
          { name: 'General', price: '85', qty: '' },
        ]
      : []
    const price = plan.tiered ? 45 : pick([40, 55, 70, 90])
    const event = {
      id,
      title: plan.title,
      description: `Una noche de ${pick(GENRES).toLowerCase()} con un line-up cuidadosamente seleccionado. Sonido de alta fidelidad y una producción visual inmersiva.`,
      date: plan.date,
      time: pick(['21:00', '22:00', '23:00']),
      duration: pick([6, 8, 10, 12]),
      location: pick(['The TBC Club', 'The MET Brisbane', 'The Warehouse', 'The Foundry', 'Riverstage']),
      address: pick([
        '365 Brunswick St, Fortitude Valley',
        '620 Ann St, Fortitude Valley',
        '27 Warner St, Fortitude Valley',
        '228 Wickham St, Fortitude Valley',
        '59 Gardens Point Rd, City Botanic Gardens',
      ]),
      city: 'Brisbane',
      price,
      pricingMode: plan.tiered ? 'tiers' : 'single',
      tiers,
      capacity,
      genre: pick(GENRES),
      imageUrl: pick(EVENT_IMAGES),
      imagePos: 50,
      minAge: pick([18, 21]),
      lineup: buildLineup(pick([3, 4, 5])),
      venue: null,
      venueAuthored: false,
      venueVersion: VENUE_LAYOUT_VERSION,
      organizerId: org.id,
      status: 'active',
      ticketsSold: 0,
      tierSold: {},
      createdAt: new Date().toISOString(),
      seed: true,
    }
    event.venue = venueForEvent(event)
    await db.collection('events').doc(id).set(event)

    // Subscribers so a future event looks alive (no tickets sold yet)
    const subs = sample(ravers, pick([10, 14, 18]))
    const batch = db.batch()
    for (const r of subs) {
      const sid = genId()
      batch.set(db.collection('subscriptions').doc(sid), { id: sid, userId: r.id, eventId: id, seed: true })
    }
    await batch.commit()

    console.log(`  + ${plan.title} (${plan.date}, aforo ${capacity}, ${subs.length} suscriptores)`)
    created++
  }

  console.log(`\n${created} evento(s) de 2027 añadido(s).`)
  process.exit(0)
}

run().catch((e) => { console.error(e); process.exit(1) })
