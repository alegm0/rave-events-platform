// Update existing raver profiles in Firestore to Australian names (Brisbane
// thesis). Maps by email raverN@rave.com → name[N-1], same order as seed.mjs,
// so no accounts are created or lost. Read-light, writes only displayName.
//
//   node scripts/fix-raver-names.mjs
//
import { readFileSync } from 'node:fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const KEY = new URL('../rave-platform-firebase-adminsdk-fbsvc-e51b46af1f.json', import.meta.url)
initializeApp({ credential: cert(JSON.parse(readFileSync(KEY))) })
const auth = getAuth()
const db = getFirestore()

const RAVER_NAMES = [
  'Mia Thompson', 'Jack Wilson', 'Olivia Nguyen', 'Noah Smith', 'Chloe Anderson',
  'Liam Brown', 'Isla Martin', 'Oliver Taylor', 'Charlotte Lee', 'William Harris',
  'Amelia White', 'Thomas Walker', 'Grace Robinson', 'Ethan Clarke', 'Zoe Mitchell',
  'Lucas Edwards', 'Sophie Green', 'Harrison Hall', 'Ruby Davies', 'Max Turner',
  'Ava Robertson', 'Cooper Scott', 'Lily Campbell', 'Jacob Murphy', 'Ella Bennett',
  'Hunter Reed', 'Harper Ryan', 'Lachlan Cox', 'Matilda Ward', 'Riley Foster',
  'Sienna Bailey', 'Flynn Patterson', 'Georgia Hughes', 'Archie Morgan', 'Hazel Price',
  'Jasper Collins', 'Evie Richardson', 'Angus Gray', 'Freya Watson', 'Declan Hayes',
]

const run = async () => {
  let updated = 0, missing = 0
  const batch = db.batch()
  for (let i = 0; i < RAVER_NAMES.length; i++) {
    const email = `raver${i + 1}@rave.com`
    const name = RAVER_NAMES[i]
    let uid
    try { uid = (await auth.getUserByEmail(email)).uid } catch { missing++; continue }
    // Keep Auth displayName in sync too
    await auth.updateUser(uid, { displayName: name })
    batch.update(db.collection('users').doc(uid), { displayName: name })
    console.log(`  ${email.padEnd(18)} → ${name}`)
    updated++
  }
  await batch.commit()
  console.log(`\n${updated} ravers renombrados${missing ? `, ${missing} no encontrados` : ''}.`)
  process.exit(0)
}

run().catch((e) => { console.error(e); process.exit(1) })
