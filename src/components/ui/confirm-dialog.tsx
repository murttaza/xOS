import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { Button } from './button';

interface ConfirmOptions {
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
    resolve: (ok: boolean) => void;
}

let _show: ((opts: ConfirmOptions) => Promise<boolean>) | null = null;

/**
 * Imperative non-blocking confirmation dialog. Falls back to native window.confirm
 * if the provider isn't mounted (e.g. during early bootstrap or in tests).
 */
export function showConfirm(opts: ConfirmOptions): Promise<boolean> {
    if (_show) return _show(opts);
    return Promise.resolve(typeof window !== 'undefined' && window.confirm(opts.message));
}

export function ConfirmProvider() {
    const [pending, setPending] = useState<PendingConfirm | null>(null);

    useEffect(() => {
        _show = (opts) =>
            new Promise<boolean>((resolve) => {
                setPending({ ...opts, resolve });
            });
        return () => {
            _show = null;
        };
    }, []);

    const close = (ok: boolean) => {
        pending?.resolve(ok);
        setPending(null);
    };

    return (
        <Dialog open={!!pending} onOpenChange={(v) => !v && close(false)}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>{pending?.title ?? 'Are you sure?'}</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{pending?.message}</p>
                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={() => close(false)}>
                        {pending?.cancelLabel ?? 'Cancel'}
                    </Button>
                    <Button
                        variant={pending?.destructive ? 'destructive' : 'default'}
                        onClick={() => close(true)}
                        autoFocus
                    >
                        {pending?.confirmLabel ?? 'Confirm'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
