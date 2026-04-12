import { useState } from 'react';
import { useStore } from '../../store';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

const DAY_NAMES: Record<number, string> = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday' };

export function ProgramOverview() {
    const programs = useStore(s => s.programs);
    const activeProgram = useStore(s => s.activeProgram);
    const programPhases = useStore(s => s.programPhases);
    const programDays = useStore(s => s.programDays);
    const programExercises = useStore(s => s.programExercises);
    const getCurrentWeek = useStore(s => s.getCurrentWeek);

    const program = programs.find(p => p.id === activeProgram?.program_id);
    const currentWeek = getCurrentWeek();

    const [expandedPhase, setExpandedPhase] = useState<string | null>(
        programPhases.find(p => currentWeek >= p.week_start && currentWeek <= p.week_end)?.id || null
    );
    const [expandedDay, setExpandedDay] = useState<string | null>(null);

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-4">
            <div className="space-y-1">
                <h2 className="text-lg font-bold">{program?.name}</h2>
                <p className="text-xs text-muted-foreground">{program?.description}</p>
                <p className="text-xs text-muted-foreground">{program?.total_weeks} weeks &middot; 5 days/week</p>
            </div>

            <div className="space-y-3">
                {programPhases.map(phase => {
                    const isExpanded = expandedPhase === phase.id;
                    const isCurrent = currentWeek >= phase.week_start && currentWeek <= phase.week_end;
                    const phaseDays = programDays
                        .filter(d => d.phase_id === phase.id)
                        .sort((a, b) => a.order - b.order);

                    return (
                        <div key={phase.id} className={cn(
                            "border rounded-xl overflow-hidden transition-all",
                            isCurrent ? "border-primary/40" : "border-border"
                        )}>
                            <button
                                className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/20 active:bg-muted/20 transition-colors"
                                onClick={() => setExpandedPhase(isExpanded ? null : phase.id)}
                            >
                                <div className={cn(
                                    "h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
                                    isCurrent ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                )}>
                                    {phase.order}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold">{phase.name}</p>
                                    <p className="text-[10px] text-muted-foreground">
                                        Weeks {phase.week_start}-{phase.week_end} &middot; {phase.rir_guidance}
                                    </p>
                                </div>
                                {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                            </button>

                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ height: 0 }}
                                        animate={{ height: 'auto' }}
                                        exit={{ height: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="border-t border-border/50 px-3 py-2 space-y-1">
                                            {phase.description && (
                                                <p className="text-xs text-muted-foreground p-2">{phase.description}</p>
                                            )}

                                            {phaseDays.map(day => {
                                                const isDayExpanded = expandedDay === day.id;
                                                const dayExercises = programExercises
                                                    .filter(e => e.program_day_id === day.id)
                                                    .sort((a, b) => a.order - b.order);

                                                return (
                                                    <div key={day.id}>
                                                        <button
                                                            className="w-full flex items-center gap-2 p-2.5 rounded-lg hover:bg-muted/30 active:bg-muted/30 transition-colors text-left"
                                                            onClick={() => setExpandedDay(isDayExpanded ? null : day.id)}
                                                        >
                                                            <span className="text-[10px] text-muted-foreground w-8 shrink-0">
                                                                {DAY_NAMES[day.day_of_week]?.slice(0, 3)}
                                                            </span>
                                                            <span className="text-sm font-medium flex-1">{day.name}</span>
                                                            {isDayExpanded
                                                                ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                                                : <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                                            }
                                                        </button>

                                                        <AnimatePresence>
                                                            {isDayExpanded && (
                                                                <motion.div
                                                                    initial={{ height: 0, opacity: 0 }}
                                                                    animate={{ height: 'auto', opacity: 1 }}
                                                                    exit={{ height: 0, opacity: 0 }}
                                                                    className="overflow-hidden"
                                                                >
                                                                    <div className="ml-10 pb-2 space-y-1">
                                                                        {dayExercises.map(ex => (
                                                                            <div key={ex.id} className="flex items-baseline gap-2 py-1">
                                                                                <span className={cn(
                                                                                    "text-xs",
                                                                                    ex.type === 'warmup' || ex.type === 'finisher' || ex.type === 'mobility'
                                                                                        ? "text-muted-foreground italic"
                                                                                        : "text-foreground"
                                                                                )}>
                                                                                    {ex.display_name}
                                                                                </span>
                                                                                {ex.prescribed_sets && ex.prescribed_sets !== '—' && (
                                                                                    <span className="text-[10px] text-muted-foreground shrink-0">
                                                                                        {ex.prescribed_sets} &times; {ex.prescribed_reps}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
