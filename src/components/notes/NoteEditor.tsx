import { Note } from '@/types';
import { Book, X, Bold, Italic, Heading1, Heading2, List, AlignCenter, Minus, Quote, ListOrdered, Strikethrough, CheckSquare } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useRef, useCallback, useState, useEffect } from 'react';
import { LinkedTasks } from './LinkedTasks';

interface NoteEditorProps {
    activeNote: Note | undefined;
    editingNote: Partial<Note>;
    isSaving: boolean;
    onEditingNoteChange: (updater: (prev: Partial<Note>) => Partial<Note>) => void;
    onClose: () => void;
}

/**
 * Convert stored note content into HTML for the contenteditable surface.
 * Supports both legacy markdown (what older notes were saved as) and HTML
 * (what new notes are saved as). For legacy markdown, we do a lightweight
 * conversion of common patterns so the user's existing formatting is preserved.
 * All output is sanitized before being returned.
 */
function toEditorHtml(raw: string | undefined): string {
    if (!raw) return '';
    // If looks like HTML already, sanitize and return directly.
    if (/<(p|div|h[1-6]|ul|ol|li|strong|b|em|i|s|strike|blockquote|br|hr|span|a|code|pre)\b/i.test(raw)) {
        return sanitizeHtml(raw);
    }

    // Escape HTML special chars first so e.g. "<something>" in user text can't
    // create real elements.
    const escapeHtml = (s: string) =>
        s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    let text = escapeHtml(raw);

    // Block-level conversions, line by line
    const lines = text.split('\n');
    const htmlLines: string[] = [];
    let listBuf: { type: 'ul' | 'ol'; items: string[]; checkable: boolean } | null = null;

    const flushList = () => {
        if (!listBuf) return;
        const tag = listBuf.type;
        const items = listBuf.items.map((it) => {
            if (listBuf!.checkable) {
                const m = it.match(/^\[([ xX])\]\s*(.*)$/);
                if (m) {
                    const checked = m[1].toLowerCase() === 'x' ? ' checked' : '';
                    return `<li><input type="checkbox"${checked}> ${m[2]}</li>`;
                }
            }
            return `<li>${it}</li>`;
        });
        htmlLines.push(`<${tag}>${items.join('')}</${tag}>`);
        listBuf = null;
    };

    for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        if (/^---\s*$/.test(line)) {
            flushList();
            htmlLines.push('<hr>');
            continue;
        }
        let m;
        if ((m = line.match(/^### (.*)$/))) {
            flushList();
            htmlLines.push(`<h3>${m[1]}</h3>`);
            continue;
        }
        if ((m = line.match(/^## (.*)$/))) {
            flushList();
            htmlLines.push(`<h2>${m[1]}</h2>`);
            continue;
        }
        if ((m = line.match(/^# (.*)$/))) {
            flushList();
            htmlLines.push(`<h1>${m[1]}</h1>`);
            continue;
        }
        if ((m = line.match(/^&gt; (.*)$/))) {
            flushList();
            htmlLines.push(`<blockquote>${m[1]}</blockquote>`);
            continue;
        }
        if ((m = line.match(/^- \[([ xX])\] (.*)$/))) {
            if (!listBuf || listBuf.type !== 'ul' || !listBuf.checkable) {
                flushList();
                listBuf = { type: 'ul', items: [], checkable: true };
            }
            listBuf.items.push(`[${m[1]}] ${m[2]}`);
            continue;
        }
        if ((m = line.match(/^- (.*)$/))) {
            if (!listBuf || listBuf.type !== 'ul' || listBuf.checkable) {
                flushList();
                listBuf = { type: 'ul', items: [], checkable: false };
            }
            listBuf.items.push(m[1]);
            continue;
        }
        if ((m = line.match(/^\d+\. (.*)$/))) {
            if (!listBuf || listBuf.type !== 'ol') {
                flushList();
                listBuf = { type: 'ol', items: [], checkable: false };
            }
            listBuf.items.push(m[1]);
            continue;
        }
        // Plain line
        flushList();
        if (line.length === 0) {
            htmlLines.push('<div><br></div>');
        } else {
            htmlLines.push(`<div>${line}</div>`);
        }
    }
    flushList();

    let out = htmlLines.join('');
    // Inline conversions (safe because escapeHtml already ran)
    out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em>$1</em>');
    out = out.replace(/~~(.+?)~~/g, '<s>$1</s>');
    return sanitizeHtml(out);
}

/**
 * Allow-list HTML sanitizer for the WYSIWYG editor. Everything not explicitly
 * allowed is stripped. Because note content is rendered via innerHTML, this
 * must be tight — treat every unlisted tag/attribute as hostile.
 */
const ALLOWED_TAGS = new Set([
    'p', 'div', 'span', 'br', 'hr',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'b', 'em', 'i', 's', 'strike', 'u',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'a', 'input',
]);
const ALLOWED_ATTRS: Record<string, Set<string>> = {
    a: new Set(['href', 'title']),
    input: new Set(['type', 'checked', 'disabled']),
};
const GLOBAL_ALLOWED_ATTRS = new Set(['class']);

function isSafeUrl(value: string): boolean {
    const v = value.trim().toLowerCase();
    // Block javascript:, vbscript:, and data: (other than data:image/* for future images)
    if (v.startsWith('javascript:') || v.startsWith('vbscript:')) return false;
    if (v.startsWith('data:') && !v.startsWith('data:image/')) return false;
    return true;
}

function sanitizeHtml(html: string): string {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const walk = (node: Element) => {
        // Iterate over a snapshot because we may replace/remove children.
        const children = [...node.children];
        for (const child of children) {
            const tag = child.tagName.toLowerCase();
            if (!ALLOWED_TAGS.has(tag)) {
                // Replace the disallowed element with its text content so user
                // text inside (e.g.) an <svg><text>hi</text></svg> is preserved.
                const text = doc.createTextNode(child.textContent || '');
                child.replaceWith(text);
                continue;
            }
            // <input> must be a checkbox — anything else gets dropped.
            if (tag === 'input' && (child.getAttribute('type') || '').toLowerCase() !== 'checkbox') {
                child.remove();
                continue;
            }
            // Scrub attributes
            for (const attr of [...child.attributes]) {
                const name = attr.name.toLowerCase();
                const allowed =
                    GLOBAL_ALLOWED_ATTRS.has(name) || ALLOWED_ATTRS[tag]?.has(name);
                if (!allowed) {
                    child.removeAttribute(attr.name);
                    continue;
                }
                if ((name === 'href' || name === 'src') && !isSafeUrl(attr.value)) {
                    child.removeAttribute(attr.name);
                }
            }
            // Force external links to safe rel
            if (tag === 'a') {
                child.setAttribute('rel', 'noopener noreferrer');
            }
            walk(child);
        }
    };
    walk(doc.body);
    return doc.body.innerHTML;
}

export const NoteEditor = ({
    activeNote,
    editingNote,
    isSaving,
    onEditingNoteChange,
    onClose,
}: NoteEditorProps) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [showToolbar, setShowToolbar] = useState(true);
    const lastHydratedNoteId = useRef<number | null>(null);

    // Hydrate contenteditable with initial HTML when switching notes.
    useEffect(() => {
        if (!activeNote || !editorRef.current) return;
        if (lastHydratedNoteId.current === activeNote.id) return;
        lastHydratedNoteId.current = activeNote.id ?? null;
        const source = editingNote.content !== undefined ? editingNote.content : activeNote.content;
        editorRef.current.innerHTML = toEditorHtml(source);
    }, [activeNote, editingNote.content]);

    const applyFormat = useCallback(
        (command: string, value?: string) => {
            const ed = editorRef.current;
            if (!ed) return;
            ed.focus();
            // document.execCommand is deprecated but still the simplest cross-browser
            // way to get WYSIWYG rich-text editing without a heavy framework.
            try {
                document.execCommand(command, false, value);
            } catch (err) {
                console.error('Format failed:', err);
            }
            const html = sanitizeHtml(ed.innerHTML);
            onEditingNoteChange((prev) => ({ ...prev, content: html }));
        },
        [onEditingNoteChange]
    );

    const insertCheckbox = useCallback(() => {
        const ed = editorRef.current;
        if (!ed) return;
        ed.focus();
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        const space = document.createTextNode(' ');
        range.insertNode(space);
        range.insertNode(checkbox);
        // Put the caret after the inserted space
        range.setStartAfter(space);
        range.setEndAfter(space);
        sel.removeAllRanges();
        sel.addRange(range);
        const clean = sanitizeHtml(ed.innerHTML);
        onEditingNoteChange((prev) => ({ ...prev, content: clean }));
    }, [onEditingNoteChange]);

    const handleInput = useCallback(() => {
        const ed = editorRef.current;
        if (!ed) return;
        // Persist the sanitized HTML, but don't overwrite the DOM every keystroke
        // — that would reset the caret. Dirty DOM shape is kept in-memory; the
        // sanitizer only runs over the serialized string we save.
        const clean = sanitizeHtml(ed.innerHTML);
        onEditingNoteChange((prev) => ({ ...prev, content: clean }));
    }, [onEditingNoteChange]);

    const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
        // Prefer plain text on paste so foreign styling doesn't leak in.
        const text = e.clipboardData.getData('text/plain');
        if (text) {
            e.preventDefault();
            document.execCommand('insertText', false, text);
        }
    }, []);

    // Toggling a checkbox inside a contentEditable does not fire `input`, so
    // we wire up a click listener that reflects the `checked` attribute into
    // the DOM and re-serializes. Otherwise users' ticks wouldn't persist.
    const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        if (target instanceof HTMLInputElement && target.type === 'checkbox') {
            if (target.checked) {
                target.setAttribute('checked', '');
            } else {
                target.removeAttribute('checked');
            }
            const ed = editorRef.current;
            if (ed) {
                const clean = sanitizeHtml(ed.innerHTML);
                onEditingNoteChange((prev) => ({ ...prev, content: clean }));
            }
        }
    }, [onEditingNoteChange]);

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        // Block arbitrary HTML/image drops. Accept plain text only.
        const text = e.dataTransfer.getData('text/plain');
        e.preventDefault();
        if (text) {
            document.execCommand('insertText', false, text);
        }
    }, []);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLDivElement>) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 'b':
                        e.preventDefault();
                        applyFormat('bold');
                        return;
                    case 'i':
                        e.preventDefault();
                        applyFormat('italic');
                        return;
                    case 'u':
                        e.preventDefault();
                        applyFormat('underline');
                        return;
                }
            }
            if (e.key === 'Tab') {
                e.preventDefault();
                document.execCommand('insertText', false, '    ');
            }
        },
        [applyFormat]
    );

    type ToolbarItem =
        | { key: string; divider: true }
        | { key: string; divider?: false; icon: typeof Bold; tooltip: string; action: () => void };
    const toolbarButtons: ToolbarItem[] = [
        { key: 'bold', icon: Bold, tooltip: 'Bold (Ctrl+B)', action: () => applyFormat('bold') },
        { key: 'italic', icon: Italic, tooltip: 'Italic (Ctrl+I)', action: () => applyFormat('italic') },
        { key: 'strikethrough', icon: Strikethrough, tooltip: 'Strikethrough', action: () => applyFormat('strikeThrough') },
        { key: 'divider1', divider: true },
        { key: 'h1', icon: Heading1, tooltip: 'Heading 1', action: () => applyFormat('formatBlock', 'H1') },
        { key: 'h2', icon: Heading2, tooltip: 'Heading 2', action: () => applyFormat('formatBlock', 'H2') },
        { key: 'divider2', divider: true },
        { key: 'bullet', icon: List, tooltip: 'Bullet List', action: () => applyFormat('insertUnorderedList') },
        { key: 'numbered', icon: ListOrdered, tooltip: 'Numbered List', action: () => applyFormat('insertOrderedList') },
        { key: 'checklist', icon: CheckSquare, tooltip: 'Insert Checkbox', action: () => insertCheckbox() },
        { key: 'divider3', divider: true },
        { key: 'quote', icon: Quote, tooltip: 'Quote', action: () => applyFormat('formatBlock', 'BLOCKQUOTE') },
        { key: 'center', icon: AlignCenter, tooltip: 'Center', action: () => applyFormat('justifyCenter') },
        { key: 'hr', icon: Minus, tooltip: 'Horizontal Rule', action: () => applyFormat('insertHorizontalRule') },
    ];

    return (
        <div className="flex-1 min-h-0 bg-card/50 backdrop-blur-sm flex flex-col relative no-drag">
            <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 z-10 text-muted-foreground hover:text-foreground"
                onClick={onClose}
            >
                <X className="h-6 w-6" />
            </Button>

            {activeNote ? (
                <div className="flex flex-col h-full min-h-0 p-4 sm:p-8 md:p-12 animate-in fade-in duration-150">
                    <input
                        className="bg-transparent text-xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4 sm:mb-6 border-none outline-none placeholder:text-muted-foreground"
                        value={editingNote.title !== undefined ? editingNote.title : activeNote.title}
                        onChange={(e) => {
                            onEditingNoteChange(prev => ({ ...prev, title: e.target.value }));
                        }}
                        placeholder="Note Title"
                    />

                    {/* Linked tasks for this note */}
                    <LinkedTasks note={activeNote} />

                    {/* Formatting Toolbar */}
                    {showToolbar && (
                        <div className="flex items-center gap-0.5 mb-3 pb-3 border-b border-border/30 flex-wrap">
                            {toolbarButtons.map(btn => {
                                if (btn.divider) {
                                    return <div key={btn.key} className="w-px h-5 bg-border/40 mx-1" />;
                                }
                                const Icon = btn.icon;
                                return (
                                    <button
                                        key={btn.key}
                                        type="button"
                                        title={btn.tooltip}
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            btn.action();
                                        }}
                                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                                    >
                                        <Icon className="h-4 w-4" />
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    <div
                        ref={editorRef}
                        className="wysiwyg-editor flex-1 min-h-0 bg-transparent text-foreground text-base sm:text-lg overflow-y-auto outline-none placeholder:text-muted-foreground leading-relaxed custom-scrollbar selection:bg-primary/30"
                        contentEditable
                        suppressContentEditableWarning
                        spellCheck
                        onInput={handleInput}
                        onPaste={handlePaste}
                        onKeyDown={handleKeyDown}
                        onClick={handleClick}
                        onDrop={handleDrop}
                        data-placeholder="Start writing... Use the toolbar above or keyboard shortcuts (Ctrl+B for bold, Ctrl+I for italic)"
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
