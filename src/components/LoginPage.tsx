import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { LogIn, UserPlus, KeyRound } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type Mode = 'signin' | 'signup' | 'reset';

export function LoginPage({ onLogin }: { onLogin: () => void }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<Mode>('signin');

    const switchMode = (newMode: Mode) => {
        setMode(newMode);
        setError('');
        setSuccess('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        if (mode === 'reset') {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin,
            });
            if (error) {
                setError(error.message);
            } else {
                setSuccess('Password reset link sent! Check your email.');
            }
            setLoading(false);
            return;
        }

        if (mode === 'signup') {
            const { data, error } = await supabase.auth.signUp({ email, password });
            if (error) {
                // If the error is from a DB trigger but the user was created, try signing in
                if (error.message?.toLowerCase().includes('database')) {
                    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
                    if (!signInError) {
                        onLogin();
                        return;
                    }
                }
                setError(error.message);
                setLoading(false);
            } else if (data.session) {
                onLogin();
            } else {
                setSuccess('Account created! Sign in to continue.');
                setMode('signin');
                setLoading(false);
            }
        } else {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                setError(error.message);
                setLoading(false);
            } else {
                onLogin();
            }
        }
    };

    const icon = mode === 'signup' ? <UserPlus className="h-4 w-4 text-emerald-400" />
        : mode === 'reset' ? <KeyRound className="h-4 w-4 text-amber-400" />
        : <LogIn className="h-4 w-4 text-primary" />;

    const subtitle = mode === 'signup' ? 'Create an account'
        : mode === 'reset' ? 'Reset your password'
        : 'Sign in to continue';

    return (
        <div className={`min-h-screen flex items-center justify-center transition-colors duration-500 ${
            mode === 'signup' ? 'bg-emerald-950/20' : mode === 'reset' ? 'bg-amber-950/20' : 'bg-background'
        }`}>
            <AnimatePresence mode="wait">
                <motion.form
                    key={mode}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    onSubmit={handleSubmit}
                    className="w-full max-w-sm space-y-4 p-8"
                >
                    <h1 className="text-2xl font-bold text-center text-foreground">xOS</h1>

                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        {icon}
                        <span>{subtitle}</span>
                    </div>

                    {error && (
                        <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="text-sm text-green-400 bg-green-400/10 rounded-lg px-3 py-2">
                            {success}
                        </div>
                    )}

                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 h-12 rounded-lg border border-border bg-card text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        required
                    />

                    {mode !== 'reset' && (
                        <div>
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 h-12 rounded-lg border border-border bg-card text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                required
                                minLength={6}
                            />
                            {mode === 'signup' && (
                                <p className="text-xs text-muted-foreground mt-1.5 ml-1">Min. 6 characters</p>
                            )}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-3 h-12 rounded-lg font-medium disabled:opacity-50 transition-colors ${
                            mode === 'signup'
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                : mode === 'reset'
                                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                                : 'bg-primary text-primary-foreground hover:bg-primary/90'
                        }`}
                    >
                        {loading
                            ? (mode === 'signup' ? 'Creating account...' : mode === 'reset' ? 'Sending...' : 'Signing in...')
                            : (mode === 'signup' ? 'Create Account' : mode === 'reset' ? 'Send Reset Link' : 'Sign In')
                        }
                    </button>

                    <div className="space-y-1">
                        {mode === 'signin' && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => switchMode('reset')}
                                    className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Forgot password?
                                </button>
                                <button
                                    type="button"
                                    onClick={() => switchMode('signup')}
                                    className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Don't have an account? Sign up
                                </button>
                            </>
                        )}
                        {mode === 'signup' && (
                            <button
                                type="button"
                                onClick={() => switchMode('signin')}
                                className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                                Already have an account? Sign in
                            </button>
                        )}
                        {mode === 'reset' && (
                            <button
                                type="button"
                                onClick={() => switchMode('signin')}
                                className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                                Back to sign in
                            </button>
                        )}
                    </div>
                </motion.form>
            </AnimatePresence>
        </div>
    );
}
