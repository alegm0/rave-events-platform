import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getEvents, getTicketsByUser, getEvent, getEventsByOrganizer } from '../lib/db'
import { useAuth } from '../context/AuthContext'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import './Calendar.css'

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DAY_NAMES = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM']

const Calendar = () => {
  const { currentUser, userProfile } = useAuth()
  const [events, setEvents] = useState([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [mode, setMode] = useState('all') // 'all' or 'mine'

  useEffect(() => {
    loadEvents()
  }, [currentUser, mode])

  const loadEvents = () => {
    if (mode === 'mine' && currentUser) {
      const isOrg = userProfile?.role === 'organizer'
      if (isOrg) {
        // Organizer sees their own events
        setEvents(getEventsByOrganizer(currentUser.id))
      } else {
        // Attendee sees events they bought tickets for
        const tickets = getTicketsByUser(currentUser.id)
        const myEvents = tickets.map(t => getEvent(t.eventId)).filter(Boolean)
        setEvents(myEvents)
      }
    } else {
      setEvents(getEvents())
    }
  }

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDay = (firstDay.getDay() + 6) % 7

  const days = []
  for (let i = 0; i < startDay; i++) days.push(null)
  for (let i = 1; i <= lastDay.getDate(); i++) days.push(i)

  const getEventsForDate = (day) => {
    if (!day) return []
    const d = new Date(year, month, day)
    return events.filter(e => new Date(e.date).toDateString() === d.toDateString())
  }

  const isToday = (day) => {
    if (!day) return false
    return new Date(year, month, day).toDateString() === new Date().toDateString()
  }

  return (
    <div className="calendar-page">
      <div className="calendar-hero">
        <div className="container">
          <span className="cal-tag">Planifica tu mes</span>
          <h1 className="cal-title">Calendario</h1>
        </div>
      </div>

      <div className="container">
        <div className="cal-top-bar">
          <div className="cal-nav">
            <button className="cal-nav-btn" onClick={() => setCurrentMonth(new Date(year, month - 1))}>
              <FiChevronLeft />
            </button>
            <h2 className="cal-current">{MONTH_NAMES[month]} <span className="cal-year">{year}</span></h2>
            <button className="cal-nav-btn" onClick={() => setCurrentMonth(new Date(year, month + 1))}>
              <FiChevronRight />
            </button>
          </div>
          {currentUser && (
            <div className="cal-mode-toggle">
              <button className={mode === 'all' ? 'active' : ''} onClick={() => setMode('all')}>Todos</button>
              <button className={mode === 'mine' ? 'active' : ''} onClick={() => setMode('mine')}>
                {userProfile?.role === 'organizer' ? 'Mis eventos' : 'Mis tickets'}
              </button>
            </div>
          )}
        </div>

        <div className="cal-grid">
          {DAY_NAMES.map(d => <div key={d} className="cal-day-name">{d}</div>)}
          {days.map((day, i) => {
            const dayEvents = getEventsForDate(day)
            return (
              <div key={i} className={`cal-day ${!day ? 'empty' : ''} ${isToday(day) ? 'today' : ''} ${dayEvents.length ? 'has-events' : ''}`}>
                {day && (
                  <>
                    <span className="cal-day-num">{day}</span>
                    {dayEvents.map(e => (
                      <Link key={e.id} to={`/event/${e.id}`} className="cal-event-dot" title={e.title}>
                        <span className="cal-event-name">{e.title}</span>
                      </Link>
                    ))}
                  </>
                )}
              </div>
            )
          })}
        </div>

        <div className="cal-legend">
          <div className="legend-item"><span className="legend-dot legend-dot--today"></span> Hoy</div>
          <div className="legend-item"><span className="legend-dot legend-dot--event"></span> {mode === 'mine' ? 'Tu evento' : 'Evento disponible'}</div>
        </div>
      </div>
    </div>
  )
}

export default Calendar
