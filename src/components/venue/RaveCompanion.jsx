import { useState, useRef, useEffect } from 'react'
import { askCompanion, getSuggestedQuestions } from '../../lib/companion'
import { FiMessageCircle, FiX, FiSend } from 'react-icons/fi'
import './RaveCompanion.css'

// Rave Companion: rule-based, answers only from verified event data.
// Deliberately not a generative chatbot — it's grounded retrieval.

const RaveCompanion = ({ event }) => {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([
    {
      from: 'bot',
      text: 'Hola. Puedo ayudarte con lo de este evento: horarios, escenarios, agua, baños, accesibilidad, descanso y salidas. Solo respondo con información verificada.',
    },
  ])
  const listRef = useRef(null)
  const suggestions = getSuggestedQuestions(event)

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, open])

  const send = (text) => {
    const q = (text ?? input).trim()
    if (!q) return
    const { answer } = askCompanion(q, { event })
    setMessages((m) => [...m, { from: 'user', text: q }, { from: 'bot', text: answer }])
    setInput('')
  }

  if (!event) return null

  return (
    <>
      {!open && (
        <button className="rc-launcher" onClick={() => setOpen(true)} aria-label="Abrir Rave Companion">
          <FiMessageCircle />
          <span>Rave Companion</span>
        </button>
      )}

      {open && (
        <div className="rc-panel" role="dialog" aria-label="Rave Companion">
          <div className="rc-head">
            <div>
              <strong>Rave Companion</strong>
              <span>Respuestas verificadas de este evento</span>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Cerrar"><FiX /></button>
          </div>

          <div className="rc-messages" ref={listRef}>
            {messages.map((m, i) => (
              <div key={i} className={`rc-msg rc-msg--${m.from}`}>{m.text}</div>
            ))}
          </div>

          {messages.length <= 1 && suggestions.length > 0 && (
            <div className="rc-suggestions">
              {suggestions.map((s) => (
                <button key={s} onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          )}

          <form className="rc-input" onSubmit={(e) => { e.preventDefault(); send() }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pregunta algo del evento…"
              aria-label="Escribe tu pregunta"
            />
            <button type="submit" aria-label="Enviar"><FiSend /></button>
          </form>
        </div>
      )}
    </>
  )
}

export default RaveCompanion
