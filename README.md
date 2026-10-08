# RAVE

Plataforma web para la gestión de eventos de música electrónica. La hice como mi proyecto de grado de Ingeniería de Software.

La idea nació de un problema concreto: la escena electrónica mueve mucho público pero las herramientas para organizar sus eventos suelen ser genéricas. RAVE conecta a dos perfiles — el **organizador**, que publica y gestiona sus eventos, y el **raver**, que descubre eventos, compra su entrada y la usa en la puerta — en un solo flujo: crear el evento, vender tickets con QR, validar la entrada y ver los resultados.

**Repo:** https://github.com/alegm0/rave-events-platform

## Qué hace

**Raver**
- Explora y busca eventos por género, fecha y ciudad.
- Compra un ticket digital con QR único (uno por evento).
- Guarda sus tickets, los presenta en la puerta y puede cancelarlos antes del evento.
- Se suscribe a eventos próximos y recibe recordatorios.
- Rave Mode: durante el evento ve el plano del venue y rutas a servicios según su perfil de comodidad.

**Organizador**
- Crea eventos en pasos, con precio único o por fases, y configura el mapa del recinto.
- Dashboard con tickets vendidos, ingresos y aforo.
- Escáner QR en la puerta (cámara o código manual) con contador de check-ins.
- Analítica por evento y perfil de marca público.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18, Vite 5, React Router 6 |
| 3D | Three.js, @react-three/fiber (hero de la landing) |
| QR | qrcode.react + BarcodeDetector (nativo del navegador) |
| Auth | Firebase Authentication |
| Datos | Cloud Firestore + Cloud Storage |
| Música | Spotify y Deezer vía funciones serverless en Vercel |

Las reglas de negocio (compra sin duplicados, control de aforo, fase de precio activa) viven en la capa de datos (`src/lib/db.js`) y se refuerzan con las reglas de seguridad de Firestore.

## Estructura

```
api/                 Funciones serverless (Spotify, Deezer)
src/
├── components/      UI reutilizable (ui, layout, auth, venue, ai)
├── context/         AuthContext (sesión y rol)
├── firebase/        Inicialización de Firebase
├── lib/             db.js (acceso a datos), ai/, venue, timetable, briefing, companion
├── pages/           Vistas (y pages/organizer para el panel del organizador)
└── App.jsx          Rutas públicas y protegidas por rol
firestore.rules      Reglas de seguridad de Firestore
storage.rules        Reglas de Cloud Storage
```

## Modelo de datos (Firestore)

- **users** — email, nombre, rol (user/organizer), marca y perfil de comodidad. Las contraseñas no se guardan aquí; las maneja Firebase Authentication.
- **events** — datos del evento, line-up, capacidad, precio único o por fases, y el plano del recinto.
- **tickets** — evento, usuario, estado (valid/used), QR único, fase y precio pagado.
- **reviews** — calificación y texto (alimentan el reporte de sentimiento).
- **going / subscriptions / notifications** — asistencia, suscripciones y avisos.

## Cómo correrlo

```bash
git clone https://github.com/alegm0/rave-events-platform.git
cd rave-events-platform
npm install
npm run dev          # http://localhost:3000
```

Necesita un proyecto de Firebase con Authentication, Firestore y Storage. Crea un `.env` en la raíz:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Activa el proveedor Email/Password en Authentication y publica las reglas:

```bash
firebase deploy --only firestore:rules,storage
```

## Probarlo rápido

1. Regístrate como **Organizador** y publica un evento.
2. En una ventana de incógnito, regístrate como **Raver** y compra un ticket.
3. Vuelve al organizador, abre el **Scanner** y valida el QR del ticket.

## Build y despliegue

```bash
npm run build        # salida en dist/
```

Desplegado en Vercel: `vercel.json` reescribe las rutas a `index.html` para que el enrutado del cliente sobreviva a un refresh. Las variables `VITE_FIREBASE_*` se configuran en Vercel, y el dominio del despliegue se agrega a los dominios autorizados de Firebase Authentication.

## Licencia

MIT — Proyecto de grado de Alejandra González, 2026.
