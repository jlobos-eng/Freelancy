// useWallet — saldos en tiempo real para un usuario.
// Lee la vista wallet_balance (security_invoker=true → cada uno ve sólo lo suyo)
// + suscripción a transactions para refrescar cuando cambia el estado.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';

export default function useWallet(userId) {
    const [balance, setBalance] = useState({ pending: 0, available: 0, lifetime: 0, completed_jobs: 0 });
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchAll = useCallback(async () => {
        if (!supabase || !userId) return;
        setLoading(true);
        try {
            const [balRes, txRes] = await Promise.all([
                supabase.from('wallet_balance').select('*').eq('user_id', userId).maybeSingle(),
                supabase
                    .from('transactions')
                    .select('*, gigs:gig_id(title)')
                    .or(`payer_id.eq.${userId},payee_id.eq.${userId}`)
                    .order('created_at', { ascending: false })
                    .limit(50),
            ]);
            if (balRes.data) {
                setBalance({
                    pending: Number(balRes.data.pending) || 0,
                    available: Number(balRes.data.available) || 0,
                    lifetime: Number(balRes.data.lifetime) || 0,
                    completed_jobs: Number(balRes.data.completed_jobs) || 0,
                });
            }
            if (txRes.data) setTransactions(txRes.data);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        if (!supabase || !userId) return;
        fetchAll();

        // Realtime sobre transactions del usuario
        const channel = supabase
            .channel(`wallet:${userId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'transactions', filter: `payer_id=eq.${userId}` },
                () => fetchAll(),
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'transactions', filter: `payee_id=eq.${userId}` },
                () => fetchAll(),
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId, fetchAll]);

    return { balance, transactions, loading, refresh: fetchAll };
}
