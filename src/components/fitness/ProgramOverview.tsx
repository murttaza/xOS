import { useState, useRef, useEffect } from 'react';
import { useStore } from '../../store';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Plus, X, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';

const DAY_NAMES: Record<number, string> = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday', 7: 'Sunday' };
const DAY_OPTIONS = [
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
    { value: 7, label: 'Sunday' },
];

const EXERCISE_TYPES = ['strength', 'conditioning', 'mobility', 'core', 'warmup', 'finisher'];

function InlineEdit({ value, onSave, className, placeholder }: { value: string; onSave: (v: string) => void; className?: string; placeholder?: string }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value);
    const ref = useRef<HTMLInputElement>(null);

    useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

    if (!editing) {
        return (
            <button
                className={cn("text-left hover:bg-muted/40 rounded px-1 -mx-1 transition-colors cursor-text", className)}
                onClick={() => { setDraft(value); setEditing(true); }}
            >
                {value || <span className="text-muted-foreground italic">{placeholder || 'Click to edit'}</span>}
            </button>
        );
    }

    const commit = () => {
        setEditing(false);
        if (draft.trim() !== value) onSave(draft.trim());
    };

    return (
        <Input
            ref={ref}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
            className={cn("h-7 text-sm px-1", className)}
            placeholder={placeholder}
        />
    );
}

function ConfirmDelete({ onConfirm, onCancel, label }: { onConfirm: () => void; onCancel: () => void; label: string }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex items-center gap-2 bg-destructive/10 rounded-lg px-3 py-2"
        >
            <span className="text-xs text-destructive flex-1">Delete {label}?</span>
            <Button size="sm" variant="destructive" className="h-6 text-xs px-2" onClick={onConfirm}>Delete</Button>
            <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={onCancel}>Cancel</Button>
        </motion.div>
    );
}

