import { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { Button } from '../ui/button';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Check, Minus, Play, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function WeekView() {
    const activeProgram = useStore(s => s.activeProgram);
    const programs = useStore(s => s.programs);
    const getCurrentWeek = useStore(s => s.getCurrentWeek);
    const getPhaseForWeek = useStore(s => s.getPhaseForWeek);
    const getSessionsForWeek = useStore(s => s.getSessionsForWeek);
    const ensureWeekSessions = useStore(s => s.ensureWeekSessions);
    const fetchSessionDetail = useStore(s => s.fetchSessionDetail);
    const setFitnessTab = useStore(s => s.setFitnessTab);
    const getWeekStartDate = useStore(s => s.getWeekStartDate);

    const currentWeek = getCurrentWeek();
    const [viewWeek, setViewWeek] = useState(currentWeek);

    const program = programs.find(p => p.id === activeProgram?.program_id);
    const totalWeeks = program?.total_weeks || 12;
    const phase = getPhaseForWeek(viewWeek);
    const weekSessions = getSessionsForWeek(viewWeek);
    const weekStart = getWeekStartDate(viewWeek);

    useEffect(() => {
        ensureWeekSessions(viewWeek);
    }, [viewWeek, ensureWeekSessions]);

    const statusIcon = (status: string) => {
        switch (status) {
            case 'completed': return <Check className="h-4 w-4 text-green-600 dark:text-green-400" />;
            case 'skipped': return <Minus className="h-4 w-4 text-red-600 dark:text-red-400" />;
            case 'in_progress': return <Play className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />;
            default: return <Clock className="h-3.5 w-3.5 text-muted-foreground/50" />;
        }
    };

    const handleSessionClick = (sessionId: string) => {
        fetchSessionDetail(sessionId);
        setFitnessTab('today');
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-4">
            {/* Week navigation */}
            <div className="flex items-center justify-between">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={viewWeek <= 1}
                    onClick={() => setViewWeek(viewWeek - 1)}
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-center">
                    <h2 className="text-base font-bold">Week {viewWeek}</h2>
                    <p className="text-xs text-muted-foreground">
                        {phase?.name || 'Phase'}
                        {viewWeek === currentWeek && <> &middot; <span className="text-primary">Current</span></>}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                        {new Date(weekStart + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        {' - '}
                        {(() => {
                            const end = new Date(weekStart + 'T00:00:00');
                            end.setDate(end.getDate() + 6);
                            return end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                        })()}
                    </p>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={viewWeek >= totalWeeks}
                    onClick={() => setViewWeek(viewWeek + 1)}
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            {/* Week selector chips */}
            <div className="flex justify-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                {Array.from({ length: totalWeeks }, (_, i) => i + 1).map(w => (
                    <button
                        key={w}
                        className={cn(
                            "shrink-0 h-8 w-8 rounded-full text-xs font-medium transition-all",
                            w === viewWeek && "bg-primary text-primary-foreground",
                            w === currentWeek && w !== viewWeek && "ring-1 ring-primary text-primary",
                            w !== viewWeek && w !== currentWeek && "text-muted-foreground hover:bg-muted active:bg-muted"
                        )}
                        onClick={() => setViewWeek(w)}
                    >
                        {w}
                    </button>
                ))}
            </div>

            {/* Day list */}
            <div className="space-y-2">
                {weekSessions.length > 0 ? (
                    weekSessions.map(session => {
                        const dayDate = new Date(session.scheduled_date + 'T00:00:00');
                        const dayName = DAY_NAMES[dayDate.getDay() === 0 ? 6 : dayDate.getDay() - 1];

                        return (
                            <motion.button
                                key={session.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={cn(
                                    "w-full flex items-center gap-3 border rounded-xl p-3.5 hover:bg-muted/30 active:bg-muted/30 transition-all text-left",
                                    session.status === 'completed' && "border-green-500/30 dark:border-green-400/30 bg-green-500/5 dark:bg-green-500/10",
                                    session.status === 'skipped' && "border-red-500/20 dark:border-red-400/20 bg-red-500/5 dark:bg-red-500/10 opacity-60",
                                    session.status === 'planned' && "border-border",
                                    session.status === 'in_progress' && "border-yellow-500/30 dark:border-yellow-400/30 bg-yellow-500/5 dark:bg-yellow-500/10",
                                )}
                                onClick={() => handleSessionClick(session.id)}
                            >
                                <div className={cn(
                                    "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                                    session.status === 'completed' && "bg-green-500/10 dark:bg-green-500/15",
                                    session.status === 'skipped' && "bg-red-500/10 dark:bg-red-500/15",
                                    session.status === 'planned' && "bg-muted",
                                    session.status === 'in_progress' && "bg-yellow-500/10 dark:bg-yellow-500/15",
                                )}>
                                    {statusIcon(session.status)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                        {session.program_day?.name || 'Workout'}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">
                                        {dayName}, {dayDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    </p>
                                </div>
                                {session.perceived_effort && (
                                    <span className="text-xs text-muted-foreground shrink-0">
                                        RPE {session.perceived_effort}
                                    </span>
                                )}
                            </motion.button>
                        );
                    })
                ) : (
                    <p className="text-center text-sm text-muted-foreground py-8">
                        No sessions scheduled for this week.
                    </p>
                )}
            </div>
        </div>
    );
}
