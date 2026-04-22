import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './components/ui/Toast'
import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import Home from './pages/Home'
import Events from './pages/Events'
import EventDetail from './pages/EventDetail'
import Calendar from './pages/Calendar'
import ComingSoon from './pages/ComingSoon'
import Login from './pages/Login'
import Register from './pages/Register'
import Profile from './pages/Profile'
import OrganizerProfile from './pages/OrganizerProfile'
import MyTickets from './pages/MyTickets'
import TicketDetail from './pages/TicketDetail'
import Dashboard from './pages/organizer/Dashboard'
import CreateEvent from './pages/organizer/CreateEvent'
import MyEvents from './pages/organizer/MyEvents'
import EventAnalytics from './pages/organizer/EventAnalytics'
import QRScanner from './pages/organizer/QRScanner'
import EditBrand from './pages/organizer/EditBrand'
import NotFound from './pages/NotFound'
import ProtectedRoute from './components/auth/ProtectedRoute'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
      <Router>
        <ScrollToTop />
        <div className="app">
          <Navbar />
          <main>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Home />} />
              <Route path="/events" element={<Events />} />
              <Route path="/event/:id" element={<EventDetail />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/coming-soon" element={<ComingSoon />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/organizer/:id" element={<OrganizerProfile />} />
              
              {/* User Protected Routes */}
              <Route path="/profile" element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } />
              <Route path="/my-tickets" element={
                <ProtectedRoute>
                  <MyTickets />
                </ProtectedRoute>
              } />
              <Route path="/ticket/:id" element={
                <ProtectedRoute>
                  <TicketDetail />
                </ProtectedRoute>
              } />
              
              {/* Organizer Protected Routes */}
              <Route path="/organizer/dashboard" element={
                <ProtectedRoute requireOrganizer>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/organizer/create-event" element={
                <ProtectedRoute requireOrganizer>
                  <CreateEvent />
                </ProtectedRoute>
              } />
              <Route path="/organizer/my-events" element={
                <ProtectedRoute requireOrganizer>
                  <MyEvents />
                </ProtectedRoute>
              } />
              <Route path="/organizer/event/:id/analytics" element={
                <ProtectedRoute requireOrganizer>
                  <EventAnalytics />
                </ProtectedRoute>
              } />
              <Route path="/organizer/scanner/:eventId" element={
                <ProtectedRoute requireOrganizer>
                  <QRScanner />
                </ProtectedRoute>
              } />
              <Route path="/organizer/edit-brand" element={
                <ProtectedRoute requireOrganizer>
                  <EditBrand />
                </ProtectedRoute>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </Router>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
