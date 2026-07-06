// useMySkills — CRUD de las skills del usuario actual (worker).
// Lee de la vista worker_skills_with_skill que ya trae el name/slug/category.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';

export default function useMySkills(userId) {
    const [mySkills, setMySkills] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchMySkills = useCallback(async () => {
        if (!supabase || !userId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('worker_skills_with_skill')
                .select('*')
                .eq('worker_id', userId)
                .order('is_primary', { ascending: false })
                .order('created_at', { ascending: true });
            if (!error && data) setMySkills(data);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => { fetchMySkills(); }, [fetchMySkills]);

    const addSkill = useCallback(async ({ skill_id, headline, hourly_rate, years_experience, is_primary }) => {
        if (!supabase || !userId) return;
        const isFirst = mySkills.length === 0;
        const { error } = await supabase.from('worker_skills').insert({
            worker_id: userId,
            skill_id,
            headline: headline || null,
            hourly_rate: hourly_rate || null,
            years_experience: years_experience ?? null,
            is_primary: is_primary ?? isFirst,
        });
        if (error) throw error;
        await fetchMySkills();
    }, [userId, mySkills.length, fetchMySkills]);

    const updateSkill = useCallback(async (id, patch) => {
        if (!supabase) return;
        const { error } = await supabase.from('worker_skills').update(patch).eq('id', id);
        if (error) throw error;
        await fetchMySkills();
    }, [fetchMySkills]);

    const deleteSkill = useCallback(async (id) => {
        if (!supabase) return;
        const { error } = await supabase.from('worker_skills').delete().eq('id', id);
        if (error) throw error;
        await fetchMySkills();
    }, [fetchMySkills]);

    const setPrimarySkill = useCallback(async (id) => {
        await updateSkill(id, { is_primary: true });
    }, [updateSkill]);

    return {
        mySkills,
        loading,
        addSkill,
        updateSkill,
        deleteSkill,
        setPrimarySkill,
        refresh: fetchMySkills,
    };
}
