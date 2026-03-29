import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store';
import { Subject, Note } from '../types';
import { Book, Trash2, ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn } from '../lib/utils';
import { ModeToggle } from './ModeToggle';
import { WindowControls } from './WindowControls';

import { BookShelf } from './notes/BookShelf';
import { NotesList } from './notes/NotesList';
import { NoteEditor } from './notes/NoteEditor';
import { NotesSearch } from './notes/NotesSearch';

// --- Constants ---

const COLORS = [
    '#ef4444', '#dc2626', '#b91c1c', '#f87171',
    '#991b1b', '#7f1d1d', '#fbbf24', '#1f2937',
];

const getRandomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];

const TOTAL_SPINES = 300;

// --- BookView (internal composite) ---

const BookView = ({ subject, onClose }: { subject: Subject; onClose: () => void }) => {
    const notes = useStore(s => s.notes);
    const fetchNotes = useStore(s => s.fetchNotes);
    const createNote = useStore(s => s.createNote);
    const updateNote = useStore(s => s.updateNote);
    const deleteNote = useStore(s => s.deleteNote);
    const deleteSubject = useStore(s => s.deleteSubject);
    const targetNoteId = useStore(s => s.targetNoteId);

    const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
    const [editingNote, setEditingNote] = useState<Partial<Note>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

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
                className="pointer-events-auto bg-card w-full max-w-6xl h-full max-h-[100dvh] md:max-h-[800px] rounded-none md:rounded-r-2xl md:rounded-l-md shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col md:flex-row overflow-hidden border border-border/50 relative no-drag"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Mobile close button */}
                <button
                    onClick={onClose}
                    className="md:hidden flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:text-foreground border-b border-border shrink-0"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Library
                </button>

                {/* Notes List / Sidebar */}
                <NotesList
                    subject={subject}
                    notes={notes}
                    selectedNoteId={selectedNoteId}
                    onSelectNote={(id) => {
                        setSelectedNoteId(id);
                        setEditingNote({});
                    }}
                    onCreateNote={handleCreateNote}
                    onDeleteNote={handleDeleteNote}
                    onDeleteSubject={handleDeleteSubject}
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    savePendingChanges={savePendingChanges}
                />

                {/* Note Editor Area */}
                <div className="flex-1 flex flex-col min-h-0">
                    {/* Mobile back to notes list */}
                    {selectedNoteId && (
                        <button
                            onClick={() => setSelectedNoteId(null)}
                            className="md:hidden flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground border-b border-border shrink-0"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back to Notes
                        </button>
                    )}
                    <NoteEditor
                        activeNote={activeNote}
                        editingNote={editingNote}
                        isSaving={isSaving}
                        onEditingNoteChange={setEditingNote}
                        onClose={onClose}
                    />
                </div>
            </div>
        </motion.div>
    );
};

// --- Main NotesMode Component ---

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

    const handleSearchResultClick = (subjectId: number, noteId: number | undefined) => {
        openSubject(subjectId, noteId);
        setGlobalSearch('');
    };

    // Calculate how many libraries we effectively have data for
    const maxOrderIndex = subjects.length > 0 ? Math.max(...subjects.map(s => s.orderIndex)) : 0;
    const dataLibrariesCount = Math.floor(maxOrderIndex / TOTAL_SPINES) + 1;
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
                        "bg-background"
                    )}
                >
                    <div className="absolute inset-0 -z-10 pointer-events-none">
                        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background/95" />
                        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 dark:bg-primary/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/4" />
                        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/5 dark:bg-accent/10 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/4" />
                    </div>
                    {/* Top Bar - Drag Area */}
                    <div className="px-3 sm:px-6 pt-3 sm:pt-4 pb-1 sm:pb-2 bg-transparent z-20">
                        <header className={cn(
                            "rounded-2xl px-3 sm:px-6 py-3 sm:py-4 flex justify-between items-center backdrop-blur-md drag relative transition-all",
                            isMurtazaMode ? 'bg-background/90 border border-border shadow-lg shadow-black/10' : 'glass'
                        )}>
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <motion.h1
                                    className="text-2xl font-bold tracking-tight text-primary transition-all duration-150 hover:drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)] cursor-pointer no-drag flex items-baseline gap-2 shrink-0"
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={toggleNotesMode}
                                >
                                    <span>{isMurtazaMode ? "\u0645\u064F\u0631\u062A\u0636\u06CC\u0670" : `${osPrefix}OS`}</span>
                                    <span className="text-xs font-mono text-muted-foreground opacity-50 flex items-center gap-1.5 ml-1">
                                        <Book className="h-3 w-3" /> Notes
                                    </span>
                                </motion.h1>
                            </div>

                            {/* Center Capsule - Search (hidden on mobile, shown md+) */}
                            <div className="hidden md:flex flex-[2] justify-center w-full max-w-md mx-4 no-drag relative z-[60]">
                                <NotesSearch
                                    globalSearch={globalSearch}
                                    onGlobalSearchChange={setGlobalSearch}
                                    searchResults={searchResults}
                                    onResultClick={handleSearchResultClick}
                                />
                            </div>

                            <div className="flex items-center gap-4 no-drag justify-end flex-1 min-w-0">
                                <ModeToggle />
                                <WindowControls />
                            </div>
                        </header>
                    </div>

                    {/* Mobile Search (visible below md) */}
                    <div className="md:hidden px-4 pb-2 no-drag relative z-[60]">
                        <NotesSearch
                            globalSearch={globalSearch}
                            onGlobalSearchChange={setGlobalSearch}
                            searchResults={searchResults}
                            onResultClick={handleSearchResultClick}
                        />
                    </div>

                    {/* Bookshelf View (Scrollable) */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-12">

                        {isCreatingSubject && (
                            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center no-drag">
                                <form onSubmit={handleCreateSubject} className="bg-background p-8 rounded-2xl border border-border w-full max-w-md space-y-4 shadow-2xl">
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

                        <BookShelf
                            subjects={subjects}
                            currentLibraryIndex={currentLibraryIndex}
                            onOpenSubject={(id) => openSubject(id)}
                            onCreateSubjectAt={(index) => {
                                setCreatingSubjectIndex(index);
                                setIsCreatingSubject(true);
                            }}
                            onNewLibrary={() => setCurrentLibraryIndex(currentLibraryIndex + 1)}
                        />

                        {/* Shelf Decoration */}
                        <div className="fixed inset-0 pointer-events-none -z-10 bg-[linear-gradient(rgba(0,0,0,0.05)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:100%_300px] bg-[position:0_40px]"></div>
                    </div>

                    {/* Footer Navigation for Libraries */}
                    <div className="h-12 border-t border-border/50 bg-background/50 backdrop-blur-sm z-10 flex items-center justify-between px-3 sm:px-6 no-drag">
                        <div className="flex-1" />
                        <div className="flex gap-1.5 sm:gap-2">
                            {Array.from({ length: visibleLibrariesCount }).map((_, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setCurrentLibraryIndex(idx)}
                                    className={cn(
                                        "px-3 sm:px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-all",
                                        currentLibraryIndex === idx ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                                    )}
                                >
                                    Library {idx + 1}
                                </button>
                            ))}
                        </div>

                        {/* Delete Library Option */}
                        <div className="flex-1 flex justify-end">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 px-2 sm:px-3"
                                onClick={handleDeleteLibrary}
                                title="Delete Current Library"
                            >
                                <Trash2 className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Delete Library</span>
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
