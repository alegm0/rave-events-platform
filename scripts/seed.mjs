// One-off seeding script for the REAL Firestore project (rave-platform).
// Uses the Firebase Admin SDK, which bypasses security rules, so run it locally
// only and never ship it. Every document it writes carries `seed: true` so the
// whole dataset can be found and removed later (see scripts/unseed.mjs).
//
//   node scripts/seed.mjs
//
import { readFileSync } from 'node:fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { venueForEvent, VENUE_LAYOUT_VERSION } from './venue-templates.mjs'

const KEY_PATH = new URL('../rave-platform-firebase-adminsdk-fbsvc-e51b46af1f.json', import.meta.url)
const serviceAccount = JSON.parse(readFileSync(KEY_PATH))

initializeApp({ credential: cert(serviceAccount) })
const auth = getAuth()
const db = getFirestore()

const DEMO_PASSWORD = 'demo123'
const genId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 11)
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const sample = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n)

// ── Batched writer ──
// Firestore allows 500 ops per batch. Writing one doc at a time means ~1000
// network round-trips (slow, can time out). This queues set/update ops and
// flushes them in batches of 450, cutting the seed from minutes to seconds.
class BatchWriter {
  constructor() { this.batch = db.batch(); this.count = 0 }
  async _maybeFlush() {
    if (this.count >= 450) { await this.batch.commit(); this.batch = db.batch(); this.count = 0 }
  }
  async set(ref, data) { this.batch.set(ref, data); this.count++; await this._maybeFlush() }
  async update(ref, data) { this.batch.update(ref, data); this.count++; await this._maybeFlush() }
  async flush() { if (this.count > 0) { await this.batch.commit(); this.batch = db.batch(); this.count = 0 } }
}
const writer = new BatchWriter()

// ── Create or reuse an authenticated user, then write its Firestore profile ──
const upsertUser = async ({ email, displayName, role, brand = null, comfortProfile = null }) => {
  let uid
  try {
    const existing = await auth.getUserByEmail(email)
    uid = existing.uid
    console.log(`  · reuse auth  ${email}`)
  } catch {
    const created = await auth.createUser({ email, password: DEMO_PASSWORD, displayName })
    uid = created.uid
    console.log(`  + auth user   ${email}`)
  }
  const profile = {
    id: uid,
    email,
    displayName,
    role,
    createdAt: new Date().toISOString(),
    favorites: [],
    stats: { eventsAttended: 0, totalSpent: 0 },
    seed: true,
  }
  if (brand) profile.brand = brand
  if (comfortProfile) profile.comfortProfile = comfortProfile
  await db.collection('users').doc(uid).set(profile, { merge: true })
  return profile
}

// ── Data pools ── (all set in Brisbane, Australia)
const CITIES = ['Brisbane']
const GENRES = ['Techno', 'House', 'Trance', 'Melodic Techno', 'Drum & Bass', 'Minimal', 'Acid', 'Afro House']
const ARTISTS = [
  'Amelie Lens', 'FJAAK', 'Kobosil', 'I Hate Models', 'Charlotte de Witte',
  'Boris Brejcha', 'Tale Of Us', 'ANNA', 'Reinier Zonneveld', 'Nina Kraviz',
  'Ben Klock', 'Marcel Dettmann', 'Dax J', '999999999', 'SAMA Abdulhadi',
]
const REVIEW_TEXTS = [
  { rating: 5, text: 'Increíble producción, el sonido estuvo impecable toda la noche.' },
  { rating: 5, text: 'La mejor fiesta a la que he ido este año. Line-up brutal.' },
  { rating: 4, text: 'Muy buen ambiente, aunque las filas en la barra fueron largas.' },
  { rating: 4, text: 'El venue estaba espectacular, volvería sin dudarlo.' },
  { rating: 3, text: 'Buena música pero demasiado lleno para mi gusto.' },
  { rating: 5, text: 'Sistema de sonido de otro nivel, me encantó la zona chill.' },
  { rating: 5, text: 'La iluminación y los visuales estuvieron a otro nivel. Experiencia completa.' },
  { rating: 4, text: 'Gran organización, entrada rápida con el QR. Solo faltó más variedad en la barra.' },
  { rating: 5, text: 'El cierre fue épico, el DJ principal lo dio todo. 10/10.' },
  { rating: 4, text: 'Buen flujo de gente, nunca me sentí demasiado apretado. Repetiría.' },
  { rating: 3, text: 'La música genial pero tardaron en abrir puertas. Mejorable.' },
  { rating: 5, text: 'Ambiente súper seguro y buena vibra toda la noche. Me encantó.' },
  { rating: 4, text: 'El venue tenía buenos espacios para descansar. Se agradece.' },
  { rating: 5, text: 'Primera vez en este colectivo y no será la última. Impecable.' },
  { rating: 2, text: 'Esperaba más del sonido en la pista secundaria, se escuchaba bajo.' },
  { rating: 4, text: 'Precio justo para la calidad de la producción. Buen trabajo.' },
]

