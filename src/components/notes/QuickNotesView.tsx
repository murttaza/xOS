import { useEffect, useState, useRef } from 'react'
import { useStore } from '../../store'
import { Note } from '../../types'
import { X, Plus, Trash2, Copy, Check } from 'lucide-react'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'
import { format, isToday, isYesterday } from 'date-fns'

function formatNoteDate(dateStr: string) {
  const date = new Date(dateStr)
  if (isToday(date)) return format(date, "'Today at' h:mm a")
  if (isYesterday(date)) return format(date, "'Yesterday at' h:mm a")
  return format(date, "MMM d 'at' h:mm a")
}

export function QuickNotesView({ subjectId, onClose }: { subjectId: number; onClose: () => void }) {
  const notes = useStore(s => s.notes)
  const fetchNotes = useStore(s => s.fetchNotes)
  const createNote = useStore(s => s.createNote)
  const updateNote = useStore(s => s.updateNote)
  const deleteNote = useStore(s => s.deleteNote)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [newText, setNewText] = useState('')
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const newInputRef = useRef<HTMLTextAreaElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    fetchNotes(subjectId)
  }, [subjectId, fetchNotes])

  // Sort notes by creation date, newest first
  const sorted = [...notes].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  const handleCreate = async () => {
    if (!newText.trim()) return
    const now = new Date().toISOString()
    await createNote({
      subjectId,
      title: newText.trim().slice(0, 50),
      content: newText.trim(),
      createdAt: now,
      updatedAt: now,
    })
    setNewText('')
    fetchNotes(subjectId)
    newInputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleCreate()
    }
  }

  const startEdit = (note: Note) => {
    setEditingId(note.id!)
    setEditText(note.content)
  }

  const handleEditChange = (text: string, note: Note) => {
    setEditText(text)
    // Auto-save after 800ms of no typing
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      updateNote({
        ...note,
        content: text,
        title: text.slice(0, 50),
        updatedAt: new Date().toISOString(),
      })
    }, 800)
  }

  const handleDelete = async (id: number) => {
    await deleteNote(id)
    fetchNotes(subjectId)
    if (editingId === id) setEditingId(null)
  }

  const handleCopy = async (note: Note) => {
    try {
      // Electron context — navigator.clipboard may not work, fallback to textarea hack
      const textarea = document.createElement('textarea')
      textarea.value = note.content
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopiedId(note.id!)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {
      // Last resort
      await navigator.clipboard.writeText(note.content)
      setCopiedId(note.id!)
      setTimeout(() => setCopiedId(null), 1500)
    }
  }

  useEffect(() => {
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [])

  return (
    <div className="fixed inset-0 z-[200] bg-background flex flex-col no-drag">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">Quick Notes</h2>
          <span className="text-xs text-muted-foreground">{notes.length} notes</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 no-drag">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* New note input */}
      <div className="px-6 py-3 border-b border-border/30">
        <div className="flex gap-2">
          <textarea
            ref={newInputRef}
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Jot something down..."
            rows={1}
            className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary/50 transition-colors"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCreate}
            disabled={!newText.trim()}
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-primary"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 ml-1">Enter to save, Shift+Enter for new line</p>
      </div>

      {/* Notes feed */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
        {sorted.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-12">
            No quick notes yet. Type above to create one.
          </div>
        ) : (
          sorted.map(note => (
            <div
              key={note.id}
              className={cn(
                "group relative rounded-lg border transition-colors",
                editingId === note.id
                  ? "border-primary/30 bg-card"
                  : "border-border/30 bg-card/50 hover:border-border hover:bg-card cursor-pointer"
              )}
            >
              {editingId === note.id ? (
                <div className="p-3">
                  <textarea
                    autoFocus
                    value={editText}
                    onChange={e => handleEditChange(e.target.value, note)}
                    onBlur={() => setEditingId(null)}
                    className="w-full bg-transparent text-sm text-foreground resize-none focus:outline-none min-h-[60px]"
                    rows={Math.max(2, editText.split('\n').length)}
                  />
                </div>
              ) : (
                <div className="p-3" onClick={() => startEdit(note)}>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {note.content}
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between px-3 pb-2.5">
                <span className="text-[10px] text-muted-foreground">
                  {formatNoteDate(note.createdAt)}
                </span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCopy(note) }}
                    className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-muted transition-colors"
                    title="Copy to clipboard"
                  >
                    {copiedId === note.id ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(note.id!) }}
                    className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
