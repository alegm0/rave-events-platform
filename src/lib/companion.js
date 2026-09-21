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
      if (rest.length) parts.push(`zona de descanso (${rest.map((s) => s.label).join(', ')})`)
      if (quiet.length) parts.push(`zona tranquila (${quiet.map((z) => z.label).join(', ')})`)
      if (!parts.length) return 'Este venue no declara zonas de descanso ni áreas tranquilas todavía.'
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
    keywords: ['quién sigue', 'quien sigue', 'siguiente', 'después', 'despues', 'next', 'a qué hora', 'a que hora', 'cuándo toca', 'cuando toca'],
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
    keywords: ['escenario', 'stage', 'dónde está', 'donde esta', 'cómo llego', 'como llego', 'mi dj'],
    resolve: ({ venue }) => {
      const stages = (venue?.zones || []).filter((z) => z.type === 'stage')
      if (!stages.length) return 'No hay escenarios declarados en la información del venue.'
      return `Escenarios: ${stages.map((z) => z.label).join(' · ')}. Míralos en el mapa del venue.`
    },
  },
  {
    id: 'what_to_bring',
    keywords: ['llevar', 'llevo', 'traer', 'traigo', 'documento', 'identificación', 'identificacion', 'guardarropa', 'edad', 'nuevo aquí', 'nuevo aqui', 'primera vez', 'antes de ir', 'necesito para'],
    resolve: ({ event }) => {
      const kbyg = event?.venue?.knowBeforeYouGo || []
      const age = event?.minAge ? `Edad mínima: +${event.minAge}.` : ''
      if (!kbyg.length && !age) return 'No hay indicaciones especiales declaradas para este evento.'
      return [age, ...kbyg].filter(Boolean).join(' ')
    },
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
      'Solo puedo responder con la información verificada de este evento: horarios, escenarios, agua, baños, accesibilidad, descanso, salidas y qué llevar. Prueba preguntando por alguno de esos.',
  }
}

/**
 * Suggested questions to seed the UI — only ones this event can actually answer.
 */
export const getSuggestedQuestions = (event) => {
  const venue = event?.venue
  const qs = []
  if ((venue?.zones || []).some((z) => z.type === 'stage')) qs.push('¿Cómo llego a mi escenario?')
  if (findServices(venue, 'toilet', true).length) qs.push('¿Dónde hay un baño accesible?')
  if (findServices(venue, 'rest').length || (venue?.zones || []).some((z) => z.type === 'quiet'))
    qs.push('Me abruma la gente, ¿dónde puedo descansar?')
  if ((event?.lineup || []).some((a) => (typeof a === 'object' ? a.time : false))) qs.push('¿Quién toca ahora?')
  qs.push('¿Qué necesito llevar?')
  return qs.slice(0, 4)
}
