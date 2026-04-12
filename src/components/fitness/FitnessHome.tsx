import { useEffect } from 'react';
import { useStore } from '../../store';
import { Button } from '../ui/button';
import { motion } from 'framer-motion';
import { Play, Check, Minus, ChevronRight, Calendar, TrendingUp, Dumbbell, FileText, ArrowRightLeft } from 'lucide-react';
import { cn } from '../../lib/utils';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export function FitnessHome() {
    const activeProgram = useStore(s => s.activeProgram);
    const programs = useStore(s => s.programs);
    const sessions = useStore(s => s.workoutSessions);
    const bodyMetrics = useStore(s => s.bodyMetrics);
    const getCurrentWeek = useStore(s => s.getCurrentWeek);
    const getPhaseForWeek = useStore(s => s.getPhaseForWeek);
    const getSessionsForWeek = useStore(s => s.getSessionsForWeek);
    const ensureWeekSessions = useStore(s => s.ensureWeekSessions);
    const setFitnessTab = useStore(s => s.setFitnessTab);
    const fetchSessionDetail = useStore(s => s.fetchSessionDetail);
    const setShowProgramPicker = useStore(s => s.setShowProgramPicker);

    const currentWeek = getCurrentWeek();
    const currentPhase = getPhaseForWeek(currentWeek);
    const weekSessions = getSessionsForWeek(currentWeek);
    const program = programs.find(p => p.id === activeProgram?.program_id);
    const totalWeeks = program?.total_weeks || 12;
    const progress = Math.round((currentWeek / totalWeeks) * 100);

    useEffect(() => {
        if (activeProgram) {
            ensureWeekSessions(currentWeek);
        }
    }, [activeProgram, currentWeek, ensureWeekSessions]);

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const todaySession = weekSessions.find(s => s.scheduled_date === todayStr);

    const latestWeight = bodyMetrics.find(m => m.body_weight);
    const completedThisWeek = weekSessions.filter(s => s.status === 'completed').length;
    const recentSessions = sessions.filter(s => s.status === 'completed').slice(-3);

    const handleTodayClick = () => {
        if (todaySession) {
            fetchSessionDetail(todaySession.id);
        }
        setFitnessTab('today');
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-4 sm:space-y-6">
            {/* Active Program Card */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="border border-border rounded-2xl p-4 sm:p-5 space-y-4"
            >
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <h2 className="text-lg font-bold leading-tight">{program?.name || 'Program'}</h2>
                        <p className="text-xs text-muted-foreground">
                            Week {currentWeek} of {totalWeeks}
                            {currentPhase && <> &middot; {currentPhase.name}</>}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground"
                            onClick={() => setShowProgramPicker(true)}
                            title="Switch Program"
                        >
                            <ArrowRightLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-2xl font-bold text-primary">{progress}%</span>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="h-full bg-primary rounded-full"
                    />
                </div>

                {/* Phase guidance */}
                {currentPhase?.rir_guidance && (
                    <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                        {currentPhase.rir_guidance}
                    </p>
                )}
            </motion.div>

            {/* Week Strip */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="space-y-3"
            >
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">This Week</h3>
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setFitnessTab('week')}>
                        View All <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                </div>
                <div className="grid grid-cols-5 gap-2">
                    {DAY_LABELS.map((label, i) => {
                        const session = weekSessions.find(s => {
                            const d = new Date(s.scheduled_date + 'T00:00:00');
                            return d.getDay() === (i === 0 ? 1 : i + 1); // Mon=1
                        });
                        const isToday = session?.scheduled_date === todayStr;
                        const status = session?.status || 'rest';

                        return (
                            <button
                                key={label}
                                className={cn(
                                    "rounded-xl p-2.5 sm:p-3 flex flex-col items-center gap-1.5 transition-all border",
                                    isToday && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                                    status === 'completed' && "border-green-500/30 dark:border-green-400/30 bg-green-500/10 dark:bg-green-500/15",
                                    status === 'skipped' && "border-red-500/30 dark:border-red-400/30 bg-red-500/10 dark:bg-red-500/15",
                                    status === 'in_progress' && "border-yellow-500/30 dark:border-yellow-400/30 bg-yellow-500/10 dark:bg-yellow-500/15",
                                    status === 'planned' && "border-border bg-muted/30",
                                    status === 'rest' && "border-border/50 bg-transparent opacity-50",
                                )}
                                onClick={() => {
                                    if (session) {
                                        fetchSessionDetail(session.id);
                                        setFitnessTab('today');
                                    }
                                }}
                            >
                                <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
                                {status === 'completed' ? (
                                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                                ) : status === 'skipped' ? (
                                    <Minus className="h-4 w-4 text-red-600 dark:text-red-400" />
                                ) : status === 'in_progress' ? (
                                    <Play className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
                                ) : (
                                    <div className="h-4 w-4 rounded-full border border-border/50" />
                                )}
                                <span className="text-[9px] text-muted-foreground truncate w-full text-center">
                                    {session?.program_day?.name?.split('—')[0]?.trim() || (status === 'rest' ? 'Rest' : '')}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </motion.div>

            {/* Today CTA */}
            {todaySession && todaySession.status !== 'completed' && todaySession.status !== 'skipped' && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <Button
                        className="w-full h-12 text-base font-semibold gap-2"
                        onClick={handleTodayClick}
                    >
                        <Dumbbell className="h-5 w-5" />
                        {todaySession.status === 'in_progress' ? 'Continue Workout' : "Start Today's Workout"}
                    </Button>
                </motion.div>
            )}

            {/* Quick Stats */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="grid grid-cols-3 gap-3"
            >
                <div className="border border-border rounded-xl p-3 text-center space-y-1">
                    <TrendingUp className="h-4 w-4 mx-auto text-muted-foreground" />
                    <p className="text-lg font-bold">{completedThisWeek}/5</p>
                    <p className="text-[10px] text-muted-foreground">This week</p>
                </div>
                <div className="border border-border rounded-xl p-3 text-center space-y-1">
                    <Calendar className="h-4 w-4 mx-auto text-muted-foreground" />
                    <p className="text-lg font-bold">{sessions.filter(s => s.status === 'completed').length}</p>
                    <p className="text-[10px] text-muted-foreground">Total sessions</p>
                </div>
                <div className="border border-border rounded-xl p-3 text-center space-y-1">
                    <TrendingUp className="h-4 w-4 mx-auto text-muted-foreground" />
                    <p className="text-lg font-bold">{latestWeight?.body_weight ? `${latestWeight.body_weight}` : '—'}</p>
                    <p className="text-[10px] text-muted-foreground">{latestWeight?.body_weight ? 'lb' : 'No weight'}</p>
                </div>
            </motion.div>

            {/* Recent Sessions */}
            {recentSessions.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="space-y-3"
                >
                    <h3 className="text-sm font-semibold">Recent Sessions</h3>
                    <div className="space-y-2">
                        {recentSessions.map(session => (
                            <button
                                key={session.id}
                                className="w-full flex items-center gap-3 border border-border rounded-lg p-3 hover:bg-muted/30 active:bg-muted/30 transition-colors text-left"
                                onClick={() => {
                                    fetchSessionDetail(session.id);
                                    setFitnessTab('today');
                                }}
                            >
                                <div className="h-8 w-8 rounded-lg bg-green-500/10 dark:bg-green-500/15 flex items-center justify-center shrink-0">
                                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{session.program_day?.name || 'Workout'}</p>
                                    <p className="text-[10px] text-muted-foreground">{new Date(session.scheduled_date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                                </div>
                                {session.perceived_effort && (
                                    <span className="text-xs text-muted-foreground">RPE {session.perceived_effort}</span>
                                )}
                            </button>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Quick links */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="grid grid-cols-2 gap-3 pb-4"
            >
                <Button variant="outline" className="h-auto py-3 flex flex-col gap-1" onClick={() => setFitnessTab('progress')}>
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-xs">Progress</span>
                </Button>
                <Button variant="outline" className="h-auto py-3 flex flex-col gap-1" onClick={() => setFitnessTab('principles')}>
                    <FileText className="h-4 w-4" />
                    <span className="text-xs">Principles</span>
                </Button>
            </motion.div>
        </div>
    );
}
