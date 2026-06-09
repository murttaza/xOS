import { StateCreator } from 'zustand';
import { Subject, Note } from '@/types';
import { api } from '@/api';
import { showErrorToast } from '@/components/ui/toast';
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
        try {
            const subjects = await api.getSubjects();
            set({ subjects });
        } catch (error) {
            console.error('Failed to fetch notebooks:', error);
            showErrorToast('Could not load notebooks — check your connection.');
        }
    },

    createSubject: async (subject) => {
        // Optimistic update
        const tempId = Date.now(); // Temp ID
        const newSubject = { ...subject, id: tempId } as Subject;
        set(state => ({ subjects: [...state.subjects, newSubject] }));

        try {
            await api.createSubject(subject);
        } catch (error) {
            // Rollback: remove the temp subject from state
            set(state => ({ subjects: state.subjects.filter(s => s.id !== tempId) }));
            console.error('Failed to create subject:', error);
            showErrorToast('Could not create the notebook.');
            return;
        }
        get().fetchSubjects();
    },

    updateSubject: async (subject) => {
        // Optimistic update — snapshot for rollback
        const prev = get().subjects;
        set(state => ({
            subjects: state.subjects.map(s => s.id === subject.id ? subject : s)
        }));

        try {
            await api.updateSubject(subject);
        } catch (error) {
            set({ subjects: prev });
            console.error('Failed to update subject:', error);
            showErrorToast('Could not save notebook changes.');
            return;
        }
        get().fetchSubjects();
    },

    deleteSubject: async (id) => {
        try {
            await api.deleteSubject(id);
        } catch (error) {
            console.error('Failed to delete subject:', error);
            showErrorToast('Could not delete the notebook.');
            return;
        }
        get().fetchSubjects();
    },

    openSubject: async (id, noteId) => {
        set({ currentSubjectId: id, targetNoteId: noteId || null });
        await get().fetchNotes(id);
    },

    closeSubject: () => set({ currentSubjectId: null, notes: [] }),

    fetchNotes: async (subjectId) => {
        try {
            const notes = await api.getNotes(subjectId);
            set({ notes });
        } catch (error) {
            console.error('Failed to fetch notes:', error);
            showErrorToast('Could not load notes — check your connection.');
        }
    },

    createNote: async (note) => {
        const result = await api.createNote(note);
        if (get().currentSubjectId === note.subjectId) {
            await get().fetchNotes(note.subjectId);
        }
        return result.id;
    },

    updateNote: async (note) => {
        // A failed note save is the worst data-loss path in the app, so retry
        // once before surfacing — and ALWAYS rethrow on final failure so the
        // editor knows the edits never landed (it keeps them as a draft).
        try {
            await api.updateNote(note);
        } catch (error) {
            console.error('Note save failed, retrying:', error);
            await new Promise(r => setTimeout(r, 2000));
            try {
                await api.updateNote(note);
            } catch (retryError) {
                console.error('Note save retry failed:', retryError);
                showErrorToast('Note save failed — your edits are kept in the editor. Check your connection.');
                throw retryError;
            }
        }
        if (get().currentSubjectId === note.subjectId) {
            get().fetchNotes(note.subjectId);
        }
    },

    deleteNote: async (id) => {
        const note = get().notes.find(n => n.id === id);
        if (note) {
            try {
                await api.deleteNote(id);
            } catch (error) {
                console.error('Failed to delete note:', error);
                showErrorToast('Could not delete the note.');
                return;
            }
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
        try {
            const results = await api.searchNotes(query);
            set({ searchResults: results });
        } catch (error) {
            console.error('Search failed:', error);
            showErrorToast('Search failed — check your connection.');
        }
    },
});
