// Dynamic Pricing Engine
// Adjusts ticket prices based on demand velocity and remaining capacity
// No external APIs needed — pure algorithmic pricing

/**
 * Calculate dynamic price based on demand signals
 * @param {object} event - Event data
 * @param {Array} tickets - All tickets for this event
 * @returns {object} Pricing analysis
 */
export const calculateDynamicPrice = (event, tickets = []) => {
  const basePrice = event.price || 0
  const capacity = event.capacity || 200
  const sold = tickets.length || event.ticketsSold || 0
  const remaining = capacity - sold

  // ── Demand Velocity ──
  // Calculate how fast tickets are selling (tickets per day)
  const now = new Date()
  const eventDate = new Date(event.date)
  const daysUntilEvent = Math.max(1, Math.ceil((eventDate - now) / (1000 * 60 * 60 * 24)))

  // Sort tickets by purchase date to analyze velocity
  const sortedTickets = [...tickets].sort((a, b) => new Date(a.purchaseDate) - new Date(b.purchaseDate))

  // Recent velocity (last 7 days)
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)
  const recentSales = sortedTickets.filter(t => new Date(t.purchaseDate) > weekAgo).length
  const dailyVelocity = recentSales / 7

  // Expected velocity to sell out evenly
  const expectedDailyVelocity = remaining / daysUntilEvent

  // Velocity ratio: > 1 means selling faster than expected
  const velocityRatio = expectedDailyVelocity > 0 ? dailyVelocity / expectedDailyVelocity : 0

  // ── Capacity Pressure ──
  const capacityPct = (sold / capacity) * 100
  let capacityMultiplier = 1.0
  if (capacityPct > 90) capacityMultiplier = 1.5       // Last 10% — premium
  else if (capacityPct > 75) capacityMultiplier = 1.3  // High demand
  else if (capacityPct > 50) capacityMultiplier = 1.15 // Moderate
  else if (capacityPct > 25) capacityMultiplier = 1.0  // Normal
  else capacityMultiplier = 0.9                         // Early bird discount

  // ── Time Pressure ──
  let timeMultiplier = 1.0
  if (daysUntilEvent <= 1) timeMultiplier = 1.4        // Day of event
  else if (daysUntilEvent <= 3) timeMultiplier = 1.25  // Last 3 days
  else if (daysUntilEvent <= 7) timeMultiplier = 1.1   // Last week

  // ── Velocity Multiplier ──
  let velocityMultiplier = 1.0
  if (velocityRatio > 3) velocityMultiplier = 1.3      // Selling 3x faster
  else if (velocityRatio > 2) velocityMultiplier = 1.2 // Selling 2x faster
  else if (velocityRatio > 1.5) velocityMultiplier = 1.1
  else if (velocityRatio < 0.3) velocityMultiplier = 0.85 // Slow sales — discount

  // ── Final Price ──
  const rawMultiplier = capacityMultiplier * timeMultiplier * velocityMultiplier
  // Cap the multiplier: max 2x, min 0.7x
  const finalMultiplier = Math.min(2.0, Math.max(0.7, rawMultiplier))
  const suggestedPrice = Math.round(basePrice * finalMultiplier)

  // ── Sell-out probability ──
  let sellOutProbability = 0
  if (capacityPct >= 100) sellOutProbability = 100
  else if (dailyVelocity > 0) {
    const daysToSellOut = remaining / dailyVelocity
    sellOutProbability = Math.min(99, Math.round((1 - (daysToSellOut / (daysUntilEvent * 2))) * 100))
    sellOutProbability = Math.max(0, sellOutProbability)
  }

  // ── Price tier suggestion ──
  let priceTier = 'normal'
  if (finalMultiplier >= 1.4) priceTier = 'premium'
  else if (finalMultiplier >= 1.15) priceTier = 'high-demand'
  else if (finalMultiplier <= 0.85) priceTier = 'early-bird'

  return {
    basePrice,
    suggestedPrice,
    currentMultiplier: finalMultiplier,
    priceTier,
    metrics: {
      capacityPct: Math.round(capacityPct),
      daysUntilEvent,
      dailyVelocity: Math.round(dailyVelocity * 10) / 10,
      velocityRatio: Math.round(velocityRatio * 100) / 100,
      remaining,
      recentSales,
    },
    sellOutProbability,
    multipliers: {
      capacity: capacityMultiplier,
      time: timeMultiplier,
      velocity: velocityMultiplier,
    },
    recommendation: getRecommendation(priceTier, sellOutProbability, daysUntilEvent, capacityPct),
  }
}

function getRecommendation(tier, sellOutProb, days, capPct) {
  if (tier === 'premium') return 'Alta demanda detectada. Considera aumentar el precio — el evento se está agotando rápido.'
  if (tier === 'high-demand') return 'Demanda por encima del promedio. Buen momento para activar la siguiente fase de precios.'
  if (tier === 'early-bird') return 'Las ventas están lentas. Considera una promoción o descuento para impulsar las primeras compras.'
  if (sellOutProb > 80) return 'Probabilidad alta de sold-out. La demanda justifica precio premium.'
  if (days <= 3 && capPct < 50) return 'Evento en pocos días con baja venta. Urgente: activa promociones o marketing.'
  return 'Ventas estables. Mantén el precio actual.'
}

/**
 * Generate demand forecast (time-series prediction)
 * Uses linear regression on sales velocity to predict future sales
 */
export const forecastDemand = (event, tickets = []) => {
  const now = new Date()
  const eventDate = new Date(event.date)
  const capacity = event.capacity || 200

  // Group sales by day
  const dailySales = {}
  tickets.forEach(t => {
    const day = new Date(t.purchaseDate).toISOString().split('T')[0]
    dailySales[day] = (dailySales[day] || 0) + 1
  })

  // Build time series
  const days = Object.keys(dailySales).sort()
  const values = days.map(d => dailySales[d])

  // Simple moving average for trend
  const windowSize = Math.min(3, values.length)
  const trend = values.length >= windowSize
    ? values.slice(-windowSize).reduce((s, v) => s + v, 0) / windowSize
    : values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0

  // Project forward
  const daysUntilEvent = Math.max(1, Math.ceil((eventDate - now) / (1000 * 60 * 60 * 24)))
  const projectedAdditionalSales = Math.round(trend * daysUntilEvent)
  const projectedTotal = Math.min(capacity, tickets.length + projectedAdditionalSales)
  const projectedPct = Math.round((projectedTotal / capacity) * 100)

  // Confidence based on data points
  const confidence = Math.min(90, Math.max(20, values.length * 10))

  // Daily forecast
  const forecast = []
  let cumulative = tickets.length
  for (let i = 1; i <= Math.min(daysUntilEvent, 30); i++) {
    // Add some variation to trend
    const variation = trend * (0.8 + Math.random() * 0.4)
    cumulative = Math.min(capacity, cumulative + variation)
    const date = new Date(now.getTime() + i * 24 * 60 * 60 * 1000)
    forecast.push({
      date: date.toISOString().split('T')[0],
      projected: Math.round(cumulative),
      pct: Math.round((cumulative / capacity) * 100),
    })
  }

  return {
    currentSales: tickets.length,
    trend: Math.round(trend * 10) / 10, // tickets per day
    projectedTotal,
    projectedPct,
    daysUntilEvent,
    confidence,
    forecast,
    willSellOut: projectedTotal >= capacity * 0.95,
    estimatedSellOutDate: trend > 0
      ? new Date(now.getTime() + ((capacity - tickets.length) / trend) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : null,
  }
}
