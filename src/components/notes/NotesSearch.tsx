import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { Note } from '@/types';
import { cn } from '@/lib/utils';

interface NotesSearchProps {
    globalSearch: string;
    onGlobalSearchChange: (value: string) => void;
    searchResults: Note[];
    onResultClick: (subjectId: number, noteId: number | undefined) => void;
}

export const NotesSearch = ({
    globalSearch,
    onGlobalSearchChange,
    searchResults,
    onResultClick,
}: NotesSearchProps) => {
    const [isFocused, setIsFocused] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [highlightIdx, setHighlightIdx] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const results = searchResults.slice(0, 30);

    // Open while there's a query; close on outside click so the dropdown
    // doesn't linger over the bookshelf.
    useEffect(() => {
        setIsOpen(!!globalSearch);
        setHighlightIdx(0);
    }, [globalSearch, searchResults]);

    useEffect(() => {
        if (!isOpen) return;
        const onPointerDown = (e: PointerEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [isOpen]);

    // Keep the highlighted row visible while arrowing through the list.
    useEffect(() => {
        listRef.current?.children[highlightIdx]?.scrollIntoView({ block: 'nearest' });
    }, [highlightIdx]);

    const pick = (note: Note) => {
        onResultClick(note.subjectId, note.id);
        setIsOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen || results.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightIdx(i => Math.min(i + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightIdx(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const note = results[highlightIdx];
            if (note) pick(note);
        } else if (e.key === 'Escape') {
            // Close just the dropdown; stop the press from reaching the
            // mode-level handler.
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(false);
        }
    };

    return (
        <div
            ref={containerRef}
            className="relative w-full bg-secondary/50 rounded-full border border-border/50 backdrop-blur-md shadow-lg shadow-black/5 flex items-center px-4 py-1.5 transition-all cursor-text"
            onClick={() => inputRef.current?.focus()}
        >
            <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
            <Input
                ref={inputRef}
                role="combobox"
                aria-expanded={isOpen && results.length > 0}
                aria-controls="notes-search-results"
                aria-label="Search across all notebooks"
                className="w-full bg-transparent border-none shadow-none h-8 px-0 text-sm text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60 caret-primary"
                placeholder={isFocused || globalSearch ? "" : "Search across all notebooks..."}
                value={globalSearch}
                onChange={(e) => onGlobalSearchChange(e.target.value)}
                onFocus={() => { setIsFocused(true); if (globalSearch) setIsOpen(true); }}
                onBlur={() => setIsFocused(false)}
                onKeyDown={handleKeyDown}
            />
            {/* Search Results Dropdown */}
            {isOpen && globalSearch && (
                <div
                    id="notes-search-results"
                    ref={listRef}
                    role="listbox"
                    className="absolute top-full left-0 right-0 mt-3 bg-popover border border-border rounded-2xl shadow-2xl p-2 max-h-96 overflow-y-auto z-[100]"
                >
                    {results.map((note, idx) => (
                        <div
                            key={note.id}
                            role="option"
                            aria-selected={idx === highlightIdx}
                            className={cn(
                                "p-3 rounded-xl cursor-pointer flex flex-col gap-1 border-b border-border/50 last:border-0 transition-colors",
                                idx === highlightIdx ? "bg-accent" : "hover:bg-accent"
                            )}
                            onMouseEnter={() => setHighlightIdx(idx)}
                            onClick={() => pick(note)}
                        >
                            <div className="flex justify-between">
                                <span className="font-medium text-primary text-[10px] uppercase tracking-wider">{note.subjectTitle}</span>
                                <span className="text-[10px] text-muted-foreground font-medium">{format(new Date(note.updatedAt), 'MMM d')}</span>
                            </div>
                            <div className="font-bold text-sm text-foreground">{note.title}</div>
                            <div className="text-xs text-muted-foreground line-clamp-1">{(note.content || '').replace(/<[^>]+>/g, ' ').trim()}</div>
                        </div>
                    ))}
                    {results.length === 0 && (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                            No notes match "{globalSearch}"
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
