import { Loader2 } from 'lucide-react';

/** Mode-level loading state — keeps "loading" visually distinct from "empty"
 *  so a freshly opened mode never flashes a misleading empty state. */
export function ModeLoading({ label = 'Loading…' }: { label?: string }) {
    return (
        <div
            className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground"
            role="status"
            aria-live="polite"
        >
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            <span className="text-xs">{label}</span>
        </div>
    );
}
