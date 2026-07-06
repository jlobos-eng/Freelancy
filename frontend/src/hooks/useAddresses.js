// useAddresses — CRUD de direcciones del usuario actual.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';

export default function useAddresses(userId) {
    const [addresses, setAddresses] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchAddresses = useCallback(async () => {
        if (!supabase || !userId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('addresses')
                .select('*')
                .eq('user_id', userId)
                .order('is_primary', { ascending: false })
                .order('created_at', { ascending: false });
            if (!error && data) setAddresses(data);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => { fetchAddresses(); }, [fetchAddresses]);

    /**
     * Crea una dirección. Usa la RPC create_address que también marca primary
     * si es la primera del usuario.
     */
    const createAddress = useCallback(async (input) => {
        if (!supabase) return null;
        const { data, error } = await supabase.rpc('create_address', {
            p_street: input.street,
            p_number: input.number || null,
            p_apartment: input.apartment || null,
            p_comuna: input.comuna,
            p_city: input.city || input.comuna,
            p_region: input.region,
            p_lat: input.lat ?? null,
            p_lng: input.lng ?? null,
            p_label: input.label || null,
            p_postal_code: input.postal_code || null,
            p_instructions: input.instructions || null,
            p_is_primary: !!input.is_primary,
        });
        if (error) throw error;
        await fetchAddresses();
        return data; // id de la dirección creada
    }, [fetchAddresses]);

    const updateAddress = useCallback(async (id, patch) => {
        if (!supabase) return;
        const { error } = await supabase.from('addresses').update(patch).eq('id', id);
        if (error) throw error;
        await fetchAddresses();
    }, [fetchAddresses]);

    const deleteAddress = useCallback(async (id) => {
        if (!supabase) return;
        const { error } = await supabase.from('addresses').delete().eq('id', id);
        if (error) throw error;
        await fetchAddresses();
    }, [fetchAddresses]);

    const setPrimary = useCallback(async (id) => {
        // El trigger trg_unset_other_primary se encarga de bajar las demás
        await updateAddress(id, { is_primary: true });
    }, [updateAddress]);

    return {
        addresses,
        loading,
        createAddress,
        updateAddress,
        deleteAddress,
        setPrimary,
        refresh: fetchAddresses,
    };
}
