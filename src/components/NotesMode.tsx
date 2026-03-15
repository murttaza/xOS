import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store';
import { Subject, Note } from '../types';
import { Book, X, Plus, Search, Trash2, Edit2, MoreVertical, Calendar, Check, Pipette } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn } from '../lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { ModeToggle } from './ModeToggle';
import { WindowControls } from './WindowControls';
import { Loader2 } from 'lucide-react';

// --- Types & Utilities ---

const COLORS = [
    '#ef4444', // Red
    '#dc2626', // Darker Red
    '#b91c1c', // Even Darker Red
    '#f87171', // Light Red
    '#991b1b', // Deep Red
    '#7f1d1d', // Very Deep Red
    '#fbbf24', // Amber (Accent)
    '#1f2937', // Gray (Dark)
];

const getRandomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];

// --- Components ---

const BookSpine = React.memo(({
    subject,
    onClick,
    isPlaceholder
}: {
    subject?: Subject;
    onClick: () => void;
    isPlaceholder?: boolean;
}) => {
    if (isPlaceholder) {
        return (
            <div
                onClick={onClick}
                className="group relative h-64 w-10 sm:w-12 cursor-pointer transition-colors duration-150 no-drag border border-transparent rounded-sm opacity-20 hover:opacity-50"
            >
                <div className="absolute inset-0 rounded-sm border border-border bg-transparent group-hover:bg-muted transition-colors flex items-center justify-center">
                    <Plus className="text-muted-foreground w-4 h-4" />
                </div>
            </div>
        )
    }

    if (!subject) return null;

    return (
        <div className="group relative h-64 w-10 sm:w-12 no-drag transition-transform duration-150 hover:-translate-y-1">
            {/* Flat Spine container */}
            <div
                className={cn(
                    "absolute inset-0 rounded-sm border border-border group-hover:border-foreground/20 transition-colors overflow-hidden cursor-pointer z-10",
                    "bg-white shadow-sm dark:bg-[#121212] dark:shadow-none"
                )}
                onClick={onClick}
            >
                {/* Minimal Accent Lines */}
                <div className="absolute top-6 left-1/2 -translate-x-1/2 w-[1px] h-8 opacity-70" style={{ backgroundColor: subject.color }} />
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[1px] h-8 opacity-70" style={{ backgroundColor: subject.color }} />

                {/* Title (Sideways) */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <h3
                        className={cn(
                            "w-60 shrink-0 text-center font-medium tracking-widest uppercase text-[10px] sm:text-xs whitespace-nowrap overflow-hidden text-ellipsis px-12 select-none rotate-90 origin-center transition-colors",
                            "text-neutral-400 group-hover:text-neutral-900 dark:text-neutral-500 dark:group-hover:text-neutral-200"
                        )}
                    >
                        {subject.title}
                    </h3>
                </div>
            </div>
        </div>
    );
});
BookSpine.displayName = 'BookSpine';

const BookView = ({ subject, onClose }: { subject: Subject; onClose: () => void }) => {
    const notes = useStore(s => s.notes);
    const fetchNotes = useStore(s => s.fetchNotes);
    const createNote = useStore(s => s.createNote);
    const updateNote = useStore(s => s.updateNote);
    const deleteNote = useStore(s => s.deleteNote);
    const deleteSubject = useStore(s => s.deleteSubject);
    const updateSubject = useStore(s => s.updateSubject);
    const targetNoteId = useStore(s => s.targetNoteId);

    const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
    const [editingNote, setEditingNote] = useState<Partial<Note>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Edit Mode State
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(subject.title);
    const [editColor, setEditColor] = useState(subject.color);

    useEffect(() => {
        if (subject.id) fetchNotes(subject.id);
    }, [subject.id, fetchNotes]);

    // Auto-select note if targetNoteId is present
    useEffect(() => {
        if (targetNoteId && notes.some(n => n.id === targetNoteId)) {
            setSelectedNoteId(targetNoteId);
        }
    }, [targetNoteId, notes]);

    const activeNote = useMemo(() => notes.find(n => n.id === selectedNoteId), [notes, selectedNoteId]);

    const handleSaveChanges = async () => {
        if (!editTitle.trim()) return;
        await updateSubject({
            ...subject,
            title: editTitle,
            color: editColor
        });
        setIsEditing(false);
    };

    const handleCreateNote = async () => {
        if (!subject.id) return;
        try {
            const newTitle = 'Untitled Note';
            const newContent = '';
            const newId = await createNote({
                subjectId: subject.id,
                title: newTitle,
                content: newContent,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            if (newId) {
                setSelectedNoteId(newId);
                setEditingNote({ title: newTitle, content: newContent });
            }
        } catch (e) {
            console.error(e);
        }
    };

    const activeStateRef = React.useRef({ activeNote, editingNote });
    useEffect(() => {
        activeStateRef.current = { activeNote, editingNote };
    }, [activeNote, editingNote]);

    const savePendingChanges = React.useCallback(() => {
        const currentActive = activeStateRef.current.activeNote;
        const currentEditing = activeStateRef.current.editingNote;
        if (currentActive) {
            const hasChanges = (currentEditing.title !== undefined && currentEditing.title !== currentActive.title) ||
                (currentEditing.content !== undefined && currentEditing.content !== currentActive.content);
            if (hasChanges) {
                updateNote({
                    ...currentActive,
                    ...currentEditing,
                    updatedAt: new Date().toISOString()
                });
            }
        }
    }, [updateNote]);

    // Cleanup save on unmount
    useEffect(() => {
        return () => {
            savePendingChanges();
        };
    }, [savePendingChanges]);

    // Debounced Save Effect
    useEffect(() => {
        if (!activeNote || !selectedNoteId) return;

        const hasChanges = (editingNote.title !== undefined && editingNote.title !== activeNote.title) ||
            (editingNote.content !== undefined && editingNote.content !== activeNote.content);

        if (!hasChanges) {
            return;
        }

        setIsSaving(true);
        const timer = setTimeout(async () => {
            await updateNote({
                ...activeNote,
                ...editingNote,
                updatedAt: new Date().toISOString()
            });
            setIsSaving(false);
        }, 1000);

        return () => clearTimeout(timer);
    }, [editingNote, activeNote, selectedNoteId, updateNote]);

    const handleDeleteNote = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this note?')) {
            await deleteNote(id);
            if (selectedNoteId === id) setSelectedNoteId(null);
        }
    };

    const handleDeleteSubject = async () => {
        if (confirm(`Delete entire notebook "${subject.title}" and all its notes?`)) {
            if (subject.id) await deleteSubject(subject.id);
            onClose();
        }
    }

    const filteredNotes = useMemo(() => notes.filter(n =>
        (n.title?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (n.content?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    ), [notes, searchTerm]);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-12 drag"
            onClick={onClose}
        >
            <div
                className="pointer-events-auto bg-background dark:bg-[#1a1a1a] w-full max-w-6xl h-full max-h-[800px] rounded-r-2xl rounded-l-md shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col md:flex-row overflow-hidden border border-border dark:border-white/5 relative no-drag"
                onClick={(e) => e.stopPropagation()}
            >

                {/* Cover / Sidebar Area */}
                <div className="w-full md:w-80 bg-muted/30 dark:bg-neutral-900 border-r border-border dark:border-white/5 flex flex-col h-full relative no-drag">
                    <div className="absolute left-0 top-0 bottom-0 w-2" style={{ backgroundColor: subject.color }} />

                    <div className="p-6 pl-8 border-b border-border dark:border-white/5 flex justify-between items-start">
                        <div>
                            <h2 className="text-xl font-bold text-foreground dark:text-white break-words">{subject.title}</h2>
                            <p className="text-xs text-muted-foreground mt-1">{notes.length} Notes</p>
                        </div>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6"><MoreVertical className="h-4 w-4" /></Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 p-1 z-[100]">
                                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setIsEditing(true)}>
                                    <Edit2 className="h-4 w-4 mr-2" /> Edit Book
                                </Button>
                                <Button variant="ghost" size="sm" className="w-full justify-start text-red-400 hover:text-red-400 hover:bg-red-950/20" onClick={handleDeleteSubject}>
                                    <Trash2 className="h-4 w-4 mr-2" /> Delete Book
                                </Button>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="p-4 pl-8">
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search notes..."
                                className="pl-8 bg-background/50 dark:bg-black/20 border-border dark:border-white/10 text-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto pl-6 pr-2 py-0 custom-scrollbar">
                        {filteredNotes.map(note => (
                            <div
                                key={note.id}
                                onClick={() => {
                                    savePendingChanges();
                                    setSelectedNoteId(note.id || null);
                                    setEditingNote({});
                                }}
                                className={cn(
                                    "mb-2 p-3 rounded-lg cursor-pointer transition-all border border-transparent group hover:border-border dark:hover:border-white/5",
                                    selectedNoteId === note.id ? "bg-accent" : "hover:bg-muted/50 dark:hover:bg-white/5"
                                )}
                            >
                                <div className="flex justify-between items-start">
                                    <h4 className={cn("font-medium text-sm truncate pr-2", selectedNoteId === note.id ? "text-accent-foreground" : "text-foreground dark:text-neutral-300")}>
                                        {note.title || 'Untitled'}
                                    </h4>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity -mt-1 -mr-1 text-muted-foreground hover:text-red-400"
                                        onClick={(e) => handleDeleteNote(e, note.id!)}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                                <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                                    {note.content?.substring(0, 100) || "No content..."}
                                </p>
                                <div className="text-[10px] text-neutral-600 mt-2 flex items-center gap-1">
                                    <Calendar className="h-2.5 w-2.5" />
                                    {format(new Date(note.updatedAt), 'MMM d, h:mm a')}
                                </div>
                            </div>
                        ))}

                        {filteredNotes.length === 0 && (
                            <div className="text-center py-10 text-muted-foreground text-sm">
                                {searchTerm ? 'No matches' : 'No notes yet'}
                            </div>
                        )}
                    </div>

                    <div className="p-4 pl-8 border-t border-border dark:border-white/5">
                        <Button className="w-full bg-primary/10 hover:bg-primary/20 text-primary" onClick={handleCreateNote}>
                            <Plus className="h-4 w-4 mr-2" /> New Note
                        </Button>
                    </div>
                </div>

                {/* Note Editor Area */}
                <div className="flex-1 bg-background/50 dark:bg-neutral-900/50 backdrop-blur-sm flex flex-col relative no-drag">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-4 right-4 z-10 text-muted-foreground hover:text-foreground"
                        onClick={onClose}
                    >
                        <X className="h-6 w-6" />
                    </Button>

                    {activeNote ? (
                        <div className="flex flex-col h-full p-8 md:p-12 animate-in fade-in duration-150">
                            <input
                                className="bg-transparent text-3xl md:text-4xl font-bold text-foreground dark:text-white mb-6 border-none outline-none placeholder:text-muted-foreground"
                                value={editingNote.title !== undefined ? editingNote.title : activeNote.title}
                                onChange={(e) => {
                                    setEditingNote(prev => ({ ...prev, title: e.target.value }));
                                }}
                                placeholder="Note Title"
                            />

                            <textarea
                                className="flex-1 bg-transparent text-foreground dark:text-neutral-300 text-lg resize-none border-none outline-none placeholder:text-muted-foreground leading-relaxed custom-scrollbar selection:bg-red-500/30"
                                value={editingNote.content !== undefined ? editingNote.content : activeNote.content}
                                onChange={(e) => setEditingNote(prev => ({ ...prev, content: e.target.value }))}
                                placeholder="Start writing..."
                                spellCheck={false}
                            />

                            <div className="text-xs text-muted-foreground mt-4 flex justify-between items-center h-6">
                                <span>Last edited {format(new Date(activeNote.updatedAt), 'MMMM d, yyyy h:mm a')}</span>
                                {isSaving ? (
                                    <span className="text-yellow-500 flex items-center gap-2">
                                        <Loader2 className="h-3 w-3 animate-spin" /> Saving...
                                    </span>
                                ) : (
                                    <span className="text-green-500 opacity-0 transition-opacity duration-150" style={{ opacity: Object.keys(editingNote).length > 0 ? 0 : 1 }}>
                                        Saved
                                    </span>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-neutral-600 space-y-4">
                            <Book className="h-16 w-16 opacity-20" />
                            <p>Select a note or create a new one</p>
                        </div>
                    )}
                </div>

                {/* Edit Subject Overlay */}
                {isEditing && (
                    <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8 no-drag">
                        <div className="bg-background dark:bg-neutral-900 border border-border dark:border-white/10 p-8 rounded-2xl w-full max-w-md shadow-2xl space-y-6 animate-in zoom-in-95 duration-150">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <Edit2 className="h-5 w-5 text-red-500" /> Edit Book Details
                            </h3>

                            <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Book Title</label>
                                <Input
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    className="bg-secondary/50 dark:bg-black/40 border-border dark:border-white/10 text-lg font-bold"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Spine Color</label>
                                <div className="grid grid-cols-8 gap-2">
                                    {COLORS.map((c) => (
                                        <button
                                            key={c}
                                            onClick={() => setEditColor(c)}
                                            className={cn(
                                                "w-8 h-8 rounded-full border-2 transition-all hover:scale-110",
                                                editColor === c ? "border-foreground dark:border-white shadow-sm scale-110" : "border-transparent opacity-70 hover:opacity-100"
                                            )}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                    <div className="relative w-8 h-8 rounded-full overflow-hidden border border-border dark:border-white/20 hover:border-foreground dark:hover:border-white transition-colors group/picker">
                                        <input
                                            type="color"
                                            value={editColor}
                                            onChange={(e) => setEditColor(e.target.value)}
                                            className="absolute inset-0 w-[150%] h-[150%] -top-[25%] -left-[25%] cursor-pointer p-0 border-0 opacity-0"
                                        />
                                        <div
                                            className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover/picker:scale-110 transition-transform"
                                            style={{ backgroundColor: editColor }}
                                        >
                                            <Pipette className="h-4 w-4 text-white mix-blend-difference" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                                <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
                                <Button onClick={handleSaveChanges} className="bg-red-600 hover:bg-red-500 text-white">
                                    <Check className="h-4 w-4 mr-2" /> Save Changes
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

export const NotesMode = () => {
    const isNotesMode = useStore(s => s.isNotesMode);
    const toggleNotesMode = useStore(s => s.toggleNotesMode);
    const subjects = useStore(s => s.subjects);
    const fetchSubjects = useStore(s => s.fetchSubjects);
    const createSubject = useStore(s => s.createSubject);
    const currentSubjectId = useStore(s => s.currentSubjectId);
    const openSubject = useStore(s => s.openSubject);
    const closeSubject = useStore(s => s.closeSubject);
    const searchNotes = useStore(s => s.searchNotes);
    const searchResults = useStore(s => s.searchResults);
    const deleteSubject = useStore(s => s.deleteSubject);
    const isMurtazaMode = useStore(s => s.isMurtazaMode);
    const osPrefix = useStore(s => s.osPrefix);

    const [globalSearch, setGlobalSearch] = useState('');
    const [isCreatingSubject, setIsCreatingSubject] = useState(false);
    const [newSubjectTitle, setNewSubjectTitle] = useState('');
    const [creatingSubjectIndex, setCreatingSubjectIndex] = useState<number>(0);
    const [currentLibraryIndex, setCurrentLibraryIndex] = useState(0);

    useEffect(() => {
        if (isNotesMode) {
            fetchSubjects();
        }
    }, [isNotesMode, fetchSubjects]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            if (globalSearch) searchNotes(globalSearch);
        }, 300);
        return () => clearTimeout(timeout);
    }, [globalSearch, searchNotes]);


    const currentSubject = useMemo(() => subjects.find(s => s.id === currentSubjectId), [subjects, currentSubjectId]);
    const TOTAL_SPINES = 300;
    const allSpines = useMemo(() => Array.from({ length: TOTAL_SPINES }), []);

    // Create a map for faster subject lookup
    const subjectMap = useMemo(() => {
        const map = new Map<number, Subject>();
        subjects.forEach(s => map.set(s.orderIndex, s));
        return map;
    }, [subjects]);




    const handleCreateSubject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSubjectTitle.trim()) return;

        const libraryOffset = currentLibraryIndex * TOTAL_SPINES;

        await createSubject({
            title: newSubjectTitle,
            color: getRandomColor(),
            orderIndex: libraryOffset + creatingSubjectIndex
        });
        setNewSubjectTitle('');
        setIsCreatingSubject(false);
    };

    const handleDeleteLibrary = async () => {
        if (confirm("Are you sure you want to delete this entire library? All books and notes within it will be lost.")) {
            const libraryOffset = currentLibraryIndex * TOTAL_SPINES;
            // Identify subjects in this library
            const subjectsToDelete = subjects.filter(s => s.orderIndex >= libraryOffset && s.orderIndex < libraryOffset + TOTAL_SPINES);

            // Delete them all
            for (const sub of subjectsToDelete) {
                if (sub.id) await deleteSubject(sub.id);
            }

            // Go back to previous library if possible or 0
            if (currentLibraryIndex > 0) {
                setCurrentLibraryIndex(prev => prev - 1);
            }
        }
    };

    // Calculate how many libraries we effectively have data for
    const maxOrderIndex = subjects.length > 0 ? Math.max(...subjects.map(s => s.orderIndex)) : 0;
    const dataLibrariesCount = Math.floor(maxOrderIndex / TOTAL_SPINES) + 1;
    // The total tabs to show is the max of (libraries with data) AND (current library being viewed, e.g. if we just clicked 'New Library')
    const visibleLibrariesCount = Math.max(dataLibrariesCount, currentLibraryIndex + 1);

    return (
        <AnimatePresence>
            {isNotesMode && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={cn(
                        "fixed inset-0 z-[55] text-foreground overflow-hidden flex flex-col font-sans no-drag",
                        isMurtazaMode ? "bg-transparent backdrop-blur-3xl" : "bg-background/95"
                    )}
                >
                    {!isMurtazaMode && (
                        <div className="absolute inset-0 -z-10 pointer-events-none">
                            <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background/95" />
                            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 dark:bg-primary/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/4" />
                            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/5 dark:bg-accent/10 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/4" />
                        </div>
                    )}
                    {/* Top Bar - Drag Area */}
                    <div className="px-6 pt-4 pb-2 bg-transparent z-20">
                        <header className={cn(
                            "rounded-2xl px-6 py-4 flex justify-between items-center backdrop-blur-xl drag relative transition-all",
                            isMurtazaMode ? 'bg-background/90 border border-white/10 shadow-lg shadow-black/10' : 'glass'
                        )}>
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <motion.h1
                                    className="text-2xl font-bold tracking-tight text-primary transition-all duration-150 hover:drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)] cursor-pointer no-drag flex items-baseline gap-2 shrink-0"
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={toggleNotesMode}
                                >
                                    <span>{isMurtazaMode ? "مُرتضیٰ" : `${osPrefix}OS`}</span>
                                    <span className="text-xs font-mono text-muted-foreground opacity-50 flex items-center gap-1.5 ml-1">
                                        <Book className="h-3 w-3" /> Notes
                                    </span>
                                </motion.h1>
                            </div>

                            {/* Center Capsule - Search (Mirroring Prayer Capsule layout style) */}
                            <div className="flex-[2] flex justify-center w-full max-w-md mx-4 no-drag">
                                <div className="relative w-full bg-secondary/50 rounded-full border border-border/50 backdrop-blur-xl shadow-lg shadow-black/5 flex items-center px-4 py-1.5 transition-all">
                                    <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
                                    <Input
                                        className="w-full bg-transparent border-none shadow-none h-7 px-0 text-sm text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground"
                                        placeholder="Search across all notebooks..."
                                        value={globalSearch}
                                        onChange={(e) => setGlobalSearch(e.target.value)}
                                    />
                                    {/* Search Results Dropdown */}
                                    {globalSearch && searchResults.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-3 bg-popover border border-border rounded-2xl shadow-2xl p-2 max-h-96 overflow-y-auto z-50">
                                            {searchResults.map(note => (
                                                <div
                                                    key={note.id}
                                                    className="p-3 hover:bg-accent rounded-xl cursor-pointer flex flex-col gap-1 border-b border-border/50 last:border-0 transition-colors"
                                                    onClick={() => {
                                                        openSubject(note.subjectId, note.id);
                                                        setGlobalSearch('');
                                                    }}
                                                >
                                                    <div className="flex justify-between">
                                                        <span className="font-medium text-red-500 text-[10px] uppercase tracking-wider">{note.subjectTitle}</span>
                                                        <span className="text-[10px] text-muted-foreground font-medium">{format(new Date(note.updatedAt), 'MMM d')}</span>
                                                    </div>
                                                    <div className="font-bold text-sm text-foreground">{note.title}</div>
                                                    <div className="text-xs text-muted-foreground line-clamp-1">{note.content}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-4 no-drag justify-end flex-1 min-w-0">
                                <ModeToggle />
                                <WindowControls />
                            </div>
                        </header>
                    </div>

                    {/* Bookshelf View (Scrollable) */}
                    <div className="flex-1 overflow-y-auto p-12">

                        {isCreatingSubject && (
                            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center no-drag">
                                <form onSubmit={handleCreateSubject} className="bg-background p-8 rounded-2xl border border-red-900/20 w-full max-w-md space-y-4 shadow-2xl">
                                    <h3 className="text-xl font-bold">New Subject</h3>
                                    <Input
                                        autoFocus
                                        placeholder="Subject Name (e.g., Project Alpha)"
                                        value={newSubjectTitle}
                                        onChange={(e) => setNewSubjectTitle(e.target.value)}
                                        className="bg-secondary/50 border-input"
                                    />
                                    <div className="flex justify-end gap-2">
                                        <Button type="button" variant="ghost" onClick={() => setIsCreatingSubject(false)}>Cancel</Button>
                                        <Button type="submit" variant="destructive">Create Book</Button>
                                    </div>
                                </form>
                            </div>
                        )}

                        <div className="grid grid-cols-[repeat(auto-fill,minmax(60px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-x-2 gap-y-12 items-end justify-items-center pb-20 no-drag">
                            {allSpines.map((_, index) => {
                                const libraryOffset = currentLibraryIndex * TOTAL_SPINES;
                                const subject = subjectMap.get(libraryOffset + index);

                                if (subject) {
                                    return (
                                        <BookSpine
                                            key={subject.id}
                                            subject={subject}
                                            onClick={() => openSubject(subject.id!)}
                                        />
                                    );
                                } else {
                                    return (
                                        <BookSpine
                                            key={`placeholder-${index}`}
                                            isPlaceholder
                                            onClick={() => {
                                                setCreatingSubjectIndex(index);
                                                setIsCreatingSubject(true);
                                            }}
                                        />
                                    );
                                }
                            })}

                            {/* New Library Option - Switch to next library view */}
                            <div className="h-64 w-10 sm:w-12 flex flex-col items-center justify-end">
                                <button
                                    className="group flex flex-col items-center gap-2 opacity-50 hover:opacity-100 transition-opacity"
                                    onClick={() => setCurrentLibraryIndex(currentLibraryIndex + 1)}
                                >
                                    <div className="w-8 h-8 rounded-full bg-muted dark:bg-neutral-800 border border-border dark:border-white/10 flex items-center justify-center group-hover:bg-red-500/10 dark:group-hover:bg-red-900/20 group-hover:border-red-500/50 transition-colors">
                                        <Plus className="h-4 w-4 text-neutral-400 group-hover:text-red-500" />
                                    </div>
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest writing-vertical-rl">New Library</span>
                                </button>
                            </div>
                        </div>

                        {/* Shelf Decoration */}
                        <div className="fixed inset-0 pointer-events-none -z-10 bg-[linear-gradient(rgba(0,0,0,0.05)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:100%_300px] bg-[position:0_40px]"></div>
                    </div>

                    {/* Footer Navigation for Libraries */}
                    <div className="h-12 border-t border-border/50 bg-background/50 backdrop-blur-md z-10 flex items-center justify-center gap-4 no-drag relative">
                        <div className="flex gap-2">
                            {Array.from({ length: visibleLibrariesCount }).map((_, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setCurrentLibraryIndex(idx)}
                                    className={cn(
                                        "px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-all",
                                        currentLibraryIndex === idx ? "bg-red-500 text-white" : "text-muted-foreground hover:bg-muted"
                                    )}
                                >
                                    Library {idx + 1}
                                </button>
                            ))}
                        </div>

                        {/* Delete Library Option */}
                        <div className="absolute right-8">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                                onClick={handleDeleteLibrary}
                                title="Delete Current Library"
                            >
                                <Trash2 className="h-4 w-4 mr-2" /> Delete Library
                            </Button>
                        </div>
                    </div>

                    {/* Open Book Overlay */}
                    <AnimatePresence>
                        {currentSubjectId && currentSubject && (
                            <BookView
                                subject={currentSubject}
                                onClose={closeSubject}
                            />
                        )}
                    </AnimatePresence>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
