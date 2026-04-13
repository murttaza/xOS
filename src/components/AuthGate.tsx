import { useEffect, useState, type ReactNode } from 'react';
import { LoginPage } from './LoginPage';
import { UpdatePasswordPage } from './UpdatePasswordPage';
import { supabase } from '../lib/supabase';
import { clearOfflineQueue } from '../adapters/supabase';

export function AuthGate({ children }: { children: ReactNode }) {
    const [ready, setReady] = useState(false);
    const [authenticated, setAuthenticated] = useState(false);
    const [isRecovery, setIsRecovery] = useState(false);

    useEffect(() => {
        // Check for existing session (persisted in localStorage automatically by Supabase)
        supabase.auth.getSession().then(({ data }) => {
            if (data.session) {
                setAuthenticated(true);
            }
            setReady(true);
        });

        // Listen for auth state changes (login, logout, token refresh, expiry)
        const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT' || !session) {
                clearOfflineQueue();
            }
            if (event === 'PASSWORD_RECOVERY') {
                setIsRecovery(true);
                setAuthenticated(true);
            }
            setAuthenticated(!!session);
        });
        return () => listener.subscription.unsubscribe();
    }, []);

    if (!ready) return (
        <div className="h-screen flex items-center justify-center bg-background">
            <div className="text-4xl font-bold text-primary animate-pulse">xOS</div>
        </div>
    );
    if (isRecovery) return <UpdatePasswordPage onDone={() => setIsRecovery(false)} />;
    if (!authenticated) return <LoginPage onLogin={() => setAuthenticated(true)} />;
    return <>{children}</>;
}
