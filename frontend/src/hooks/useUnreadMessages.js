// useUnreadMessages — contador de mensajes no leídos por gig.
// - Carga inicial desde unread_messages_per_gig (la vista calcula por usuario via security_invoker).
// - Realtime: escucha INSERT/UPDATE en messages y actualiza los contadores localmente.
// - Devuelve un Map<gigId, number> para que los dashboards pinten badges sin N+1.
//
// API:
//   - unreadByGig: Map<gigId, count>
//   - totalUnread: número total
//   - markGigRead(gigId): llamada cuando se abre el chat (UI optimistic)
//   - refresh()

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabase';

export default function useUnreadMessages(userId, gigIds = []) {
    const [counts, setCounts] = useState(new Map());

    // Stable key para evitar re-runs cuando gigIds llega como array nuevo con mismos valores
    const gigIdsKey = useMemo(() => [...gigIds].sort().join(','), [gigIds]);

    const fetchCounts = useCallback(async () => {
        if (!supabase || !userId) return;

        const ids = gigIdsKey ? gigIdsKey.split(',').filter(Boolean) : [];
        if (ids.length === 0) {
            setCounts(new Map());
            return;
        }

        const { data, error } = await supabase
            .from('unread_messages_per_gig')
            .select('gig_id, client_id, worker_id, unread_for_client, unread_for_worker')
            .in('gig_id', ids);

        if (error || !data) return;

        const next = new Map();
        for (const row of data) {
            // Si soy el cliente del gig → me importa unread_for_client; si soy el worker → unread_for_worker
            const myCount = row.client_id === userId
                ? Number(row.unread_for_client) || 0
                : row.worker_id === userId
                    ? Number(row.unread_for_worker) || 0
                    : 0;
            if (myCount > 0) next.set(row.gig_id, myCount);
        }
        setCounts(next);
    }, [userId, gigIdsKey]);

    useEffect(() => {
        if (!supabase || !userId) return;

        fetchCounts();

        // Realtime: escuchar inserts en messages para los gigs en los que participo.
        // No podemos filtrar por sender_id != userId vía postgres_changes filter, pero la
        // ganancia con un refetch es despreciable y simplifica la lógica vs sincronía local.
        const channel = supabase
            .channel(`unread-messages:${userId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages' },
                (payload) => {
                    const m = payload.new;
                    // Sólo nos importa si el mensaje es de un gig que estamos rastreando
                    // y el sender NO es el usuario actual (los míos no cuentan).
                    if (!m?.gig_id || m.sender_id === userId) return;
                    if (gigIdsKey && !gigIdsKey.split(',').includes(m.gig_id)) return;
                    setCounts(prev => {
                        const next = new Map(prev);
                        next.set(m.gig_id, (next.get(m.gig_id) || 0) + 1);
                        return next;
                    });
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'messages' },
                (payload) => {
                    // Cuando el otro lado marca como leído, no nos toca actualizar nada
                    // (los contadores que vemos son sobre mensajes dirigidos A NOSOTROS).
                    // Pero si fueron mensajes nuestros que quedaron leídos, tampoco cambia nuestro contador.
                    // Sólo refrescamos si el read_at cambió en mensajes dirigidos al caller — improbable
                    // que no venga vía nuestro propio mark_messages_read. Skip por simplicidad.
                    void payload;
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId, gigIdsKey, fetchCounts]);

    /**
     * Limpia el contador de un gig localmente (optimistic) cuando el usuario
     * abre el chat. Se complementa con la llamada server-side a mark_messages_read.
     */
    const markGigRead = useCallback((gigId) => {
        setCounts(prev => {
            if (!prev.has(gigId)) return prev;
            const next = new Map(prev);
            next.delete(gigId);
            return next;
        });
    }, []);

    const totalUnread = useMemo(() => {
        let total = 0;
        for (const c of counts.values()) total += c;
        return total;
    }, [counts]);

    return {
        unreadByGig: counts,
        totalUnread,
        markGigRead,
        refresh: fetchCounts,
    };
}
