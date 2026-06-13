// Notes "libraries" are pages of the bookshelf: subjects are bucketed by
// orderIndex in blocks of SPINES_PER_LIBRARY. This was previously re-derived
// in NotesMode, BookShelf, and NoteLinkPicker — one source of truth now.
export const SPINES_PER_LIBRARY = 300;

export function libraryIndexOf(orderIndex: number): number {
    return Math.floor(orderIndex / SPINES_PER_LIBRARY);
}

export function libraryOffset(libraryIndex: number): number {
    return libraryIndex * SPINES_PER_LIBRARY;
}

export function isInLibrary(orderIndex: number, libraryIndex: number): boolean {
    const offset = libraryOffset(libraryIndex);
    return orderIndex >= offset && orderIndex < offset + SPINES_PER_LIBRARY;
}
