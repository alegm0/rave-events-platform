// Real-time Sentiment Analysis Pipeline
// NLP-driven insights for organizers from attendee reviews
// No external APIs — uses keyword/pattern-based analysis (works offline, $0)

// Sentiment lexicons (Spanish + English for electronic music context)
const POSITIVE_WORDS = [
  // Spanish
  'increíble', 'increible', 'brutal', 'genial', 'excelente', 'perfecto', 'impresionante',
  'espectacular', 'hermoso', 'épico', 'épica', 'lo mejor', 'wow', 'tremendo',
  'buenísimo', 'buenisimo', 'maravilloso', 'sublime', 'fantástico', 'fantastico',
  'extraordinario', 'inmejorable', 'brutal', 'crack', 'top', 'diosa', 'dios',
  'fiesta', 'goce', 'vibra', 'energía', 'energia', 'ambientazo', 'bomba',
  'recomiendo', 'repetiría', 'repetiria', 'volvería', 'volveria', 'encantó', 'encanto',
  'alucinante', 'magistral', 'bestial', 'imponente',
  // English
  'amazing', 'incredible', 'awesome', 'perfect', 'love', 'best', 'great',
  'fire', 'lit', 'insane', 'mind-blowing', 'unreal', 'sick', 'dope',
  'legendary', 'vibes', 'euphoric', 'bliss', 'transcendent',
]

const NEGATIVE_WORDS = [
  // Spanish
  'malo', 'pésimo', 'pesimo', 'horrible', 'terrible', 'decepción', 'decepcion',
  'decepcionante', 'aburrido', 'mediocre', 'caro', 'costoso', 'robo',
  'estafa', 'mal', 'pésima', 'pesima', 'basura', 'desastre', 'desorganizado',
  'no recomiendo', 'nunca más', 'nunca mas', 'perdida de tiempo',
  'vacío', 'vacio', 'frío', 'frio', 'muerto', 'lento',
  'feo', 'sucia', 'sucio', 'peligroso', 'inseguro',
  // English
  'bad', 'terrible', 'horrible', 'awful', 'worst', 'hate', 'boring',
  'disappointing', 'scam', 'overpriced', 'empty', 'dead', 'weak',
]

// Aspect categories for electronic music events
const ASPECTS = {
  music: {
    keywords: ['música', 'musica', 'music', 'sonido', 'sound', 'bass', 'beat', 'dj', 'set', 'track', 'mix', 'lineup', 'artista', 'artistas', 'techno', 'house', 'drop', 'melody', 'melodía', 'riff', 'sintetizador'],
    label: 'Música / DJs'
  },
  sound: {
    keywords: ['sonido', 'sound', 'audio', 'speakers', 'parlantes', 'volumen', 'bass', 'bajo', 'graves', 'agudos', 'equalización', 'system', 'funktion'],
    label: 'Sistema de sonido'
  },
  venue: {
    keywords: ['lugar', 'venue', 'espacio', 'sitio', 'local', 'club', 'warehouse', 'terraza', 'pista', 'dancefloor', 'iluminación', 'luces', 'decoración', 'ambiente', 'atmosfera', 'atmósfera'],
    label: 'Venue / Ambiente'
  },
  organization: {
    keywords: ['organización', 'organizacion', 'fila', 'cola', 'entrada', 'seguridad', 'staff', 'personal', 'baños', 'banos', 'limpieza', 'servicio', 'bar', 'barra', 'bebidas', 'comida', 'agua'],
    label: 'Organización'
  },
  crowd: {
    keywords: ['gente', 'público', 'publico', 'crowd', 'people', 'comunidad', 'ambiente', 'vibra', 'vibe', 'energía', 'energia', 'tribu', 'familia', 'respect', 'respeto'],
    label: 'Público / Comunidad'
  },
  price: {
    keywords: ['precio', 'price', 'caro', 'barato', 'costoso', 'económico', 'economico', 'vale la pena', 'worth', 'ticket', 'entrada', 'cover'],
    label: 'Precio / Valor'
  }
}

/**
 * Analyze sentiment of a single review
 * @param {string} text - Review text
 * @returns {object} Sentiment analysis result
 */
export const analyzeReview = (text) => {
  if (!text) return { score: 0, label: 'neutral', aspects: [] }

  const lower = text.toLowerCase()
  const words = lower.split(/\s+/)

  // Score calculation
  let positiveCount = 0
  let negativeCount = 0
  const foundPositive = []
  const foundNegative = []

  POSITIVE_WORDS.forEach(w => {
    if (lower.includes(w)) { positiveCount++; foundPositive.push(w) }
  })
  NEGATIVE_WORDS.forEach(w => {
    if (lower.includes(w)) { negativeCount++; foundNegative.push(w) }
  })

  // Negation detection (reverses next word)
  const negations = ['no', 'ni', 'nunca', 'jamás', 'jamas', 'sin', 'not', 'never']
  words.forEach((word, i) => {
    if (negations.includes(word) && i < words.length - 1) {
      const next = words[i + 1]
      if (POSITIVE_WORDS.some(p => next.includes(p))) { positiveCount--; negativeCount++ }
      if (NEGATIVE_WORDS.some(n => next.includes(n))) { negativeCount--; positiveCount++ }
    }
  })

  // Emoji sentiment
  const positiveEmojis = (text.match(/[😍🥰🔥💯❤️🎉🙌👏✨💪🤩😎🫶💜⚡️]/g) || []).length
  const negativeEmojis = (text.match(/[😡👎💀😤😢😞😒🤮]/g) || []).length
  positiveCount += positiveEmojis
  negativeCount += negativeEmojis

  // Calculate score (-1 to 1)
  const total = positiveCount + negativeCount
  let score = 0
  if (total > 0) score = (positiveCount - negativeCount) / total

  // Detect aspects mentioned
  const aspects = []
  Object.entries(ASPECTS).forEach(([key, { keywords, label }]) => {
    const mentioned = keywords.filter(kw => lower.includes(kw))
    if (mentioned.length > 0) {
      // Determine aspect-level sentiment
      let aspectSentiment = score // default to overall
      aspects.push({ key, label, mentioned, sentiment: aspectSentiment > 0.2 ? 'positive' : aspectSentiment < -0.2 ? 'negative' : 'neutral' })
    }
  })

  return {
    score: Math.round(score * 100) / 100,
    label: score > 0.2 ? 'positive' : score < -0.2 ? 'negative' : 'neutral',
    confidence: Math.min(1, total * 0.2),
    positiveWords: foundPositive,
    negativeWords: foundNegative,
    aspects,
  }
}

