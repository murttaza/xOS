import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Wordmark } from './Wordmark';
import { isElectron } from '../lib/platform';
import {
    CheckSquare, BookOpen, Wallet, Dumbbell, Shield, CalendarDays, Timer, HelpCircle,
} from 'lucide-react';

const FEATURES = [
    {
        icon: CheckSquare,
        title: 'Tasks & XP',
        body: 'Plan your day on the board. Completing tasks and logging focused time levels up your life stats.',
    },
    {
        icon: Timer,
        title: 'Focus timers',
        body: 'Start a timer on any task, then enter Focus Mode for distraction-free deep work with a pomodoro.',
    },
    {
        icon: BookOpen,
        title: 'Notes',
        body: 'Notebooks with rich-text notes you can link straight to tasks.',
    },
    {
        icon: Wallet,
        title: 'Budget',
        body: 'Track income, spending, categories, and monthly targets.',
    },
    {
        icon: Dumbbell,
        title: 'Fitness',
        body: 'Follow a training program, log workouts, and watch your Fitness stat grow.',
    },
    {
        icon: CalendarDays,
        title: 'Streaks',
        body: 'Track "days since" streaks — pausing freezes them, missing resets them.',
    },
    ...(isElectron
        ? [{
            icon: Shield,
            title: 'Password vault',
            body: 'A local, encrypted vault on this device. Add a master passphrase for real lock-screen security.',
        }]
        : []),
];

/** First-run onboarding — shown once per device (see App.tsx). */
export function WelcomeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        <span className="flex items-center gap-2.5">
                            Welcome to <Wordmark height={20} />
                        </span>
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Your personal life OS — tasks, notes, budget, fitness, and streaks in one
                        place, gamified with XP so consistency actually feels rewarding.
                    </p>

                    <div className="grid sm:grid-cols-2 gap-2.5 max-h-[40vh] overflow-y-auto overscroll-contain pr-1">
                        {FEATURES.map(({ icon: Icon, title, body }) => (
                            <div key={title} className="flex gap-2.5 rounded-xl border border-border/50 bg-muted/30 px-3 py-2.5">
                                <Icon className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold">{title}</p>
                                    <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{body}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex items-start gap-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2">
                        <HelpCircle className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                        <p className="text-xs text-foreground/90">
                            The <span className="font-semibold">?</span> button in the header has every
                            keyboard shortcut, and Settings (gear icon, next to the logo) holds backup,
                            sign-out, and desktop options.
                        </p>
                    </div>

                    <Button className="w-full" onClick={onClose}>
                        Start by adding your first task
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
