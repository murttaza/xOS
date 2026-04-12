import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store';
import { cn } from '../lib/utils';
import { ArrowLeft, Dumbbell } from 'lucide-react';
import { Button } from './ui/button';
import { ModeToggle } from './ModeToggle';
import { WindowControls } from './WindowControls';

import { FitnessHome } from './fitness/FitnessHome';
import { TodayWorkout } from './fitness/TodayWorkout';
import { WeekView } from './fitness/WeekView';
import { ProgramOverview } from './fitness/ProgramOverview';
import { ProgressTracker } from './fitness/ProgressTracker';
import { ExerciseHistory } from './fitness/ExerciseHistory';
import { PrinciplesView } from './fitness/PrinciplesView';
import { ProgramPicker } from './fitness/ProgramPicker';

const TABS = [
    { id: 'home', label: 'Home' },
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'Week' },
    { id: 'program', label: 'Program' },
    { id: 'progress', label: 'Progress' },
    { id: 'history', label: 'History' },
    { id: 'principles', label: 'Principles' },
] as const;

export function FitnessMode() {
    const isFitnessMode = useStore(s => s.isFitnessMode);
    const toggleFitnessMode = useStore(s => s.toggleFitnessMode);
    const fitnessTab = useStore(s => s.fitnessTab);
    const setFitnessTab = useStore(s => s.setFitnessTab);
    const fetchFitnessData = useStore(s => s.fetchFitnessData);
    const activeProgram = useStore(s => s.activeProgram);

    useEffect(() => {
        if (isFitnessMode) {
            fetchFitnessData();
        }
    }, [isFitnessMode, fetchFitnessData]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isFitnessMode) {
                toggleFitnessMode();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isFitnessMode, toggleFitnessMode]);

    const renderContent = () => {
        if (!activeProgram) return <ProgramPicker />;

        switch (fitnessTab) {
            case 'today': return <TodayWorkout />;
            case 'week': return <WeekView />;
            case 'program': return <ProgramOverview />;
            case 'progress': return <ProgressTracker />;
            case 'history': return <ExerciseHistory />;
            case 'principles': return <PrinciplesView />;
            default: return <FitnessHome />;
        }
    };

    return (
        <AnimatePresence>
            {isFitnessMode && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className={cn(
                        "fixed inset-0 z-[55] text-foreground overflow-hidden flex flex-col font-sans no-drag",
                        "bg-background"
                    )}
                >
                    {/* Header */}
                    <div
                        className="shrink-0 border-b border-border/50"
                        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}
                    >
                        <div className="flex items-center justify-between px-3 sm:px-6 lg:px-8 py-3 lg:py-4">
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 lg:hidden"
                                    onClick={toggleFitnessMode}
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                                <span className="text-base font-semibold lg:hidden">Fitness</span>
                                <div className="hidden lg:flex items-center gap-3">
                                    <Dumbbell className="h-5 w-5 text-primary" />
                                    <h2 className="text-lg font-bold tracking-tight">Fitness</h2>
                                </div>
                            </div>

                            {/* Desktop tab nav */}
                            {activeProgram && (
                                <div className="hidden lg:flex items-center gap-1">
                                    {TABS.map(tab => (
                                        <Button
                                            key={tab.id}
                                            variant={fitnessTab === tab.id ? 'default' : 'ghost'}
                                            size="sm"
                                            className={cn(
                                                "text-xs h-8 px-3",
                                                fitnessTab === tab.id
                                                    ? "bg-primary text-primary-foreground"
                                                    : "text-muted-foreground hover:text-foreground"
                                            )}
                                            onClick={() => setFitnessTab(tab.id)}
                                        >
                                            {tab.label}
                                        </Button>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-center gap-2">
                                <ModeToggle />
                                <WindowControls />
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto no-scrollbar">
                        {renderContent()}
                    </div>

                    {/* Mobile bottom tabs */}
                    {activeProgram && (
                        <div className="lg:hidden shrink-0 border-t border-border/50 bg-background/95 backdrop-blur-lg"
                            style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0px)' }}
                        >
                            <div className="flex overflow-x-auto no-scrollbar">
                                {TABS.map(tab => (
                                    <button
                                        key={tab.id}
                                        className={cn(
                                            "flex-1 min-w-[64px] py-2.5 text-[10px] font-medium text-center transition-colors",
                                            fitnessTab === tab.id
                                                ? "text-primary border-t-2 border-primary -mt-px"
                                                : "text-muted-foreground"
                                        )}
                                        onClick={() => setFitnessTab(tab.id)}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
