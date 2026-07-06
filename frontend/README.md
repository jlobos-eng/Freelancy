# Freelancy — Frontend

Marketplace móvil-first para conectar clientes con "Lancys" (trabajadores independientes).
React + Vite + Tailwind + Supabase + Leaflet.

## Stack

- **React 18** con Vite 5.
- **Tailwind 3** con `darkMode: 'class'` y tokens semánticos en `tailwind.config.js`.
- **Supabase** para auth, base de datos (Postgres + RLS), Storage y Realtime.
- **react-leaflet** + OpenStreetMap para el mapa real.
- **react-hot-toast** para notificaciones in-app.
- **lucide-react** para iconografía.

## Estructura

```
src/
├── App.jsx                      # Orquestador (auth, data, modales)
├── main.jsx                     # Entry: ThemeProvider + ErrorBoundary
├── index.css                    # Tailwind + tokens base + scrollbar dark
├── context/
│   └── ThemeContext.jsx         # Modo claro/oscuro persistido en localStorage
├── components/
│   ├── AppHeader.jsx
│   ├── BottomNav.jsx
│   ├── DecorativeMap.jsx        # Mapa decorativo del dashboard (sin tiles externos)
│   ├── ErrorBoundary.jsx
│   ├── EmptyState.jsx
│   ├── SkeletonCard.jsx
│   ├── BidModal.jsx
│   ├── ApplicationsList.jsx
│   ├── NotificationsPanel.jsx
│   └── MapView.jsx              # Mapa Leaflet con markers de Lancys
├── modals/
│   ├── ChatModal.jsx
│   ├── GigFormModal.jsx
│   ├── RatingModal.jsx
│   └── WorkerProfileModal.jsx
├── views/
│   ├── LoginView.jsx
│   ├── PinView.jsx
│   ├── KycView.jsx
│   ├── DashboardClient.jsx
│   ├── DashboardWorker.jsx
│   ├── ProfileView.jsx
│   ├── WalletView.jsx
│   ├── SettingsView.jsx
│   ├── MapScreen.jsx
│   └── ModeSwitch.jsx
├── hooks/
│   ├── useGeolocation.js
│   └── useNotifications.js
└── services/
    └── supabase.js
```

## Setup

```bash
npm install
cp .env.example .env  # luego edita .env con tus credenciales reales
npm run dev
```

Variables de entorno (`.env`, no se commitea):

```
VITE_SUPABASE_URL=https://<tu-proyecto>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key — NUNCA service_role>
```

> ⚠️ **NUNCA** uses la `service_role` key en frontend. Está en el bundle público, se salta RLS,
> y cualquier visitante con DevTools la lee. Usa solo la `anon public`.

## Migraciones de base de datos

Las migraciones están en `../supabase/migrations/`:

- `2026_04_24_gig_applications.sql` — Postulaciones competitivas con RLS y RPC `accept_application`.
- `2026_04_24_notifications.sql` — Notificaciones in-app + triggers automáticos.

Aplicar desde el dashboard de Supabase o `supabase db push`.

## Modo oscuro

Controlado por `ThemeContext`. Toggle en *Ajustes → Modo Oscuro*. Persiste en `localStorage`
con la clave `freelancy-theme`.

## Scripts

```bash
npm run dev       # dev server (http://localhost:5173)
npm run build     # producción
npm run preview   # servir build
npm run lint      # eslint
```
