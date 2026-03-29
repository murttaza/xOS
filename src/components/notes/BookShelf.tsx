import React, { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { Subject } from '@/types';
import { cn } from '@/lib/utils';

// --- BookSpine Component ---

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
                    "bg-card shadow-sm"
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
                            "text-muted-foreground group-hover:text-foreground"
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

// --- BookShelf Component ---

interface BookShelfProps {
    subjects: Subject[];
    currentLibraryIndex: number;
    onOpenSubject: (id: number) => void;
    onCreateSubjectAt: (index: number) => void;
    onNewLibrary: () => void;
}

const SPINES_PER_LIBRARY = 300;
const PLACEHOLDER_PADDING = 6; // empty slots after last subject to fill the row + a few extra

export const BookShelf = ({
    subjects,
    currentLibraryIndex,
    onOpenSubject,
    onCreateSubjectAt,
    onNewLibrary,
}: BookShelfProps) => {
    const libraryOffset = currentLibraryIndex * SPINES_PER_LIBRARY;

    // Get subjects in this library, sorted by orderIndex
    const librarySubjects = useMemo(() =>
        subjects
            .filter(s => s.orderIndex >= libraryOffset && s.orderIndex < libraryOffset + SPINES_PER_LIBRARY)
            .sort((a, b) => a.orderIndex - b.orderIndex),
        [subjects, libraryOffset]
    );

    // Build a sparse list: real subjects at their positions + placeholder padding after the last one
    const spines = useMemo(() => {
        const subjectMap = new Map<number, Subject>();
        librarySubjects.forEach(s => subjectMap.set(s.orderIndex - libraryOffset, s));

        const maxIndex = librarySubjects.length > 0
            ? Math.max(...librarySubjects.map(s => s.orderIndex - libraryOffset))
            : -1;
        const totalSlots = maxIndex + 1 + PLACEHOLDER_PADDING;

        return Array.from({ length: totalSlots }, (_, i) => ({
            index: i,
            subject: subjectMap.get(i) || null,
        }));
    }, [librarySubjects, libraryOffset]);

    return (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(60px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-x-2 gap-y-12 items-end justify-items-center pb-20 no-drag">
            {spines.map(({ index, subject }) => {
                if (subject) {
                    return (
                        <BookSpine
                            key={subject.id}
                            subject={subject}
                            onClick={() => onOpenSubject(subject.id!)}
                        />
                    );
                } else {
                    return (
                        <BookSpine
                            key={`placeholder-${index}`}
                            isPlaceholder
                            onClick={() => onCreateSubjectAt(index)}
                        />
                    );
                }
            })}

            {/* New Library Option - Switch to next library view */}
            <div className="h-64 w-10 sm:w-12 flex flex-col items-center justify-end">
                <button
                    className="group flex flex-col items-center gap-2 opacity-50 hover:opacity-100 transition-opacity"
                    onClick={onNewLibrary}
                >
                    <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center group-hover:bg-primary/10 group-hover:border-primary/50 transition-colors">
                        <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest writing-vertical-rl">New Library</span>
                </button>
            </div>
        </div>
    );
};
