// ThemeContext — manejo centralizado de modo claro/oscuro.
// - Persiste en localStorage.
// - Aplica la clase `dark` al <html>.
// - Sincroniza el <meta name="theme-color"> (barra de estado en mobile).
// - En el primer arranque respeta la preferencia del SO si no hay valor guardado.
// - Si el usuario sigue al SO, reacciona a cambios live de prefers-color-scheme.

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';

const STORAGE_KEY = 'freelancy-theme';

// Colores que la barra del navegador móvil debería pintar para cada tema.
const THEME_COLORS = {
    light: '#4f46e5', // indigo-600
    dark: '#0f172a',  // slate-900
};

const ThemeContext = createContext({
    theme: 'light',
    isDark: false,
    toggleTheme: () => { },
    setTheme: () => { },
});

function readStoredTheme() {
    if (typeof window === 'undefined') return null;
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored === 'light' || stored === 'dark') return stored;
    } catch {
        // localStorage bloqueado (modo privado)
    }
    return null;
}

function readSystemTheme() {
    if (typeof window === 'undefined' || !window.matchMedia) return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readInitialTheme() {
    return readStoredTheme() || readSystemTheme();
}

function applyThemeToDom(theme) {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');

    // Sincronizar barra de estado móvil
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLORS[theme] || THEME_COLORS.light);
}

export function ThemeProvider({ children }) {
    const [theme, setThemeState] = useState(readInitialTheme);
    const [followSystem, setFollowSystem] = useState(() => readStoredTheme() === null);

    // Aplicar tema al montar y en cada cambio
    useEffect(() => {
        applyThemeToDom(theme);
    }, [theme]);

    // Persistencia: solo guardamos si el usuario eligió manualmente
    useEffect(() => {
        if (followSystem) return;
        try {
            window.localStorage.setItem(STORAGE_KEY, theme);
        } catch {
            // ignore
        }
    }, [theme, followSystem]);

    // Si seguimos al sistema, escuchamos cambios live
    useEffect(() => {
        if (!followSystem || typeof window === 'undefined' || !window.matchMedia) return;
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e) => setThemeState(e.matches ? 'dark' : 'light');
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, [followSystem]);

    const setTheme = useCallback((next) => {
        setFollowSystem(false);
        setThemeState(next === 'dark' ? 'dark' : 'light');
    }, []);

    const toggleTheme = useCallback(() => {
        setFollowSystem(false);
        setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
    }, []);

    const value = useMemo(
        () => ({ theme, isDark: theme === 'dark', toggleTheme, setTheme }),
        [theme, toggleTheme, setTheme],
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    return useContext(ThemeContext);
}
