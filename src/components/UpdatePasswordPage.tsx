import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { KeyRound, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { Wordmark } from './Wordmark';
import { evaluateAccountPassword, MIN_ACCOUNT_PASSWORD_LENGTH } from '../lib/passwordPolicy';

const METER_COLORS = ['bg-red-500', 'bg-red-500', 'bg-yellow-500', 'bg-emerald-500', 'bg-emerald-400'];

export function UpdatePasswordPage({ onDone }: { onDone: () => void }) {
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const evaluation = evaluateAccountPassword(password);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!evaluation.ok) {
            setError(evaluation.problems[0]);
            return;
        }
        if (password !== confirm) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
            setError(error.message);
            setLoading(false);
        } else {
            onDone();
        }
    };

    return (
        <div className="min-h-[100dvh] flex items-center justify-center bg-amber-950/20">
            <motion.form
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleSubmit}
                className="w-full max-w-sm space-y-4 p-8"
            >
                <div className="flex justify-center"><Wordmark height={24} /></div>

                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <KeyRound className="h-4 w-4 text-amber-400" />
                    <span>Set your new password</span>
                </div>

                {error && (
                    <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                        {error}
                    </div>
                )}

                <div>
                    <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="New password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-4 pr-11 py-3 h-12 rounded-lg border border-border bg-card text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            autoComplete="new-password"
                            required
                            minLength={MIN_ACCOUNT_PASSWORD_LENGTH}
                            autoFocus
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
                </div>

                <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Confirm password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full px-4 py-3 h-12 rounded-lg border border-border bg-card text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    autoComplete="new-password"
                    required
                    minLength={MIN_ACCOUNT_PASSWORD_LENGTH}
                />

                <button
                    type="submit"
                    disabled={loading || !evaluation.ok || password !== confirm}
                    className="w-full py-3 h-12 rounded-lg font-medium disabled:opacity-50 transition-colors bg-amber-600 hover:bg-amber-500 text-white"
                >
                    {loading ? 'Updating...' : 'Update Password'}
                </button>
            </motion.form>
        </div>
    );
}
