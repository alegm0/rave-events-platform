// Anomaly Detection for Ticket Fraud
// Detects suspicious purchase patterns, bot behavior, and resale flagging
// Pure heuristic-based — no external APIs ($0)

/**
 * Analyze a ticket purchase for fraud signals
 * @param {object} purchase - { userId, eventId, timestamp }
 * @param {Array} allTickets - All tickets for analysis context
 * @param {Array} userHistory - All tickets by this user
 * @returns {object} Fraud risk assessment
 */
export const analyzePurchase = (purchase, allTickets, userHistory) => {
  const signals = []
  let riskScore = 0 // 0-100

  const { userId, eventId, timestamp } = purchase
  const purchaseTime = new Date(timestamp || Date.now())

  // ── Signal 1: Velocity check ──
  // Multiple purchases in rapid succession (bot behavior)
  const recentPurchases = userHistory.filter(t => {
    const diff = Math.abs(purchaseTime - new Date(t.purchaseDate))
    return diff < 60000 // within 1 minute
  })
  if (recentPurchases.length >= 3) {
    riskScore += 35
    signals.push({ type: 'velocity', severity: 'high', message: `${recentPurchases.length} compras en menos de 1 minuto — posible bot` })
  } else if (recentPurchases.length >= 2) {
    riskScore += 15
    signals.push({ type: 'velocity', severity: 'medium', message: 'Compras rápidas consecutivas' })
  }

  // ── Signal 2: Bulk buying ──
  // Same user buying many tickets to same event
  const sameEventTickets = userHistory.filter(t => t.eventId === eventId)
  if (sameEventTickets.length >= 5) {
    riskScore += 30
    signals.push({ type: 'bulk', severity: 'high', message: `${sameEventTickets.length} tickets para el mismo evento — posible reventa` })
  } else if (sameEventTickets.length >= 3) {
    riskScore += 15
    signals.push({ type: 'bulk', severity: 'medium', message: 'Múltiples tickets del mismo evento' })
  }

  // ── Signal 3: Off-hours purchase ──
  // Purchases at unusual hours (3-6 AM in local timezone) 
  const hour = purchaseTime.getHours()
  if (hour >= 3 && hour <= 5) {
    riskScore += 10
    signals.push({ type: 'timing', severity: 'low', message: 'Compra en horario inusual (3-5 AM)' })
  }

  // ── Signal 4: New account rapid spending ──
  // User created very recently and already buying expensive tickets
  const userTicketCount = userHistory.length
  if (userTicketCount === 0) {
    // First ticket ever — slight flag if it's a high-value event
    riskScore += 5
    signals.push({ type: 'new_account', severity: 'low', message: 'Primera compra de la cuenta' })
  }

  // ── Signal 5: Purchasing pattern across events ──
  // Buying tickets to events that are very different (genre/city) — scalper pattern
  const uniqueEvents = new Set(userHistory.map(t => t.eventId))
  if (uniqueEvents.size > 8) {
    riskScore += 20
    signals.push({ type: 'scatter', severity: 'medium', message: `Tickets a ${uniqueEvents.size} eventos distintos — patrón de scalper` })
  }

  // ── Signal 6: Rapid sell-out contribution ──
  // If event is selling fast and this user is buying bulk
  const eventTickets = allTickets.filter(t => t.eventId === eventId)
  const last10min = eventTickets.filter(t => {
    const diff = Math.abs(purchaseTime - new Date(t.purchaseDate))
    return diff < 600000 // 10 minutes
  })
  if (last10min.length > 20) {
    riskScore += 10
    signals.push({ type: 'surge', severity: 'medium', message: 'Compra durante pico de ventas inusual' })
  }

  // ── Risk level ──
  let riskLevel = 'low'
  if (riskScore >= 50) riskLevel = 'high'
  else if (riskScore >= 25) riskLevel = 'medium'

  return {
    riskScore: Math.min(100, riskScore),
    riskLevel,
    signals,
    action: riskLevel === 'high' ? 'flag' : riskLevel === 'medium' ? 'monitor' : 'allow',
    recommendation: getRecommendation(riskLevel, signals),
  }
}

