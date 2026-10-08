// Rave Companion — rule-based assistant (intent matching).
// It answers ONLY from verified event / venue / timetable / preference data.
// If the data doesn't exist, it says so. It never invents information.
// This is "retrieval over structured, verified data", not generation.

import { buildTimeline, getNowNext, formatTime, minutesUntil } from './timetable'
import { findServices, hasStepFreeAccess } from './venue'

// Each intent has trigger keywords and a resolver that reads real data.
const INTENTS = [
  {
    id: 'accessible_toilet',
    keywords: ['baño accesible', 'bano accesible', 'baño para discapacitados', 'toilet accesible', 'accessible toilet', 'baño silla'],
    resolve: ({ venue }) => {
      const acc = findServices(venue, 'toilet', true)
      if (acc.length) return `Sí. Baño accesible: ${acc.map((s) => s.label).join(', ')}${acc[0].walkMin ? ` (a ~${acc[0].walkMin} min)` : ''}.`
      const any = findServices(venue, 'toilet')
      if (any.length) return `Este venue tiene baños (${any.map((s) => s.label).join(', ')}), pero no hay uno marcado como accesible en la información del evento.`
      return 'La información del venue no incluye baños todavía.'
    },
  },
  {
    id: 'toilet',
    keywords: ['baño', 'bano', 'toilet', 'baños', 'wc', 'servicios sanitarios'],
    resolve: ({ venue }) => {
      const any = findServices(venue, 'toilet')
      if (!any.length) return 'La información del venue no incluye baños todavía.'
      return `Baños: ${any.map((s) => `${s.label}${s.walkMin ? ` (~${s.walkMin} min)` : ''}${s.accessible ? ' · accesible' : ''}`).join(' · ')}.`
    },
  },
  {
    id: 'water',
    keywords: ['agua', 'water', 'hidrat', 'sed'],
    resolve: ({ venue }) => {
      const w = findServices(venue, 'water')
      if (!w.length) return 'No hay estaciones de agua declaradas para este venue.'
      return `Estaciones de agua: ${w.map((s) => `${s.label}${s.walkMin ? ` (~${s.walkMin} min)` : ''}`).join(' · ')}.`
    },
  },
  {
    id: 'rest_break',
    keywords: ['descansar', 'descanso', 'sentarme', 'sentar', 'break', 'cansad', 'agobi', 'me abruma', 'overwhelmed', 'lleno de gente', 'mucha gente'],
    resolve: ({ venue }) => {
      const rest = findServices(venue, 'rest')
      const quiet = (venue?.zones || []).filter((z) => z.type === 'quiet')
      const parts = []
      if (rest.length) parts.push(`zona de respiro (${rest.map((s) => s.label).join(', ')})`)
      if (quiet.length) parts.push(`zona tranquila (${quiet.map((z) => z.label).join(', ')})`)
      if (!parts.length) return 'Este venue no declara zonas de respiro ni áreas tranquilas todavía.'
      return `Puedes tomar un respiro en: ${parts.join(' y ')}.`
    },
  },
  {
    id: 'quiet',
    keywords: ['tranquil', 'silenci', 'quiet', 'ruido', 'menos ruido', 'chill'],
    resolve: ({ venue }) => {
      const quiet = (venue?.zones || []).filter((z) => z.type === 'quiet')
      if (!quiet.length) return 'No hay una zona tranquila declarada para este venue.'
      return `Zona tranquila: ${quiet.map((z) => z.label).join(', ')}.`
    },
  },
  {
    id: 'step_free',
    keywords: ['sin escalones', 'step free', 'step-free', 'silla de ruedas', 'wheelchair', 'rampa', 'acceso accesible', 'entrada accesible'],
    resolve: ({ venue }) => {
      if (hasStepFreeAccess(venue)) {
        const acc = findServices(venue, 'entrance', true)
        return `Sí, hay acceso sin escalones: ${acc.map((s) => s.label).join(', ')}.`
      }
      return 'Según la información del evento, este venue no tiene una entrada sin escalones.'
    },
  },
  {
    id: 'exit',
    keywords: ['salida', 'salir', 'exit', 'emergencia'],
    resolve: ({ venue }) => {
      const ex = findServices(venue, 'exit')
      if (!ex.length) return 'No hay salidas declaradas en la información del venue.'
      return `Salidas: ${ex.map((s) => s.label).join(' · ')}.`
    },
  },
  {
    id: 'firstaid',
    keywords: ['first aid', 'primeros auxilios', 'enfermería', 'enfermeria', 'médico', 'medico', 'ayuda médica', 'me siento mal'],
    resolve: ({ venue }) => {
      const fa = findServices(venue, 'firstaid')
      if (!fa.length) return 'No hay un punto de primeros auxilios declarado para este venue.'
      return `First Aid: ${fa.map((s) => `${s.label}${s.walkMin ? ` (~${s.walkMin} min)` : ''}`).join(' · ')}.`
    },
  },
  {
    id: 'now_playing',
    keywords: ['quién toca', 'quien toca', 'ahora', 'now playing', 'sonando', 'qué suena', 'que suena'],
    resolve: ({ event }) => {
      const tl = buildTimeline(event)
      if (!tl.length) return 'Este evento no tiene horarios de lineup declarados.'
      const { current } = getNowNext(tl)
      if (current) return `Ahora: ${current.name} (desde las ${formatTime(current.start)}).`
      return `El primer set es ${tl[0].name} a las ${formatTime(tl[0].start)}.`
    },
  },
  {
    id: 'next_act',
    keywords: ['quién sigue', 'quien sigue', 'siguiente', 'después toca', 'despues toca', 'next', 'cuándo toca', 'cuando toca', 'a qué hora toca', 'a que hora toca', 'próximo set', 'proximo set'],
    resolve: ({ event }) => {
      const tl = buildTimeline(event)
      if (!tl.length) return 'Este evento no tiene horarios de lineup declarados.'
      const { next } = getNowNext(tl)
      if (next) {
        const mins = minutesUntil(next.start)
        // Only show a countdown when it's within the same session (< 12h)
        const soon = mins > 0 && mins <= 720
        return `Sigue ${next.name} a las ${formatTime(next.start)}${soon ? ` (en ~${mins} min)` : ''}.`
      }
      return `El horario completo: ${tl.map((t) => `${formatTime(t.start)} ${t.name}`).join(' · ')}.`
    },
  },
  {
    id: 'stage',
    keywords: ['escenario', 'stage', 'cómo llego a mi escenario', 'como llego a mi escenario', 'cómo llego al escenario', 'como llego al escenario', 'dónde toca', 'donde toca mi', 'mi dj'],
    resolve: ({ venue }) => {
      const stages = (venue?.zones || []).filter((z) => z.type === 'stage')
      if (!stages.length) return 'No hay escenarios declarados en la información del venue.'
      return `Escenarios: ${stages.map((z) => z.label).join(' · ')}. Míralos en el mapa del venue.`
    },
  },
  {
    id: 'what_to_bring',
    keywords: ['llevar', 'llevo', 'traer', 'traigo', 'documento', 'identificación', 'identificacion', 'nuevo aquí', 'nuevo aqui', 'primera vez', 'antes de ir', 'necesito para'],
    resolve: ({ event }) => {
      const kbyg = event?.venue?.knowBeforeYouGo || []
      const age = event?.minAge ? `Edad mínima: +${event.minAge}.` : ''
      if (!kbyg.length && !age) return 'No hay indicaciones especiales declaradas para este evento.'
      return [age, ...kbyg].filter(Boolean).join(' ')
    },
  },
  {
    id: 'doors_open',
    keywords: ['a qué hora abre', 'a que hora abre', 'abren puertas', 'puertas', 'apertura', 'a qué hora empieza', 'a que hora empieza', 'empieza', 'hora de inicio', 'inicio'],
    resolve: ({ event }) => {
      if (!event?.time) return 'La hora de apertura no está declarada para este evento.'
      return `Las puertas abren a las ${event.time}.`
    },
  },
  {
    id: 'end_time',
    keywords: ['a qué hora termina', 'a que hora termina', 'termina', 'hasta qué hora', 'hasta que hora', 'cuánto dura', 'cuanto dura', 'duración', 'duracion', 'cierre'],
    resolve: ({ event }) => {
      if (!event?.time || !event?.duration) return 'La duración del evento no está declarada.'
      const [h, m] = event.time.split(':').map(Number)
      const endH = (h + event.duration) % 24
      const end = `${String(endH).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`
      const nextDay = h + event.duration >= 24
      return `El evento dura ~${event.duration}h: de ${event.time} a ${end}${nextDay ? ' (del día siguiente)' : ''}.`
    },
  },
  {
    id: 'price',
    keywords: ['precio', 'cuánto cuesta', 'cuanto cuesta', 'vale', 'cuánto vale', 'cuanto vale', 'entrada cuánto', 'ticket cuánto', 'cost'],
    resolve: ({ event }) => {
      if (event?.pricingMode === 'tiers' && event?.tiers?.length) {
        const t = event.tiers.map((x) => `${x.name} AUD ${x.price}`).join(' · ')
        return `Entradas por fases: ${t}. Se vende una fase a la vez.`
      }
      if (typeof event?.price === 'number') return `La entrada general cuesta AUD ${event.price}.`
      return 'El precio no está declarado para este evento.'
    },
  },
  {
    id: 'location',
    keywords: ['dónde queda', 'donde queda', 'dónde es', 'donde es', 'dirección', 'direccion', 'ubicación', 'ubicacion', 'cómo llego al venue', 'como llego al venue', 'lugar', 'venue dónde', 'address'],
    resolve: ({ event }) => {
      const parts = []
      if (event?.location) parts.push(event.location)
      if (event?.address) parts.push(event.address)
      if (event?.city) parts.push(event.city)
      if (!parts.length) return 'La ubicación no está declarada para este evento.'
      return `El evento es en ${event.location || 'el venue'}, ${[event.address, event.city].filter(Boolean).join(', ')}.`
    },
  },
  {
    id: 'date',
    keywords: ['qué día', 'que dia', 'cuándo es', 'cuando es', 'fecha', 'qué fecha', 'que fecha'],
    resolve: ({ event }) => {
      if (!event?.date) return 'La fecha no está declarada para este evento.'
      const d = new Date(`${event.date}T00:00:00`)
      const fmt = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      return `El evento es el ${fmt}${event.time ? `, puertas a las ${event.time}` : ''}.`
    },
  },
  {
    id: 'lineup',
    keywords: ['lineup', 'line-up', 'line up', 'quiénes tocan', 'quienes tocan', 'artistas', 'djs', 'cartel', 'quién va a tocar', 'quien va a tocar'],
    resolve: ({ event }) => {
      const lu = event?.lineup || []
      if (!lu.length) return 'El line-up no está declarado para este evento todavía.'
      const names = lu.map((a) => {
        if (typeof a === 'string') return a
        return a.time ? `${a.time} ${a.name}` : a.name
      })
      return `Line-up: ${names.join(' · ')}.`
    },
  },
  {
    id: 'smoking',
    keywords: ['fumar', 'fumador', 'smoking', 'cigarrillo', 'zona de fumadores'],
    resolve: ({ venue }) => {
      const sm = findServices(venue, 'smoking')
      if (!sm.length) return 'No hay una zona de fumadores declarada para este venue.'
      return `Zona de fumadores: ${sm.map((s) => `${s.label}${s.walkMin ? ` (~${s.walkMin} min)` : ''}`).join(' · ')}.`
    },
  },
  {
    id: 'capacity',
    keywords: ['capacidad', 'aforo', 'cuánta gente', 'cuanta gente', 'qué tan lleno', 'que tan lleno', 'cuántos caben', 'cuantos caben', 'lleno'],
    resolve: ({ event }) => {
      if (!event?.capacity) return 'El aforo no está declarado para este evento.'
      const sold = event.ticketsSold || 0
      const pct = Math.round((sold / event.capacity) * 100)
      return `Aforo: ${event.capacity} personas. Van ${sold} entradas (${pct}% vendido).`
    },
  },
  {
    id: 'age',
    keywords: ['edad', 'edad mínima', 'edad minima', 'menores', 'mayor de edad', '+18', '+21', 'puedo entrar si tengo'],
    resolve: ({ event }) => {
      if (!event?.minAge) return 'No hay una edad mínima declarada para este evento.'
      return `Edad mínima: +${event.minAge}. Trae documento de identidad para validar en puerta.`
    },
  },
  {
    id: 'cloakroom',
    keywords: ['guardarropa', 'guardar abrigo', 'dejar cosas', 'casillero', 'locker'],
    resolve: ({ event }) => {
      const kbyg = (event?.venue?.knowBeforeYouGo || []).join(' ').toLowerCase()
      if (kbyg.includes('guardarropa')) {
        const line = (event.venue.knowBeforeYouGo || []).find((k) => k.toLowerCase().includes('guardarropa'))
        return line || 'Revisa las indicaciones del evento sobre guardarropa.'
      }
      return 'No hay información declarada sobre guardarropa para este evento.'
    },
  },
  {
    id: 'weather',
    keywords: ['clima', 'lluvia', 'va a llover', 'frío', 'frio', 'calor', 'al aire libre', 'techo', 'cubierto'],
    resolve: ({ venue }) => {
      if (venue?.layout === 'outdoor') return 'Es un evento al aire libre: revisa el clima antes de ir y abrígate si refresca de noche.'
      if (venue?.layout === 'indoor') return 'Es un evento en espacio cerrado, así que el clima de afuera no afecta mucho.'
      return 'No está declarado si el evento es al aire libre o cerrado.'
    },
  },
  {
    id: 'greeting',
    keywords: ['hola', 'buenas', 'hey', 'qué tal', 'que tal', 'gracias', 'thanks', 'muchas gracias'],
    resolve: () => 'Hola. Pregúntame por horarios, line-up, precio, ubicación, agua, baños, accesibilidad, descanso o salidas de este evento.',
  },
]

