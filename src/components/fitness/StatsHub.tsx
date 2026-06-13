import { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import { StatsView } from './StatsView';
import { ProgressTracker } from './ProgressTracker';
import { ExerciseHistory } from './ExerciseHistory';

// Stats, Progress, and History told overlapping stories from three top-level
// tabs (body weight charted in two of them). One hub with a segmented switch
// keeps all three reachable while shrinking the tab bar enough to fit phones.
const VIEWS = [
    { id: 'stats', label: 'Overview' },
    { id: 'progress', label: 'Check-ins' },
    { id: 'history', label: 'History' },
] as const;

export type StatsHubView = typeof VIEWS[number]['id'];

export function StatsHub({ initialView = 'stats' }: { initialView?: StatsHubView }) {
    const [view, setView] = useState<StatsHubView>(initialView);
    useEffect(() => { setView(initialView); }, [initialView]);

    return (
        <div>
            <div className="pt-4 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto">
                <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5" role="tablist" aria-label="Stats views">
                    {VIEWS.map(v => (
                        <button
                            key={v.id}
                            role="tab"
                            aria-selected={view === v.id}
                            onClick={() => setView(v.id)}
                            className={cn(
                                "flex-1 text-xs font-medium px-3 py-1.5 rounded-md transition-all",
                                view === v.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {v.label}
                        </button>
                    ))}
                </div>
            </div>
            {view === 'stats' && <StatsView />}
            {view === 'progress' && <ProgressTracker />}
            {view === 'history' && <ExerciseHistory />}
        </div>
    );
}
