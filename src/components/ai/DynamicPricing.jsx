import { useState, useEffect } from 'react'
import { calculateDynamicPrice, forecastDemand } from '../../lib/ai/pricing'
import { FiTrendingUp, FiDollarSign, FiActivity, FiAlertTriangle } from 'react-icons/fi'
import './AIComponents.css'

const DynamicPricing = ({ event, tickets }) => {
  const [pricing, setPricing] = useState(null)
  const [forecast, setForecast] = useState(null)

  useEffect(() => {
    if (!event || !tickets) return
    setPricing(calculateDynamicPrice(event, tickets))
    setForecast(forecastDemand(event, tickets))
  }, [event, tickets])

  if (!pricing || !forecast) return null

  const priceChange = pricing.suggestedPrice - pricing.basePrice
  const priceDirection = priceChange > 0 ? 'up' : priceChange < 0 ? 'down' : 'same'

  return (
    <div className="ai-section">
      <div className="ai-section-header">
        <h2 className="ai-section-title"><FiActivity /> Pricing Engine & Forecast</h2>
        <span className="ai-badge">AI</span>
      </div>

      {/* Price recommendation */}
      <div className="ai-pricing-main">
        <div className="ai-pricing-current">
          <span className="ai-pricing-label">Precio actual</span>
          <span className="ai-pricing-value">${pricing.basePrice}</span>
        </div>
        <div className="ai-pricing-arrow">→</div>
        <div className={`ai-pricing-suggested ${priceDirection}`}>
          <span className="ai-pricing-label">Precio sugerido</span>
          <span className="ai-pricing-value">${pricing.suggestedPrice}</span>
          {priceChange !== 0 && (
            <span className={`ai-pricing-change ${priceDirection}`}>
              {priceDirection === 'up' ? '+' : ''}{priceChange > 0 ? `$${priceChange}` : `-$${Math.abs(priceChange)}`}
            </span>
          )}
        </div>
      </div>

      {/* Tier badge */}
      <div className={`ai-tier-badge ai-tier-${pricing.priceTier}`}>
        {pricing.priceTier === 'premium' && '🔥 Premium — Alta demanda'}
        {pricing.priceTier === 'high-demand' && '📈 Demanda alta'}
        {pricing.priceTier === 'normal' && '✅ Precio normal'}
        {pricing.priceTier === 'early-bird' && '🐦 Early Bird — Impulsar ventas'}
      </div>

      {/* Metrics grid */}
      <div className="ai-metrics-grid">
        <div className="ai-metric-card">
          <span className="ai-metric-value">{pricing.metrics.capacityPct}%</span>
          <span className="ai-metric-label">Capacidad vendida</span>
        </div>
        <div className="ai-metric-card">
          <span className="ai-metric-value">{pricing.metrics.dailyVelocity}</span>
          <span className="ai-metric-label">Tickets/día</span>
        </div>
        <div className="ai-metric-card">
          <span className="ai-metric-value">{pricing.metrics.daysUntilEvent}d</span>
          <span className="ai-metric-label">Hasta el evento</span>
        </div>
        <div className="ai-metric-card">
          <span className="ai-metric-value">{pricing.sellOutProbability}%</span>
          <span className="ai-metric-label">Prob. Sold Out</span>
        </div>
      </div>

      {/* Multipliers */}
      <div className="ai-multipliers">
        <span className="ai-mult-title">Factores de precio:</span>
        <div className="ai-mult-list">
          <span>Capacidad: ×{pricing.multipliers.capacity.toFixed(2)}</span>
          <span>Tiempo: ×{pricing.multipliers.time.toFixed(2)}</span>
          <span>Velocidad: ×{pricing.multipliers.velocity.toFixed(2)}</span>
        </div>
      </div>

      {/* Forecast */}
      <div className="ai-forecast">
        <h3 className="ai-forecast-title"><FiTrendingUp /> Demand Forecast</h3>
        <div className="ai-forecast-stats">
          <div>
            <span className="ai-forecast-big">{forecast.projectedTotal}</span>
            <span className="ai-forecast-label">ventas proyectadas</span>
          </div>
          <div>
            <span className="ai-forecast-big">{forecast.projectedPct}%</span>
            <span className="ai-forecast-label">capacidad proyectada</span>
          </div>
          <div>
            <span className="ai-forecast-big">{forecast.trend}</span>
            <span className="ai-forecast-label">tickets/día tendencia</span>
          </div>
        </div>
        {forecast.willSellOut && forecast.estimatedSellOutDate && (
          <div className="ai-forecast-sellout">
            <FiAlertTriangle /> Estimado de sold-out: {new Date(forecast.estimatedSellOutDate).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
          </div>
        )}
        <div className="ai-forecast-bar">
          <div className="ai-forecast-bar-fill" style={{ width: `${Math.min(forecast.projectedPct, 100)}%` }}></div>
          <div className="ai-forecast-bar-current" style={{ width: `${Math.min((forecast.currentSales / (event.capacity || 200)) * 100, 100)}%` }}></div>
        </div>
        <div className="ai-forecast-legend">
          <span><span className="ai-dot ai-dot-current"></span> Ventas actuales ({forecast.currentSales})</span>
          <span><span className="ai-dot ai-dot-projected"></span> Proyección ({forecast.projectedTotal})</span>
        </div>
        <span className="ai-confidence">Confianza: {forecast.confidence}%</span>
      </div>

      {/* Recommendation */}
      <div className="ai-recommendation">
        <FiDollarSign />
        <p>{pricing.recommendation}</p>
      </div>
    </div>
  )
}

export default DynamicPricing
