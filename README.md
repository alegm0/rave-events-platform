# RAVE — Plataforma de gestión de eventos de música electrónica

Trabajo de grado de Ingeniería de Software · Alejandra González · 2026

RAVE es una aplicación web que digitaliza el ciclo completo de un evento de música electrónica: desde que el organizador lo publica hasta que el asistente entra con su QR. Nace de un problema real de la escena: el público es grande, pero las herramientas de gestión son genéricas y no acompañan ni al productor ni al asistente de principio a fin.

**Objetivo del proyecto:** demostrar, sobre un caso de uso real, el diseño e implementación de una plataforma web completa — con autenticación por roles, reglas de negocio en una capa de datos propia, seguridad declarada en el servidor y una experiencia de usuario cuidada para dos perfiles distintos.

- **Aplicación en vivo:** desplegada en Vercel
- **Documentación completa:** manual técnico (requerimientos, modelo de datos, casos de uso y diagramas UML)
- **Repositorio:** https://github.com/alegm0/rave-events-platform

## Qué resuelve

La plataforma distingue dos roles con permisos separados, más el visitante sin sesión:

**Organizador** — publica eventos en pasos (con precio único o por fases y mapa del recinto), vende entradas, valida el acceso en puerta con un escáner QR y consulta analítica de ventas, aforo y check-ins de cada evento.

**Raver (asistente)** — descubre y busca eventos, compra una entrada digital con QR único, la presenta en la puerta, se suscribe a eventos próximos y, durante el evento, usa el *Rave Mode* para ubicarse en el plano del recinto según su perfil de accesibilidad.

## Decisiones de ingeniería (lo relevante para la evaluación)

- **Reglas de negocio en la capa de datos.** La prevención de compras duplicadas, el control de aforo y la resolución de la fase de precio activa se ejecutan en `src/lib/db.js`, no en la interfaz, y se **refuerzan en el servidor** con las reglas de seguridad de Firestore y Cloud Storage. Una entrada no puede duplicarse ni manipularse desde el navegador.
- **Autorización por rol y por propiedad del recurso.** Las rutas protegidas (`ProtectedRoute`) y las reglas de Firestore verifican el rol y que el recurso pertenezca al usuario antes de permitir una operación. Las contraseñas nunca se almacenan en la base de datos: las gestiona Firebase Authentication.
- **Validación de la entrada en puerta.** El escáner usa `BarcodeDetector` (nativo del navegador) con modo manual de respaldo, y revalida la ventana de acceso en el servidor para que un ticket solo se marque como usado una vez y dentro del horario del evento.
- **Analítica sin servicios externos.** El precio dinámico, el pronóstico de demanda, la detección de patrones de fraude y el análisis de sentimiento de reseñas se calculan con algoritmos heurísticos deterministas en el cliente, sobre los datos reales del evento.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18, Vite 5, React Router 6 |
| 3D | Three.js, @react-three/fiber (hero interactivo de la landing) |
| QR | qrcode.react + BarcodeDetector (nativo del navegador) |
| Autenticación | Firebase Authentication |
| Base de datos | Cloud Firestore + Cloud Storage |
| Integración musical | Spotify y Deezer vía funciones serverless en Vercel |

## Arquitectura

Arquitectura modular con separación clara entre presentación, estado, acceso a datos y lógica de dominio.

```
api/                 Funciones serverless (Spotify, Deezer)
src/
├── components/      UI reutilizable (ui, layout, auth, venue, ai)
├── context/         AuthContext (sesión y rol)
├── firebase/        Inicialización de Firebase
├── lib/             db.js (acceso a datos), ai/, venue, timetable, briefing, companion
├── pages/           Vistas públicas y del raver (y pages/organizer para el panel)
└── App.jsx          Rutas públicas y protegidas por rol
firestore.rules      Reglas de seguridad de Firestore
storage.rules        Reglas de Cloud Storage
```

**Modelo de datos (Cloud Firestore):** `users` (perfil, rol, marca), `events` (datos, line-up, precio único o por fases, plano del recinto), `tickets` (estado valid/used, QR único, precio pagado), `reviews`, `going`, `subscriptions` y `notifications`.

## Recorrido de evaluación

La forma más rápida de ver el flujo completo de punta a punta:

1. Regístrate como **Organizador** y publica un evento.
2. En una ventana de incógnito, regístrate como **Raver** y compra una entrada.
3. Vuelve al organizador, abre el **Scanner** y valida el QR → "¡Acceso concedido!".

Esto ejerce de corrido la creación de evento, la compra con control de aforo, el QR único y la validación en puerta.

## Ejecución local

```bash
git clone https://github.com/alegm0/rave-events-platform.git
cd rave-events-platform
npm install
npm run dev          # http://localhost:3000
```

Requiere un proyecto de Firebase (Authentication, Firestore y Storage) y un archivo `.env` en la raíz con las variables `VITE_FIREBASE_*`. Tras activar el proveedor Email/Password, se publican las reglas con:

```bash
firebase deploy --only firestore:rules,storage
npm run build        # build de producción en dist/
```

## Licencia

MIT — Trabajo de grado de Alejandra González, 2026.
