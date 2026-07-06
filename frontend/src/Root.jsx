// Root — routing minimalista por pathname.
//
// Rutas:
//   /oauth/mp/callback → OAuthCallback (Mercado Pago)
//   /auth/reset        → PasswordResetView (Supabase recovery)
//   *                  → App
//
// Si crece el routing, considerar react-router.

import App from './App.jsx';
import OAuthCallback from './views/OAuthCallback.jsx';
import PasswordResetView from './views/PasswordResetView.jsx';
import { Toaster } from 'react-hot-toast';

function isRecoveryHash() {
    if (typeof window === 'undefined') return false;
    // Supabase pone el flujo recovery como hash: #access_token=...&type=recovery&...
    return window.location.hash.includes('type=recovery');
}

export default function Root() {
    if (typeof window === 'undefined') return <App />;

    const path = window.location.pathname;

    if (path === '/oauth/mp/callback') {
        return (
            <>
                <Toaster position="top-center" />
                <OAuthCallback />
            </>
        );
    }

    // /auth/reset O cualquier path con hash de recovery → password reset
    if (path === '/auth/reset' || isRecoveryHash()) {
        return (
            <>
                <Toaster position="top-center" />
                <PasswordResetView />
            </>
        );
    }

    return <App />;
}
