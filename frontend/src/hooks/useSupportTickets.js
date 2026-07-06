// useSupportTickets — gestión de tickets de soporte del usuario actual.
// Lista + create + suscripción realtime para ver respuestas del admin sin recargar.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';

const APP_VERSION = 'v0.1.0';

export default function useSupportTickets(userId) {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchTickets = useCallback(async () => {
        if (!supabase || !userId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('support_tickets')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            if (!error && data) setTickets(data);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        if (!supabase || !userId) return;
        fetchTickets();

        const channel = supabase
            .channel(`support_tickets:${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'support_tickets',
                    filter: `user_id=eq.${userId}`,
                },
                () => fetchTickets(),
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [userId, fetchTickets]);

    /**
     * Crea un ticket nuevo.
     * @param {object} input
     * @param {'bug'|'question'|'payment'|'account'|'other'} input.type
     * @param {'low'|'normal'|'high'} input.priority
     * @param {string} input.subject
     * @param {string} input.description
     * @param {object} [input.context] — campos extra a fusionar con el contexto auto.
     */
    const createTicket = useCallback(async (input) => {
        if (!supabase || !userId) throw new Error('No hay sesión activa');

        const autoContext = {
            app_version: APP_VERSION,
            user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 250) : null,
            url: typeof window !== 'undefined' ? window.location.pathname + window.location.search : null,
            timestamp: new Date().toISOString(),
            ...input.context,
        };

        const { data, error } = await supabase
            .from('support_tickets')
            .insert({
                user_id: userId,
                type: input.type,
                priority: input.priority || 'normal',
                subject: input.subject.trim(),
                description: input.description.trim(),
                context: autoContext,
                status: 'open',
            })
            .select()
            .single();

        if (error) throw error;
        await fetchTickets();
        return data;
    }, [userId, fetchTickets]);

    return {
        tickets,
        loading,
        createTicket,
        refresh: fetchTickets,
    };
}