const normalize = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents for matching

/**
 * Match a free-text question to an intent and resolve it over verified data.
 * @returns {{ intent, answer }} — answer is null if nothing matched.
 */
export const askCompanion = (question, { event, venue } = {}) => {
  const q = normalize(question)
  const ctx = { event, venue: venue || event?.venue }

  for (const intent of INTENTS) {
    const hit = intent.keywords.some((kw) => q.includes(normalize(kw)))
    if (hit) return { intent: intent.id, answer: intent.resolve(ctx) }
  }
  return {
    intent: null,
    answer:
      'Solo puedo responder con la información verificada de este evento: line-up y horarios, precio, ubicación y fecha, agua, baños, accesibilidad, descanso, zona de fumadores, aforo, salidas y qué llevar. Prueba preguntando por alguno de esos.',
  }
}

/**
 * Suggested questions to seed the UI — only ones this event can actually answer.
 */
export const getSuggestedQuestions = (event) => {
  const venue = event?.venue
  const qs = []
  // Line-up / timing
  if ((event?.lineup || []).some((a) => (typeof a === 'object' ? a.time : false))) qs.push('¿Quién toca ahora?')
  if ((event?.lineup || []).length) qs.push('¿Quiénes tocan?')
  // The practical ones a raver actually asks before/at the event
  if (findServices(venue, 'water').length) qs.push('¿Dónde hay agua?')
  if (findServices(venue, 'toilet', true).length) qs.push('¿Dónde hay un baño accesible?')
  if (findServices(venue, 'rest').length || (venue?.zones || []).some((z) => z.type === 'quiet'))
    qs.push('Me abruma la gente, ¿dónde puedo descansar?')
  if (findServices(venue, 'smoking').length) qs.push('¿Dónde puedo fumar?')
  // Logistics
  if (event?.price != null || event?.tiers?.length) qs.push('¿Cuánto cuesta la entrada?')
  if (event?.time) qs.push('¿A qué hora abren puertas?')
  if (event?.location) qs.push('¿Dónde queda el venue?')
  qs.push('¿Qué necesito llevar?')
  return qs.slice(0, 6)
}
