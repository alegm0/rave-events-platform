// Create a "live right now" event for testing the scanner / live ops.
// The event starts 1 hour ago and runs 6 hours, so it's currently in progress
// (door open, not finished → scanner is enabled). It's owned by the organizer
// aurora@rave.com (Riverbank Open Air) and uses the NEW club venue layout.
// Flagged seed:true so unseed can remove it.
//
//   node scripts/create-live-event.mjs
//
import { readFileSync } from 'node:fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const KEY = new URL('../rave-platform-firebase-adminsdk-fbsvc-e51b46af1f.json', import.meta.url)
initializeApp({ credential: cert(JSON.parse(readFileSync(KEY))) })
const db = getFirestore()

const genId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 11)
const ORG_EMAIL = 'aurora@rave.com'

// New-style club venue (booth + floor + quiet + perimeter services).
const CLUB_VENUE = {
  kind: 'club', layout: 'indoor', setting: 'Club · pista principal + chill',
  zones: [
    { id: 'booth', label: 'DJ Booth', type: 'booth', x: 34, y: 5, w: 32, h: 9 },
    { id: 'floor', label: 'Dance Floor', type: 'floor', x: 16, y: 17, w: 68, h: 42 },
    { id: 'chill', label: 'Chill-out', type: 'quiet', x: 6, y: 64, w: 30, h: 24 },
  ],
  services: [
    { id: 'bar', type: 'bar', label: 'Bar (agua gratis)', x: 90, y: 36, walkMin: 2 },
    { id: 'water1', type: 'water', label: 'Punto de agua', x: 90, y: 50, walkMin: 2 },
    { id: 'toilet1', type: 'toilet', label: 'Baños', x: 90, y: 66, accessible: true, walkMin: 2 },
    { id: 'smoking', type: 'smoking', label: 'Zona de fumadores', x: 46, y: 74, walkMin: 2 },
    { id: 'rest', type: 'rest', label: 'Zona de respiro', x: 46, y: 90, accessible: true, walkMin: 2 },
    { id: 'gate', type: 'entrance', label: 'Entrada', x: 50, y: 97, accessible: true, walkMin: 0 },
    { id: 'exit', type: 'exit', label: 'Salida de emergencia', x: 90, y: 97, walkMin: 2 },
  ],
  knowBeforeYouGo: ['Trae documento de identidad', 'Agua potable gratis en el bar', 'Guardarropa en la entrada'],
}

async function run() {
  // Find the organizer by email.
  const usersSnap = await db.collection('users').where('email', '==', ORG_EMAIL).get()
  if (usersSnap.empty) {
    console.error(`No se encontró el organizador ${ORG_EMAIL}. ¿La cuenta existe?`)
    process.exit(1)
  }
  const org = usersSnap.docs[0].data()
  const organizerId = org.id || usersSnap.docs[0].id

  // Remove any previous LIVE TEST event (and its tickets) so we don't pile up
  // duplicates or leave a finished one lying around.
  const prevSnap = await db.collection('events').where('title', '==', 'LIVE TEST — Scanner Demo').get()
  for (const prev of prevSnap.docs) {
    const prevTix = await db.collection('tickets').where('eventId', '==', prev.data().id).get()
    const delBatch = db.batch()
    prevTix.docs.forEach((t) => delBatch.delete(t.ref))
    delBatch.delete(prev.ref)
    await delBatch.commit()
    console.log(`  (limpiado LIVE TEST previo: ${prevTix.size} tickets)`)
  }

  // Start 1 hour ago, 6-hour run → currently live.
  const now = new Date()
  const start = new Date(now.getTime() - 60 * 60 * 1000)
  const date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
  const time = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`

  const id = genId()
  const event = {
    id,
    title: 'LIVE TEST — Scanner Demo',
    description: 'Evento de prueba en vivo para validar el scanner de entradas. Techno hasta el amanecer.',
    date, time, duration: 6,
    location: 'The TBC Club', address: '365 Brunswick St, Fortitude Valley', city: 'Brisbane',
    price: 30, pricingMode: 'single', tiers: [],
    capacity: 40, genre: 'Techno',
    imageUrl: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&q=80',
    imagePos: 50, minAge: 18,
    lineup: [
      { name: 'Charlotte de Witte', time },
      { name: 'Amelie Lens', time: '' },
    ],
    venue: CLUB_VENUE, venueAuthored: true, venueVersion: 5,
    organizerId, status: 'active',
    ticketsSold: 0, tierSold: {},
    createdAt: new Date().toISOString(), seed: true,
  }

  await db.collection('events').doc(id).set(event)
  console.log('Evento "en vivo" creado:')
  console.log(`  Título:     ${event.title}`)
  console.log(`  Organizador: ${org.displayName || ORG_EMAIL} (${organizerId})`)
  console.log(`  Inicio:     ${date} ${time} (hace 1h) · dura 6h → EN VIVO ahora`)
  console.log(`  Aforo:      ${event.capacity} · precio AUD $${event.price}`)
  console.log(`  ID:         ${id}`)
  console.log('\nPruébalo: compra un ticket como raver (demo123), copia su código, y valídalo en Scanner.')
  process.exit(0)
}

run().catch((e) => { console.error(e); process.exit(1) })
