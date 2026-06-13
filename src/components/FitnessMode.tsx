import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store';
import { cn, isDialogOpen } from '../lib/utils';
import { Dumbbell } from 'lucide-react';
import { Button } from './ui/button';
import { ModeHeader } from './ModeHeader';
import { ModeLoading } from './ui/mode-loading';

import { FitnessHome } from './fitness/FitnessHome';
import { TodayWorkout } from './fitness/TodayWorkout';
import { WeekView } from './fitness/WeekView';
import { ProgramOverview } from './fitness/ProgramOverview';
import { StatsHub } from './fitness/StatsHub';
import { PrinciplesView } from './fitness/PrinciplesView';
import { ProgramPicker } from './fitness/ProgramPicker';

// Six tabs, not eight: Progress and History now live inside the Stats hub.
// Six fits the mobile bottom bar without scrolling tabs off-screen.
const TABS = [
    { id: 'home', label: 'Home' },
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'Week' },
    { id: 'program', label: 'Program' },
    { id: 'stats', label: 'Stats' },
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

    // Distinguish "still fetching" from "no program yet" on open
    const [modeLoading, setModeLoading] = useState(true);
    useEffect(() => {
        if (isFitnessMode) {
            setModeLoading(true);
            Promise.resolve(fetchFitnessData()).finally(() => setModeLoading(false));
        }
    }, [isFitnessMode, fetchFitnessData]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Escape' || !isFitnessMode || e.defaultPrevented) return;
            if (isDialogOpen()) return; // a dialog owns this Escape press
            if (showProgramPicker && activeProgram) {
                setShowProgramPicker(false); // close the picker layer, keep the mode
                return;
            }
            toggleFitnessMode();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isFitnessMode, toggleFitnessMode, showProgramPicker, activeProgram, setShowProgramPicker]);

    const renderContent = () => {
        if (modeLoading) return <ModeLoading label="Loading fitness…" />;
        if (!activeProgram || showProgramPicker) return <ProgramPicker />;

        switch (fitnessTab) {
            case 'today': return <TodayWorkout />;
            case 'week': return <WeekView />;
            case 'program': return <ProgramOverview />;
            case 'stats': return <StatsHub initialView="stats" />;
            // Old deep links (home quick-links, history) land inside the hub.
            case 'progress': return <StatsHub initialView="progress" />;
            case 'history': return <StatsHub initialView="history" />;
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

    // 'progress'/'history' render inside the Stats hub — highlight Stats for them.
    const isTabActive = (tabId: string) =>
        fitnessTab === tabId || (tabId === 'stats' && (fitnessTab === 'progress' || fitnessTab === 'history'));

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
                    style={{ paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)' }}
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
                                        variant={isTabActive(tab.id) ? 'default' : 'ghost'}
                                        size="sm"
                                        className={cn(
                                            "text-xs h-8 px-3",
                                            isTabActive(tab.id)
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

                    {/* Content — when the bottom tab bar isn't shown (program picker),
                        the content itself reaches the screen bottom and needs clearance */}
                    <div className={cn("flex-1 overflow-y-auto no-scrollbar", !activeProgram && "mobile-safe-bottom")}>
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
                                            "flex-1 min-w-[52px] py-2.5 text-[10px] font-medium text-center transition-colors",
                                            isTabActive(tab.id)
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
