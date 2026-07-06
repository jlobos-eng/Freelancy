// services/monitoring.js — monitoreo de errores en producción (Sentry).
//
// Diseño "inerte hasta que haya DSN":
//   - Si VITE_SENTRY_DSN NO está definido, no se inicializa nada y reportError
//     solo hace console.error. Cero dependencia en runtime, cero ruido.
//   - Si SÍ está definido, se carga @sentry/react DINÁMICAMENTE (code-split:
//     el bundle de Sentry solo se descarga cuando realmente se usa) y se
//     inicializa. Un fallo al cargar Sentry nunca tumba la app (try/catch).
//
// Para activarlo:
//   1. Crear proyecto en https://sentry.io (plan gratis) → copiar el DSN.
//   2. Poner VITE_SENTRY_DSN=<dsn> en frontend/.env (y en las env vars del deploy).
//   3. Redeploy. Listo: los errores no capturados llegan a Sentry con traza.

let _sentry = null;

/** Inicializa Sentry solo si hay DSN. Idempotente y a prueba de fallos. */
export async function initMonitoring() {
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    if (!dsn || _sentry) return;
    try {
        const Sentry = await import('@sentry/react');
        Sentry.init({
            dsn,
            environment: import.meta.env.MODE, // 'development' | 'production'
            // Muestreo conservador de performance; súbelo si quieres más trazas.
            tracesSampleRate: 0.1,
            // Sin session replay por defecto (privacidad + costo). Actívalo si lo necesitas.
            replaysSessionSampleRate: 0,
            replaysOnErrorSampleRate: 0,
        });
        _sentry = Sentry;
    } catch (e) {
        // Nunca dejamos que un problema del monitoreo rompa la app.
        console.warn('[monitoring] Sentry no se pudo inicializar:', e);
    }
}

/**
 * Reporta un error. Va a Sentry si está activo; si no, a la consola.
 * @param {unknown} error
 * @param {Record<string, unknown>} [context] - datos extra (ej: { gigId, userId })
 */
export function reportError(error, context) {
    try {
        if (_sentry) {
            _sentry.captureException(error, context ? { extra: context } : undefined);
        } else {
            console.error('[error]', error, context ?? '');
        }
    } catch {
        // no-op: reportar un error nunca debe lanzar otro error
    }
}

/** Adjunta info del usuario a los reportes (llamar tras login). */
export function setMonitoringUser(user) {
    if (_sentry && user?.id) {
        _sentry.setUser({ id: user.id });
    }
}