// ── The plan ── (Brisbane organizers, Fortitude Valley nightlife district)
const ORGANIZERS = [
  { email: 'nocturn@rave.com', displayName: 'NOCTURN Collective', brand: { name: 'NOCTURN Collective', bio: 'Colectivo underground de Fortitude Valley, Brisbane.', city: 'Brisbane', instagram: '@nocturn.bne', website: 'nocturn.com.au', founded: '2019', logo: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&q=80', cover: 'https://images.unsplash.com/photo-1549924231-f129b911e442?w=1200&q=80' } },
  { email: 'subsuelo@rave.com', displayName: 'Basement Collective', brand: { name: 'Basement Collective', bio: 'Techno crudo en espacios industriales de Brisbane.', city: 'Brisbane', instagram: '@basement.bne', website: 'basement.com.au', founded: '2021', logo: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&q=80', cover: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&q=80' } },
  { email: 'aurora@rave.com', displayName: 'Riverbank Open Air', brand: { name: 'Riverbank Open Air', bio: 'Festivales al aire libre y melodic techno junto al río Brisbane.', city: 'Brisbane', instagram: '@riverbank.oa', website: 'riverbank.com.au', founded: '2020', logo: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=200&q=80', cover: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200&q=80' } },
]

// 24 authentic electronic-music scene photos (each verified by eye: festival
// crowds, DJs, clubs, warehouse parties, stage lights). Enough variety that
// events don't share images.
const EVENT_IMAGES = [
  'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=1200&q=80',
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&q=80',
  'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=1200&q=80',
  'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=1200&q=80',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&q=80',
  'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200&q=80',
  'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200&q=80',
  'https://images.unsplash.com/photo-1563841930606-67e2bce48b78?w=1200&q=80',
  'https://images.unsplash.com/photo-1565035010268-a3816f98589a?w=1200&q=80',
  'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=1200&q=80',
  'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200&q=80',
  'https://images.unsplash.com/photo-1493676304819-0d7a8d026dcf?w=1200&q=80',
  'https://images.unsplash.com/photo-1516873240891-4bf014598ab4?w=1200&q=80',
  'https://images.unsplash.com/photo-1545128485-c400e7702796?w=1200&q=80',
  'https://images.unsplash.com/photo-1468164016595-6108e4c60c8b?w=1200&q=80',
  'https://images.unsplash.com/photo-1570872626485-d8ffea69f463?w=1200&q=80',
  'https://images.unsplash.com/photo-1549451371-64aa98a6f660?w=1200&q=80',
  'https://images.unsplash.com/photo-1522158637959-30385a09e0da?w=1200&q=80',
  'https://images.unsplash.com/photo-1504704911898-68304a7d2807?w=1200&q=80',
  'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=1200&q=80',
  'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&q=80',
  'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=1200&q=80',
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&q=80',
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&q=80',
]

const buildLineup = (n) => sample(ARTISTS, n).map((name, i) => ({
  name,
  time: `${String((22 + i * 2) % 24).padStart(2, '0')}:00`,
}))

const run = async () => {
  console.log('\n== Sembrando proyecto REAL rave-platform ==\n')

  // 1) Organizers
  console.log('Organizadores:')
  const organizers = []
  for (const o of ORGANIZERS) {
    organizers.push(await upsertUser({ ...o, role: 'organizer' }))
  }

  // 2) Ravers
  console.log('\nRavers:')
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
  const ravers = []
  for (let i = 0; i < RAVER_NAMES.length; i++) {
    const name = RAVER_NAMES[i]
    const email = `raver${i + 1}@rave.com`
    const comfortProfile = Math.random() < 0.4
      ? { quieterAreas: Math.random() < 0.5, stepFree: Math.random() < 0.3, restAreas: Math.random() < 0.5 }
      : null
    ravers.push(await upsertUser({ email, displayName: name, role: 'user', comfortProfile }))
  }

  // 3) Events — mix of past and upcoming, single-price and tiered
  console.log('\nEventos:')
  const events = []
  // Fixed dates: a few in the recent past (so they carry reviews and check-ins)
  // and the rest AFTER November 2026, since the project is presented then.
  const eventPlans = [
    // Past — already happened, so they carry reviews and checked-in tickets.
    { title: 'CONCRETE — Warehouse Session', date: '2026-07-18', tiered: false },
    { title: 'Basement 003',                  date: '2026-08-22', tiered: true  },
    { title: 'Riverbank Sunset Open Air',     date: '2026-09-12', tiered: false },
    // Future — from November onwards, for the project presentation.
    { title: 'NOCTURN Midnight',              date: '2026-12-05', tiered: false },
    { title: 'Melodic Journey',               date: '2026-12-19', tiered: true  },
    { title: 'Acid Bunker',                   date: '2027-01-16', tiered: false },
    { title: 'Valley Festival',               date: '2027-02-14', tiered: true  },
    { title: 'Underground Ritual',            date: '2027-03-07', tiered: false },
    { title: 'Autumn Warehouse',              date: '2027-04-18', tiered: false },
    { title: 'Riverbank Winter Open Air',     date: '2027-05-22', tiered: true  },
    { title: 'Subterranean',                  date: '2027-06-12', tiered: false },
    { title: 'Solstice Techno',               date: '2027-07-10', tiered: true  },
    { title: 'Deep Valley Sessions',          date: '2027-08-14', tiered: false },
    { title: 'Spring Awakening Brisbane',     date: '2027-09-18', tiered: true  },
  ]

  for (let i = 0; i < eventPlans.length; i++) {
    const plan = eventPlans[i]
    const org = organizers[i % organizers.length]
    const id = genId()
    // Demo-scale venues (tens, not thousands) so sell-through stays believable
    // and ticketsSold can match real attendee accounts. Final sales/capacity are
    // recalibrated by scripts/fix-sales.mjs after seeding.
    const capacity = pick([40, 50, 60, 80, 120])
    // Prices in AUD (Brisbane). Tiered events rise across phases.
    const tiers = plan.tiered
      ? [
          { name: 'Early Bird', price: '45', qty: '100' },
          { name: 'First Release', price: '65', qty: '200' },
          { name: 'General', price: '85', qty: '' },
        ]
      : []
    const price = plan.tiered ? 45 : pick([40, 55, 70, 90])
    const event = {
      id,
      title: plan.title,
      description: `Una noche de ${pick(GENRES).toLowerCase()} con un line-up cuidadosamente seleccionado. Sonido de alta fidelidad y una producción visual inmersiva.`,
      date: plan.date,
      time: pick(['21:00', '22:00', '23:00']),
      duration: pick([6, 8, 10, 12]),
      // Venue + address picked TOGETHER so each venue keeps its one real address
      // (picking them independently produced the same venue at several addresses)
      ...(() => {
        const v = pick([
          { location: 'The TBC Club', address: '365 Brunswick St, Fortitude Valley' },
          { location: 'The MET Brisbane', address: '620 Ann St, Fortitude Valley' },
          { location: 'The Warehouse', address: '27 Warner St, Fortitude Valley' },
          { location: 'The Foundry', address: '228 Wickham St, Fortitude Valley' },
          { location: 'Riverstage', address: '59 Gardens Point Rd, City Botanic Gardens' },
        ])
        return v
      })(),
      city: org.brand.city,
      price,
      pricingMode: plan.tiered ? 'tiers' : 'single',
      tiers,
      capacity,
      genre: pick(GENRES),
      imageUrl: pick(EVENT_IMAGES),
      imagePos: 50,
      minAge: pick([18, 21]),
      lineup: buildLineup(pick([3, 4, 5])),
      venue: null,
      venueAuthored: false,
      venueVersion: VENUE_LAYOUT_VERSION,
      organizerId: org.id,
      status: 'active',
      ticketsSold: 0,
      tierSold: {},
      createdAt: new Date().toISOString(),
      seed: true,
    }
    // Give it a venue map matching its kind (location/genre/capacity)
    event.venue = venueForEvent(event)
    await db.collection('events').doc(id).set(event)
    events.push(event)
    console.log(`  + ${plan.title}  (${event.date}, aforo ${capacity}, ${plan.tiered ? 'por fases' : 'precio único'})`)
  }

  // 4) Tickets + going + notifications, spread realistically
  console.log('\nTickets, asistencias y reseñas:')
  let ticketCount = 0, goingCount = 0, reviewCount = 0

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  for (const event of events) {
    const isPast = new Date(`${event.date}T00:00:00`) < todayStart

    // How many people are going to THIS event. We want every event to look
    // alive — never 2 or 3 people — so each one draws a healthy crowd from the
    // raver pool. Popularity varies: some events are packed, others calmer.
    const popularity = pick([0.45, 0.6, 0.75, 0.9, 1.0])
    const goingTotal = Math.max(18, Math.round(ravers.length * popularity))
    const crowd = sample(ravers, Math.min(ravers.length, goingTotal))

    // Of everyone going, most buy a ticket; the rest are "interested" (going
    // without a ticket yet). That mirrors how real event pages look.
    const buyerCount = Math.round(crowd.length * pick([0.7, 0.8, 0.85]))
    const buyers = crowd.slice(0, buyerCount)
    const interestedOnly = crowd.slice(buyerCount)

    let sold = 0
    const tierSold = {}
    for (const buyer of buyers) {
      // For tiered events, spread buyers across the tiers (most on the cheaper
      // early releases) so the analytics breakdown looks real, not all on one.
      const tier = event.pricingMode === 'tiers'
        ? pick([event.tiers[0], event.tiers[0], event.tiers[1], event.tiers[1], event.tiers[2]])
        : null
      const tName = tier?.name || null
      const pricePaid = tier ? parseFloat(tier.price) : event.price
      const tid = genId()
      // Past events: most tickets already checked in.
      const used = isPast && Math.random() < 0.85
      await writer.set(db.collection('tickets').doc(tid), {
        id: tid,
        eventId: event.id,
        userId: buyer.id,
        tierName: tName,
        pricePaid,
        purchaseDate: new Date().toISOString(),
        status: used ? 'used' : 'valid',
        usedAt: used ? new Date().toISOString() : null,
        qrCode: `RAVE-${Date.now()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        seed: true,
      })
      ticketCount++
      sold++
      if (tName) tierSold[tName] = (tierSold[tName] || 0) + 1

      // Buying implies "going"
      const gid1 = genId()
      await writer.set(db.collection('going').doc(gid1), { id: gid1, userId: buyer.id, eventId: event.id, seed: true })
      goingCount++

      // Purchase notification
      const nid = genId()
      await writer.set(db.collection('notifications').doc(nid), {
        id: nid, userId: buyer.id, type: 'purchase',
        title: `Ticket comprado: ${event.title}`,
        message: `Tu entrada para ${event.title} está lista. ¡Nos vemos en la pista!`,
        eventId: event.id, read: Math.random() < 0.6,
        createdAt: new Date().toISOString(), seed: true,
      })
    }

    // Extra "going" without a ticket — the interested crowd
    for (const r of interestedOnly) {
      const gid2 = genId()
      await writer.set(db.collection('going').doc(gid2), { id: gid2, userId: r.id, eventId: event.id, seed: true })
      goingCount++
    }

    // Update the event's public counters
    await writer.update(db.collection('events').doc(event.id), {
      ticketsSold: sold,
      tierSold: event.pricingMode === 'tiers' ? tierSold : FieldValue.delete(),
    })

    // Reviews only for past events
    if (isPast) {
      const reviewers = sample(buyers, Math.min(buyers.length, pick([8, 10, 12, 14])))
      for (const r of reviewers) {
        const rv = pick(REVIEW_TEXTS)
        const rid = genId()
        await writer.set(db.collection('reviews').doc(rid), {
          id: rid, userId: r.id, eventId: event.id,
          rating: rv.rating, text: rv.text,
          createdAt: new Date().toISOString(), seed: true,
        })
        reviewCount++
      }
    }

    console.log(`  · ${event.title}: ${crowd.length} van (${sold} con ticket), reseñas ${isPast ? 'sí' : 'no'}`)
  }

  // 5) A few subscriptions to upcoming events
  console.log('\nSuscripciones:')
  let subCount = 0
  const upcoming = events.filter(e => new Date(`${e.date}T00:00:00`) >= todayStart)
  for (const event of upcoming) {
    const subs = sample(ravers, pick([8, 12, 16, 20]))
    for (const r of subs) {
      const sid = genId()
      await writer.set(db.collection('subscriptions').doc(sid), {
        id: sid, userId: r.id, eventId: event.id,
        createdAt: new Date().toISOString(), reminded: false, seed: true,
      })
      subCount++
    }
  }
  console.log(`  + ${subCount} suscripciones`)

  // 6) Enrich the FIXED events (owned by src/lib/db.js: the ev-* and ev1..ev5
  //    featured events). They ship with a hardcoded ticketsSold but NO real
  //    attendees or reviews, so past ones look empty. Here we give every past
  //    fixed event a real crowd + reviews using the same raver pool, so the
  //    whole app shows consistent history. Flagged seed:true so unseed cleans
  //    them too. We DON'T touch future fixed events or the live event.
  console.log('\nEnriqueciendo eventos destacados (db.js):')
  const seededEventIds = new Set(events.map((e) => e.id))
  const allEventsSnap = await db.collection('events').get()
  const now = new Date()
  // An event only counts as "past with reviews" if it ended before TODAY —
  // an event happening today (or in the future) shouldn't carry reviews yet.
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let fixedEnriched = 0

  for (const docSnap of allEventsSnap.docs) {
    const ev = docSnap.data()
    if (seededEventIds.has(ev.id)) continue          // already handled above
    if (ev.id === 'ev-live') continue                // the live/now event
    const evDate = new Date(`${ev.date}T00:00:00`)
    const isPast = evDate < startOfToday

    // Skip if it already has reviews (idempotent-ish: don't double up)
    const existingReviews = await db.collection('reviews').where('eventId', '==', ev.id).limit(1).get()
    if (!existingReviews.empty) continue

    if (isPast) {
      // Real crowd for a past featured event — these are the big names, so
      // draw a strong turnout (most of the pool).
      const crowd = sample(ravers, Math.min(ravers.length, pick([28, 32, 36, 40])))
      const tier = ev.pricingMode === 'tiers' && ev.tiers?.length ? ev.tiers[0] : null

      for (const person of crowd) {
        // Going
        const gid = genId()
        await writer.set(db.collection('going').doc(gid), { id: gid, userId: person.id, eventId: ev.id, seed: true })
        goingCount++
        // Ticket (mostly checked-in since it already happened)
        const tid = genId()
        const used = Math.random() < 0.85
        await writer.set(db.collection('tickets').doc(tid), {
          id: tid, eventId: ev.id, userId: person.id,
          tierName: tier?.name || null,
          pricePaid: tier ? parseFloat(tier.price) : ev.price,
          purchaseDate: new Date().toISOString(),
          status: used ? 'used' : 'valid',
          usedAt: used ? new Date().toISOString() : null,
          qrCode: `RAVE-${Date.now()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
          seed: true,
        })
        ticketCount++
      }

      // Reviews from a good share of the crowd
      const reviewers = sample(crowd, Math.min(crowd.length, pick([10, 12, 15, 18])))
      for (const r of reviewers) {
        const rv = pick(REVIEW_TEXTS)
        const rid = genId()
        await writer.set(db.collection('reviews').doc(rid), {
          id: rid, userId: r.id, eventId: ev.id,
          rating: rv.rating, text: rv.text,
          createdAt: new Date().toISOString(), seed: true,
        })
        reviewCount++
      }

      // Align the public counter with the real crowd we just created, so the
      // "sold" number matches the attendee list. We do NOT flag the fixed event
      // itself as seed (db.js owns it); only its reviews/tickets/going carry
      // seed:true so unseed cleans those without deleting the event.
      await writer.update(db.collection('events').doc(ev.id), { ticketsSold: crowd.length })

      console.log(`  · ${ev.title}: ${crowd.length} asistieron, ${reviewers.length} reseñas`)
      fixedEnriched++
    } else {
      // Future featured event — give it subscribers so it doesn't look dead.
      const subs = sample(ravers, pick([10, 14, 18]))
      for (const r of subs) {
        const sid = genId()
        await writer.set(db.collection('subscriptions').doc(sid), {
          id: sid, userId: r.id, eventId: ev.id,
          createdAt: new Date().toISOString(), reminded: false, seed: true,
        })
        subCount++
        // Some of them also mark "going"
        if (Math.random() < 0.5) {
          const gid = genId()
          await writer.set(db.collection('going').doc(gid), { id: gid, userId: r.id, eventId: ev.id, seed: true })
          goingCount++
        }
      }
      console.log(`  · ${ev.title} (futuro): ${subs.length} suscriptores`)
      fixedEnriched++
    }
  }
  console.log(`  + ${fixedEnriched} eventos destacados enriquecidos`)

  // Flush any remaining batched writes
  await writer.flush()

  console.log('\n== Resumen ==')
  console.log(`  Organizadores: ${organizers.length}`)
  console.log(`  Ravers:        ${ravers.length}`)
  console.log(`  Eventos:       ${events.length}`)
  console.log(`  Tickets:       ${ticketCount}`)
  console.log(`  Asistencias:   ${goingCount}`)
  console.log(`  Reseñas:       ${reviewCount}`)
  console.log(`  Suscripciones: ${subCount}`)
  console.log(`\n  Contraseña de todas las cuentas sembradas: ${DEMO_PASSWORD}`)
  console.log('  Todos los documentos llevan { seed: true } para poder limpiarlos.\n')
}

run().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1) })
