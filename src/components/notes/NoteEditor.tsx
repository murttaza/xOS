import { Note } from '@/types';
import { Book, X, Bold, Italic, Heading1, Heading2, List, AlignCenter, Minus, Quote, ListOrdered, Strikethrough, CheckSquare } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useRef, useCallback, useState } from 'react';

interface NoteEditorProps {
    activeNote: Note | undefined;
    editingNote: Partial<Note>;
    isSaving: boolean;
    onEditingNoteChange: (updater: (prev: Partial<Note>) => Partial<Note>) => void;
    onClose: () => void;
}

type FormatAction =
    | { type: 'wrap'; before: string; after: string }
    | { type: 'line-prefix'; prefix: string; toggle?: boolean };

const FORMAT_ACTIONS: Record<string, FormatAction> = {
    bold: { type: 'wrap', before: '**', after: '**' },
    italic: { type: 'wrap', before: '*', after: '*' },
    strikethrough: { type: 'wrap', before: '~~', after: '~~' },
    h1: { type: 'line-prefix', prefix: '# ', toggle: true },
    h2: { type: 'line-prefix', prefix: '## ', toggle: true },
    bullet: { type: 'line-prefix', prefix: '- ' },
    numbered: { type: 'line-prefix', prefix: '1. ' },
    checklist: { type: 'line-prefix', prefix: '- [ ] ' },
    quote: { type: 'line-prefix', prefix: '> ' },
    center: { type: 'wrap', before: '<center>', after: '</center>' },
    hr: { type: 'line-prefix', prefix: '---\n' },
};

