import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import Root from './Root.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { initMonitoring, reportError } from './services/monitoring.js';

// Monitoreo de errores (Sentry). Inerte si no hay VITE_SENTRY_DSN.
initMonitoring();

// Capturar errores no atrapados por React (promesas rechazadas y errores globales).
if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', (e) => reportError(e.reason, { kind: 'unhandledrejection' }));
    window.addEventListener('error', (e) => reportError(e.error ?? e.message, { kind: 'window.error' }));
}

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <ThemeProvider>
            <ErrorBoundary>
                <Root />
            </ErrorBoundary>
        </ThemeProvider>
    </StrictMode>,
);

// Registrar el service worker (PWA + push). Sólo en producción y en HTTPS,
// salvo localhost que también permite SW. En dev evitamos cache rara.
if ('serviceWorker' in navigator && (import.meta.env.PROD || location.hostname === 'localhost')) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('/sw.js', { scope: '/' })
            .catch((err) => console.warn('[sw] register failed', err));
    });

    // Recibir mensajes del SW (ej: click en push notification)
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'push-notification-click') {
            // Aquí podríamos navegar a un gig específico. Por ahora, dejamos que
            // App.jsx escuche este evento si quiere reaccionar.
            window.dispatchEvent(new CustomEvent('push-click', { detail: event.data.payload }));
        }
    });
}
