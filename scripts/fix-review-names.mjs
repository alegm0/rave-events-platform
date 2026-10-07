// Backfill: give existing reviews a userName.
// Older seed reviews were stored with only userId (no userName), so they render
// as "Anónimo" in the UI. This looks up each review's user and copies their
// displayName onto the review, so attendees' names show on their reviews.
// Reviews whose user can't be found keep a friendly fallback name.
//
//   node scripts/fix-review-names.mjs
//
import { readFileSync } from 'node:fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const KEY = new URL('../rave-platform-firebase-adminsdk-fbsvc-e51b46af1f.json', import.meta.url)
initializeApp({ credential: cert(JSON.parse(readFileSync(KEY))) })
const db = getFirestore()

// Friendly fallback names (Australian first names) for reviews whose user we
// can't resolve, so nothing stays "Anónimo".
const FALLBACK_NAMES = [
  'Jack', 'Charlotte', 'Liam', 'Olivia', 'Noah', 'Amelia', 'Will', 'Mia',
  'Ethan', 'Ava', 'Lucas', 'Zoe', 'Mason', 'Ruby', 'Leo', 'Chloe',
]
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

async function run() {
  console.log('Cargando usuarios y reviews…')
  const [usersSnap, reviewsSnap] = await Promise.all([
    db.collection('users').get(),
    db.collection('reviews').get(),
  ])

  // Map userId -> displayName
  const nameById = {}
  usersSnap.forEach((d) => {
    const u = d.data()
    nameById[u.id || d.id] = u.displayName || u.name || null
  })

  let updated = 0
  let batch = db.batch()
  let batchCount = 0

  for (const docSnap of reviewsSnap.docs) {
    const r = docSnap.data()
    if (r.userName) continue // already has a name

    const name = nameById[r.userId] || pick(FALLBACK_NAMES)
    batch.update(docSnap.ref, { userName: name })
    batchCount++
    updated++

    // Firestore batches cap at 500 writes.
    if (batchCount >= 400) {
      await batch.commit()
      batch = db.batch()
      batchCount = 0
    }
  }

  if (batchCount > 0) await batch.commit()
  console.log(updated === 0
    ? 'Nada que actualizar — todas las reviews ya tienen nombre.'
    : `${updated} review(s) actualizadas con nombre.`)
  process.exit(0)
}

run().catch((e) => { console.error(e); process.exit(1) })
