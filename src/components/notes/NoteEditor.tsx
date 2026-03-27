import { Note } from '@/types';
import { Book, X } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';

interface NoteEditorProps {
    activeNote: Note | undefined;
    editingNote: Partial<Note>;
    isSaving: boolean;
    onEditingNoteChange: (updater: (prev: Partial<Note>) => Partial<Note>) => void;
    onClose: () => void;
}

export const NoteEditor = ({
    activeNote,
    editingNote,
    isSaving,
    onEditingNoteChange,
    onClose,
}: NoteEditorProps) => {
    return (
        <div className="flex-1 bg-card/50 backdrop-blur-sm flex flex-col relative no-drag">
            <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 z-10 text-muted-foreground hover:text-foreground"
                onClick={onClose}
            >
                <X className="h-6 w-6" />
            </Button>

            {activeNote ? (
                <div className="flex flex-col h-full p-4 sm:p-8 md:p-12 animate-in fade-in duration-150">
                    <input
                        className="bg-transparent text-xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4 sm:mb-6 border-none outline-none placeholder:text-muted-foreground"
                        value={editingNote.title !== undefined ? editingNote.title : activeNote.title}
                        onChange={(e) => {
                            onEditingNoteChange(prev => ({ ...prev, title: e.target.value }));
                        }}
                        placeholder="Note Title"
                    />

                    <textarea
                        className="flex-1 bg-transparent text-foreground text-lg resize-none border-none outline-none placeholder:text-muted-foreground leading-relaxed custom-scrollbar selection:bg-primary/30"
                        value={editingNote.content !== undefined ? editingNote.content : activeNote.content}
                        onChange={(e) => onEditingNoteChange(prev => ({ ...prev, content: e.target.value }))}
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
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4">
                    <Book className="h-16 w-16 opacity-20" />
                    <p>Select a note or create a new one</p>
                </div>
            )}
        </div>
    );
};
