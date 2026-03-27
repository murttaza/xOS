import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function LoginPage({ onLogin }: { onLogin: () => void }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            setError(error.message);
            setLoading(false);
        } else {
            onLogin();
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 p-8">
                <h1 className="text-2xl font-bold text-center text-foreground">xOS</h1>
                <p className="text-sm text-center text-muted-foreground">Sign in to continue</p>

                {error && (
                    <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                        {error}
                    </div>
                )}

                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                />

                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                />

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                    {loading ? 'Signing in...' : 'Sign In'}
                </button>
            </form>
        </div>
    );
}
