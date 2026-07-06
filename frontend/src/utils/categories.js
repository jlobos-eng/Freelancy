// utils/categories.js — single source of truth para categorías de servicios.
// Antes la lista vivía duplicada en DashboardClient. La centralización
// permite que el filtro funcione idéntico en cualquier dashboard.

// Fallback estático cuando el catálogo dinámico (skills table) aún no cargó.
// Los names DEBEN matchear con `skills.name` del seed para que el filtro
// por skill_slug funcione (ver fetchData en App.jsx).
export const CATEGORIAS = [
    'Todos',
    'Electricista',
    'Gásfiter',
    'Pintor',
    'Carpintero',
    'Limpieza doméstica',
    'Paseador de perros',
    'Diseñador gráfico',
    'Fotógrafo',
];

/**
 * Devuelve true si el gig debe mostrarse para la categoría seleccionada.
 * Estrategia de match (en orden de prioridad):
 *   1. Si la categoría es "Todos" → siempre true.
 *   2. Si gig tiene `category` exacto → comparar.
 *   3. Si la categoría aparece en el title o en la description → true.
 *      Esto permite que gigs antiguos sin campo `category` igual matcheen
 *      por keyword sin tener que migrar BD.
 *
 * Comparación case-insensitive y con pluralización ingenua (gásfiter / gasfiter).
 */
export function gigMatchesCategory(gig, category) {
    if (!category || category === 'Todos') return true;
    if (!gig) return false;

    const needle = normalize(category);
    if (!needle) return true;

    if (gig.category && normalize(gig.category) === needle) return true;
    if (gig.title && normalize(gig.title).includes(needle)) return true;
    if (gig.description && normalize(gig.description).includes(needle)) return true;
    return false;
}

/**
 * Mismo helper para workers (mantiene compat con el filtro existente
 * en DashboardClient que comparaba contra `skill`).
 */
export function workerMatchesCategory(worker, category) {
    if (!category || category === 'Todos') return true;
    if (!worker) return false;
    if (!worker.skill) return false;
    return normalize(worker.skill).includes(normalize(category));
}

// Normalización: minúsculas + sin tildes, para que "Gásfiter" matchee "gasfiter".
function normalize(s) {
    return String(s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '');
}
