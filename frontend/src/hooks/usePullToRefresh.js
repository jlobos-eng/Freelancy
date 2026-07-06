// usePullToRefresh — pull-to-refresh táctil con resistencia exponencial.
//
// Cómo funciona:
//   - Listeners en `window` (no en un contenedor específico) → el scroll y el
//     touch se manejan a nivel documento, así funciona en cualquier zona.
//   - Sólo activa cuando `window.scrollY === 0` (estamos en top de la página).
//   - Mide el delta del touch desde el primer touchstart.
//   - Aplica resistencia: pullDistance = sqrt(rawDelta * 8). Esto hace que
//     jalar 200px se sienta como 40px, simulando una banda elástica.
//   - Si pullDistance > threshold al soltar → dispara onRefresh().
//
// Diseño defensivo:
//   - Si NO estamos en scrollTop=0, no hace nada (no interfiere con scroll normal).
//   - Cancela si el usuario hace swipe horizontal (probablemente quería navegar).
//   - No reentry: ignora touches mientras isRefreshing.
//   - Funciona aunque el body sea el que scrollea (no requiere overflow-y-auto
//     en un contenedor específico).

import { useEffect, useRef, useState, useCallback } from 'react';

const THRESHOLD = 70;       // px para disparar refresh
const MAX_PULL = 120;       // px máx visible
const RESISTANCE_FACTOR = 8;

function getScrollTop() {
    if (typeof window === 'undefined') return 0;
    return window.scrollY ?? document.documentElement.scrollTop ?? document.body.scrollTop ?? 0;
}

export default function usePullToRefresh(onRefresh) {
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const startYRef = useRef(null);
    const startXRef = useRef(null);
    const cancelledRef = useRef(false);

    const handleTouchStart = useCallback((e) => {
        if (isRefreshing) return;
        // Sólo activamos si estamos en top del documento
        if (getScrollTop() > 0) {
            startYRef.current = null;
            return;
        }
        startYRef.current = e.touches[0].clientY;
        startXRef.current = e.touches[0].clientX;
        cancelledRef.current = false;
    }, [isRefreshing]);

    const handleTouchMove = useCallback((e) => {
        if (isRefreshing || startYRef.current == null || cancelledRef.current) return;
        const dy = e.touches[0].clientY - startYRef.current;
        const dx = e.touches[0].clientX - startXRef.current;

        // Si el swipe es más horizontal que vertical, cancelar
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
            cancelledRef.current = true;
            setPullDistance(0);
            return;
        }

        if (dy <= 0) {
            setPullDistance(0);
            return;
        }

        // Si ya nos movimos del top mientras tirábamos (por inercia), cancelar
        if (getScrollTop() > 0) {
            cancelledRef.current = true;
            setPullDistance(0);
            return;
        }

        const eased = Math.min(MAX_PULL, Math.sqrt(dy * RESISTANCE_FACTOR));
        setPullDistance(eased);

        if (eased > 5 && e.cancelable) {
            e.preventDefault();
        }
    }, [isRefreshing]);

    const handleTouchEnd = useCallback(async () => {
        if (cancelledRef.current || isRefreshing) {
            startYRef.current = null;
            return;
        }
        const distance = pullDistance;
        startYRef.current = null;

        if (distance >= THRESHOLD && typeof onRefresh === 'function') {
            setIsRefreshing(true);
            try {
                await onRefresh();
            } catch {
                // no-op — el caller debe loggear
            } finally {
                setIsRefreshing(false);
                setPullDistance(0);
            }
        } else {
            setPullDistance(0);
        }
    }, [pullDistance, isRefreshing, onRefresh]);

    // Listeners a nivel window → funcionan en cualquier zona de la pantalla.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.addEventListener('touchstart', handleTouchStart, { passive: true });
        window.addEventListener('touchmove', handleTouchMove, { passive: false });
        window.addEventListener('touchend', handleTouchEnd, { passive: true });
        window.addEventListener('touchcancel', handleTouchEnd, { passive: true });
        return () => {
            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
            window.removeEventListener('touchcancel', handleTouchEnd);
        };
    }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

    /** Dispara refresh manualmente (botones desktop / atajos teclado). */
    const triggerRefresh = useCallback(async () => {
        if (isRefreshing || typeof onRefresh !== 'function') return;
        setIsRefreshing(true);
        try {
            await onRefresh();
        } finally {
            setIsRefreshing(false);
            setPullDistance(0);
        }
    }, [isRefreshing, onRefresh]);

    return {
        pullDistance,
        isRefreshing,
        triggerRefresh,
        threshold: THRESHOLD,
    };
}
