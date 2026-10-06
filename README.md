# RAVE — Electronic Music Events Platform

<div align="center">

**A full-stack web platform for managing electronic music events, built with React and Three.js.**

[Live Demo](#) · [Documentation](#architecture) · [Screenshots](#screenshots)

</div>

---

## About

RAVE is a complete event management platform designed for the electronic music scene. It connects event organizers with ravers through a seamless experience: event creation, digital ticket sales with QR codes, real-time entry validation, and analytics dashboards.

Built as a thesis project, it demonstrates modern web development practices including role-based authentication, 3D interactive visuals, responsive design, and a component-based architecture.

## Features

### For Ravers (Attendees)
- Browse and search events by genre, date, and location
- Purchase digital tickets with unique QR codes
- View ticket details and present QR at venue entrance
- Subscribe to upcoming events and receive notifications
- Personal calendar with purchased events
- View organizer brand profiles

### For Organizers
- Multi-step event creation with live preview
- Support for events from 3h sets to 48h festivals
- Dashboard with real-time stats (tickets sold, revenue, capacity)
- QR Scanner for entry validation (camera + manual mode)
- Per-event analytics (check-ins, revenue, capacity %)
- Customizable brand profile (logo, bio, social media)
- Event management with filters (upcoming/past)

### Platform
- Role-based authentication (Raver vs Organizer)
- Fully responsive design (mobile, tablet, desktop)
- 3D interactive hero with Three.js particles and audio visualizer
- Real-time notifications system
- Scroll-reveal animations throughout
- Berlin-inspired dark UI with alternating light/dark sections

## Tech Stack

| Category | Technology |
|----------|-----------|
| Frontend | React 18, Vite 5 |
| Routing | React Router v6 |
| 3D Graphics | Three.js, @react-three/fiber |
| QR Codes | qrcode.react |
| Icons | react-icons (Feather) |
| Styling | CSS3 with custom properties |
| Auth | Firebase Authentication |
| Data | Cloud Firestore (with Cloud Storage for uploads) |
| Architecture | Component-based, Context API, custom data layer |

## Screenshots

### Landing Page with 3D Hero
The homepage features an interactive Three.js scene with floating particles, audio visualizer rings, and a parallax background.

### Event Detail
Full event page with hero image, info grid, capacity bar, lineup, organizer profile, related events, and ticket purchase sidebar.

### Organizer Dashboard
Stats overview, featured event card, quick actions, and event list with per-event metrics and progress bars.

### QR Scanner
Dual-mode scanner (camera + manual) with live check-in counter, session stats, and full-screen validation feedback.

### Ticket with QR Code
Digital ticket card with tear effect, QR code, event details, organizer info, and lineup.

## Architecture

```
src/
├── components/          # Reusable UI components
│   ├── auth/           # ProtectedRoute (role-based guard)
│   ├── layout/         # Navbar (with notifications), Footer
│   └── ui/             # Button, Card, Input, HeroScene (3D)
├── context/            # AuthContext (global auth state)
├── firebase/           # config.js (Auth, Firestore and Storage clients)
├── lib/                # db.js (data layer over Cloud Firestore), ai/, venue, timetable
├── pages/              # Page components
│   ├── organizer/      # Dashboard, CreateEvent, MyEvents, Analytics, Scanner, EditBrand
│   ├── Home.jsx        # Landing with 3D hero (redirects if logged in)
│   ├── Events.jsx      # Event listing with search + genre filters
│   ├── EventDetail.jsx # Full event page with purchase flow
│   ├── Calendar.jsx    # Monthly view with "all" / "my tickets" toggle
│   ├── ComingSoon.jsx  # Upcoming events with countdown + subscribe
│   ├── MyTickets.jsx   # Ticket collection with status filters
│   ├── TicketDetail.jsx# Digital ticket with QR code
│   ├── Profile.jsx     # Role-specific profile (different for Raver vs Organizer)
│   └── OrganizerProfile.jsx # Public brand page
├── App.jsx             # Routes + ScrollToTop
├── main.jsx            # Entry point
└── index.css           # Global styles + CSS variables
```

### Data Model

- **Users** — email, displayName, role (user/organizer), brand profile, comfort profile. Passwords are never stored here: they are handled by Firebase Authentication.
- **Events** — title, date, time, duration, location, capacity, genre, lineup, image, minimum age, single price or ordered pricing tiers, and a schematic venue (zones and services)
- **Tickets** — eventId, userId, status (valid/used), unique QR code, tier and price actually paid
- **Notifications** — userId, type (purchase/subscription/reminder), title, message, read status
- **Subscriptions** — userId, eventId (for "notify me" on upcoming events)
- **Reviews** — userId, eventId, rating and text, used for the sentiment report
- **Going** — userId, eventId (attendance intent, drives the "who's going" list)

## Getting Started

```bash
# Clone the repository
git clone https://github.com/alegm0/rave-events-platform.git

# Navigate to project
cd rave-events-platform

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3000
```

### Configuration

The app needs a Firebase project (Authentication, Cloud Firestore and Cloud Storage).
Create a `.env` file in the project root:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Enable the Email/Password sign-in provider in Firebase Authentication, then deploy the
access rules:

```bash
firebase deploy --only firestore:rules,storage
```

Nothing is kept in browser storage: every read and write goes to Cloud Firestore.

### Quick Test

1. Open the app and click **Registrarse**
2. Create an **Organizador** account
3. Go to **Crear Evento** and publish an event
4. Open an incognito window, register as **Raver**
5. Browse events, buy a ticket, check your QR
6. Go back to the organizer, open **Scanner**, paste the QR code
7. See "¡Acceso Concedido!" ✅

## Build for Production

```bash
npm run build
```

Output goes to `dist/`. The project is deployed to Vercel: `vercel.json` rewrites every
route to `index.html` so client-side routes survive a refresh. Remember to set the
`VITE_FIREBASE_*` environment variables in the Vercel project settings, and to add the
deployment domain to the authorised domains list in Firebase Authentication.

## License

MIT — Built as a thesis project by Alejandra Gonzalez, 2026.
