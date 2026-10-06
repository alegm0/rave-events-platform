// Swap generic/old event images for authentic rave-crowd photos.
// Any event whose imageUrl is one of the OLD pool (or empty) gets reassigned
// a verified authentic image, cycling through the new pool for variety.
//
//   node scripts/fix-event-images.mjs
//
import { readFileSync } from 'node:fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const KEY = new URL('../rave-platform-firebase-adminsdk-fbsvc-e51b46af1f.json', import.meta.url)
initializeApp({ credential: cert(JSON.parse(readFileSync(KEY))) })
const db = getFirestore()

// Verified authentic electronic-music / rave crowd shots
const NEW_IMAGES = [
  'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=1200&q=80',
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&q=80',
  'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=1200&q=80',
  'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=1200&q=80',
]

// Old / generic images we want to replace (match by the photo id substring)
const OLD_IDS = [
  'photo-1516450360452-9312f5e86fc7',
  'photo-1574391884720-bbc3740c59d1',
  'photo-1470225620780-dba8ba36b745',
  'photo-1533174072545-7a4b6ad7a6c3',
  'photo-1571266028243', // known broken
]

const isOld = (url = '') => !url || OLD_IDS.some((id) => url.includes(id))

const run = async () => {
  const snap = await db.collection('events').get()
  const batch = db.batch()
  let updated = 0, i = 0
  for (const docSnap of snap.docs) {
    const ev = docSnap.data()
    if (ev.status !== 'active') continue
    if (!isOld(ev.imageUrl)) continue
    const img = NEW_IMAGES[i % NEW_IMAGES.length]
    i++
    batch.update(docSnap.ref, { imageUrl: img })
    console.log(`  · ${ev.title} → ${img.split('/').pop().split('?')[0]}`)
    updated++
  }
  if (updated > 0) await batch.commit()
  console.log(updated === 0 ? '\nNingún evento necesitaba imagen nueva.' : `\n${updated} evento(s) con imagen auténtica.`)
  process.exit(0)
}

run().catch((e) => { console.error(e); process.exit(1) })
