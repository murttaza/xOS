import React, { useState, useMemo } from 'react';
import { useStore } from '@/store';
import { Subject, Note } from '@/types';
import { Plus, Search, Trash2, Edit2, MoreVertical, Calendar, Check, Pipette } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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

interface NotesListProps {
    subject: Subject;
    notes: Note[];
    selectedNoteId: number | null;
    onSelectNote: (id: number | null) => void;
    onCreateNote: () => void;
    onDeleteNote: (e: React.MouseEvent, id: number) => void;
    onDeleteSubject: () => void;
    searchTerm: string;
    onSearchChange: (term: string) => void;
    savePendingChanges: () => void;
}

export const NotesList = ({
    subject,
    notes,
    selectedNoteId,
    onSelectNote,
    onCreateNote,
    onDeleteNote,
    onDeleteSubject,
    searchTerm,
    onSearchChange,
    savePendingChanges,
}: NotesListProps) => {
    const updateSubject = useStore(s => s.updateSubject);

    // Edit Mode State
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(subject.title);
    const [editColor, setEditColor] = useState(subject.color);

    const handleSaveChanges = async () => {
        if (!editTitle.trim()) return;
        await updateSubject({
            ...subject,
            title: editTitle,
            color: editColor
        });
        setIsEditing(false);
    };

    const filteredNotes = useMemo(() => notes.filter(n =>
        (n.title?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (n.content?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    ), [notes, searchTerm]);

    return (
        <>
            <div className={`w-full md:w-80 bg-muted/30 border-r border-border flex-col h-full relative no-drag ${selectedNoteId ? 'hidden md:flex' : 'flex'}`}>
                <div className="absolute left-0 top-0 bottom-0 w-2" style={{ backgroundColor: subject.color }} />

                <div className="p-6 pl-8 border-b border-border flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-bold text-foreground break-words">{subject.title}</h2>
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
                            <Button variant="ghost" size="sm" className="w-full justify-start text-red-400 hover:text-red-400 hover:bg-red-950/20" onClick={onDeleteSubject}>
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
                            className="pl-8 bg-muted/50 border-border text-sm"
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto pl-6 pr-2 py-0 custom-scrollbar">
                    {filteredNotes.map(note => (
                        <div
                            key={note.id}
                            onClick={() => {
                                savePendingChanges();
                                onSelectNote(note.id || null);
                            }}
                            className={cn(
                                "mb-2 p-3 rounded-lg cursor-pointer transition-colors border border-transparent group hover:border-border",
                                selectedNoteId === note.id ? "bg-accent" : "hover:bg-muted/50"
                            )}
                        >
                            <div className="flex justify-between items-start">
                                <h4 className={cn("font-medium text-sm truncate pr-2", selectedNoteId === note.id ? "text-accent-foreground" : "text-foreground")}>
                                    {note.title || 'Untitled'}
                                </h4>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity -mt-1 -mr-1 text-muted-foreground hover:text-red-400"
                                    onClick={(e) => onDeleteNote(e, note.id!)}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {note.content?.substring(0, 100) || "No content..."}
                            </p>
                            <div className="text-[10px] text-muted-foreground/70 mt-2 flex items-center gap-1">
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

                <div className="p-4 pl-8 border-t border-border">
                    <Button className="w-full bg-primary/10 hover:bg-primary/20 text-primary" onClick={onCreateNote}>
                        <Plus className="h-4 w-4 mr-2" /> New Note
                    </Button>
                </div>
            </div>

            {/* Edit Subject Overlay */}
            {isEditing && (
                <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-8 no-drag">
                    <div className="bg-card border border-border p-8 rounded-2xl w-full max-w-md shadow-2xl space-y-6 animate-in zoom-in-95 duration-150">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <Edit2 className="h-5 w-5 text-primary" /> Edit Book Details
                        </h3>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Book Title</label>
                            <Input
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="bg-muted/50 border-border text-lg font-bold"
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
                                <div className="relative w-8 h-8 rounded-full overflow-hidden border border-border hover:border-foreground transition-colors group/picker">
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

                        <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
                            <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
                            <Button onClick={handleSaveChanges} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                                <Check className="h-4 w-4 mr-2" /> Save Changes
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
