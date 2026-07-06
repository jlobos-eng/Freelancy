// ErrorBoundary — atrapa errores de render del árbol y muestra un fallback.
// Sin esto, cualquier excepción tira pantalla blanca.

import { Component } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        // En producción, mandar a Sentry / Logflare aquí
        console.error('🔥 ErrorBoundary atrapó:', error, info);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
        if (typeof window !== 'undefined') window.location.reload();
    };

    render() {
        if (!this.state.hasError) return this.props.children;

        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 text-center">
                <div className="bg-red-100 dark:bg-red-900/40 p-4 rounded-2xl mb-4">
                    <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
                </div>
                <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-1">
                    Algo se rompió
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-4">
                    {this.state.error?.message || 'Error inesperado en la aplicación.'}
                </p>
                <button
                    onClick={this.handleReset}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all"
                >
                    <RefreshCcw className="w-4 h-4" /> Reintentar
                </button>
            </div>
        );
    }
}
