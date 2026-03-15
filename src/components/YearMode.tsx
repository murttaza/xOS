import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { getLocalDateString } from '../lib/utils';
import { X, Pause, Play, Trash2, RotateCcw, Plus, Edit } from 'lucide-react';
import { Streak } from '../types';

function StreakItem({ streak, updateStreak, deleteStreak }: {
    streak: Streak;
    updateStreak: (streak: Streak) => Promise<void>;
    deleteStreak: (id: number) => Promise<void>;
}) {
    const [now, setNow] = useState(new Date());
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(streak.title);

    // Normalize existing dates for backward compatibility
    const initialDate = streak.createdAt ? new Date(streak.createdAt) : new Date(streak.lastUpdated || new Date());
    // Format date for datetime-local exactly: YYYY-MM-DDThh:mm
    const toLocalISOString = (d: Date) => {
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    const [editDate, setEditDate] = useState(toLocalISOString(initialDate));

    useEffect(() => {
        const interval = setInterval(() => {
            if (!streak.isPaused) {
                setNow(new Date());
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [streak.isPaused]);

    const handleSave = () => {
        updateStreak({ ...streak, title: editTitle, createdAt: new Date(editDate).toISOString() });
        setIsEditing(false);
    }

    const start = streak.createdAt ? new Date(streak.createdAt) : new Date(streak.lastUpdated || new Date());

    // Days based on midnight crossed
    const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());

    // If paused, freeze time at lastUpdated
    const effectiveNow = streak.isPaused ? new Date(streak.lastUpdated || new Date()) : now;
    const effectiveNowMidnight = new Date(effectiveNow.getFullYear(), effectiveNow.getMonth(), effectiveNow.getDate());
    const effectiveDaysPassed = Math.max(0, Math.round((effectiveNowMidnight.getTime() - startMidnight.getTime()) / (1000 * 60 * 60 * 24)));

    // elapsed time in hours (modulo)
    const elapsedMs = Math.max(0, effectiveNow.getTime() - start.getTime());
    const h = Math.floor(elapsedMs / (1000 * 60 * 60)) % 24;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative p-6 rounded-2xl border transition-all duration-150 group ${streak.isPaused ? 'bg-[#050505] border-transparent text-white/50' : 'bg-[#0a0a0a] border-white/5 hover:border-white/10 hover:bg-[#111111]'}`}
        >
            {isEditing ? (
                <div className="flex flex-col gap-4">
                    <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="bg-background text-foreground" />
                    <Input type="datetime-local" value={editDate} onChange={e => setEditDate(e.target.value)} className="bg-background text-foreground" />
                    <div className="flex gap-2 justify-end mt-2">
                        <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
                        <Button variant="default" size="sm" onClick={handleSave}>Save</Button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xl font-bold">{streak.title}</h3>
                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsEditing(true)}
                                title="Edit Streak"
                                className="h-8 w-8 rounded-full hover:bg-white/10"
                            >
                                <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => updateStreak({ ...streak, currentStreak: 0, lastUpdated: new Date().toISOString(), createdAt: new Date().toISOString() })}
                                title="Reset Streak"
                                className="h-8 w-8 rounded-full hover:bg-white/10"
                            >
                                <RotateCcw className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    updateStreak({ ...streak, isPaused: streak.isPaused ? 0 : 1, lastUpdated: new Date().toISOString() })
                                }}
                                title={streak.isPaused ? "Resume tracking" : "Pause tracking"}
                                className={`h-8 w-8 rounded-full hover:bg-white/10 ${streak.isPaused ? 'text-primary' : ''}`}
                            >
                                {streak.isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => typeof streak.id === 'number' && deleteStreak(streak.id)}
                                title="Delete Streak"
                                className="h-8 w-8 rounded-full hover:bg-red-500/20 hover:text-red-400 text-muted-foreground"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-col mt-4">
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black tabular-nums tracking-tighter">{effectiveDaysPassed}</span>
                            <span className="text-sm uppercase tracking-wider font-semibold opacity-70">Days</span>
                        </div>
                        <div className="flex items-baseline gap-2 text-muted-foreground font-mono text-sm mt-1">
                            <span>{String(h).padStart(2, '0')}h</span>
                        </div>
                    </div>
                </>
            )}
        </motion.div>
    );
}

export function YearMode() {
    const isYearMode = useStore(state => state.isYearMode);
    const toggleYearMode = useStore(state => state.toggleYearMode);
    const streaks = useStore(state => state.streaks);
    const fetchStreaks = useStore(state => state.fetchStreaks);
    const createStreak = useStore(state => state.createStreak);
    const updateStreak = useStore(state => state.updateStreak);
    const deleteStreak = useStore(state => state.deleteStreak);

    const [viewState, setViewState] = useState<'days' | 'weeks'>('days');
    const [newStreakTitle, setNewStreakTitle] = useState('');

    useEffect(() => {
        if (isYearMode) {
            fetchStreaks();
        }
    }, [isYearMode, fetchStreaks]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isYearMode) {
                toggleYearMode();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isYearMode, toggleYearMode]);



    const handleAddStreak = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newStreakTitle.trim()) return;
        const nowIso = new Date().toISOString();
        createStreak({
            title: newStreakTitle.trim(),
            currentStreak: 0,
            lastUpdated: nowIso,
            isPaused: 0,
            createdAt: nowIso
        });
        setNewStreakTitle('');
    };

    // Date calculations strictly bound to local timezone
    const now = new Date();
    // Get the exact purely-local string representation "YYYY-MM-DD" limit scope
    const todayStr = getLocalDateString(now);
    const [localY, localM, localD] = todayStr.split('-').map(Number);

    const isLeapYear = (localY % 4 === 0 && localY % 100 !== 0) || (localY % 400 === 0);
    const daysInYear = isLeapYear ? 366 : 365;

    // Use UTC for consistent day counting that perfectly matches local time shifts (ignores DST)
    const utcToday = Date.UTC(localY, localM - 1, localD);
    const utcStartOfYear = Date.UTC(localY, 0, 1);

    const daysPassed = Math.floor((utcToday - utcStartOfYear) / (1000 * 60 * 60 * 24));
    const daysLeft = daysInYear - daysPassed;

    const weeksInYear = 52;
    const weeksPassed = Math.floor(daysPassed / 7);

    const totalDots = viewState === 'days' ? daysInYear : weeksInYear;
    const passedDots = viewState === 'days' ? daysPassed : weeksPassed;

    return (
        <AnimatePresence>
            {isYearMode && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="fixed inset-0 z-[100] bg-background flex overflow-y-auto overflow-x-hidden no-scrollbar no-drag"
                >
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleYearMode}
                        className="fixed top-6 right-6 z-50 rounded-full hover:bg-white/10 no-drag bg-background/50 backdrop-blur-sm"
                    >
                        <X className="h-6 w-6" />
                    </Button>

                    <div className="flex flex-col lg:flex-row w-full min-h-full p-4 lg:p-8 gap-4 lg:gap-8 pb-32 lg:pb-8">
                        {/* Left Column - Dots Grid */}
                        <div className="group w-full lg:w-1/2 lg:h-full min-h-[500px] flex flex-col items-center justify-center p-4 lg:p-8 lg:border-r border-b lg:border-b-0 border-white/5 relative transition-colors duration-150 hover:bg-white/[0.01]">
                            {/* Subtle Hover Glow */}
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.03)_0%,transparent_60%)]" />

                            <div className="absolute top-8 left-8 flex items-center gap-4 z-50 no-drag">
                                <Button
                                    variant={viewState === 'days' ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setViewState('days')}
                                    className="rounded-full"
                                >
                                    Days
                                </Button>
                                <Button
                                    variant={viewState === 'weeks' ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setViewState('weeks')}
                                    className="rounded-full"
                                >
                                    Weeks
                                </Button>
                            </div>

                            <div className="w-full max-w-2xl flex flex-col items-center max-h-full min-h-0">
                                <div className="text-center mb-12 shrink-0">
                                    <h1 className="text-5xl font-black mb-2 tabular-nums tracking-tighter text-white">
                                        {viewState === 'days' ? daysLeft : weeksInYear - weeksPassed}
                                    </h1>
                                    <p className="text-muted-foreground uppercase tracking-widest text-sm font-semibold">
                                        {viewState === 'days' ? 'Days' : 'Weeks'} left in {localY}
                                    </p>
                                </div>

                                <ScrollArea className="w-full shrink min-h-0 px-4 [&_[data-radix-scroll-area-scrollbar]]:hidden">
                                    <div className="flex flex-wrap gap-2.5 justify-center content-start pb-6">
                                        {Array.from({ length: totalDots }).map((_, i) => (
                                            <div
                                                key={i}
                                                style={{ animation: `fadeInScale 0.2s ease-out ${i * (viewState === 'days' ? 0.001 : 0.01)}s both` }}
                                                className={`rounded-full transition-all duration-150 ${i < passedDots
                                                    ? 'bg-white/10 w-2 h-2 opacity-50 relative'
                                                    : 'bg-white w-2.5 h-2.5'
                                                    }`}
                                            >
                                                {/* Cross mark for passed days */}
                                                {i < passedDots && (
                                                    <div className="absolute inset-0 flex items-center justify-center -rotate-45">
                                                        <div className="w-4 h-px bg-white/40"></div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </div>
                        </div>

                        {/* Right Column - Streaks Tracker */}
                        <div className="group w-full lg:w-1/2 lg:h-full min-h-[500px] flex flex-col justify-start lg:justify-center items-center p-4 lg:p-8 relative transition-colors duration-150 hover:bg-white/[0.01]">
                            {/* Subtle Hover Glow */}
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.03)_0%,transparent_60%)]" />

                            <div className="w-full max-w-2xl flex flex-col max-h-full min-h-0 relative z-10">
                                <div className="flex justify-end mb-8 w-full h-[52px] shrink-0">
                                    <form onSubmit={handleAddStreak} className="group flex items-center">
                                        <div className="w-0 opacity-0 group-hover:w-[400px] focus-within:w-[400px] group-hover:opacity-100 focus-within:opacity-100 transition-all duration-150 ease-out overflow-hidden pr-2">
                                            <Input
                                                placeholder="What habit do you want to track?"
                                                value={newStreakTitle}
                                                onChange={(e) => setNewStreakTitle(e.target.value)}
                                                className="bg-white/5 border-white/10 text-lg py-6 focus-visible:ring-1 focus-visible:ring-white/30 rounded-xl w-full min-w-[300px]"
                                            />
                                        </div>
                                        <Button type="submit" variant="ghost" size="icon" className="h-[52px] w-[52px] shrink-0 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors duration-150">
                                            <Plus className="h-6 w-6" />
                                        </Button>
                                    </form>
                                </div>

                                <ScrollArea className="flex-1 min-h-0 -mx-4 px-4 [&_[data-radix-scroll-area-scrollbar]]:hidden">
                                    <div className="space-y-4 pb-12">
                                        {streaks?.map((streak) => (
                                            <StreakItem
                                                key={streak.id}
                                                streak={streak}
                                                updateStreak={updateStreak}
                                                deleteStreak={deleteStreak}
                                            />
                                        ))}

                                        {(!streaks || streaks.length === 0) && (
                                            <div className="text-center py-20 opacity-50">
                                                <p>No active streaks.</p>
                                                <p className="text-sm mt-2">Add one above to hold yourself accountable.</p>
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
