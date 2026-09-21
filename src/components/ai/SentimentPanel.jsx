import { useState, useEffect } from 'react'
import { analyzeEventSentiment } from '../../lib/ai/sentiment'
import { FiMessageCircle, FiTrendingUp, FiAlertCircle, FiCheckCircle, FiInfo } from 'react-icons/fi'
import './AIComponents.css'

const SentimentPanel = ({ reviews }) => {
  const [report, setReport] = useState(null)

  useEffect(() => {
    if (!reviews || reviews.length === 0) { setReport(null); return }
    setReport(analyzeEventSentiment(reviews))
  }, [reviews])

  if (!report || report.totalReviews === 0) return null

  const sentimentColor = report.overallSentiment === 'positive' ? '#4caf50'
    : report.overallSentiment === 'negative' ? '#ff3d00' : '#ff9800'

  return (
    <div className="ai-section">
      <div className="ai-section-header">
        <h2 className="ai-section-title"><FiMessageCircle /> Sentiment Analysis</h2>
        <span className="ai-badge">NLP</span>
      </div>

      {/* Overall sentiment */}
      <div className="ai-sentiment-overview">
        <div className="ai-sentiment-score" style={{ borderColor: sentimentColor }}>
          <span className="ai-sentiment-value" style={{ color: sentimentColor }}>
            {report.overallScore > 0 ? '+' : ''}{report.overallScore}
          </span>
          <span className="ai-sentiment-label">{report.overallSentiment === 'positive' ? 'Positivo' : report.overallSentiment === 'negative' ? 'Negativo' : 'Mixto'}</span>
        </div>
        <div className="ai-sentiment-breakdown">
          <div className="ai-sentiment-bar-row">
            <span>😍 Positivas</span>
            <div className="ai-sentiment-bar">
              <div style={{ width: `${(report.breakdown.positive / report.totalReviews) * 100}%`, background: '#4caf50' }}></div>
            </div>
            <span>{report.breakdown.positive}</span>
          </div>
          <div className="ai-sentiment-bar-row">
            <span>😐 Neutrales</span>
            <div className="ai-sentiment-bar">
              <div style={{ width: `${(report.breakdown.neutral / report.totalReviews) * 100}%`, background: '#ff9800' }}></div>
            </div>
            <span>{report.breakdown.neutral}</span>
          </div>
          <div className="ai-sentiment-bar-row">
            <span>😞 Negativas</span>
            <div className="ai-sentiment-bar">
              <div style={{ width: `${(report.breakdown.negative / report.totalReviews) * 100}%`, background: '#ff3d00' }}></div>
            </div>
            <span>{report.breakdown.negative}</span>
          </div>
        </div>
      </div>

      {/* Aspect scores */}
      {Object.keys(report.aspectScores).length > 0 && (
        <div className="ai-aspects">
          <h3 className="ai-subsection-title">Análisis por aspecto</h3>
          <div className="ai-aspects-grid">
            {Object.entries(report.aspectScores).map(([key, data]) => (
              <div key={key} className="ai-aspect-card">
                <div className="ai-aspect-header">
                  <span className="ai-aspect-name">{data.label}</span>
                  <span className={`ai-aspect-score ${data.score > 0.3 ? 'positive' : data.score < -0.3 ? 'negative' : 'neutral'}`}>
                    {data.score > 0.3 ? '👍' : data.score < -0.3 ? '👎' : '➖'}
                  </span>
                </div>
                <div className="ai-aspect-bar">
                  <div className="ai-aspect-pos" style={{ width: `${(data.positive / data.mentions) * 100}%` }}></div>
                  <div className="ai-aspect-neg" style={{ width: `${(data.negative / data.mentions) * 100}%` }}></div>
                </div>
                <span className="ai-aspect-mentions">{data.mentions} menciones</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Keywords */}
      <div className="ai-keywords">
        {report.keywords.positive.length > 0 && (
          <div className="ai-keyword-group">
            <span className="ai-keyword-label">Palabras positivas:</span>
            <div className="ai-keyword-tags">
              {report.keywords.positive.map(k => (
                <span key={k.word} className="ai-keyword-tag positive">"{k.word}" ({k.count})</span>
              ))}
            </div>
          </div>
        )}
        {report.keywords.negative.length > 0 && (
          <div className="ai-keyword-group">
            <span className="ai-keyword-label">Palabras negativas:</span>
            <div className="ai-keyword-tags">
              {report.keywords.negative.map(k => (
                <span key={k.word} className="ai-keyword-tag negative">"{k.word}" ({k.count})</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Insights */}
      <div className="ai-insights">
        <h3 className="ai-subsection-title">Insights</h3>
        {report.insights.map((insight, i) => (
          <div key={i} className={`ai-insight ai-insight-${insight.type}`}>
            {insight.type === 'success' && <FiCheckCircle />}
            {insight.type === 'warning' && <FiAlertCircle />}
            {insight.type === 'alert' && <FiAlertCircle />}
            {insight.type === 'info' && <FiInfo />}
            <p>{insight.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default SentimentPanel
