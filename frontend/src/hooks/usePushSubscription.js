// usePushSubscription — gestiona el opt-in/opt-out de push notifications.
// API expuesta:
//   - isSupported: boolean — el browser soporta SW + Push
//   - permission: 'default' | 'granted' | 'denied'
//   - subscription: PushSubscription | null
//   - subscribe(): pide permiso, crea subscription y la guarda en BD
//   - unsubscribe(): borra del browser y de la BD
//   - loading

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// Convierte VAPID key base64-url → Uint8Array (formato que pide PushManager)
function urlBase64ToUint8Array(base64String) {
    if (!base64String) return new Uint8Array();
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from(rawData, (c) => c.charCodeAt(0));
}

export default function usePushSubscription() {
    const isSupported = typeof window !== 'undefined'
        && 'serviceWorker' in navigator
        && 'PushManager' in window;

    const [permission, setPermission] = useState(
        isSupported && typeof Notification !== 'undefined' ? Notification.permission : 'default'
    );
    const [subscription, setSubscription] = useState(null);
    const [loading, setLoading] = useState(false);

    // Cargar subscription actual desde el browser
    useEffect(() => {
        if (!isSupported) return;
        let cancelled = false;
        (async () => {
            try {
                const reg = await navigator.serviceWorker.ready;
                const sub = await reg.pushManager.getSubscription();
                if (!cancelled) setSubscription(sub);
            } catch {
                // SW no listo todavía
            }
        })();
        return () => { cancelled = true; };
    }, [isSupported]);

    const subscribe = useCallback(async () => {
        if (!isSupported) {
            throw new Error('Push notifications no soportadas en este navegador');
        }
        if (!VAPID_PUBLIC_KEY) {
            throw new Error('VITE_VAPID_PUBLIC_KEY no configurada');
        }
        setLoading(true);
        try {
            // 1) Pedir permiso
            const perm = await Notification.requestPermission();
            setPermission(perm);
            if (perm !== 'granted') {
                throw new Error('Permiso denegado');
            }

            // 2) Suscribir en el SW
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });

            // 3) Guardar en Supabase via RPC
            const subJson = sub.toJSON();
            const { error } = await supabase.rpc('upsert_push_subscription', {
                p_endpoint: subJson.endpoint,
                p_p256dh: subJson.keys.p256dh,
                p_auth: subJson.keys.auth,
                p_user_agent: navigator.userAgent.slice(0, 200),
            });
            if (error) {
                // Rollback: si falló guardar, borramos del browser
                await sub.unsubscribe().catch(() => null);
                throw error;
            }

            setSubscription(sub);
            return sub;
        } finally {
            setLoading(false);
        }
    }, [isSupported]);

    const unsubscribe = useCallback(async () => {
        if (!subscription) return;
        setLoading(true);
        try {
            const endpoint = subscription.endpoint;
            await subscription.unsubscribe();
            await supabase.rpc('delete_push_subscription', { p_endpoint: endpoint });
            setSubscription(null);
        } finally {
            setLoading(false);
        }
    }, [subscription]);

    return {
        isSupported,
        permission,
        subscription,
        isSubscribed: !!subscription,
        loading,
        subscribe,
        unsubscribe,
    };
}
