import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const ipc = (window as any).ipcRenderer

interface WidgetState {
  taskTitle: string | null
  timerSeconds: number
  totalXP: number
  maxStreak: number
  hasTimer: boolean
}

export function WidgetApp() {
  const [state, setState] = useState<WidgetState>({
    taskTitle: null,
    timerSeconds: 0,
    totalXP: 0,
    maxStreak: 0,
    hasTimer: false,
  })
  const timerRef = useRef<ReturnType<typeof setInterval>>()
  const startTimeRef = useRef<string | null>(null)

  const fetchData = async () => {
    try {
      // Fetch active timer
      const { data: timers } = await supabase.from('active_timers').select('taskId, startTime')
      let taskTitle: string | null = null
      let timerSeconds = 0
      let hasTimer = false

      if (timers?.length) {
        hasTimer = true
        startTimeRef.current = timers[0].startTime
        timerSeconds = Math.floor((Date.now() - new Date(timers[0].startTime).getTime()) / 1000)

        const { data: tasks } = await supabase
          .from('tasks')
          .select('title')
          .eq('id', timers[0].taskId)
          .limit(1)
        taskTitle = tasks?.[0]?.title || 'Task'
      } else {
        startTimeRef.current = null
      }

      // Fetch stats
      const { data: stats } = await supabase.from('stats').select('currentXP')
      const totalXP = stats?.reduce((sum, s) => sum + (s.currentXP || 0), 0) || 0

      // Fetch streaks
      const { data: streaks } = await supabase.from('streaks').select('currentStreak')
      const maxStreak = streaks?.reduce((max, s) => Math.max(max, s.currentStreak || 0), 0) || 0

      setState({ taskTitle, timerSeconds, totalXP, maxStreak, hasTimer })
    } catch { /* Supabase might be unreachable */ }
  }

  // Initial fetch + periodic refresh
  useEffect(() => {
    fetchData()
    const refresh = setInterval(fetchData, 30000) // Refresh every 30s
    return () => clearInterval(refresh)
  }, [])

  // Listen for data-changed from other windows
  useEffect(() => {
    const unsub = ipc?.on('data-changed', () => fetchData())
    return () => unsub?.()
  }, [])

  // Tick the timer every second (local calculation, no network)
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)

    if (state.hasTimer && startTimeRef.current) {
      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor((Date.now() - new Date(startTimeRef.current).getTime()) / 1000)
          setState(prev => ({ ...prev, timerSeconds: elapsed }))
        }
      }, 1000)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [state.hasTimer])

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const handleClick = () => {
    ipc?.send('open-full-app')
  }

  return (
    <div
      style={styles.container}
      onClick={handleClick}
      onMouseDown={(e) => {
        // Allow dragging the window
        if (e.button === 0) {
          ;(e.target as HTMLElement).closest('[data-nodrag]') || ipc?.send?.('widget-drag')
        }
      }}
    >
      {/* Timer / Task */}
      <div style={styles.left}>
        {state.hasTimer ? (
          <>
            <div style={styles.timer}>{formatTime(state.timerSeconds)}</div>
            <div style={styles.taskTitle}>{state.taskTitle || 'Working...'}</div>
          </>
        ) : (
          <div style={styles.idle}>No active timer</div>
        )}
      </div>

      {/* Stats */}
      <div style={styles.right}>
        <div style={styles.stat}>
          <span style={styles.statValue}>{state.totalXP.toLocaleString()}</span>
          <span style={styles.statLabel}>XP</span>
        </div>
        <div style={styles.divider} />
        <div style={styles.stat}>
          <span style={styles.statValue}>{state.maxStreak}</span>
          <span style={styles.statLabel}>Streak</span>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: 'Outfit, system-ui, sans-serif',
    background: 'rgba(15, 15, 20, 0.92)',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.08)',
    backdropFilter: 'blur(20px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    height: 88,
    boxSizing: 'border-box' as const,
    cursor: 'pointer',
    userSelect: 'none' as const,
    // @ts-expect-error Electron-specific CSS property for window dragging
    WebkitAppRegion: 'drag',
  },
  left: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
    minWidth: 0,
    flex: 1,
  },
  timer: {
    fontSize: 24,
    fontWeight: 700,
    color: '#4ade80',
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '0.02em',
  },
  taskTitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
  },
  idle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.3)',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0,
  },
  stat: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    gap: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 600,
    color: '#fff',
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  divider: {
    width: 1,
    height: 32,
    background: 'rgba(255,255,255,0.08)',
  },
}
