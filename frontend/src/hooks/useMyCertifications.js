// useMyCertifications — CRUD de certificaciones del lancy actual.
// Suscripción realtime para que el badge cambie automáticamente cuando el
// admin aprueba/rechaza.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';

export default function useMyCertifications(userId) {
    const [certifications, setCertifications] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchCerts = useCallback(async () => {
        if (!supabase || !userId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('certifications')
                .select('*, skills:skill_id(name, cert_authority)')
                .eq('worker_id', userId)
                .order('created_at', { ascending: false });
            if (!error && data) setCertifications(data);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        if (!supabase || !userId) return;
        fetchCerts();

        const channel = supabase
            .channel(`certifications:${userId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'certifications', filter: `worker_id=eq.${userId}` },
                () => fetchCerts(),
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [userId, fetchCerts]);

    /**
     * Sube un archivo al bucket certifications/<user_id>/<filename> y devuelve URL pública (signed).
     * Si el bucket aún no existe, devuelve null y el caller debe avisar.
     */
    const uploadDocument = useCallback(async (file) => {
        if (!supabase || !userId || !file) return null;
        const ext = file.name.split('.').pop().toLowerCase();
        const path = `${userId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
            .from('certifications')
            .upload(path, file, { contentType: file.type });
        if (upErr) throw upErr;
        // Devolvemos el path interno del bucket — para mostrar al admin
        // generamos un signed URL de 1 año.
        const { data: signed, error: sigErr } = await supabase.storage
            .from('certifications')
            .createSignedUrl(path, 60 * 60 * 24 * 365);
        if (sigErr) return path; // fallback al path
        return signed.signedUrl;
    }, [userId]);

    const submitCertification = useCallback(async (input) => {
        if (!supabase) return;
        const { data, error } = await supabase.rpc('submit_certification', {
            p_skill_id: input.skill_id,
            p_authority: input.authority,
            p_credential_number: input.credential_number,
            p_document_url: input.document_url,
            p_document_mime: input.document_mime || null,
            p_document_size_bytes: input.document_size_bytes || null,
            p_issued_at: input.issued_at || null,
            p_expires_at: input.expires_at || null,
        });
        if (error) throw error;
        await fetchCerts();
        return data;
    }, [fetchCerts]);

    const deleteCertification = useCallback(async (id) => {
        if (!supabase) return;
        const { error } = await supabase.from('certifications').delete().eq('id', id);
        if (error) throw error;
        await fetchCerts();
    }, [fetchCerts]);

    return {
        certifications,
        loading,
        uploadDocument,
        submitCertification,
        deleteCertification,
        refresh: fetchCerts,
    };
}
