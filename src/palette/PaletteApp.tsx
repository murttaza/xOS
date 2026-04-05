import { useState, useRef, useEffect, useCallback } from 'react'
import { executeCommand, COMMANDS, type CommandResult, type Suggestion } from './commands'

const ipc = (window as any).ipcRenderer

export function PaletteApp() {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<CommandResult | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isExecuting, setIsExecuting] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  // Reset on window focus
  useEffect(() => {
    const onFocus = () => {
      setInput('')
      setResult(null)
      setSuggestions([])
      setSelectedIdx(0)
      inputRef.current?.focus()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  // Load suggestions when command is recognized
  useEffect(() => {
    const cmd = input.split(' ')[0]?.toLowerCase()
    const match = COMMANDS.find(c => c.cmd === cmd)
    if (match && input.includes(' ')) {
      match.getSuggestions().then(s => {
        setSuggestions(s)
        setSelectedIdx(0)
      })
    } else {
      setSuggestions([])
    }
  }, [input])

  const runSuggestion = useCallback(async (suggestion: Suggestion) => {
    setIsExecuting(true)
    setSuggestions([])
    const res = await suggestion.action()
    setResult(res)
    setIsExecuting(false)
    if (res.success) ipc?.send('data-changed', { source: 'palette' })
    // User dismisses with Escape or clicking away — no auto-hide
  }, [])

  const handleSubmit = useCallback(async () => {
    if (isExecuting) return
    // If there are suggestions and one is selected, run it
    if (suggestions.length > 0) {
      await runSuggestion(suggestions[selectedIdx])
      return
    }
    if (!input.trim()) return
    setIsExecuting(true)
    const res = await executeCommand(input)
    setResult(res)
    setIsExecuting(false)
    if (res.success) ipc?.send('data-changed', { source: 'palette' })
    // User dismisses with Escape or clicking away — no auto-hide
  }, [input, isExecuting, suggestions, selectedIdx, runSuggestion])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSubmit() }
    else if (e.key === 'Escape') ipc?.send('hide-palette')
    else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => Math.max(i - 1, 0))
    }
  }


  const showCommands = !result && input === ''
  const showSuggestions = !result && suggestions.length > 0

  return (
    <div style={t.root}>
      {/* Input */}
      <div style={t.bar}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); setResult(null) }}
          onKeyDown={handleKeyDown}
          placeholder="Type a command..."
          spellCheck={false}
          autoFocus
          style={t.input}
        />
        {isExecuting ? (
          <div style={t.spinner} />
        ) : (
          <kbd style={t.kbd}>esc</kbd>
        )}
      </div>

      {/* Result */}
      {result && (
        <div style={{ ...t.card, marginTop: 6 }}>
          <div style={{
            ...t.resultDot,
            background: result.success ? 'hsl(0, 84%, 60%)' : 'hsl(0, 70%, 50%)',
          }} />
          <span style={t.resultText}>{result.message}</span>
        </div>
      )}

      {/* Command list */}
      {showCommands && (
        <div style={{ ...t.card, marginTop: 6, padding: '4px 0' }}>
          {COMMANDS.map(c => (
            <div
              key={c.cmd}
              style={t.row}
              onClick={() => { setInput(c.cmd + ' '); inputRef.current?.focus() }}
              onMouseEnter={e => e.currentTarget.style.background = 'hsl(0, 0%, 6%)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={t.cmdName}>{c.cmd}</span>
              <span style={t.cmdDesc}>{c.desc}</span>
            </div>
          ))}
        </div>
      )}

      {/* Context suggestions (tasks for timer, etc.) */}
      {showSuggestions && (
        <div style={{ ...t.card, marginTop: 6, padding: '4px 0', maxHeight: 220, overflowY: 'auto' }}>
          {suggestions.map((s, i) => (
            <div
              key={i}
              style={{
                ...t.row,
                background: i === selectedIdx ? 'hsl(0, 0%, 6%)' : 'transparent',
              }}
              onClick={() => runSuggestion(s)}
              onMouseEnter={() => setSelectedIdx(i)}
            >
              <span style={t.suggLabel}>{s.label}</span>
              {s.detail && <span style={t.suggDetail}>{s.detail}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Theme: AMOLED black + red accent matching the main app
const t: Record<string, React.CSSProperties> = {
  root: {
    padding: 20,
    fontFamily: 'Outfit, system-ui, sans-serif',
  },
  bar: {
    display: 'flex',
    alignItems: 'center',
    background: 'hsl(0, 0%, 3%)',
    borderRadius: 10,
    padding: '0 12px',
    height: 42,
    border: '1px solid hsl(0, 0%, 8%)',
  },
  input: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: 'hsl(0, 0%, 98%)',
    fontSize: 14,
    fontFamily: 'Outfit, system-ui, sans-serif',
    fontWeight: 400,
  },
  kbd: {
    fontSize: 10,
    color: 'hsl(0, 0%, 35%)',
    border: '1px solid hsl(0, 0%, 10%)',
    borderRadius: 4,
    padding: '1px 5px',
    fontFamily: 'monospace',
  },
  spinner: {
    width: 12,
    height: 12,
    border: '2px solid hsl(0, 0%, 10%)',
    borderTopColor: 'hsl(0, 84%, 60%)',
    borderRadius: '50%',
    animation: 'spin 0.6s linear infinite',
    flexShrink: 0,
  },
  card: {
    background: 'hsl(0, 0%, 3%)',
    borderRadius: 10,
    padding: '8px 12px',
    border: '1px solid hsl(0, 0%, 8%)',
    fontSize: 13,
    lineHeight: 1.5,
  },
  resultDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    marginTop: 6,
    marginRight: 8,
    flexShrink: 0,
    display: 'inline-block',
  },
  resultText: {
    color: 'hsl(0, 0%, 65%)',
    whiteSpace: 'pre-line' as const,
    fontSize: 13,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 12px',
    borderRadius: 7,
    cursor: 'pointer',
    transition: 'background 0.08s',
  },
  cmdName: {
    fontSize: 13,
    fontWeight: 600,
    color: 'hsl(0, 84%, 60%)',
    minWidth: 48,
  },
  cmdDesc: {
    fontSize: 12,
    color: 'hsl(0, 0%, 40%)',
    marginLeft: 'auto',
  },
  suggLabel: {
    fontSize: 13,
    color: 'hsl(0, 0%, 85%)',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  suggDetail: {
    fontSize: 11,
    color: 'hsl(0, 0%, 35%)',
    flexShrink: 0,
  },
}