/**
 * Analyze all reviews for an event — generate insights for organizer
 * @param {Array} reviews - Array of {text, rating, userName, createdAt}
 * @returns {object} Comprehensive sentiment report
 */
export const analyzeEventSentiment = (reviews) => {
  if (!reviews || reviews.length === 0) {
    return {
      overallSentiment: 'neutral',
      overallScore: 0,
      totalReviews: 0,
      breakdown: { positive: 0, neutral: 0, negative: 0 },
      aspectScores: {},
      insights: [],
      keywords: { positive: [], negative: [] },
      timeline: [],
    }
  }

  const analyzed = reviews.map(r => ({
    ...r,
    sentiment: analyzeReview(r.text),
  }))

  // Overall breakdown
  const positive = analyzed.filter(r => r.sentiment.label === 'positive').length
  const negative = analyzed.filter(r => r.sentiment.label === 'negative').length
  const neutral = analyzed.length - positive - negative

  const overallScore = analyzed.reduce((s, r) => s + r.sentiment.score, 0) / analyzed.length

  // Aspect aggregation
  const aspectScores = {}
  Object.keys(ASPECTS).forEach(key => {
    const relevant = analyzed.filter(r => r.sentiment.aspects.some(a => a.key === key))
    if (relevant.length > 0) {
      const pos = relevant.filter(r => r.sentiment.aspects.find(a => a.key === key)?.sentiment === 'positive').length
      const neg = relevant.filter(r => r.sentiment.aspects.find(a => a.key === key)?.sentiment === 'negative').length
      aspectScores[key] = {
        label: ASPECTS[key].label,
        mentions: relevant.length,
        positive: pos,
        negative: neg,
        score: relevant.length > 0 ? (pos - neg) / relevant.length : 0,
      }
    }
  })

  // Top keywords
  const allPositive = analyzed.flatMap(r => r.sentiment.positiveWords)
  const allNegative = analyzed.flatMap(r => r.sentiment.negativeWords)
  const posFreq = countFrequency(allPositive).slice(0, 5)
  const negFreq = countFrequency(allNegative).slice(0, 5)

  // Generate insights
  const insights = generateInsights(positive, negative, neutral, aspectScores, analyzed)

  // Sentiment over time
  const timeline = analyzed
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map((r, i) => ({
      date: r.createdAt,
      score: r.sentiment.score,
      cumulative: analyzed.slice(0, i + 1).reduce((s, x) => s + x.sentiment.score, 0) / (i + 1),
    }))

  return {
    overallSentiment: overallScore > 0.2 ? 'positive' : overallScore < -0.2 ? 'negative' : 'mixed',
    overallScore: Math.round(overallScore * 100) / 100,
    totalReviews: reviews.length,
    breakdown: { positive, neutral, negative },
    aspectScores,
    insights,
    keywords: { positive: posFreq, negative: negFreq },
    timeline,
    reviews: analyzed,
  }
}

function countFrequency(arr) {
  const freq = {}
  arr.forEach(w => { freq[w] = (freq[w] || 0) + 1 })
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([word, count]) => ({ word, count }))
}

function generateInsights(pos, neg, neutral, aspects, analyzed) {
  const insights = []
  const total = pos + neg + neutral

  // Overall sentiment insight
  if (pos / total > 0.7) insights.push({ type: 'success', text: `${Math.round(pos/total*100)}% de reviews son positivas. Tu evento dejó una gran impresión.` })
  else if (neg / total > 0.4) insights.push({ type: 'warning', text: `${Math.round(neg/total*100)}% de reviews son negativas. Revisa los aspectos con baja puntuación.` })

  // Aspect insights
  Object.entries(aspects).forEach(([key, data]) => {
    if (data.score > 0.5 && data.mentions >= 2) {
      insights.push({ type: 'success', text: `"${data.label}" destaca positivamente (${data.positive} menciones positivas).` })
    }
    if (data.score < -0.3 && data.mentions >= 2) {
      insights.push({ type: 'alert', text: `"${data.label}" tiene feedback negativo (${data.negative} menciones negativas). Considera mejorar este aspecto.` })
    }
  })

  // Rating vs sentiment mismatch
  const avgRating = analyzed.reduce((s, r) => s + (r.rating || 3), 0) / total
  const avgSentiment = analyzed.reduce((s, r) => s + r.sentiment.score, 0) / total
  if (avgRating >= 4 && avgSentiment < 0) {
    insights.push({ type: 'info', text: 'Las calificaciones son altas pero el texto de las reviews sugiere áreas de mejora.' })
  }

  if (insights.length === 0) {
    insights.push({ type: 'info', text: 'Sentimiento general mixto. Revisa los comentarios individuales para detalles.' })
  }

  return insights
}
