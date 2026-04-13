import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { KeyRound } from 'lucide-react';
import { motion } from 'framer-motion';

export function UpdatePasswordPage({ onDone }: { onDone: () => void }) {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

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
        <div className="min-h-screen flex items-center justify-center bg-amber-950/20">
            <motion.form
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleSubmit}
                className="w-full max-w-sm space-y-4 p-8"
            >
                <h1 className="text-2xl font-bold text-center text-foreground">xOS</h1>

                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <KeyRound className="h-4 w-4 text-amber-400" />
                    <span>Set your new password</span>
                </div>

                {error && (
                    <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                        {error}
                    </div>
                )}

                <input
                    type="password"
                    placeholder="New password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 h-12 rounded-lg border border-border bg-card text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                    minLength={6}
                    autoFocus
                />

                <div>
                    <input
                        type="password"
                        placeholder="Confirm password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        className="w-full px-4 py-3 h-12 rounded-lg border border-border bg-card text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        required
                        minLength={6}
                    />
                    <p className="text-xs text-muted-foreground mt-1.5 ml-1">Min. 6 characters</p>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 h-12 rounded-lg font-medium disabled:opacity-50 transition-colors bg-amber-600 hover:bg-amber-500 text-white"
                >
                    {loading ? 'Updating...' : 'Update Password'}
                </button>
            </motion.form>
        </div>
    );
}