export function ProgramOverview() {
    const programs = useStore(s => s.programs);
    const activeProgram = useStore(s => s.activeProgram);
    const programPhases = useStore(s => s.programPhases);
    const programDays = useStore(s => s.programDays);
    const programExercises = useStore(s => s.programExercises);
    const getCurrentWeek = useStore(s => s.getCurrentWeek);

    const updateProgram = useStore(s => s.updateProgram);
    const deleteProgram = useStore(s => s.deleteProgram);
    const addPhase = useStore(s => s.addPhase);
    const updatePhase = useStore(s => s.updatePhase);
    const deletePhase = useStore(s => s.deletePhase);
    const addDay = useStore(s => s.addDay);
    const updateDay = useStore(s => s.updateDay);
    const deleteDay = useStore(s => s.deleteDay);
    const addExercise = useStore(s => s.addExercise);
    const updateExercise = useStore(s => s.updateExercise);
    const deleteExercise = useStore(s => s.deleteExercise);

    const program = programs.find(p => p.id === activeProgram?.program_id);
    const currentWeek = getCurrentWeek();

    const [expandedPhase, setExpandedPhase] = useState<string | null>(
        programPhases.find(p => currentWeek >= p.week_start && currentWeek <= p.week_end)?.id || null
    );
    const [expandedDay, setExpandedDay] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null); // id of item being deleted
    const [editMode, setEditMode] = useState(false);
    const [addingPhase, setAddingPhase] = useState(false);
    const [addingDay, setAddingDay] = useState<string | null>(null); // phase id
    const [addingExercise, setAddingExercise] = useState<string | null>(null); // day id

    // New phase form
    const [newPhaseName, setNewPhaseName] = useState('');
    const [newPhaseWeekStart, setNewPhaseWeekStart] = useState(1);
    const [newPhaseWeekEnd, setNewPhaseWeekEnd] = useState(4);

    // New day form
    const [newDayName, setNewDayName] = useState('');
    const [newDayOfWeek, setNewDayOfWeek] = useState(1);
    const [newDayFocus, setNewDayFocus] = useState('');

    // New exercise form
    const [newExName, setNewExName] = useState('');
    const [newExSets, setNewExSets] = useState('3');
    const [newExReps, setNewExReps] = useState('8-12');
    const [newExType, setNewExType] = useState('strength');

    if (!program) return null;

    const handleDeleteProgram = async () => {
        await deleteProgram(program.id);
        setConfirmDelete(null);
    };

    const handleAddPhase = async () => {
        if (!newPhaseName.trim()) return;
        await addPhase({
            program_id: program.id,
            name: newPhaseName.trim(),
            week_start: newPhaseWeekStart,
            week_end: newPhaseWeekEnd,
            rir_guidance: '',
            description: '',
            order: programPhases.length + 1,
        });
        setNewPhaseName('');
        setAddingPhase(false);
    };

    const handleAddDay = async (phaseId: string) => {
        if (!newDayName.trim()) return;
        const phaseDays = programDays.filter(d => d.phase_id === phaseId);
        await addDay({
            program_id: program.id,
            phase_id: phaseId,
            day_of_week: newDayOfWeek,
            name: newDayName.trim(),
            focus: newDayFocus.trim(),
            order: phaseDays.length + 1,
        });
        setNewDayName('');
        setNewDayFocus('');
        setAddingDay(null);
    };

    const handleAddExercise = async (dayId: string) => {
        if (!newExName.trim()) return;
        const dayExercises = programExercises.filter(e => e.program_day_id === dayId);
        await addExercise({
            program_day_id: dayId,
            display_name: newExName.trim(),
            type: newExType,
            prescribed_sets: newExSets,
            prescribed_reps: newExReps,
            is_loggable: newExType === 'strength' || newExType === 'conditioning',
            order: dayExercises.length + 1,
        });
        setNewExName('');
        setNewExSets('3');
        setNewExReps('8-12');
        setAddingExercise(null);
    };

    const moveExercise = async (ex: typeof programExercises[0], direction: 'up' | 'down') => {
        const dayExercises = programExercises
            .filter(e => e.program_day_id === ex.program_day_id)
            .sort((a, b) => a.order - b.order);
        const idx = dayExercises.findIndex(e => e.id === ex.id);
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= dayExercises.length) return;
        const other = dayExercises[swapIdx];
        await Promise.all([
            updateExercise(ex.id, { order: other.order }),
            updateExercise(other.id, { order: ex.order }),
        ]);
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-4">
            {/* Program Header */}
            <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-1">
                        {editMode ? (
                            <InlineEdit
                                value={program.name}
                                onSave={name => updateProgram(program.id, { name })}
                                className="text-lg font-bold"
                                placeholder="Program name"
                            />
                        ) : (
                            <h2 className="text-lg font-bold">{program.name}</h2>
                        )}
                        {editMode ? (
                            <InlineEdit
                                value={program.description || ''}
                                onSave={description => updateProgram(program.id, { description })}
                                className="text-xs text-muted-foreground"
                                placeholder="Add description"
                            />
                        ) : (
                            program.description && <p className="text-xs text-muted-foreground">{program.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                            {editMode ? (
                                <span className="inline-flex items-center gap-1">
                                    <Input
                                        type="number"
                                        value={program.total_weeks}
                                        onChange={e => {
                                            const v = Math.max(1, parseInt(e.target.value) || 1);
                                            updateProgram(program.id, { total_weeks: v });
                                        }}
                                        className="h-6 w-14 text-xs inline"
                                        min={1}
                                        max={52}
                                    />
                                    <span>weeks</span>
                                </span>
                            ) : (
                                <>{program.total_weeks} weeks</>
                            )}
                        </p>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant={editMode ? 'default' : 'ghost'}
                            size="sm"
                            className="h-8 text-xs gap-1"
                            onClick={() => setEditMode(!editMode)}
                        >
                            <Pencil className="h-3 w-3" />
                            {editMode ? 'Done' : 'Edit'}
                        </Button>
                        {editMode && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-destructive hover:text-destructive gap-1"
                                onClick={() => setConfirmDelete('program')}
                            >
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                </div>

                <AnimatePresence>
                    {confirmDelete === 'program' && (
                        <ConfirmDelete
                            label="this entire program"
                            onConfirm={handleDeleteProgram}
                            onCancel={() => setConfirmDelete(null)}
                        />
                    )}
                </AnimatePresence>
            </div>

            {/* Phases */}
            <div className="space-y-3">
                {programPhases
                    .sort((a, b) => a.order - b.order)
                    .map(phase => {
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
                            <div className="flex items-center gap-1">
                                <button
                                    className="flex-1 flex items-center gap-3 p-4 text-left hover:bg-muted/20 active:bg-muted/20 transition-colors"
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
                                            Weeks {phase.week_start}-{phase.week_end}
                                            {phase.rir_guidance && <> &middot; {phase.rir_guidance}</>}
                                        </p>
                                    </div>
                                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                </button>
                                {editMode && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 mr-2 text-destructive hover:text-destructive shrink-0"
                                        onClick={() => setConfirmDelete(`phase-${phase.id}`)}
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                )}
                            </div>

                            <AnimatePresence>
                                {confirmDelete === `phase-${phase.id}` && (
                                    <div className="px-3 pb-2">
                                        <ConfirmDelete
                                            label={phase.name}
                                            onConfirm={async () => { await deletePhase(phase.id); setConfirmDelete(null); }}
                                            onCancel={() => setConfirmDelete(null)}
                                        />
                                    </div>
                                )}
                            </AnimatePresence>

                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ height: 0 }}
                                        animate={{ height: 'auto' }}
                                        exit={{ height: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="border-t border-border/50 px-3 py-2 space-y-1">
                                            {/* Phase editing */}
                                            {editMode && (
                                                <div className="space-y-2 p-2 bg-muted/20 rounded-lg mb-2">
                                                    <div className="flex gap-2">
                                                        <div className="flex-1">
                                                            <label className="text-[10px] text-muted-foreground">Name</label>
                                                            <InlineEdit
                                                                value={phase.name}
                                                                onSave={name => updatePhase(phase.id, { name })}
                                                                className="text-sm font-medium"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <div>
                                                            <label className="text-[10px] text-muted-foreground">Week Start</label>
                                                            <Input
                                                                type="number"
                                                                value={phase.week_start}
                                                                onChange={e => updatePhase(phase.id, { week_start: parseInt(e.target.value) || 1 })}
                                                                className="h-7 w-16 text-xs"
                                                                min={1}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] text-muted-foreground">Week End</label>
                                                            <Input
                                                                type="number"
                                                                value={phase.week_end}
                                                                onChange={e => updatePhase(phase.id, { week_end: parseInt(e.target.value) || 1 })}
                                                                className="h-7 w-16 text-xs"
                                                                min={phase.week_start}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] text-muted-foreground">RIR Guidance</label>
                                                        <InlineEdit
                                                            value={phase.rir_guidance || ''}
                                                            onSave={rir_guidance => updatePhase(phase.id, { rir_guidance })}
                                                            className="text-xs"
                                                            placeholder="e.g. Leave 2-3 reps in reserve"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] text-muted-foreground">Description</label>
                                                        <InlineEdit
                                                            value={phase.description || ''}
                                                            onSave={description => updatePhase(phase.id, { description })}
                                                            className="text-xs"
                                                            placeholder="Phase description"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {!editMode && phase.description && (
                                                <p className="text-xs text-muted-foreground p-2">{phase.description}</p>
                                            )}

                                            {/* Days */}
                                            {phaseDays.map(day => {
                                                const isDayExpanded = expandedDay === day.id;
                                                const dayExercises = programExercises
                                                    .filter(e => e.program_day_id === day.id)
                                                    .sort((a, b) => a.order - b.order);

                                                return (
                                                    <div key={day.id}>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                className="flex-1 flex items-center gap-2 p-2.5 rounded-lg hover:bg-muted/30 active:bg-muted/30 transition-colors text-left"
                                                                onClick={() => setExpandedDay(isDayExpanded ? null : day.id)}
                                                            >
                                                                {editMode ? (
                                                                    <select
                                                                        value={day.day_of_week}
                                                                        onChange={e => { e.stopPropagation(); updateDay(day.id, { day_of_week: parseInt(e.target.value) }); }}
                                                                        onClick={e => e.stopPropagation()}
                                                                        className="text-[10px] text-muted-foreground w-10 shrink-0 bg-transparent border-none cursor-pointer"
                                                                    >
                                                                        {DAY_OPTIONS.map(opt => (
                                                                            <option key={opt.value} value={opt.value}>{opt.label.slice(0, 3)}</option>
                                                                        ))}
                                                                    </select>
                                                                ) : (
                                                                    <span className="text-[10px] text-muted-foreground w-8 shrink-0">
                                                                        {DAY_NAMES[day.day_of_week]?.slice(0, 3)}
                                                                    </span>
                                                                )}
                                                                <span className="text-sm font-medium flex-1">{day.name}</span>
                                                                {isDayExpanded
                                                                    ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                                                    : <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                                                }
                                                            </button>
                                                            {editMode && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                                                                    onClick={() => setConfirmDelete(`day-${day.id}`)}
                                                                >
                                                                    <X className="h-3 w-3" />
                                                                </Button>
                                                            )}
                                                        </div>

                                                        <AnimatePresence>
                                                            {confirmDelete === `day-${day.id}` && (
                                                                <div className="ml-10 mb-1">
                                                                    <ConfirmDelete
                                                                        label={day.name}
                                                                        onConfirm={async () => { await deleteDay(day.id); setConfirmDelete(null); }}
                                                                        onCancel={() => setConfirmDelete(null)}
                                                                    />
                                                                </div>
                                                            )}
                                                        </AnimatePresence>

                                                        <AnimatePresence>
                                                            {isDayExpanded && (
                                                                <motion.div
                                                                    initial={{ height: 0, opacity: 0 }}
                                                                    animate={{ height: 'auto', opacity: 1 }}
                                                                    exit={{ height: 0, opacity: 0 }}
                                                                    className="overflow-hidden"
                                                                >
                                                                    <div className="ml-10 pb-2 space-y-1">
                                                                        {/* Day inline editing */}
                                                                        {editMode && (
                                                                            <div className="flex gap-2 mb-2 p-2 bg-muted/20 rounded-lg">
                                                                                <div className="flex-1">
                                                                                    <label className="text-[10px] text-muted-foreground">Name</label>
                                                                                    <InlineEdit
                                                                                        value={day.name}
                                                                                        onSave={name => updateDay(day.id, { name })}
                                                                                        className="text-sm font-medium"
                                                                                    />
                                                                                </div>
                                                                                <div className="flex-1">
                                                                                    <label className="text-[10px] text-muted-foreground">Focus</label>
                                                                                    <InlineEdit
                                                                                        value={day.focus || ''}
                                                                                        onSave={focus => updateDay(day.id, { focus })}
                                                                                        className="text-xs text-muted-foreground"
                                                                                        placeholder="e.g. Chest, Shoulders"
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {/* Exercises */}
                                                                        {dayExercises.map((ex, exIdx) => (
                                                                            <div key={ex.id} className="group">
                                                                                {editMode ? (
                                                                                    <div className="flex items-center gap-1 py-1">
                                                                                        <div className="flex flex-col gap-0.5">
                                                                                            <button
                                                                                                className="h-3 text-muted-foreground hover:text-foreground disabled:opacity-20"
                                                                                                disabled={exIdx === 0}
                                                                                                onClick={() => moveExercise(ex, 'up')}
                                                                                            >
                                                                                                <ArrowUp className="h-3 w-3" />
                                                                                            </button>
                                                                                            <button
                                                                                                className="h-3 text-muted-foreground hover:text-foreground disabled:opacity-20"
                                                                                                disabled={exIdx === dayExercises.length - 1}
                                                                                                onClick={() => moveExercise(ex, 'down')}
                                                                                            >
                                                                                                <ArrowDown className="h-3 w-3" />
                                                                                            </button>
                                                                                        </div>
                                                                                        <div className="flex-1 min-w-0">
                                                                                            <InlineEdit
                                                                                                value={ex.display_name}
                                                                                                onSave={display_name => updateExercise(ex.id, { display_name })}
                                                                                                className="text-xs"
                                                                                            />
                                                                                        </div>
                                                                                        <div className="flex items-center gap-1 shrink-0">
                                                                                            <Input
                                                                                                value={ex.prescribed_sets}
                                                                                                onChange={e => updateExercise(ex.id, { prescribed_sets: e.target.value })}
                                                                                                className="h-6 w-10 text-[10px] text-center px-1"
                                                                                                placeholder="Sets"
                                                                                            />
                                                                                            <span className="text-[10px] text-muted-foreground">&times;</span>
                                                                                            <Input
                                                                                                value={ex.prescribed_reps}
                                                                                                onChange={e => updateExercise(ex.id, { prescribed_reps: e.target.value })}
                                                                                                className="h-6 w-14 text-[10px] text-center px-1"
                                                                                                placeholder="Reps"
                                                                                            />
                                                                                            <select
                                                                                                value={ex.type}
                                                                                                onChange={e => updateExercise(ex.id, { type: e.target.value, is_loggable: e.target.value === 'strength' || e.target.value === 'conditioning' })}
                                                                                                className="h-6 text-[10px] bg-background border border-border rounded px-1"
                                                                                            >
                                                                                                {EXERCISE_TYPES.map(t => (
                                                                                                    <option key={t} value={t}>{t}</option>
                                                                                                ))}
                                                                                            </select>
                                                                                            <Button
                                                                                                variant="ghost"
                                                                                                size="icon"
                                                                                                className="h-6 w-6 text-destructive hover:text-destructive"
                                                                                                onClick={() => deleteExercise(ex.id)}
                                                                                            >
                                                                                                <X className="h-3 w-3" />
                                                                                            </Button>
                                                                                        </div>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="flex items-baseline gap-2 py-1">
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
                                                                                )}
                                                                            </div>
                                                                        ))}

                                                                        {/* Add exercise */}
                                                                        {editMode && addingExercise === day.id && (
                                                                            <motion.div
                                                                                initial={{ height: 0, opacity: 0 }}
                                                                                animate={{ height: 'auto', opacity: 1 }}
                                                                                className="border border-dashed border-border rounded-lg p-2 space-y-2"
                                                                            >
                                                                                <Input
                                                                                    value={newExName}
                                                                                    onChange={e => setNewExName(e.target.value)}
                                                                                    placeholder="Exercise name"
                                                                                    className="h-7 text-xs"
                                                                                    autoFocus
                                                                                />
                                                                                <div className="flex gap-2">
                                                                                    <Input
                                                                                        value={newExSets}
                                                                                        onChange={e => setNewExSets(e.target.value)}
                                                                                        placeholder="Sets"
                                                                                        className="h-7 w-16 text-xs"
                                                                                    />
                                                                                    <Input
                                                                                        value={newExReps}
                                                                                        onChange={e => setNewExReps(e.target.value)}
                                                                                        placeholder="Reps"
                                                                                        className="h-7 w-20 text-xs"
                                                                                    />
                                                                                    <select
                                                                                        value={newExType}
                                                                                        onChange={e => setNewExType(e.target.value)}
                                                                                        className="h-7 text-xs bg-background border border-border rounded px-1 flex-1"
                                                                                    >
                                                                                        {EXERCISE_TYPES.map(t => (
                                                                                            <option key={t} value={t}>{t}</option>
                                                                                        ))}
                                                                                    </select>
                                                                                </div>
                                                                                <div className="flex gap-2">
                                                                                    <Button size="sm" className="h-7 text-xs flex-1" onClick={() => handleAddExercise(day.id)}>Add</Button>
                                                                                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAddingExercise(null)}>Cancel</Button>
                                                                                </div>
                                                                            </motion.div>
                                                                        )}

                                                                        {editMode && addingExercise !== day.id && (
                                                                            <button
                                                                                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors py-1"
                                                                                onClick={() => { setAddingExercise(day.id); setNewExName(''); setNewExSets('3'); setNewExReps('8-12'); setNewExType('strength'); }}
                                                                            >
                                                                                <Plus className="h-3 w-3" /> Add Exercise
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                );
                                            })}

                                            {/* Add day */}
                                            {editMode && addingDay === phase.id && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    className="border border-dashed border-border rounded-lg p-3 space-y-2 mx-2 my-1"
                                                >
                                                    <p className="text-xs font-medium">Add Training Day</p>
                                                    <div className="flex gap-2">
                                                        <select
                                                            value={newDayOfWeek}
                                                            onChange={e => setNewDayOfWeek(parseInt(e.target.value))}
                                                            className="h-7 text-xs bg-background border border-border rounded px-2"
                                                        >
                                                            {DAY_OPTIONS.map(opt => (
                                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                            ))}
                                                        </select>
                                                        <Input
                                                            value={newDayName}
                                                            onChange={e => setNewDayName(e.target.value)}
                                                            placeholder="Day name"
                                                            className="h-7 text-xs flex-1"
                                                            autoFocus
                                                        />
                                                    </div>
                                                    <Input
                                                        value={newDayFocus}
                                                        onChange={e => setNewDayFocus(e.target.value)}
                                                        placeholder="Focus (e.g. Chest, Shoulders)"
                                                        className="h-7 text-xs"
                                                    />
                                                    <div className="flex gap-2">
                                                        <Button size="sm" className="h-7 text-xs flex-1" onClick={() => handleAddDay(phase.id)}>Add Day</Button>
                                                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAddingDay(null)}>Cancel</Button>
                                                    </div>
                                                </motion.div>
                                            )}

                                            {editMode && addingDay !== phase.id && (
                                                <button
                                                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors py-2 px-2"
                                                    onClick={() => { setAddingDay(phase.id); setNewDayName(''); setNewDayFocus(''); setNewDayOfWeek(1); }}
                                                >
                                                    <Plus className="h-3 w-3" /> Add Training Day
                                                </button>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}

                {/* Add phase */}
                {editMode && addingPhase && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="border border-dashed border-border rounded-xl p-4 space-y-3"
                    >
                        <p className="text-sm font-semibold">Add Phase</p>
                        <Input
                            value={newPhaseName}
                            onChange={e => setNewPhaseName(e.target.value)}
                            placeholder="Phase name (e.g. Hypertrophy)"
                            className="h-8 text-sm"
                            autoFocus
                        />
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="text-[10px] text-muted-foreground">Week Start</label>
                                <Input
                                    type="number"
                                    value={newPhaseWeekStart}
                                    onChange={e => setNewPhaseWeekStart(parseInt(e.target.value) || 1)}
                                    className="h-7 text-xs"
                                    min={1}
                                />
                            </div>
                            <div className="flex-1">
                                <label className="text-[10px] text-muted-foreground">Week End</label>
                                <Input
                                    type="number"
                                    value={newPhaseWeekEnd}
                                    onChange={e => setNewPhaseWeekEnd(parseInt(e.target.value) || 1)}
                                    className="h-7 text-xs"
                                    min={newPhaseWeekStart}
                                />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button size="sm" className="flex-1 h-8 text-xs" onClick={handleAddPhase}>Add Phase</Button>
                            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setAddingPhase(false)}>Cancel</Button>
                        </div>
                    </motion.div>
                )}

                {editMode && !addingPhase && (
                    <button
                        className="w-full flex items-center justify-center gap-2 border border-dashed border-border rounded-xl p-3 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
                        onClick={() => {
                            const lastPhase = programPhases[programPhases.length - 1];
                            setNewPhaseWeekStart(lastPhase ? lastPhase.week_end + 1 : 1);
                            setNewPhaseWeekEnd(lastPhase ? lastPhase.week_end + 4 : 4);
                            setNewPhaseName('');
                            setAddingPhase(true);
                        }}
                    >
                        <Plus className="h-3.5 w-3.5" /> Add Phase
                    </button>
                )}
            </div>
        </div>
    );
}
