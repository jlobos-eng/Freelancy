// frontend/src/hooks/useNotifications.js
// Hook que sincroniza notificaciones del usuario actual:
// - Carga inicial
// - Suscripción realtime via Supabase channels (postgres_changes en notifications)
// - onNew(notification): callback opcional para mostrar toast cuando llega una nueva
// - markAsRead(id) y markAllAsRead()

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';

export default function useNotifications(userId, { onNew } = {}) {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);
    const onNewRef = useRef(onNew);

    // Mantener el callback fresco sin re-suscribir el channel
    useEffect(() => {
        onNewRef.current = onNew;
    }, [onNew]);

    // Carga inicial
    const fetchNotifications = useCallback(async () => {
        if (!supabase || !userId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(50);
            if (!error && data) {
                setNotifications(data);
            }
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        if (!supabase || !userId) return;

        fetchNotifications();

        // Realtime: nuevas notificaciones para este usuario
        const channel = supabase
            .channel(`notifications:${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    const next = payload.new;
                    setNotifications(prev => [next, ...prev]);
                    if (typeof onNewRef.current === 'function') {
                        try { onNewRef.current(next); } catch { /* no-op */ }
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    const updated = payload.new;
                    setNotifications(prev => prev.map(n => n.id === updated.id ? updated : n));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId, fetchNotifications]);

    const markAsRead = useCallback(async (id) => {
        if (!supabase) return;
        const now = new Date().toISOString();
        // optimistic update
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: now } : n));
        await supabase.from('notifications').update({ read_at: now }).eq('id', id);
    }, []);

    const markAllAsRead = useCallback(async () => {
        if (!supabase || !userId) return;
        const now = new Date().toISOString();
        // optimistic
        setNotifications(prev => prev.map(n => n.read_at ? n : { ...n, read_at: now }));
        // Intenta RPC primero, fallback a update directo
        const { error } = await supabase.rpc('mark_all_notifications_read');
        if (error) {
            await supabase
                .from('notifications')
                .update({ read_at: now })
                .eq('user_id', userId)
                .is('read_at', null);
        }
    }, [userId]);

    const remove = useCallback(async (id) => {
        if (!supabase) return;
        setNotifications(prev => prev.filter(n => n.id !== id));
        await supabase.from('notifications').delete().eq('id', id);
    }, []);

    const unreadCount = notifications.filter(n => !n.read_at).length;

    return {
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        remove,
        refresh: fetchNotifications,
    };
}
