import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

type ToastKind = 'error' | 'success';

interface Toast {
    id: number;
    message: string;
    kind: ToastKind;
}

let _addToast: ((message: string, kind: ToastKind) => void) | null = null;
let _nextId = 0;

/** Show an error toast from anywhere (no hook required) */
export function showErrorToast(message: string) {
    _addToast?.(message, 'error');
}

/** Show a success toast from anywhere (no hook required) */
export function showSuccessToast(message: string) {
    _addToast?.(message, 'success');
}

export function ToastContainer() {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, kind: ToastKind) => {
        const id = _nextId++;
        setToasts(prev => [...prev.slice(-4), { id, message, kind }]); // keep max 5
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), kind === 'success' ? 3000 : 5000);
    }, []);

    useEffect(() => {
        _addToast = addToast;
        return () => { _addToast = null; };
    }, [addToast]);

    return (
        <div className="fixed bottom-4 right-3 sm:right-4 z-[100] flex flex-col gap-2 max-w-sm" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <AnimatePresence>
                {toasts.map(t => (
                    <motion.div
                        key={t.id}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        className={t.kind === 'success'
                            ? "flex items-start gap-2 bg-secondary/95 text-foreground border border-border/60 text-sm rounded-lg px-3 py-2.5 shadow-lg backdrop-blur-sm"
                            : "flex items-start gap-2 bg-destructive/90 text-destructive-foreground text-sm rounded-lg px-3 py-2.5 shadow-lg backdrop-blur-sm"}
                    >
                        {t.kind === 'success'
                            ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
                            : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
                        <span className="flex-1">{t.message}</span>
                        <button
                            onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                            className="shrink-0 -m-1.5 p-1.5 opacity-70 hover:opacity-100 flex items-center justify-center"
                            aria-label="Dismiss"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
