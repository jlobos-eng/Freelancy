/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        './index.html',
        './src/**/*.{js,ts,jsx,tsx}',
    ],
    theme: {
        extend: {
            colors: {
                // Tokens semánticos: cambian con el tema sin tocar componentes
                brand: {
                    indigo: '#4f46e5',
                    'indigo-hover': '#4338ca',
                    emerald: '#10b981',
                    'emerald-hover': '#059669',
                },
            },
            keyframes: {
                'fade-in': {
                    '0%': { opacity: 0 },
                    '100%': { opacity: 1 },
                },
                'slide-in-bottom': {
                    '0%': { transform: 'translateY(100%)', opacity: 0 },
                    '100%': { transform: 'translateY(0)', opacity: 1 },
                },
                'zoom-in-95': {
                    '0%': { transform: 'scale(0.95)', opacity: 0 },
                    '100%': { transform: 'scale(1)', opacity: 1 },
                },
                'slide-in-right': {
                    '0%': { transform: 'translateX(100%)', opacity: 0 },
                    '100%': { transform: 'translateX(0)', opacity: 1 },
                },
                'pulse-soft': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.6 },
                },
            },
            animation: {
                'fade-in': 'fade-in 200ms ease-out',
                'slide-in-bottom': 'slide-in-bottom 300ms cubic-bezier(0.22, 1, 0.36, 1)',
                'zoom-in-95': 'zoom-in-95 250ms ease-out',
                'slide-in-right': 'slide-in-right 300ms cubic-bezier(0.22, 1, 0.36, 1)',
                'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
            },
        },
    },
    plugins: [],
}
