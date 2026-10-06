// Give every event a venue map. The app has VENUE_TEMPLATES + pickVenueTemplate
// in src/lib/db.js, but backfillVenues() is never actually called at runtime,
// so events seeded straight into Firestore end up with venue:null and the map
// section never renders. This applies the same template logic to Firestore.
// Organizer-authored venues (venueAuthored) are left untouched.
//
//   node scripts/backfill-venues.mjs
//
import { readFileSync } from 'node:fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { VENUE_TEMPLATES, VENUE_LAYOUT_VERSION, pickVenueTemplate } from './venue-templates.mjs'

const KEY = new URL('../rave-platform-firebase-adminsdk-fbsvc-e51b46af1f.json', import.meta.url)
initializeApp({ credential: cert(JSON.parse(readFileSync(KEY))) })
const db = getFirestore()

const run = async () => {
  const snap = await db.collection('events').get()
  const batch = db.batch()
  let updated = 0
  const counts = {}
  for (const docSnap of snap.docs) {
    const ev = docSnap.data()
    if (ev.status !== 'active') continue
    if (ev.venueAuthored) continue              // real organizer declaration, never overwrite
    if (ev.venue && (ev.venueVersion || 1) >= VENUE_LAYOUT_VERSION) continue  // already current
    const kind = pickVenueTemplate(ev)
    counts[kind] = (counts[kind] || 0) + 1
    batch.update(docSnap.ref, { venue: VENUE_TEMPLATES[kind], venueVersion: VENUE_LAYOUT_VERSION })
    console.log(`  · ${ev.title.padEnd(34)} → ${kind}`)
    updated++
  }
  if (updated > 0) await batch.commit()
  console.log(`\n${updated} eventos con mapa de venue. Reparto:`, counts)
  process.exit(0)
}

run().catch((e) => { console.error(e); process.exit(1) })
