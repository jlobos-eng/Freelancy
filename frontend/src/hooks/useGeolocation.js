// frontend/src/hooks/useGeolocation.js
// Hook para acceder a la ubicación del usuario.
// - Auto-fetch en mount (con fallback a Santiago si falla).
// - requestLocation(): dispara el prompt manualmente desde un botón.
//   Devuelve una Promise<{lat, lng, accuracy} | null> para usar en flujos
//   tipo "Compartir mi ubicación" donde necesitamos esperar el resultado.

import { useState, useEffect, useCallback, useRef } from 'react';

const SANTIAGO_FALLBACK = {
    lat: -33.4489,
    lng: -70.6693,
    accuracy: null,
    isFallback: true,
};

const DEFAULT_OPTS = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 60000,
};

export default function useGeolocation(options = {}) {
    const {
        enableHighAccuracy = DEFAULT_OPTS.enableHighAccuracy,
        timeout = DEFAULT_OPTS.timeout,
        maximumAge = DEFAULT_OPTS.maximumAge,
        watch = false,
        autoFetch = true,
    } = options;

    const [coords, setCoords] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(autoFetch);
    const [permissionState, setPermissionState] = useState('prompt'); // 'prompt' | 'granted' | 'denied'

    const optsRef = useRef({ enableHighAccuracy, timeout, maximumAge });
    optsRef.current = { enableHighAccuracy, timeout, maximumAge };

    /**
     * Intenta resolver la ubicación. Resuelve con {lat,lng,accuracy} si OK,
     * o con null si el usuario rechaza / no hay soporte / timeout.
     * Siempre actualiza el estado del hook.
     */
    const requestLocation = useCallback(() => {
        if (!('geolocation' in navigator)) {
            const err = { code: 'UNSUPPORTED', message: 'Geolocalización no soportada en este navegador.' };
            setError(err);
            setCoords(SANTIAGO_FALLBACK);
            setLoading(false);
            return Promise.resolve(null);
        }

        setLoading(true);
        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const next = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        isFallback: false,
                    };
                    setCoords(next);
                    setPermissionState('granted');
                    setError(null);
                    setLoading(false);
                    resolve(next);
                },
                (err) => {
                    const errorMap = {
                        1: { code: 'PERMISSION_DENIED', message: 'Permiso de ubicación denegado.' },
                        2: { code: 'POSITION_UNAVAILABLE', message: 'No se pudo obtener tu ubicación.' },
                        3: { code: 'TIMEOUT', message: 'Tiempo de espera agotado.' },
                    };
                    const mapped = errorMap[err.code] || { code: 'UNKNOWN', message: err.message };
                    setError(mapped);
                    if (mapped.code === 'PERMISSION_DENIED') setPermissionState('denied');
                    setCoords(SANTIAGO_FALLBACK);
                    setLoading(false);
                    resolve(null);
                },
                optsRef.current,
            );
        });
    }, []);

    useEffect(() => {
        if (!autoFetch && !watch) return;
        if (!('geolocation' in navigator)) {
            setError({ code: 'UNSUPPORTED', message: 'Geolocalización no soportada.' });
            setCoords(SANTIAGO_FALLBACK);
            setLoading(false);
            return;
        }

        if (watch) {
            const handleSuccess = (position) => {
                setCoords({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    isFallback: false,
                });
                setPermissionState('granted');
                setError(null);
                setLoading(false);
            };
            const handleError = (err) => {
                const errorMap = {
                    1: { code: 'PERMISSION_DENIED', message: 'Permiso de ubicación denegado.' },
                    2: { code: 'POSITION_UNAVAILABLE', message: 'No se pudo obtener tu ubicación.' },
                    3: { code: 'TIMEOUT', message: 'Tiempo de espera agotado.' },
                };
                const mapped = errorMap[err.code] || { code: 'UNKNOWN', message: err.message };
                setError(mapped);
                if (mapped.code === 'PERMISSION_DENIED') setPermissionState('denied');
                setCoords(SANTIAGO_FALLBACK);
                setLoading(false);
            };
            const id = navigator.geolocation.watchPosition(handleSuccess, handleError, optsRef.current);
            return () => navigator.geolocation.clearWatch(id);
        }

        // autoFetch sin watch
        requestLocation();
    }, [autoFetch, watch, requestLocation]);

    return { coords, error, loading, permissionState, requestLocation };
}

// Fórmula de Haversine — distancia entre dos puntos en kilómetros.
export function haversineDistance(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
    const R = 6371; // Radio de la Tierra en km
    const toRad = (v) => (v * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Formato amigable de distancia: "350 m", "1.2 km", "12 km".
export function formatDistance(km) {
    if (km == null || isNaN(km)) return null;
    if (km < 1) return `${Math.round(km * 1000)} m`;
    if (km < 10) return `${km.toFixed(1)} km`;
    return `${Math.round(km)} km`;
}
