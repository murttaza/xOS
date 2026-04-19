import { useState, useEffect, useMemo } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { api } from '@/api';
import { Subject, Note } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, BookOpen, ChevronRight, Library, X, FileText, Search, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const TOTAL_SPINES = 300;

interface NoteLinkPickerProps {
    selectedNoteId: number | null;
    onSelectNote: (noteId: number | null) => void;
}

type Step = 'library' | 'book' | 'note';

export function NoteLinkPicker({ selectedNoteId, onSelectNote }: NoteLinkPickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [notes, setNotes] = useState<Note[]>([]);
    const [step, setStep] = useState<Step>('library');
    const [selectedLibraryIndex, setSelectedLibraryIndex] = useState<number | null>(null);
    const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
    const [noteSearch, setNoteSearch] = useState('');
    const [bookSearch, setBookSearch] = useState('');

    const [currentNote, setCurrentNote] = useState<Note | null>(null);

    useEffect(() => {
        if (isOpen) {
            api.getSubjects()
                .then((data) => setSubjects(data || []))
                .catch((err) => {
                    console.error('Failed to load subjects for note picker:', err);
                    setSubjects([]);
                });
        }
    }, [isOpen]);

    useEffect(() => {
        let cancelled = false;
        if (selectedNoteId) {
            api.getNote(selectedNoteId)
                .then((n) => {
                    if (cancelled) return;
                    // Reflect the current backend state — if the note was
                    // deleted externally, drop the phantom chip.
                    setCurrentNote(n || null);
                })
                .catch((err) => console.error('Failed to load linked note:', err));
        } else {
            setCurrentNote(null);
        }
        return () => {
            cancelled = true;
        };
    }, [selectedNoteId]);

    const libraries = useMemo(() => {
        const idx = new Set<number>();
        subjects.forEach((s) => idx.add(Math.floor(s.orderIndex / TOTAL_SPINES)));
        // Always include Library 0 when there are no subjects at all, so the
        // user sees something; otherwise derive strictly from populated libs.
        if (idx.size === 0) idx.add(0);
        return [...idx].sort((a, b) => a - b);
    }, [subjects]);

    const librariesWithCounts = useMemo(() => {
        return libraries.map((idx) => {
            const offset = idx * TOTAL_SPINES;
            const count = subjects.filter(
                (s) => s.orderIndex >= offset && s.orderIndex < offset + TOTAL_SPINES
            ).length;
            return { idx, count };
        });
    }, [libraries, subjects]);

    const booksInLibrary = useMemo(() => {
        if (selectedLibraryIndex === null) return [];
        const offset = selectedLibraryIndex * TOTAL_SPINES;
        const list = subjects
            .filter((s) => s.orderIndex >= offset && s.orderIndex < offset + TOTAL_SPINES)
            .sort((a, b) => a.orderIndex - b.orderIndex);
        if (!bookSearch.trim()) return list;
        const q = bookSearch.toLowerCase();
        return list.filter((s) => s.title.toLowerCase().includes(q));
    }, [subjects, selectedLibraryIndex, bookSearch]);

    const selectedBook = useMemo(
        () => subjects.find((s) => s.id === selectedSubjectId) || null,
        [subjects, selectedSubjectId]
    );

    useEffect(() => {
        let cancelled = false;
        if (selectedSubjectId !== null) {
            api.getNotes(selectedSubjectId)
                .then((data) => {
                    if (!cancelled) setNotes(data || []);
                })
                .catch((err) => {
                    console.error('Failed to load notes for picker:', err);
                    if (!cancelled) setNotes([]);
                });
        } else {
            setNotes([]);
        }
        return () => {
            cancelled = true;
        };
    }, [selectedSubjectId]);

    const filteredNotes = useMemo(() => {
        if (!noteSearch.trim()) return notes;
        const q = noteSearch.toLowerCase();
        return notes.filter(
            (n) =>
                (n.title || '').toLowerCase().includes(q) ||
                (n.content || '').substring(0, 200).toLowerCase().includes(q)
        );
    }, [notes, noteSearch]);

    const reset = () => {
        setStep('library');
        setSelectedLibraryIndex(null);
        setSelectedSubjectId(null);
        setNoteSearch('');
        setBookSearch('');
    };

    const handlePickLibrary = (idx: number) => {
        setSelectedLibraryIndex(idx);
        setStep('book');
    };

    const handlePickBook = (id: number) => {
        setSelectedSubjectId(id);
        setStep('note');
    };

    const handlePickNote = (noteId: number) => {
        onSelectNote(noteId);
        setIsOpen(false);
        reset();
    };

    const handleClear = () => {
        onSelectNote(null);
        setIsOpen(false);
        reset();
    };

    const goBack = () => {
        if (step === 'note') {
            setStep('book');
            setSelectedSubjectId(null);
            setNoteSearch('');
        } else if (step === 'book') {
            setStep('library');
            setSelectedLibraryIndex(null);
            setBookSearch('');
        }
    };

    const isCoarsePointer =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(pointer: coarse)').matches;

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (!open) reset();
    };

    return (
        <>
            {currentNote ? (
                <div className="flex items-center gap-2 bg-muted/50 border border-border rounded-md h-10 sm:h-9 px-2 text-sm">
                    <div
                        className="w-1 h-5 rounded-full shrink-0"
                        style={{ backgroundColor: currentNote.subjectColor || '#888' }}
                    />
                    <button
                        type="button"
                        onClick={() => setIsOpen(true)}
                        className="flex items-center gap-1.5 min-w-0 flex-1 text-left hover:text-foreground transition-colors"
                        title="Change linked note"
                    >
                        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate text-foreground">
                            {currentNote.title || 'Untitled Note'}
                        </span>
                        {currentNote.subjectTitle && (
                            <span className="text-xs text-muted-foreground/70 truncate hidden sm:inline">
                                · {currentNote.subjectTitle}
                            </span>
                        )}
                    </button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={handleClear}
                        title="Unlink note"
                    >
                        <X className="h-3.5 w-3.5" />
                    </Button>
                </div>
            ) : (
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsOpen(true)}
                    className="bg-muted/50 border-border text-foreground hover:bg-muted h-10 sm:h-9 justify-start font-normal"
                >
                    <Link2 className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span className="text-muted-foreground/80">Link a note...</span>
                </Button>
            )}

            <DialogPrimitive.Root open={isOpen} onOpenChange={handleOpenChange}>
                <DialogPrimitive.Portal>
                    <DialogPrimitive.Overlay className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
                    <DialogPrimitive.Content
                        aria-describedby={undefined}
                        className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] z-[110] flex flex-col bg-popover/95 backdrop-blur-xl border border-border text-foreground shadow-2xl w-full max-w-[520px] max-sm:h-[100dvh] max-sm:max-h-[100dvh] sm:max-h-[85vh] sm:rounded-lg overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
                        onInteractOutside={(e) => {
                            // Close the picker on backdrop click, but prevent the
                            // event from propagating to the parent TaskDialog's
                            // onInteractOutside handler (which would close it too).
                            e.preventDefault();
                            setIsOpen(false);
                            reset();
                        }}
                        onEscapeKeyDown={(e) => {
                            // Same: handle Escape here and stop bubbling so the
                            // parent dialog doesn't also close.
                            e.preventDefault();
                            setIsOpen(false);
                            reset();
                        }}
                    >
                        <DialogPrimitive.Title className="sr-only">Link a note</DialogPrimitive.Title>
                        <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-2 shrink-0 relative">
                            <div className="flex items-center gap-2">
                                {step !== 'library' && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={goBack}
                                        aria-label="Go back"
                                    >
                                        <ArrowLeft className="h-4 w-4" />
                                    </Button>
                                )}
                                <h2 className="text-lg font-light tracking-wide text-foreground/90">
                                    {step === 'library' && 'Choose Library'}
                                    {step === 'book' && 'Choose Book'}
                                    {step === 'note' && 'Choose Note'}
                                </h2>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 ml-auto text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                        setIsOpen(false);
                                        reset();
                                    }}
                                    aria-label="Close"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            {(selectedLibraryIndex !== null || selectedBook) && (
                                <div className="flex items-center gap-1 text-[11px] text-muted-foreground/80 mt-1 flex-wrap">
                                    {selectedLibraryIndex !== null && (
                                        <>
                                            <Library className="h-3 w-3" />
                                            <span>Library {selectedLibraryIndex + 1}</span>
                                        </>
                                    )}
                                    {selectedBook && (
                                        <>
                                            <ChevronRight className="h-3 w-3" />
                                            <div
                                                className="w-0.5 h-3 rounded-full"
                                                style={{ backgroundColor: selectedBook.color }}
                                            />
                                            <span>{selectedBook.title}</span>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 py-3 min-h-0">
                        {step === 'library' && (
                            <div className="space-y-1.5">
                                {librariesWithCounts.map(({ idx, count }) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => handlePickLibrary(idx)}
                                        className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/50 hover:bg-muted hover:border-border transition-all text-left group"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                                <Library className="h-4 w-4 text-primary" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-sm font-medium text-foreground">
                                                    Library {idx + 1}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {count} {count === 1 ? 'book' : 'books'}
                                                </div>
                                            </div>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                                    </button>
                                ))}
                                {librariesWithCounts.length === 0 && (
                                    <div className="text-center py-12 text-muted-foreground text-sm">
                                        No libraries yet
                                    </div>
                                )}
                            </div>
                        )}

                        {step === 'book' && (
                            <>
                                <div className="relative mb-3">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        autoFocus={!isCoarsePointer}
                                        placeholder="Search books in this library..."
                                        value={bookSearch}
                                        onChange={(e) => setBookSearch(e.target.value)}
                                        className="pl-9 bg-muted/50 border-border text-sm h-9"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    {booksInLibrary.map((book) => (
                                        <button
                                            key={book.id}
                                            type="button"
                                            onClick={() => book.id && handlePickBook(book.id)}
                                            className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/50 hover:bg-muted hover:border-border transition-all text-left group"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div
                                                    className="h-9 w-1.5 rounded-full shrink-0"
                                                    style={{ backgroundColor: book.color }}
                                                />
                                                <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                                                <span className="text-sm font-medium text-foreground truncate">
                                                    {book.title}
                                                </span>
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                                        </button>
                                    ))}
                                    {booksInLibrary.length === 0 && (
                                        <div className="text-center py-12 text-muted-foreground text-sm">
                                            {bookSearch ? 'No books match' : 'No books in this library'}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {step === 'note' && (
                            <>
                                <div className="relative mb-3">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        autoFocus={!isCoarsePointer}
                                        placeholder="Search notes in this book..."
                                        value={noteSearch}
                                        onChange={(e) => setNoteSearch(e.target.value)}
                                        className="pl-9 bg-muted/50 border-border text-sm h-9"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    {filteredNotes.map((n) => {
                                        const isActive = selectedNoteId === n.id;
                                        return (
                                            <button
                                                key={n.id}
                                                type="button"
                                                onClick={() => n.id && handlePickNote(n.id)}
                                                className={cn(
                                                    'w-full flex items-start gap-3 p-3 rounded-lg border transition-all text-left',
                                                    isActive
                                                        ? 'bg-primary/10 border-primary/40'
                                                        : 'bg-muted/40 border-border/50 hover:bg-muted hover:border-border'
                                                )}
                                            >
                                                <FileText
                                                    className={cn(
                                                        'h-4 w-4 shrink-0 mt-0.5',
                                                        isActive ? 'text-primary' : 'text-muted-foreground'
                                                    )}
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <div
                                                        className={cn(
                                                            'text-sm font-medium truncate',
                                                            isActive ? 'text-primary' : 'text-foreground'
                                                        )}
                                                    >
                                                        {n.title || 'Untitled Note'}
                                                    </div>
                                                    {n.content && (
                                                        <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                                            {n.content.replace(/<[^>]+>/g, ' ').trim().slice(0, 120)}
                                                        </div>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                    {filteredNotes.length === 0 && (
                                        <div className="text-center py-12 text-muted-foreground text-sm">
                                            {noteSearch ? 'No notes match' : 'No notes in this book yet'}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                        {selectedNoteId && (
                            <div className="px-4 sm:px-6 py-3 border-t border-border/50 shrink-0">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={handleClear}
                                    className="w-full sm:w-auto text-muted-foreground hover:text-destructive h-9"
                                >
                                    <X className="h-3.5 w-3.5 mr-1.5" /> Unlink current note
                                </Button>
                            </div>
                        )}
                    </DialogPrimitive.Content>
                </DialogPrimitive.Portal>
            </DialogPrimitive.Root>
        </>
    );
}
