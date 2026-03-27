import { StateCreator } from 'zustand';
import { Subject, Note } from '@/types';
import { api } from '@/api';
import type { AppState } from './index';

export interface NotesSlice {
    subjects: Subject[];
    currentSubjectId: number | null;
    targetNoteId: number | null;
    notes: Note[];
    searchResults: Note[];

    fetchSubjects: () => Promise<void>;
    createSubject: (subject: Omit<Subject, 'id'>) => Promise<void>;
    updateSubject: (subject: Subject) => Promise<void>;
    deleteSubject: (id: number) => Promise<void>;

    openSubject: (id: number, noteId?: number) => Promise<void>;
    closeSubject: () => void;

    fetchNotes: (subjectId: number) => Promise<void>;
    createNote: (note: Omit<Note, 'id'>) => Promise<number>;
    updateNote: (note: Note) => Promise<void>;
    deleteNote: (id: number) => Promise<void>;

    searchNotes: (query: string) => Promise<void>;
}

export const createNotesSlice: StateCreator<AppState, [], [], NotesSlice> = (set, get) => ({
    subjects: [],
    currentSubjectId: null,
    targetNoteId: null,
    notes: [],
    searchResults: [],

    fetchSubjects: async () => {
        const subjects = await api.getSubjects();
        set({ subjects });
    },

    createSubject: async (subject) => {
        // Optimistic update
        const tempId = Date.now(); // Temp ID
        const newSubject = { ...subject, id: tempId } as Subject;
        set(state => ({ subjects: [...state.subjects, newSubject] }));

        await api.createSubject(subject);
        get().fetchSubjects();
    },

    updateSubject: async (subject) => {
        // Optimistic update
        set(state => ({
            subjects: state.subjects.map(s => s.id === subject.id ? subject : s)
        }));

        await api.updateSubject(subject);
        get().fetchSubjects();
    },

    deleteSubject: async (id) => {
        await api.deleteSubject(id);
        get().fetchSubjects();
    },

    openSubject: async (id, noteId) => {
        set({ currentSubjectId: id, targetNoteId: noteId || null });
        await get().fetchNotes(id);
    },

    closeSubject: () => set({ currentSubjectId: null, notes: [] }),

    fetchNotes: async (subjectId) => {
        const notes = await api.getNotes(subjectId);
        set({ notes });
    },

    createNote: async (note) => {
        const result = await api.createNote(note);
        if (get().currentSubjectId === note.subjectId) {
            await get().fetchNotes(note.subjectId);
        }
        return result.id;
    },

    updateNote: async (note) => {
        await api.updateNote(note);
        if (get().currentSubjectId === note.subjectId) {
            get().fetchNotes(note.subjectId);
        }
    },

    deleteNote: async (id) => {
        const note = get().notes.find(n => n.id === id);
        if (note) {
            await api.deleteNote(id);
            if (get().currentSubjectId === note.subjectId) {
                get().fetchNotes(note.subjectId);
            }
        }
    },

    searchNotes: async (query) => {
        if (!query.trim()) {
            set({ searchResults: [] });
            return;
        }
        const results = await api.searchNotes(query);
        set({ searchResults: results });
    },
});
