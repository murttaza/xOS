import { useState, useRef } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { Note } from '@/types';

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
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div
            className="relative w-full bg-secondary/50 rounded-full border border-border/50 backdrop-blur-md shadow-lg shadow-black/5 flex items-center px-4 py-1.5 transition-all cursor-text"
            onClick={() => inputRef.current?.focus()}
        >
            <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
            <Input
                ref={inputRef}
                className="w-full bg-transparent border-none shadow-none h-8 px-0 text-sm text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60 caret-primary"
                placeholder={isFocused || globalSearch ? "" : "Search across all notebooks..."}
                value={globalSearch}
                onChange={(e) => onGlobalSearchChange(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
            />
            {/* Search Results Dropdown */}
            {globalSearch && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-3 bg-popover border border-border rounded-2xl shadow-2xl p-2 max-h-96 overflow-y-auto z-[100]">
                    {searchResults.slice(0, 30).map(note => (
                        <div
                            key={note.id}
                            className="p-3 hover:bg-accent rounded-xl cursor-pointer flex flex-col gap-1 border-b border-border/50 last:border-0 transition-colors"
                            onClick={() => {
                                onResultClick(note.subjectId, note.id);
                            }}
                        >
                            <div className="flex justify-between">
                                <span className="font-medium text-primary text-[10px] uppercase tracking-wider">{note.subjectTitle}</span>
                                <span className="text-[10px] text-muted-foreground font-medium">{format(new Date(note.updatedAt), 'MMM d')}</span>
                            </div>
                            <div className="font-bold text-sm text-foreground">{note.title}</div>
                            <div className="text-xs text-muted-foreground line-clamp-1">{(note.content || '').replace(/<[^>]+>/g, ' ').trim()}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
