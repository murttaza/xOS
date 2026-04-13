import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store';
import { cn } from '../lib/utils';
import { Dumbbell } from 'lucide-react';
import { Button } from './ui/button';
import { ModeHeader } from './ModeHeader';

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
    const goBackFitnessTab = useStore(s => s.goBackFitnessTab);
    const fitnessTabHistory = useStore(s => s.fitnessTabHistory);
    const fetchFitnessData = useStore(s => s.fetchFitnessData);
    const activeProgram = useStore(s => s.activeProgram);
    const showProgramPicker = useStore(s => s.showProgramPicker);
    const setShowProgramPicker = useStore(s => s.setShowProgramPicker);

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
        if (!activeProgram || showProgramPicker) return <ProgramPicker />;

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

    const handleBack = () => {
        if (showProgramPicker) {
            setShowProgramPicker(false);
            return;
        }
        if (fitnessTabHistory.length > 0) {
            goBackFitnessTab();
        }
    };

    const canGoBack = showProgramPicker || fitnessTabHistory.length > 0;

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
                    <ModeHeader
                        modeLabel="Fitness"
                        modeIcon={Dumbbell}
                        onGoHome={toggleFitnessMode}
                        showMobileBack={canGoBack}
                        onMobileBack={handleBack}
                        centerContent={activeProgram ? (
                            <div className="flex items-center gap-1">
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
                        ) : undefined}
                    />

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
