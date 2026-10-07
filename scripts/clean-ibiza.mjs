// Remove leftover Ibiza data from a previous (pre-Brisbane) version that the
// seed/unseed scripts never touched because these docs carry seed:false and
// fixed ids. For a Brisbane thesis, any Ibiza organizer/event is incoherent.
//
// Also rewrites the live event (ev-live): db.js already defines it as a
// Brisbane event, but ensureFeaturedEvents() never runs in the app, so the
// Firestore copy stayed frozen as the old Ibiza "Cocoon — Live Tonight".
//
//   node scripts/clean-ibiza.mjs
//
import { readFileSync } from 'node:fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { VENUE_TEMPLATES } from './venue-templates.mjs'

const KEY = new URL('../rave-platform-firebase-adminsdk-fbsvc-e51b46af1f.json', import.meta.url)
initializeApp({ credential: cert(JSON.parse(readFileSync(KEY))) })
const db = getFirestore()

const IBIZA_ORG_IDS = ['org-ibiza-amnesia', 'org-hi-ibiza', 'org-ushuaia']
const IBIZA_EVENT_IDS = ['ev-amnesia-pyramid', 'ev-hi-afterlife', 'ev-hi-blackcoffee', 'ev-ushuaia-armin', 'ev-ushuaia-david']

// Fresh Brisbane live event (mirrors buildLiveEvent in src/lib/db.js)
const buildLiveEvent = () => {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const hh = now.getHours()
  const t = (h) => `${pad(h)}:00`
  const doorHour = (hh - 2 + 24) % 24
  return {
    id: 'ev-live',
    title: 'Warehouse Sessions — Live Tonight',
    description: 'Techno hipnótico en Fortitude Valley. El evento está sucediendo AHORA: entra a Rave Mode para ver quién toca en este momento.',
    date, time: t(doorHour), duration: 8,
    location: 'The TBC Club', address: '365 Brunswick St', city: 'Brisbane', genre: 'Techno', price: 45, capacity: 800,
    imageUrl: 'https://images.unsplash.com/photo-1493676304819-0d7a8d026dcf?w=800&q=80',
    organizerId: 'org-tbc', ticketsSold: 540, status: 'active', minAge: 18,
    lineup: [
      { name: 'Ricardo Villalobos', time: t((hh - 1 + 24) % 24) },
      { name: 'Sven Väth', time: t(hh) },
      { name: 'Dubfire', time: t((hh + 1) % 24) },
      { name: 'Ilario Alicante', time: t((hh + 2) % 24) },
    ],
    venue: VENUE_TEMPLATES.warehouse,
    venueVersion: 4,
  }
}

const run = async () => {
  let deleted = 0

  // 1) Delete Ibiza organizers
  for (const id of IBIZA_ORG_IDS) {
    const ref = db.collection('users').doc(id)
    if ((await ref.get()).exists) { await ref.delete(); console.log(`  - org borrado: ${id}`); deleted++ }
  }

  // 2) Delete Ibiza events + any related docs (tickets/reviews/going/subscriptions)
  for (const id of IBIZA_EVENT_IDS) {
    const ref = db.collection('events').doc(id)
    if ((await ref.get()).exists) { await ref.delete(); console.log(`  - evento borrado: ${id}`); deleted++ }
  }
  for (const coll of ['tickets', 'reviews', 'going', 'subscriptions']) {
    const snap = await db.collection(coll).get()
    for (const d of snap.docs) {
      if (IBIZA_EVENT_IDS.includes(d.data().eventId)) { await d.ref.delete(); deleted++ }
    }
  }

  // 3) Rewrite the live event as Brisbane (full overwrite, not merge)
  const live = buildLiveEvent()
  await db.collection('events').doc('ev-live').set(live)
  console.log(`  ~ ev-live reescrito: ${live.title} · ${live.city}`)

  // 4) Safety sweep: any remaining non-Brisbane active event?
  const events = (await db.collection('events').get()).docs.map((d) => ({ _id: d.id, ...d.data() }))
  const stragglers = events.filter((e) => e.city && e.city !== 'Brisbane')
  console.log(`\n${deleted} documentos de Ibiza eliminados.`)
  if (stragglers.length) {
    console.log('ATENCIÓN, quedan eventos no-Brisbane:')
    stragglers.forEach((e) => console.log('   ', e._id, e.title, e.city))
  } else {
    console.log('OK: no quedan eventos fuera de Brisbane.')
  }

  const orgs = (await db.collection('users').get()).docs.map((d) => d.data()).filter((u) => u.role === 'organizer')
  const nonBrisOrg = orgs.filter((o) => (o.brand?.city || o.city) && (o.brand?.city || o.city) !== 'Brisbane')
  console.log(nonBrisOrg.length ? `ATENCIÓN, organizadores no-Brisbane: ${nonBrisOrg.map((o) => o.displayName).join(', ')}` : 'OK: todos los organizadores son de Brisbane.')
  process.exit(0)
}

run().catch((e) => { console.error(e); process.exit(1) })
