// utils/geo.js — utilidades de geolocalización del lado cliente.
// - Jitter determinista de ~200m (privacidad: nunca exponemos la coord exacta del worker)
// - Reverse geocoding via Nominatim para detectar comuna desde lat/lng

// =====================================================================
// Jitter determinista
// =====================================================================
// La idea: dado un (lat, lng) y un seed (worker.id), generamos siempre
// el mismo desplazamiento dentro de un radio. Esto garantiza:
//  - El pin no "salta" entre renders del mismo worker.
//  - Dos clientes ven al mismo worker en el mismo lugar aproximado.
//  - El cliente nunca ve la coord exacta — la app nunca la entrega cruda
//    al render.
// =====================================================================

const DEFAULT_JITTER_METERS = 200;

function hashSeed(str) {
    let h = 0;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) {
        h = ((h << 5) - h) + s.charCodeAt(i);
        h |= 0;
    }
    // Devolvemos dos valores pseudo-aleatorios en [0,1) derivados del mismo hash
    const u1 = ((h >>> 0) % 100000) / 100000;
    const u2 = (((h * 2654435761) >>> 0) % 100000) / 100000;
    return [u1, u2];
}

/**
 * Aplica un desplazamiento estable y pseudo-aleatorio a una coord.
 * @param {number} lat
 * @param {number} lng
 * @param {string} seed - típicamente worker.id (uuid)
 * @param {number} maxMeters - radio máximo del jitter
 * @returns {{lat:number, lng:number}}
 */
export function jitterCoord(lat, lng, seed, maxMeters = DEFAULT_JITTER_METERS) {
    if (lat == null || lng == null) return { lat, lng };
    const [u1, u2] = hashSeed(seed);
    // Distribución polar: ángulo uniforme + radio uniforme en área (sqrt para no concentrar al centro)
    const angle = u1 * 2 * Math.PI;
    const radius = Math.sqrt(u2) * maxMeters;
    // Conversión metros → grados. 1 grado lat ≈ 111_320 m. lng depende del coseno de la lat.
    const dLat = (radius * Math.cos(angle)) / 111_320;
    const dLng = (radius * Math.sin(angle)) / (111_320 * Math.cos((lat * Math.PI) / 180));
    return { lat: lat + dLat, lng: lng + dLng };
}

// =====================================================================
// Reverse geocoding (Nominatim — gratis, fair use)
// =====================================================================
// Nominatim pide:
//  - Header User-Agent identificable. Browsers bloquean setear UA, pero
//    aceptan que pongamos un Referer implícito.
//  - Máx 1 req/seg por IP. La UI llama esto solo cuando el worker
//    aprieta "Compartir ubicación", así que está bien.
//
// Si el rate limit te bloquea, migra a una API con key (LocationIQ,
// Geoapify, Mapbox). El contrato de retorno se mantiene.

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';

/**
 * Forward geocoding (autocomplete): query → lista de candidatos.
 * Cada candidato: { display, lat, lng, components: { street, number, comuna, city, region, country, postal_code } }
 * Acotamos a Chile (countrycodes=cl).
 *
 * Rate limit: 1 req/seg. Recomendado debouncing de 300-500ms en el caller.
 * Soporta AbortSignal para cancelar peticiones obsoletas.
 */
export async function searchAddresses(query, { limit = 5, signal } = {}) {
    const q = String(query || '').trim();
    if (q.length < 3) return [];
    try {
        const url = `${NOMINATIM_SEARCH_URL}?format=jsonv2&q=${encodeURIComponent(q)}` +
            `&countrycodes=cl&accept-language=es&addressdetails=1&limit=${limit}`;
        const res = await fetch(url, { headers: { Accept: 'application/json' }, signal });
        if (!res.ok) return [];
        const data = await res.json();
        return data.map((item) => {
            const a = item.address || {};
            const locality =
                a.suburb || a.city_district || a.town || a.village || a.municipality || a.city || '';
            return {
                display: item.display_name,
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
                components: {
                    street: a.road || a.pedestrian || '',
                    number: a.house_number || '',
                    comuna: locality,
                    city: a.city || a.town || a.municipality || '',
                    region: a.state || '',
                    country: a.country_code ? a.country_code.toUpperCase() : 'CL',
                    postal_code: a.postcode || '',
                },
            };
        });
    } catch (err) {
        if (err?.name === 'AbortError') return [];
        return [];
    }
}

/**
 * Reverse geocoding: lat/lng → string legible (comuna, ciudad).
 * Devuelve null si falla o si no hay match.
 */
export async function reverseGeocode(lat, lng) {
    if (lat == null || lng == null) return null;
    try {
        const url = `${NOMINATIM_URL}?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=es&zoom=14`;
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) return null;
        const data = await res.json();
        const a = data.address || {};
        // Preferimos comuna chilena → suburb / city_district / town. Caemos al state si nada.
        const locality =
            a.suburb || a.city_district || a.town || a.village || a.municipality || a.city || a.state;
        const region = a.state && a.state !== locality ? a.state : null;
        if (!locality) return null;
        return region && region !== locality ? `${locality}, ${region}` : locality;
    } catch {
        return null;
    }
}
