import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { LogIn, UserPlus, KeyRound, MailCheck, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wordmark } from './Wordmark';
import { evaluateAccountPassword, authRedirectTo, MIN_ACCOUNT_PASSWORD_LENGTH } from '../lib/passwordPolicy';

type Mode = 'signin' | 'signup' | 'reset' | 'confirm-email';

const METER_COLORS = ['bg-red-500', 'bg-red-500', 'bg-yellow-500', 'bg-emerald-500', 'bg-emerald-400'];

/** Map raw Supabase auth errors to plain language; pass unknowns through. */
function friendlyAuthError(message: string): string {
    const m = message.toLowerCase();
    if (m.includes('invalid login credentials')) return 'Wrong email or password.';
    if (m.includes('email not confirmed')) return 'Confirm your email first — check your inbox for the link.';
    if (m.includes('user already registered')) return 'An account with this email already exists — sign in instead.';
    if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts — wait a minute and try again.';
    if (m.includes('network') || m.includes('fetch')) return "Couldn't reach the server — check your connection.";
    return message;
}

export function LoginPage({ onLogin }: { onLogin: () => void }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<Mode>('signin');

    const evaluation = evaluateAccountPassword(password);

    const switchMode = (newMode: Mode) => {
        setMode(newMode);
        setError('');
        setSuccess('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (mode === 'signup' && !evaluation.ok) {
            setError(evaluation.problems[0]);
            return;
        }
        setLoading(true);

        if (mode === 'reset') {
            const redirectTo = authRedirectTo();
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                ...(redirectTo ? { redirectTo } : {}),
            });
            if (error) {
                setError(friendlyAuthError(error.message));
            } else {
                setSuccess('Password reset link sent! Check your email.');
            }
            setLoading(false);
            return;
        }

        if (mode === 'signup') {
            const redirectTo = authRedirectTo();
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: { ...(redirectTo ? { emailRedirectTo: redirectTo } : {}) },
            });
            if (error) {
                setError(friendlyAuthError(error.message));
                setLoading(false);
            } else if (data.session) {
                // Email confirmation disabled on the project — signed in directly.
                onLogin();
            } else {
                // Confirmation required: tell the user to verify instead of
                // pretending they can sign in already.
                setMode('confirm-email');
                setLoading(false);
            }
        } else {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                setError(friendlyAuthError(error.message));
                setLoading(false);
            } else {
                onLogin();
            }
        }
    };

    const icon = mode === 'signup' ? <UserPlus className="h-4 w-4 text-emerald-400" />
        : mode === 'reset' ? <KeyRound className="h-4 w-4 text-amber-400" />
        : mode === 'confirm-email' ? <MailCheck className="h-4 w-4 text-emerald-400" />
        : <LogIn className="h-4 w-4 text-primary" />;

    const subtitle = mode === 'signup' ? 'Create an account'
        : mode === 'reset' ? 'Reset your password'
        : mode === 'confirm-email' ? 'Confirm your email'
        : 'Sign in to continue';

    if (mode === 'confirm-email') {
        return (
            <div className="min-h-[100dvh] flex items-center justify-center bg-emerald-950/20">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="w-full max-w-sm space-y-4 p-8 text-center"
                >
                    <div className="flex justify-center"><Wordmark height={24} /></div>
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        {icon}
                        <span>{subtitle}</span>
                    </div>
                    <p className="text-sm text-foreground/90">
                        We sent a confirmation link to <span className="font-medium">{email}</span>.
                        Open it to activate your account, then come back and sign in.
                    </p>
                    <button
                        type="button"
                        onClick={() => switchMode('signin')}
                        className="w-full py-3 h-12 rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                        Back to sign in
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className={`min-h-[100dvh] flex items-center justify-center transition-colors duration-500 ${
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
                    <div className="flex justify-center"><Wordmark height={24} /></div>

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
                        <div className="text-sm text-success bg-success/10 rounded-lg px-3 py-2">
                            {success}
                        </div>
                    )}

                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 h-12 rounded-lg border border-border bg-card text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        autoComplete="email"
                        required
                    />

                    {mode !== 'reset' && (
                        <div>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-4 pr-11 py-3 h-12 rounded-lg border border-border bg-card text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                                    required
                                    minLength={mode === 'signup' ? MIN_ACCOUNT_PASSWORD_LENGTH : undefined}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(p => !p)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    title={showPassword ? 'Hide password' : 'Show password'}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {mode === 'signup' && (
                                <div className="mt-2 space-y-1.5">
                                    {password && (
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-300 ${METER_COLORS[evaluation.score]}`}
                                                    style={{ width: `${Math.max(8, (evaluation.score / 4) * 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-[11px] text-muted-foreground w-16 text-right">{evaluation.label}</span>
                                        </div>
                                    )}
                                    <p className="text-xs text-muted-foreground ml-1">
                                        {password && !evaluation.ok
                                            ? evaluation.problems[0]
                                            : `Min. ${MIN_ACCOUNT_PASSWORD_LENGTH} characters — a few random words work great`}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || (mode === 'signup' && !evaluation.ok)}
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
