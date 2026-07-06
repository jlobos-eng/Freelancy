// useDisputes — disputas relevantes para el usuario actual.
// - Carga inicial: disputas donde soy opener O respondent O participo del gig.
// - Realtime: escucha INSERTs/UPDATEs para los gigs en los que participo.
// - Devuelve un Map gigId → disputa abierta para que App.jsx pinte badges
//   sin hacer N+1.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabase';

export default function useDisputes(userId, gigIds = []) {
    const [disputes, setDisputes] = useState([]);
    const [loading, setLoading] = useState(false);

    // Stable key para evitar re-runs cuando gigIds llega como array nuevo con mismos valores
    const gigIdsKey = useMemo(() => [...gigIds].sort().join(','), [gigIds]);

    const fetchDisputes = useCallback(async () => {
        if (!supabase || !userId) return;
        setLoading(true);
        try {
            // Pedimos todas las disputas en gigs en los que participo (o que abrí)
            let query = supabase
                .from('disputes')
                .select('*')
                .order('created_at', { ascending: false });

            if (gigIdsKey) {
                const ids = gigIdsKey.split(',').filter(Boolean);
                if (ids.length > 0) {
                    query = query.in('gig_id', ids);
                }
            }

            const { data, error } = await query;
            if (!error && data) {
                setDisputes(data);
            }
        } finally {
            setLoading(false);
        }
    }, [userId, gigIdsKey]);

    useEffect(() => {
        if (!supabase || !userId) return;

        fetchDisputes();

        // Realtime sobre la tabla disputes (la RLS ya filtra a participantes)
        const channel = supabase
            .channel(`disputes:${userId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'disputes' },
                (payload) => {
                    setDisputes(prev => {
                        if (prev.find(d => d.id === payload.new.id)) return prev;
                        return [payload.new, ...prev];
                    });
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'disputes' },
                (payload) => {
                    setDisputes(prev => prev.map(d => d.id === payload.new.id ? payload.new : d));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId, fetchDisputes]);

    // Map gigId → disputa abierta (open o under_review). Útil para badges.
    const openByGig = useMemo(() => {
        const map = new Map();
        for (const d of disputes) {
            if (d.status === 'open' || d.status === 'under_review') {
                map.set(d.gig_id, d);
            }
        }
        return map;
    }, [disputes]);

    return {
        disputes,
        openByGig,
        loading,
        refresh: fetchDisputes,
    };
}
