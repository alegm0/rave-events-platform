import { useState } from 'react'
import Modal from './Modal'
import Button from './Button'
import { FiCreditCard, FiLock, FiCheck } from 'react-icons/fi'
import './CheckoutModal.css'

// Simulated payment checkout (RF06).
// NOTE: This is a simulated gateway for academic purposes — it validates card
// format and simulates processing, but does NOT charge a real card. No real
// payment provider (Stripe, etc.) is integrated.

const luhnValid = (num) => {
  const digits = num.replace(/\s/g, '')
  if (!/^\d{13,19}$/.test(digits)) return false
  let sum = 0, alt = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10)
    if (alt) { n *= 2; if (n > 9) n -= 9 }
    sum += n
    alt = !alt
  }
  return sum % 10 === 0
}

const formatCardNumber = (v) =>
  v.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ').trim()

const formatExpiry = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 4)
  return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
}

const CheckoutModal = ({ isOpen, onClose, event, onPaid }) => {
  const [form, setForm] = useState({ name: '', number: '', expiry: '', cvc: '' })
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('form') // form | processing | done

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const validate = () => {
    const e = {}
    if (form.name.trim().length < 3) e.name = 'Ingresa el nombre del titular'
    if (!luhnValid(form.number)) e.number = 'Número de tarjeta inválido'
    const [mm, yy] = form.expiry.split('/')
    const validExp = mm && yy && +mm >= 1 && +mm <= 12 && form.expiry.length === 5
    if (!validExp) e.expiry = 'Fecha inválida (MM/AA)'
    if (!/^\d{3,4}$/.test(form.cvc)) e.cvc = 'CVC inválido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handlePay = async () => {
    if (!validate()) return
    setStatus('processing')
    // Simulate a gateway round-trip
    await new Promise((r) => setTimeout(r, 1600))
    try {
      await onPaid() // creates the ticket; may throw (duplicate / sold out)
      setStatus('done')
      await new Promise((r) => setTimeout(r, 900))
      handleClose()
    } catch (err) {
      setStatus('form')
      setErrors({ general: err.message || 'No se pudo completar la compra' })
    }
  }

  const handleClose = () => {
    setStatus('form'); setErrors({}); setForm({ name: '', number: '', expiry: '', cvc: '' })
    onClose()
  }

  const price = event?.price === 0 ? 'Gratis' : `$${event?.price}`

  return (
    <Modal isOpen={isOpen} onClose={status === 'processing' ? () => {} : handleClose} title="Pago seguro" size="sm">
      {status === 'done' ? (
        <div className="co-done">
          <div className="co-done-icon"><FiCheck /></div>
          <h3>¡Pago aprobado!</h3>
          <p>Tu entrada para {event?.title} está lista.</p>
        </div>
      ) : (
        <div className="co">
          {/* Order summary */}
          <div className="co-summary">
            <div>
              <span className="co-summary-label">{event?.title}</span>
              <span className="co-summary-sub">Entrada General · QR Digital</span>
            </div>
            <span className="co-summary-price">{price}</span>
          </div>

          {errors.general && <div className="co-error-banner">{errors.general}</div>}

          {/* Card form */}
          <div className="co-field">
            <label>Nombre del titular</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)}
              placeholder="Como aparece en la tarjeta" disabled={status === 'processing'} />
            {errors.name && <span className="co-err">{errors.name}</span>}
          </div>

          <div className="co-field">
            <label>Número de tarjeta</label>
            <div className="co-input-icon">
              <FiCreditCard />
              <input value={form.number} onChange={(e) => set('number', formatCardNumber(e.target.value))}
                placeholder="4242 4242 4242 4242" inputMode="numeric" disabled={status === 'processing'} />
            </div>
            {errors.number && <span className="co-err">{errors.number}</span>}
          </div>

          <div className="co-row">
            <div className="co-field">
              <label>Vence</label>
              <input value={form.expiry} onChange={(e) => set('expiry', formatExpiry(e.target.value))}
                placeholder="MM/AA" inputMode="numeric" disabled={status === 'processing'} />
              {errors.expiry && <span className="co-err">{errors.expiry}</span>}
            </div>
            <div className="co-field">
              <label>CVC</label>
              <input value={form.cvc} onChange={(e) => set('cvc', e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="123" inputMode="numeric" disabled={status === 'processing'} />
              {errors.cvc && <span className="co-err">{errors.cvc}</span>}
            </div>
          </div>

          <Button fullWidth size="lg" onClick={handlePay} disabled={status === 'processing'}>
            {status === 'processing' ? 'Procesando pago…' : `Pagar ${price}`}
          </Button>

          <p className="co-secure"><FiLock /> Pago simulado con fines académicos · no se realiza ningún cobro real</p>
        </div>
      )}
    </Modal>
  )
}

export default CheckoutModal
