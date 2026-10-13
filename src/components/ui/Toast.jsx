import { createContext, useContext, useState, useCallback } from 'react'
import { FiCheck, FiX, FiInfo, FiAlertTriangle } from 'react-icons/fi'
import './Toast.css'

const ToastContext = createContext()
export const useToast = () => useContext(ToastContext)

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'success', duration = 3000) => {
    const id = Date.now()
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration)
  }, [])

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error'),
    info: (msg) => addToast(msg, 'info'),
    warning: (msg) => addToast(msg, 'warning'),
  }

  const icons = { success: <FiCheck />, error: <FiX />, info: <FiInfo />, warning: <FiAlertTriangle /> }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* WCAG 4.1.3: status messages announced to assistive tech. Errors are
          assertive (interrupt), the rest polite. Icons are decorative. */}
      <div className="toast-container" aria-live="polite" aria-atomic="true">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast--${t.type}`}
            role={t.type === 'error' ? 'alert' : 'status'}>
            <span className="toast-icon" aria-hidden="true">{icons[t.type]}</span>
            <span className="toast-msg">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
