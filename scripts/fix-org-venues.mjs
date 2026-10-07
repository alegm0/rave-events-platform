// Fix venue address coherence left by random seeding: each venue was showing
// 3-4 different addresses because the seed picked venue and address
// independently at random. Here every venue gets ONE canonical Brisbane /
// Fortitude Valley address, applied to all its events.
//
//   node scripts/fix-org-venues.mjs
//
import { readFileSync } from 'node:fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const KEY = new URL('../rave-platform-firebase-adminsdk-fbsvc-e51b46af1f.json', import.meta.url)
initializeApp({ credential: cert(JSON.parse(readFileSync(KEY))) })
const db = getFirestore()

// One real address per venue.
const VENUE_ADDRESS = {
  'The TBC Club': '365 Brunswick St, Fortitude Valley',
  'The MET Brisbane': '620 Ann St, Fortitude Valley',
  'Riverstage': '59 Gardens Point Rd, City Botanic Gardens',
  'The Foundry': '228 Wickham St, Fortitude Valley',
  'The Warehouse': '27 Warner St, Fortitude Valley',
  'Sub Club': '12 Constance St, Fortitude Valley',
  'Jan Murphy Gallery': '486 Brunswick St, Fortitude Valley',
}

const run = async () => {
  const eventsSnap = await db.collection('events').get()
  const batch = db.batch()
  let fixed = 0

  for (const docSnap of eventsSnap.docs) {
    const e = docSnap.data()
    const canonical = VENUE_ADDRESS[e.location]
    if (canonical && e.address !== canonical) {
      batch.update(docSnap.ref, { address: canonical })
      fixed++
    }
  }
  await batch.commit()
  console.log(`Direcciones corregidas: ${fixed}`)

  // Verify: no venue has more than one address now
  const after = (await db.collection('events').get()).docs.map((d) => d.data()).filter((e) => e.status === 'active')
  const byVenue = {}
  after.forEach((e) => { (byVenue[e.location] ||= new Set()).add(e.address) })
  console.log('\nVerificación venue -> direcciones:')
  let allGood = true
  Object.entries(byVenue).forEach(([v, addrs]) => {
    const ok = addrs.size === 1
    if (!ok) allGood = false
    console.log(`  ${ok ? 'OK' : 'XX'} ${v}: ${[...addrs].join(' | ')}`)
  })
  console.log(allGood ? '\nOK: cada venue tiene una sola direccion.' : '\nATENCION: aun hay venues con varias direcciones.')
  process.exit(0)
}

run().catch((e) => { console.error(e); process.exit(1) })
