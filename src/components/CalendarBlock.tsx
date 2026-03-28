import { useEffect, useState, useMemo, useCallback } from "react";
import { CardContent } from "@/components/ui/card";

import { useStore } from "@/store";
import { startOfMonth, endOfMonth, format, addMonths, subMonths, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday } from "date-fns";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { cn, safeJSONParse, getLocalDateString } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

const WEEK_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function CalendarBlock() {
    const sessions = useStore(state => state.sessions);
    const tasks = useStore(state => state.tasks);
    const fetchSessionsRange = useStore(state => state.fetchSessionsRange);
    const dailyLog = useStore(state => state.dailyLog);
    const fetchDailyLog = useStore(state => state.fetchDailyLog);

    const [date, setDate] = useState<Date>(new Date());
    const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
    const [journalText, setJournalText] = useState("");
    const [windowSize, setWindowSize] = useState(0);
    const [isMobileExpanded, setIsMobileExpanded] = useState(false);

    useEffect(() => {
        if (!window.ipcRenderer) return;
        const removeListener = window.ipcRenderer.on('window-size-state', (_: unknown, size: number) => {
            setWindowSize(size);
        });
        return () => removeListener();
    }, []);
    
    // Save Journal Entry
    const saveJournalEntry = useStore(state => state.saveJournalEntry);

    // Create a map for faster task lookup
    const taskMap = useMemo(() => {
        const map = new Map();
        tasks.forEach(t => map.set(t.id, t));
        return map;
    }, [tasks]);

    // Initial fetch
    useEffect(() => {
        const start = format(startOfMonth(currentMonth), "yyyy-MM-dd");
        const end = format(endOfMonth(currentMonth), "yyyy-MM-dd");
        fetchSessionsRange(start, end);
    }, [currentMonth, fetchSessionsRange]);

    // Fetch Daily Log when date changes
    useEffect(() => {
        const dateStr = format(date, "yyyy-MM-dd");
        fetchDailyLog(dateStr);
    }, [date, fetchDailyLog]);

    // Sync local journal text state when dailyLog changes or when we change dates
    useEffect(() => {
        setJournalText(dailyLog?.journalEntry || "");
    }, [dailyLog?.date, dailyLog?.journalEntry]);

    // Debounced save for Journal Entry
    useEffect(() => {
        const handler = setTimeout(() => {
            const dateStr = format(date, "yyyy-MM-dd");
            if (journalText !== (dailyLog?.journalEntry || "")) {
                saveJournalEntry(dateStr, journalText);
            }
        }, 1000);
        return () => clearTimeout(handler);
    }, [journalText, date, dailyLog?.journalEntry, saveJournalEntry]);

    const nextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
    const prevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));

    const getTaskTitle = useCallback((taskId: number) => {
        const task = taskMap.get(taskId);
        return task ? task.title : "Unknown Task";
    }, [taskMap]);

    const selectedDateStr = format(date, "yyyy-MM-dd");

    const daySessions = useMemo(() =>
        sessions.filter(s => s.dateLogged === selectedDateStr),
        [sessions, selectedDateStr]
    );

    const completedTasksOnDay = useMemo(() => {
        return tasks.filter(t => t.isComplete && t.completedAt && getLocalDateString(new Date(t.completedAt)) === selectedDateStr);
    }, [tasks, selectedDateStr]);

    const completedPrayers = useMemo(() => {
        if (!dailyLog || dailyLog.date !== selectedDateStr) return [];
        const prayers = safeJSONParse<Record<string, boolean>>(dailyLog.prayersCompleted, {});
        return Object.entries(prayers).filter(([, completed]) => completed).map(([name]) => name);
    }, [dailyLog, selectedDateStr]);

    const totalMinutes = useMemo(() =>
        daySessions.reduce((acc, s) => acc + s.duration_minutes, 0),
        [daySessions]
    );

    // Generate calendar grid
    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(currentMonth);
        const calendarStart = startOfWeek(monthStart);
        const calendarEnd = endOfWeek(monthEnd);
        return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    }, [currentMonth]);

    // Set of dates that have activity for quick lookup
    const datesWithActivity = useMemo(() => {
        const set = new Set<string>();
        sessions.forEach(s => set.add(s.dateLogged));
        tasks.forEach(t => {
            if (t.isComplete && t.completedAt) {
                set.add(getLocalDateString(new Date(t.completedAt)));
            }
        });
        return set;
    }, [sessions, tasks]);

    return (
        <div className="flex flex-col lg:h-full overflow-hidden lg:bg-gradient-to-br lg:from-card lg:to-secondary/10">
            {/* Header - collapsible on mobile */}
            <div
                className="flex items-center justify-between p-4 pb-2 shrink-0 cursor-pointer lg:cursor-default"
                onClick={() => setIsMobileExpanded(prev => !prev)}
            >
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary transition-colors hidden lg:flex" onClick={(e) => { e.stopPropagation(); prevMonth(); }}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base font-bold tracking-tight shrink-0">{format(currentMonth, "MMMM yyyy")}</span>
                    <ChevronDown className={`h-4 w-4 lg:hidden transition-transform shrink-0 ${isMobileExpanded ? 'rotate-180' : ''}`} />
                    {!isMobileExpanded && (
                        <span className="text-[11px] text-muted-foreground/50 font-normal truncate lg:hidden">
                            Today {format(new Date(), "EEE d")}{daySessions.length > 0 ? ` · ${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m` : ''}
                        </span>
                    )}
                </div>

                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary transition-colors hidden lg:flex" onClick={(e) => { e.stopPropagation(); nextMonth(); }}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            <CardContent className={`${isMobileExpanded ? 'block' : 'hidden'} lg:flex flex-1 min-h-0 overflow-hidden p-4 pt-0 flex-col gap-6`}>
                {/* Calendar Grid */}
                <div className="w-full max-w-[340px] mx-auto shrink-0">
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {WEEK_DAYS.map((day) => (
                            <div key={day} className="text-center text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest">
                                {day}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1.5">
                        {calendarDays.map((day, idx) => {
                            const isCurrentMonth = isSameMonth(day, currentMonth);
                            const isSelected = isSameDay(day, date);
                            const isTodayDate = isToday(day);
                            const dayStr = format(day, "yyyy-MM-dd");
                            const hasActivity = datesWithActivity.has(dayStr);

                            return (
                                <button
                                    key={idx}
                                    onClick={() => setDate(day)}
                                    className={cn(
                                        "relative aspect-square flex flex-col items-center justify-center rounded-xl text-xs font-medium transition-[color,background-color,border-color,transform] duration-100 hover:scale-110 active:scale-95",
                                        !isCurrentMonth && "text-muted-foreground/30 opacity-50",
                                        isCurrentMonth && "text-foreground/80 hover:bg-secondary/70 hover:text-foreground",
                                        isSelected && "bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-105 font-bold z-10 hover:bg-primary hover:scale-105",
                                        !isSelected && isTodayDate && "bg-secondary/50 text-foreground border border-primary/20",
                                    )}
                                >
                                    {format(day, "d")}
                                    {hasActivity && !isSelected && (
                                        <div className="absolute bottom-1.5 h-1 w-1 rounded-full bg-primary/70" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Selected Day Details */}
                <div className={`flex-1 min-h-0 flex flex-col gap-3 bg-secondary/20 rounded-2xl p-4 border border-border/40 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${windowSize === 0 ? 'max-h-[45vh]' : ''}`}>
                    <div className="flex items-center justify-between shrink-0 mb-1">
                        <div className="flex flex-col">
                            <h3 className="font-bold text-sm">{format(date, "EEEE")}</h3>
                            <span className="text-xs text-muted-foreground">{format(date, "MMMM d")}</span>
                        </div>
                        {totalMinutes > 0 && (
                            <div className="text-right">
                                <span className="block text-lg font-bold text-primary leading-none tracking-tight">
                                    {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m
                                </span>
                                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Focused</span>
                            </div>
                        )}
                    </div>

                    {/* Prayers Section (if any completed) */}
                    {completedPrayers.length > 0 && (
                        <div className="flex gap-1.5 shrink-0">
                            {completedPrayers.map((prayer) => (
                                <span key={prayer} className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase flex items-center justify-center border border-primary/20">
                                    {prayer[0]}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Journal Entry */}
                    <div className="shrink-0 mb-3 border-b border-border/40 pb-3">
                        <Textarea 
                            placeholder="Write your journal entry for this day..."
                            value={journalText}
                            onChange={(e) => setJournalText(e.target.value)}
                            className="text-xs resize-none min-h-[80px] bg-background/50 border-border/40 focus-visible:ring-primary/20 placeholder:text-muted-foreground/40 no-scrollbar [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        />
                    </div>

                    {/* Sessions List */}
                    <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pr-1 -mr-2 space-y-2">
                        {daySessions.length === 0 && completedPrayers.length === 0 && completedTasksOnDay.length === 0 ? (
                            <div className="h-20 flex flex-col items-center justify-center text-muted-foreground/50 gap-2">
                                <div className="h-1 w-1 rounded-full bg-current opacity-50" />
                                <span className="text-xs font-medium">No activity recorded</span>
                            </div>
                        ) : (
                            <AnimatePresence mode="popLayout">
                                {daySessions.map((session, i) => (
                                    <motion.div
                                        key={session.id || `session-${session.taskId}-${session.startTime}`}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="flex items-center justify-between p-2.5 rounded-lg bg-background/50 border border-border/40 hover:bg-background/80 hover:border-primary/20 hover:shadow-sm transition-colors group"
                                    >
                                        <span className="text-xs font-medium truncate max-w-[70%] group-hover:text-primary transition-colors">
                                            {getTaskTitle(session.taskId)}
                                        </span>
                                        <span className="text-[10px] font-mono font-medium text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full">
                                            {session.duration_minutes}m
                                        </span>
                                    </motion.div>
                                ))}
                                {completedTasksOnDay.map((task, i) => (
                                    <motion.div
                                        key={`task-${task.id}`}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ delay: (daySessions.length + i) * 0.05 }}
                                        className="flex items-center justify-between p-2.5 rounded-lg bg-background/50 border border-border/40 hover:bg-background/80 hover:border-primary/20 hover:shadow-sm transition-colors group"
                                    >
                                        <span className="text-xs font-medium truncate max-w-[70%] group-hover:text-primary transition-colors line-through opacity-70">
                                            {task.title}
                                        </span>
                                        <span className="text-[10px] font-mono font-medium text-green-500/70 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                                            Completed
                                        </span>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        )}
                    </div>
                </div>
            </CardContent>
        </div>
    );
}
