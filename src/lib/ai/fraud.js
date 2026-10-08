// Anomaly Detection for Ticket Fraud
// Detects suspicious purchase patterns, bot behavior, and resale flagging
// Pure heuristic-based — no external APIs ($0)

/**
 * Analyze all purchases for an event to detect overall fraud patterns
 * @param {Array} tickets - All tickets for event
 * @param {Array} allTickets - All tickets in system (for user history)
 * @returns {object} Event-level fraud report
 */
export const analyzeEventFraud = (tickets, allTickets) => {
  if (!tickets || tickets.length === 0) {
    return {
      riskLevel: 'low', flaggedCount: 0, alerts: [],
      totalBuyers: 0,
      stats: { burstPeak: 0, offHoursPct: 0, scalperBuyers: 0 },
      summary: 'Sin datos suficientes para análisis.',
    }
  }

  // IMPORTANT: this platform enforces one ticket per user per event (RF07), so
  // classic "bulk buying" or "rapid repeat purchase" by a single user is
  // impossible here. Detecting it would be theatre. Instead we look at signals
  // that CAN actually occur under that rule: cross-user purchase bursts (bot
  // swarms grabbing one ticket each), off-hours concentration, and users who
  // behave like scalpers across many different events (needs full history).
  const buyers = new Set(tickets.map(t => t.userId))
  const alerts = []

  // ── Signal 1: Purchase burst across distinct users ──
  // Many different accounts buying within the same minute looks like a bot
  // swarm or a resale operation spreading purchases across accounts.
  const sortedAll = [...tickets].sort((a, b) => new Date(a.purchaseDate) - new Date(b.purchaseDate))
  let burstPeak = 0
  for (let i = 0; i < sortedAll.length; i++) {
    const windowUsers = new Set(
      sortedAll.filter(t => {
        const diff = new Date(t.purchaseDate) - new Date(sortedAll[i].purchaseDate)
        return diff >= 0 && diff < 60000 // 1-minute window
      }).map(t => t.userId)
    )
    burstPeak = Math.max(burstPeak, windowUsers.size)
  }
  if (burstPeak > 15) {
    alerts.push({ type: 'traffic_spike', severity: 'high', message: `Pico de ${burstPeak} compradores distintos en 1 minuto — posible swarm de bots` })
  } else if (burstPeak > 8) {
    alerts.push({ type: 'traffic_spike', severity: 'medium', message: `Pico de ${burstPeak} compradores en 1 minuto — vigilar` })
  }

  // ── Signal 2: Off-hours concentration (3-5 AM) ──
  const offHours = tickets.filter(t => {
    const h = new Date(t.purchaseDate).getHours()
    return h >= 3 && h <= 5
  }).length
  const offHoursPct = Math.round((offHours / tickets.length) * 100)
  if (tickets.length >= 10 && offHoursPct >= 40) {
    alerts.push({ type: 'off_hours', severity: 'medium', message: `${offHoursPct}% de las compras ocurrieron entre 3-5 AM — patrón automatizado` })
  }

  // ── Signal 3: Scalper behaviour across events (uses full ticket history) ──
  // A buyer holding tickets to an unusually high number of distinct events
  // across the platform resembles a scalper. Only computable with allTickets.
  let scalperBuyers = 0
  if (Array.isArray(allTickets) && allTickets.length) {
    const eventsByUser = {}
    allTickets.forEach(t => {
      if (!buyers.has(t.userId)) return
      ;(eventsByUser[t.userId] ||= new Set()).add(t.eventId)
    })
    Object.entries(eventsByUser).forEach(([userId, evSet]) => {
      if (evSet.size > 8) {
        scalperBuyers++
        alerts.push({ type: 'scalper', severity: 'medium', message: `Comprador con tickets a ${evSet.size} eventos distintos — patrón de scalper`, userId })
      }
    })
  }

  const flaggedCount = alerts.length
  const hasHighAlert = alerts.some(a => a.severity === 'high')
  let riskLevel = 'low'
  if (hasHighAlert) riskLevel = 'high'
  else if (flaggedCount > 0) riskLevel = 'medium'

  const summary = riskLevel === 'high'
    ? '⚠️ Se detectó actividad potencialmente automatizada. Revisa las alertas.'
    : riskLevel === 'medium'
    ? `⚡ ${flaggedCount} alerta(s) para monitorear. Sin riesgo alto.`
    : '✅ No se detectaron anomalías. Compras normales.'

  return {
    riskLevel,
    flaggedCount,
    totalBuyers: buyers.size,
    alerts: alerts.sort((a, b) => (b.severity === 'high' ? 1 : 0) - (a.severity === 'high' ? 1 : 0)),
    stats: {
      burstPeak,
      offHoursPct,
      scalperBuyers,
    },
    summary,
  }
}
