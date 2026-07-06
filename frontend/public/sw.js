// Freelancy service worker — instalación + push web notifications.
// Estrategia: red-primero para todo (no cacheamos assets para evitar que
// usuarios queden en versiones viejas durante MVP). Sólo el manifest queda
// cacheado por defecto en el navegador.
//
// Eventos manejados:
//  - 'install'  → skipWaiting (activación inmediata cuando publicamos nueva versión)
//  - 'activate' → clients.claim (controlar pestañas existentes)
//  - 'push'     → mostrar notification con icono + body + click handler
//  - 'notificationclick' → focusear/abrir la app y navegar al gig si aplica

const CACHE_VERSION = 'freelancy-v1';

self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        // Limpiar caches viejos por si en el futuro precacheamos
        const keys = await caches.keys();
        await Promise.all(
            keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
        );
        await self.clients.claim();
    })());
});

// =====================================================================
// Push notifications
// =====================================================================
// Payload esperado del backend (send-push Edge Function):
//   {
//     title: string,
//     body: string,
//     gig_id?: string,
//     notification_id?: string,
//     type?: string,
//     url?: string,            // URL específica a abrir
//     tag?: string,            // si dos pushes tienen el mismo tag, el segundo reemplaza al primero
//   }
self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch {
        // Si llega texto plano, lo usamos como body
        data = { body: event.data ? event.data.text() : '' };
    }

    const title = data.title || 'Freelancy';
    const body = data.body || '';
    const tag = data.tag || data.notification_id || data.gig_id || 'freelancy-default';

    const options = {
        body,
        tag,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        renotify: true,
        requireInteraction: false,
        data: {
            url: data.url || '/',
            gig_id: data.gig_id,
            notification_id: data.notification_id,
            type: data.type,
        },
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || '/';

    event.waitUntil((async () => {
        const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

        // Si hay una pestaña de la app abierta, la enfocamos y le mandamos un mensaje
        for (const client of allClients) {
            const clientUrl = new URL(client.url);
            if (clientUrl.origin === self.location.origin) {
                await client.focus();
                client.postMessage({
                    type: 'push-notification-click',
                    payload: event.notification.data,
                });
                return;
            }
        }

        // Si no, abrimos una nueva
        await self.clients.openWindow(targetUrl);
    })());
});

// Mantener el service worker vivo si recibe mensajes desde la app (opcional)
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
