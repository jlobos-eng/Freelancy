// utils/avatar.js — fallback de avatar con caché en memoria.
// Antes vivía dentro de App.jsx con useRef; al sacarlo se elimina la prop drilling
// de avatarFallback hacia 8+ componentes.

const cache = new Map();

/** Devuelve una URL de avatar generada por ui-avatars para un nombre dado. */
export function avatarFallback(name) {
    const key = name || 'User';
    const hit = cache.get(key);
    if (hit) return hit;
    const url = `https://ui-avatars.com/api/?name=${encodeURIComponent(key)}&background=random&color=fff&bold=true`;
    cache.set(key, url);
    return url;
}

/** Devuelve la URL del avatar si existe, sino el fallback. Útil para usar inline en src=. */
export function avatarFor(profile) {
    if (profile?.avatar_url) return profile.avatar_url;
    return avatarFallback(profile?.full_name);
}
