// Assign a UNIQUE authentic rave/EDM image to every active event.
// Pool = 24 Unsplash photos, each verified by eye as an electronic-music scene
// (festival crowds, DJs, clubs, warehouse parties, stage lights). The pool is
// shuffled and handed out one-per-event so no two events share an image.
//
//   node scripts/assign-unique-images.mjs
//
import { readFileSync } from 'node:fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const KEY = new URL('../rave-platform-firebase-adminsdk-fbsvc-e51b46af1f.json', import.meta.url)
initializeApp({ credential: cert(JSON.parse(readFileSync(KEY))) })
const db = getFirestore()

const W = (id) => `https://images.unsplash.com/${id}?w=1200&q=80`

// 24 verified authentic electronic-music scene photos
const POOL = [
  'photo-1506157786151-b8491531f063', // EDM festival, purple lights
  'photo-1492684223066-81342ee5ff30', // confetti over crowd
  'photo-1540039155733-5bb30b53aa14', // crowd, hands up, stage lights
  'photo-1429962714451-bb934ecdc4ec', // hands forming a heart
  'photo-1514525253161-7a46d19cd819', // neon stage + confetti
  'photo-1459749411175-04bf5292ceea', // crowd, golden stage lights
  'photo-1501386761578-eac5c94b800a', // festival crowd close-up
  'photo-1563841930606-67e2bce48b78', // outdoor festival stage, blue
  'photo-1565035010268-a3816f98589a', // silhouette, arms up
  'photo-1524368535928-5b5e00ddc76b', // crowd, warm lights, haze
  'photo-1470229722913-7c0e2dbbafd3', // festival at night, lights
  'photo-1493676304819-0d7a8d026dcf', // DJ facing a huge crowd
  'photo-1516873240891-4bf014598ab4', // DJ mixing in the booth
  'photo-1545128485-c400e7702796',    // dark club, red lights
  'photo-1468164016595-6108e4c60c8b', // vinyl on a turntable
  'photo-1570872626485-d8ffea69f463', // venue, pink laser beams
  'photo-1549451371-64aa98a6f660',    // festival stage + raised hand
  'photo-1522158637959-30385a09e0da', // concert, white light beams
  'photo-1504704911898-68304a7d2807', // club, geometric LED install
  'photo-1517457373958-b7bdd4587205', // outdoor party, string lights
  'photo-1533174072545-7a4b6ad7a6c3', // festival night, confetti
  'photo-1574391884720-bbc3740c59d1', // warehouse party, haze
  'photo-1516450360452-9312f5e86fc7', // concert, colored lights
  'photo-1470225620780-dba8ba36b745', // DJ hands on controller, purple
]

const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[b[i], b[j]] = [b[j], b[i]] } return b }

const run = async () => {
  const snap = await db.collection('events').get()
  const active = snap.docs.filter((d) => d.data().status === 'active')
  console.log(`Eventos activos: ${active.length} · imágenes en pool: ${POOL.length}`)

  if (active.length > POOL.length) {
    console.error(`Faltan imágenes: hay ${active.length} eventos y solo ${POOL.length} imágenes únicas.`)
    process.exit(1)
  }

  const pics = shuffle(POOL)
  const batch = db.batch()
  active.forEach((docSnap, i) => {
    batch.update(docSnap.ref, { imageUrl: W(pics[i]) })
    console.log(`  · ${docSnap.data().title.padEnd(32)} → ${pics[i]}`)
  })
  await batch.commit()
  console.log(`\n${active.length} eventos con imagen única (ninguna repetida).`)
  process.exit(0)
}

run().catch((e) => { console.error(e); process.exit(1) })
