// useSkillCatalog — lectura del catálogo cerrado de skills.
// Cache global: una sola llamada por sesión (el catálogo no cambia mientras
// el usuario está logueado). Si lo necesitas en muchos componentes, considera
// promover esto a Context.

import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

let cachedSkills = null;
let inflight = null;

async function fetchSkillsOnce() {
    if (cachedSkills) return cachedSkills;
    if (inflight) return inflight;
    if (!supabase) return [];
    inflight = supabase
        .from('skills')
        .select('id, slug, name, category, icon, description, requires_certification, cert_authority')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true })
        .then(({ data, error }) => {
            inflight = null;
            if (error || !data) return [];
            cachedSkills = data;
            return data;
        });
    return inflight;
}

export default function useSkillCatalog() {
    const [skills, setSkills] = useState(cachedSkills || []);
    const [loading, setLoading] = useState(!cachedSkills);

    useEffect(() => {
        if (cachedSkills) return;
        let cancelled = false;
        (async () => {
            const data = await fetchSkillsOnce();
            if (!cancelled) {
                setSkills(data);
                setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // Útil para selectores: agrupar por categoría
    const byCategory = skills.reduce((acc, s) => {
        (acc[s.category] = acc[s.category] || []).push(s);
        return acc;
    }, {});

    return { skills, byCategory, loading };
}