export const NoteEditor = ({
    activeNote,
    editingNote,
    isSaving,
    onEditingNoteChange,
    onClose,
}: NoteEditorProps) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [showToolbar, setShowToolbar] = useState(true);

    const applyFormat = useCallback((actionKey: string) => {
        const ta = textareaRef.current;
        if (!ta) return;

        const action = FORMAT_ACTIONS[actionKey];
        if (!action) return;

        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const value = ta.value;

        let newValue: string;
        let newCursorStart: number;
        let newCursorEnd: number;

        if (action.type === 'wrap') {
            const selected = value.slice(start, end);
            // If already wrapped, unwrap
            const beforeCheck = value.slice(Math.max(0, start - action.before.length), start);
            const afterCheck = value.slice(end, end + action.after.length);
            if (beforeCheck === action.before && afterCheck === action.after) {
                newValue = value.slice(0, start - action.before.length) + selected + value.slice(end + action.after.length);
                newCursorStart = start - action.before.length;
                newCursorEnd = end - action.before.length;
            } else {
                newValue = value.slice(0, start) + action.before + selected + action.after + value.slice(end);
                newCursorStart = start + action.before.length;
                newCursorEnd = end + action.before.length;
            }
        } else {
            // line-prefix: apply to each selected line
            const lineStart = value.lastIndexOf('\n', start - 1) + 1;
            const lineEnd = value.indexOf('\n', end);
            const actualEnd = lineEnd === -1 ? value.length : lineEnd;
            const selectedLines = value.slice(lineStart, actualEnd);
            const lines = selectedLines.split('\n');

            const allHavePrefix = action.toggle && lines.every(l => l.startsWith(action.prefix));
            const transformed = lines.map(l => {
                if (allHavePrefix) return l.slice(action.prefix.length);
                return action.prefix + l;
            }).join('\n');

            newValue = value.slice(0, lineStart) + transformed + value.slice(actualEnd);
            newCursorStart = lineStart;
            newCursorEnd = lineStart + transformed.length;
        }

        // Update through the onChange handler
        onEditingNoteChange(prev => ({ ...prev, content: newValue }));

        // Restore cursor position after React re-renders
        requestAnimationFrame(() => {
            ta.focus();
            ta.setSelectionRange(newCursorStart, newCursorEnd);
        });
    }, [onEditingNoteChange]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'b':
                    e.preventDefault();
                    applyFormat('bold');
                    break;
                case 'i':
                    e.preventDefault();
                    applyFormat('italic');
                    break;
                case 'u':
                    e.preventDefault();
                    applyFormat('strikethrough');
                    break;
            }
        }

        // Tab for indent
        if (e.key === 'Tab') {
            e.preventDefault();
            const ta = e.currentTarget;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            const value = ta.value;

            if (e.shiftKey) {
                // Outdent: remove leading spaces/tab
                const lineStart = value.lastIndexOf('\n', start - 1) + 1;
                const lineText = value.slice(lineStart, end);
                const outdented = lineText.replace(/^( {1,4}|\t)/, '');
                const diff = lineText.length - outdented.length;
                const newValue = value.slice(0, lineStart) + outdented + value.slice(end);
                onEditingNoteChange(prev => ({ ...prev, content: newValue }));
                requestAnimationFrame(() => {
                    ta.focus();
                    ta.setSelectionRange(Math.max(lineStart, start - diff), end - diff);
                });
            } else {
                const indent = '    ';
                const newValue = value.slice(0, start) + indent + value.slice(end);
                onEditingNoteChange(prev => ({ ...prev, content: newValue }));
                requestAnimationFrame(() => {
                    ta.focus();
                    ta.setSelectionRange(start + indent.length, start + indent.length);
                });
            }
        }
    }, [applyFormat, onEditingNoteChange]);

    const toolbarButtons = [
        { key: 'bold', icon: Bold, tooltip: 'Bold (Ctrl+B)', className: '' },
        { key: 'italic', icon: Italic, tooltip: 'Italic (Ctrl+I)', className: '' },
        { key: 'strikethrough', icon: Strikethrough, tooltip: 'Strikethrough (Ctrl+U)', className: '' },
        { key: 'divider1', icon: null, tooltip: '', className: '' },
        { key: 'h1', icon: Heading1, tooltip: 'Heading 1', className: '' },
        { key: 'h2', icon: Heading2, tooltip: 'Heading 2', className: '' },
        { key: 'divider2', icon: null, tooltip: '', className: '' },
        { key: 'bullet', icon: List, tooltip: 'Bullet List', className: '' },
        { key: 'numbered', icon: ListOrdered, tooltip: 'Numbered List', className: '' },
        { key: 'checklist', icon: CheckSquare, tooltip: 'Checklist', className: '' },
        { key: 'divider3', icon: null, tooltip: '', className: '' },
        { key: 'quote', icon: Quote, tooltip: 'Quote', className: '' },
        { key: 'center', icon: AlignCenter, tooltip: 'Center', className: '' },
        { key: 'hr', icon: Minus, tooltip: 'Horizontal Rule', className: '' },
    ];

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

                    {/* Formatting Toolbar */}
                    {showToolbar && (
                        <div className="flex items-center gap-0.5 mb-3 pb-3 border-b border-border/30 flex-wrap">
                            {toolbarButtons.map(btn => {
                                if (btn.key.startsWith('divider')) {
                                    return <div key={btn.key} className="w-px h-5 bg-border/40 mx-1" />;
                                }
                                const Icon = btn.icon!;
                                return (
                                    <button
                                        key={btn.key}
                                        type="button"
                                        title={btn.tooltip}
                                        onMouseDown={(e) => {
                                            e.preventDefault(); // Prevent textarea losing focus
                                            applyFormat(btn.key);
                                        }}
                                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                                    >
                                        <Icon className="h-4 w-4" />
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    <textarea
                        ref={textareaRef}
                        className="flex-1 bg-transparent text-foreground text-base sm:text-lg resize-none border-none outline-none placeholder:text-muted-foreground leading-relaxed custom-scrollbar selection:bg-primary/30 font-mono"
                        value={editingNote.content !== undefined ? editingNote.content : activeNote.content}
                        onChange={(e) => onEditingNoteChange(prev => ({ ...prev, content: e.target.value }))}
                        onKeyDown={handleKeyDown}
                        placeholder="Start writing... Use the toolbar above or keyboard shortcuts (Ctrl+B for bold, Ctrl+I for italic)"
                        spellCheck={false}
                    />

                    <div className="text-xs text-muted-foreground mt-4 flex justify-between items-center h-6">
                        <div className="flex items-center gap-3">
                            <span>Last edited {format(new Date(activeNote.updatedAt), 'MMMM d, yyyy h:mm a')}</span>
                            <button
                                onClick={() => setShowToolbar(prev => !prev)}
                                className="text-muted-foreground/60 hover:text-muted-foreground transition-colors text-[10px] uppercase tracking-wider"
                            >
                                {showToolbar ? 'Hide toolbar' : 'Show toolbar'}
                            </button>
                        </div>
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
