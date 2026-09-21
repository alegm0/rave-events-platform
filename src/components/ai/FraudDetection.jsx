import { useState, useEffect } from 'react'
import { analyzeEventFraud } from '../../lib/ai/fraud'
import { FiShield, FiAlertTriangle, FiCheckCircle, FiUsers } from 'react-icons/fi'
import './AIComponents.css'

const FraudDetection = ({ tickets, allTickets }) => {
  const [report, setReport] = useState(null)

  useEffect(() => {
    if (!tickets || tickets.length === 0) return
    setReport(analyzeEventFraud(tickets, allTickets || tickets))
  }, [tickets, allTickets])

  if (!report) return null

  const riskColor = report.riskLevel === 'high' ? '#ff3d00'
    : report.riskLevel === 'medium' ? '#ff9800' : '#4caf50'

  return (
    <div className="ai-section">
      <div className="ai-section-header">
        <h2 className="ai-section-title"><FiShield /> Fraud Detection</h2>
        <span className="ai-badge" style={{ background: `${riskColor}20`, color: riskColor }}>
          {report.riskLevel === 'high' ? '⚠️ Alto' : report.riskLevel === 'medium' ? '⚡ Medio' : '✅ Bajo'}
        </span>
      </div>

      {/* Summary */}
      <div className="ai-fraud-summary" style={{ borderLeftColor: riskColor }}>
        <p>{report.summary}</p>
      </div>

      {/* Stats */}
      <div className="ai-metrics-grid">
        <div className="ai-metric-card">
          <span className="ai-metric-value">{report.totalBuyers}</span>
          <span className="ai-metric-label">Compradores únicos</span>
        </div>
        <div className="ai-metric-card">
          <span className="ai-metric-value">{report.stats.avgTicketsPerUser}</span>
          <span className="ai-metric-label">Avg tickets/usuario</span>
        </div>
        <div className="ai-metric-card">
          <span className="ai-metric-value">{report.stats.maxTicketsOneUser}</span>
          <span className="ai-metric-label">Max tickets 1 usuario</span>
        </div>
        <div className="ai-metric-card">
          <span className="ai-metric-value">{report.flaggedCount}</span>
          <span className="ai-metric-label">Flaggeados</span>
        </div>
      </div>

      {/* Alerts */}
      {report.alerts.length > 0 && (
        <div className="ai-fraud-alerts">
          <h3 className="ai-subsection-title">Alertas ({report.alerts.length})</h3>
          {report.alerts.slice(0, 5).map((alert, i) => (
            <div key={i} className={`ai-fraud-alert ai-fraud-${alert.severity}`}>
              {alert.severity === 'high' ? <FiAlertTriangle /> : <FiUsers />}
              <div>
                <span className="ai-fraud-alert-type">{alert.type.replace('_', ' ')}</span>
                <p>{alert.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {report.alerts.length === 0 && (
        <div className="ai-fraud-clean">
          <FiCheckCircle size={24} />
          <p>No se detectaron patrones sospechosos en las compras.</p>
        </div>
      )}
    </div>
  )
}

export default FraudDetection
