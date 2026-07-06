// useKyc — estado de verificación KYC del usuario actual.
// Lee la última submission y el kyc_status del profile.
// Suscripción realtime: si un admin aprueba/rechaza, la UI reacciona.
//
// API:
//   { status, submission, loading, refresh, submit }
//
// status puede ser 'none' | 'pending_review' | 'approved' | 'rejected'.
// submit({ docFrontBlob, docBackBlob, selfieBlob, rut, fullName, ocrConfidence })
//   → sube las 3 imágenes a kyc-documents/{userId}/... y llama submit_kyc.
//   Devuelve { submissionId, status, autoApproved }.

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabase';

const BUCKET = 'kyc-documents';

async function uploadOne(userId, blob, kind) {
    const ext = blob.type.includes('png') ? 'png' : 'jpg';
    const path = `${userId}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
        contentType: blob.type || `image/${ext}`,
        upsert: false,
    });
    if (error) throw new Error(`Subiendo ${kind}: ${error.message}`);
    return path;
}

export default function useKyc(userId) {
    const [status, setStatus] = useState('none');
    const [submission, setSubmission] = useState(null);
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(async () => {
        if (!supabase || !userId) return;
        setLoading(true);
        try {
            // Última submission del user
            const { data: subs } = await supabase
                .from('kyc_submissions')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(1);
            const last = subs?.[0] || null;
            setSubmission(last);

            // Status canónico desde profiles (lo escribe el trigger)
            const { data: prof } = await supabase
                .from('profiles')
                .select('kyc_status')
                .eq('id', userId)
                .single();
            setStatus(prof?.kyc_status || 'none');
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        if (!supabase || !userId) return;
        refresh();

        // Realtime: cualquier cambio en mi última submission o en mi profile.kyc_status
        const ch = supabase
            .channel(`kyc:${userId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'kyc_submissions', filter: `user_id=eq.${userId}` },
                () => refresh(),
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
                (payload) => {
                    if (payload.new?.kyc_status) setStatus(payload.new.kyc_status);
                },
            )
            .subscribe();

        return () => { supabase.removeChannel(ch); };
    }, [userId, refresh]);

    const submit = useCallback(async ({
        docFrontBlob, docBackBlob, selfieBlob,
        rut, fullName, ocrConfidence,
    }) => {
        if (!supabase || !userId) throw new Error('No autenticado');
        if (!docFrontBlob || !docBackBlob || !selfieBlob) {
            throw new Error('Faltan imágenes (frente, reverso, selfie)');
        }

        // Subir las 3 imágenes en paralelo
        const [frontPath, backPath, selfiePath] = await Promise.all([
            uploadOne(userId, docFrontBlob, 'front'),
            uploadOne(userId, docBackBlob, 'back'),
            uploadOne(userId, selfieBlob, 'selfie'),
        ]);

        // RPC submit_kyc
        const { data, error } = await supabase.rpc('submit_kyc', {
            p_doc_front_path: frontPath,
            p_doc_back_path: backPath,
            p_selfie_path: selfiePath,
            p_rut: rut || null,
            p_full_name_extracted: fullName || null,
            p_ocr_confidence: typeof ocrConfidence === 'number' ? ocrConfidence : null,
        });
        if (error) throw error;

        const row = Array.isArray(data) ? data[0] : data;
        await refresh();
        return {
            submissionId: row?.submission_id,
            status: row?.status,
            autoApproved: row?.auto_approved,
        };
    }, [userId, refresh]);

    return { status, submission, loading, refresh, submit };
}
