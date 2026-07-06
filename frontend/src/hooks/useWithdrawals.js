// useWithdrawals — historial de retiros + acciones (request, cancel, simulate).
// Llama RPCs (no INSERT directo) porque el backend valida saldo + monto + cuenta
// atómicamente. El UI nunca debería tocar withdrawals con INSERT/UPDATE.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';

export default function useWithdrawals(userId) {
    const [withdrawals, setWithdrawals] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchWithdrawals = useCallback(async () => {
        if (!supabase || !userId) return;
        setLoading(true);
        setError(null);
        try {
            const { data, error: e } = await supabase
                .from('withdrawals')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(50);
            if (e) throw e;
            setWithdrawals(data || []);
        } catch (e) {
            setError(e.message || String(e));
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        fetchWithdrawals();
        if (!supabase || !userId) return;
        const channel = supabase
            .channel(`withdrawals:${userId}`)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'withdrawals', filter: `user_id=eq.${userId}` },
                () => fetchWithdrawals())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [userId, fetchWithdrawals]);

    /** Crea un retiro. Devuelve el id (uuid) o lanza con mensaje del backend. */
    const requestWithdrawal = useCallback(async ({ amount, bankAccountId }) => {
        if (!supabase) throw new Error('No session');
        const { data, error: e } = await supabase.rpc('request_withdrawal', {
            p_amount: amount,
            p_bank_account_id: bankAccountId,
        });
        if (e) throw e;
        await fetchWithdrawals();
        return data;
    }, [fetchWithdrawals]);

    const cancelWithdrawal = useCallback(async (withdrawalId) => {
        if (!supabase) throw new Error('No session');
        const { error: e } = await supabase.rpc('cancel_withdrawal', {
            p_withdrawal_id: withdrawalId,
        });
        if (e) throw e;
        await fetchWithdrawals();
    }, [fetchWithdrawals]);

    /** Sólo dev/demo: empuja el retiro a 'paid' (o 'failed' si forceFail=true). */
    const simulateProcess = useCallback(async (withdrawalId, forceFail = false) => {
        if (!supabase) throw new Error('No session');
        const { data, error: e } = await supabase.rpc('simulate_process_withdrawal', {
            p_withdrawal_id: withdrawalId,
            p_force_fail: forceFail,
        });
        if (e) throw e;
        await fetchWithdrawals();
        return data;
    }, [fetchWithdrawals]);

    return {
        withdrawals,
        loading,
        error,
        refresh: fetchWithdrawals,
        requestWithdrawal,
        cancelWithdrawal,
        simulateProcess,
    };
}