function getRecommendation(level, signals) {
  if (level === 'high') return 'Compra flaggeada para revisión manual. Considere bloquear o requerir verificación adicional.'
  if (level === 'medium') return 'Actividad ligeramente sospechosa. Monitorear futuras compras de este usuario.'
  return 'Sin anomalías detectadas. Transacción normal.'
}

/**
 * Analyze all purchases for an event to detect overall fraud patterns
 * @param {Array} tickets - All tickets for event
 * @param {Array} allTickets - All tickets in system (for user history)
 * @returns {object} Event-level fraud report
 */
export const analyzeEventFraud = (tickets, allTickets) => {
  if (!tickets || tickets.length === 0) {
    return { riskLevel: 'low', flaggedCount: 0, alerts: [], summary: 'Sin datos suficientes para análisis.' }
  }

  // Group by user
  const userTickets = {}
  tickets.forEach(t => {
    if (!userTickets[t.userId]) userTickets[t.userId] = []
    userTickets[t.userId].push(t)
  })

  const alerts = []
  let flaggedCount = 0

  Object.entries(userTickets).forEach(([userId, userTix]) => {
    // Bulk buying detection
    if (userTix.length >= 4) {
      flaggedCount++
      alerts.push({
        userId,
        type: 'bulk_purchase',
        severity: userTix.length >= 6 ? 'high' : 'medium',
        message: `Usuario compró ${userTix.length} tickets`,
        ticketCount: userTix.length,
      })
    }

    // Rapid purchase detection
    const sorted = userTix.sort((a, b) => new Date(a.purchaseDate) - new Date(b.purchaseDate))
    for (let i = 1; i < sorted.length; i++) {
      const diff = new Date(sorted[i].purchaseDate) - new Date(sorted[i-1].purchaseDate)
      if (diff < 5000) { // 5 seconds between purchases
        alerts.push({
          userId,
          type: 'rapid_purchase',
          severity: 'high',
          message: 'Compras con menos de 5 segundos de diferencia',
        })
        flaggedCount++
        break
      }
    }
  })

  // Overall velocity check
  const sortedAll = [...tickets].sort((a, b) => new Date(a.purchaseDate) - new Date(b.purchaseDate))
  let maxBurstCount = 0
  for (let i = 0; i < sortedAll.length; i++) {
    const burst = sortedAll.filter(t => {
      const diff = new Date(t.purchaseDate) - new Date(sortedAll[i].purchaseDate)
      return diff >= 0 && diff < 60000 // 1 minute window
    })
    maxBurstCount = Math.max(maxBurstCount, burst.length)
  }
  if (maxBurstCount > 10) {
    alerts.push({
      type: 'traffic_spike',
      severity: 'medium',
      message: `Pico de ${maxBurstCount} compras en 1 minuto`,
    })
  }

  const riskLevel = flaggedCount > 3 ? 'high' : flaggedCount > 0 ? 'medium' : 'low'

  return {
    riskLevel,
    flaggedCount,
    totalBuyers: Object.keys(userTickets).length,
    alerts: alerts.sort((a, b) => (b.severity === 'high' ? 1 : 0) - (a.severity === 'high' ? 1 : 0)),
    stats: {
      avgTicketsPerUser: Math.round(tickets.length / Object.keys(userTickets).length * 10) / 10,
      maxTicketsOneUser: Math.max(...Object.values(userTickets).map(t => t.length)),
      maxBurstPerMinute: maxBurstCount,
    },
    summary: riskLevel === 'high'
      ? `⚠️ ${flaggedCount} compradores flaggeados. Se detectó actividad sospechosa.`
      : riskLevel === 'medium'
      ? `⚡ ${flaggedCount} alerta(s) menor(es). Monitorear.`
      : '✅ No se detectaron anomalías. Compras normales.',
  }
}
