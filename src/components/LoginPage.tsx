import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { LogIn, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function LoginPage({ onLogin }: { onLogin: () => void }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        if (isSignUp) {
            const { error } = await supabase.auth.signUp({ email, password });
            if (error) {
                setError(error.message);
            } else {
                setSuccess('Account created! Check your email to confirm, then sign in.');
                setIsSignUp(false);
            }
            setLoading(false);
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

    return (
        <div className={`min-h-screen flex items-center justify-center transition-colors duration-500 ${isSignUp ? 'bg-emerald-950/20' : 'bg-background'}`}>
            <AnimatePresence mode="wait">
                <motion.form
                    key={isSignUp ? 'signup' : 'signin'}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    onSubmit={handleSubmit}
                    className="w-full max-w-sm space-y-4 p-8"
                >
                    <h1 className="text-2xl font-bold text-center text-foreground">xOS</h1>

                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        {isSignUp ? (
                            <>
                                <UserPlus className="h-4 w-4 text-emerald-400" />
                                <span>Create an account</span>
                            </>
                        ) : (
                            <>
                                <LogIn className="h-4 w-4 text-primary" />
                                <span>Sign in to continue</span>
                            </>
                        )}
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
                        {isSignUp && (
                            <p className="text-xs text-muted-foreground mt-1.5 ml-1">Min. 6 characters</p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-3 h-12 rounded-lg font-medium disabled:opacity-50 transition-colors ${
                            isSignUp
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                : 'bg-primary text-primary-foreground hover:bg-primary/90'
                        }`}
                    >
                        {loading ? (isSignUp ? 'Creating account...' : 'Signing in...') : (isSignUp ? 'Create Account' : 'Sign In')}
                    </button>

                    <button
                        type="button"
                        onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccess(''); }}
                        className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                    </button>
                </motion.form>
            </AnimatePresence>
        </div>
    );
}
