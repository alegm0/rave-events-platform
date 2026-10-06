// Removes everything seed.mjs created: every Firestore document flagged
// { seed: true } across all collections, plus the seeded Auth users.
//
//   node scripts/unseed.mjs
//
import { readFileSync } from 'node:fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const KEY_PATH = new URL('../rave-platform-firebase-adminsdk-fbsvc-e51b46af1f.json', import.meta.url)
initializeApp({ credential: cert(JSON.parse(readFileSync(KEY_PATH))) })
const auth = getAuth()
const db = getFirestore()

const COLLECTIONS = ['tickets', 'going', 'notifications', 'reviews', 'subscriptions', 'events', 'users']

const run = async () => {
  console.log('\n== Limpiando documentos { seed: true } ==\n')
  const seededUserIds = []

  for (const name of COLLECTIONS) {
    const snap = await db.collection(name).where('seed', '==', true).get()
    if (snap.empty) { console.log(`  ${name}: nada`); continue }
    if (name === 'users') snap.docs.forEach(d => seededUserIds.push(d.id))

    // Batches of 500 (Firestore limit)
    let deleted = 0
    for (let i = 0; i < snap.docs.length; i += 500) {
      const batch = db.batch()
      snap.docs.slice(i, i + 500).forEach(d => batch.delete(d.ref))
      await batch.commit()
      deleted += Math.min(500, snap.docs.length - i)
    }
    console.log(`  ${name}: ${deleted} eliminados`)
  }

  console.log('\nEliminando usuarios de Auth sembrados:')
  for (const uid of seededUserIds) {
    try { await auth.deleteUser(uid); console.log(`  - ${uid}`) }
    catch (e) { console.log(`  ! ${uid}: ${e.message}`) }
  }

  console.log('\n== Limpieza completa ==\n')
}

run().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1) })
