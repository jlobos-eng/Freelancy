// useBankAccounts — CRUD de cuentas bancarias del usuario.
// Las RLS aseguran que cada usuario sólo ve/edita las suyas, así que el hook
// no necesita pasar user_id explícito en filtros (lo hace por seguridad igual).

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';

export default function useBankAccounts(userId) {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchAccounts = useCallback(async () => {
        if (!supabase || !userId) return;
        setLoading(true);
        setError(null);
        try {
            const { data, error: e } = await supabase
                .from('bank_accounts')
                .select('*')
                .eq('user_id', userId)
                .order('is_primary', { ascending: false })
                .order('created_at', { ascending: false });
            if (e) throw e;
            setAccounts(data || []);
        } catch (e) {
            setError(e.message || String(e));
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

    const addAccount = useCallback(async (payload) => {
        if (!supabase || !userId) throw new Error('No session');
        const isFirst = accounts.length === 0;
        const { data, error: e } = await supabase
            .from('bank_accounts')
            .insert({
                user_id: userId,
                holder_name: payload.holder_name.trim(),
                holder_rut: payload.holder_rut,
                bank_code: payload.bank_code,
                account_type: payload.account_type,
                account_number: payload.account_number.trim(),
                contact_email: payload.contact_email?.trim() || null,
                is_primary: payload.is_primary ?? isFirst, // si es la primera, queda primary
            })
            .select()
            .single();
        if (e) throw e;
        await fetchAccounts();
        return data;
    }, [userId, accounts.length, fetchAccounts]);

    const setPrimary = useCallback(async (accountId) => {
        if (!supabase) return;
        const { error: e } = await supabase
            .from('bank_accounts')
            .update({ is_primary: true })
            .eq('id', accountId);
        if (e) throw e;
        await fetchAccounts();
    }, [fetchAccounts]);

    const deleteAccount = useCallback(async (accountId) => {
        if (!supabase) return;
        const { error: e } = await supabase
            .from('bank_accounts')
            .delete()
            .eq('id', accountId);
        if (e) throw e;
        await fetchAccounts();
    }, [fetchAccounts]);

    return { accounts, loading, error, refresh: fetchAccounts, addAccount, setPrimary, deleteAccount };
}
