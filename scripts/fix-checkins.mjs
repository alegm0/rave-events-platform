// Backfill check-ins for PAST events.
// A finished event should show attendees as "Check-in" (status: used), not
// "Pendiente". Some seeded tickets stayed as 'valid', so the attendee list for
// past events looked like nobody showed up. This marks ~85% of each past
// event's tickets as used (checked in), leaving a realistic ~15% no-shows.
// Future events are left untouched.
//
//   node scripts/fix-checkins.mjs
//
import { readFileSync } from 'node:fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const KEY = new URL('../rave-platform-firebase-adminsdk-fbsvc-e51b46af1f.json', import.meta.url)
initializeApp({ credential: cert(JSON.parse(readFileSync(KEY))) })
const db = getFirestore()

// An event is "past" when its start + duration is already behind us.
const hasEnded = (ev) => {
  if (!ev?.date) return false
  const [h, m] = (ev.time || '23:00').split(':').map((n) => parseInt(n, 10) || 0)
  const start = new Date(`${ev.date}T00:00:00`)
  start.setHours(h, m, 0, 0)
  return new Date(start.getTime() + (ev.duration || 6) * 3600000) < new Date()
}

async function run() {
  console.log('Cargando eventos y tickets…')
  const [eventsSnap, ticketsSnap] = await Promise.all([
    db.collection('events').get(),
    db.collection('tickets').get(),
  ])

  // Map past events → their door-open timestamp, so we can scatter check-ins
  // realistically across the first couple of hours instead of one instant.
  const pastEventIds = new Set()
  const doorOpen = {}
  eventsSnap.forEach((d) => {
    const e = d.data()
    const eid = e.id || d.id
    if (hasEnded(e)) {
      pastEventIds.add(eid)
      const [h, m] = (e.time || '23:00').split(':').map((n) => parseInt(n, 10) || 0)
      const start = new Date(`${e.date}T00:00:00`); start.setHours(h, m, 0, 0)
      doorOpen[eid] = start.getTime()
    }
  })
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

  let updated = 0
  let batch = db.batch()
  let batchCount = 0

  for (const docSnap of ticketsSnap.docs) {
    const t = docSnap.data()
    if (!pastEventIds.has(t.eventId)) continue   // only past events
    const base = doorOpen[t.eventId] || Date.now()

    if (t.status === 'used') {
      // Already checked in — just re-scatter its usedAt so check-ins aren't all
      // stamped at the same instant (fixes the "everyone at 17:14" look).
      batch.update(docSnap.ref, { usedAt: new Date(base + randInt(0, 180) * 60000).toISOString() })
      batchCount++
      if (batchCount >= 400) { await batch.commit(); batch = db.batch(); batchCount = 0 }
      continue
    }

    // ~85% show up; the rest stay as valid (no-shows).
    if (Math.random() < 0.85) {
      const usedAt = new Date(base + randInt(0, 180) * 60000).toISOString()
      batch.update(docSnap.ref, { status: 'used', usedAt })
      batchCount++
      updated++
      if (batchCount >= 400) { await batch.commit(); batch = db.batch(); batchCount = 0 }
    }
  }

  if (batchCount > 0) await batch.commit()
  console.log(updated === 0
    ? 'Nada que actualizar — los eventos pasados ya tienen check-ins.'
    : `${updated} ticket(s) marcados como Check-in en eventos pasados.`)
  process.exit(0)
}

run().catch((e) => { console.error(e); process.exit(1) })
