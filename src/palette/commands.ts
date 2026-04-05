import { supabase } from '../lib/supabase'
import { format } from 'date-fns'

export interface CommandResult {
  success: boolean
  message: string
}

export interface Suggestion {
  label: string
  detail?: string
  action: () => Promise<CommandResult>
}

// ── Fetch helpers ──────────────────────────────────────────────

async function fetchIncompleteTasks() {
  const { data } = await supabase
    .from('tasks')
    .select('id, title, difficulty, dueDate')
    .eq('isComplete', 0)
    .order('dueDate', { ascending: true })
  return data || []
}

async function fetchActiveTimers() {
  const { data: timers } = await supabase.from('active_timers').select('taskId, startTime')
  if (!timers?.length) return []

  const taskIds = timers.map(t => t.taskId)
  const { data: tasks } = await supabase.from('tasks').select('id, title').in('id', taskIds)
  const taskMap = new Map((tasks || []).map(t => [t.id, t.title]))

  return timers.map(t => ({
    taskId: t.taskId,
    startTime: t.startTime,
    title: taskMap.get(t.taskId) || `Task #${t.taskId}`,
  }))
}

// ── Command definitions ────────────────────────────────────────

export interface CommandDef {
  cmd: string
  desc: string
  getSuggestions: () => Promise<Suggestion[]>
  execute?: (args: string) => Promise<CommandResult>
}

export const COMMANDS: CommandDef[] = [
  {
    cmd: 'add',
    desc: 'Create a task',
    async getSuggestions() { return [] }, // No suggestions — user types title
    async execute(args) {
      if (!args.trim()) return { success: false, message: 'Provide a task title' }
      const today = format(new Date(), 'yyyy-MM-dd')
      const { error } = await supabase.from('tasks').insert({
        title: args.trim(), description: '', dueDate: today,
        difficulty: 1, isComplete: 0, statTarget: [], labels: [], subtasks: [],
      })
      if (error) return { success: false, message: error.message }
      return { success: true, message: `Added: ${args.trim()}` }
    },
  },
  {
    cmd: 'timer',
    desc: 'Start or stop a timer',
    async getSuggestions() {
      const [tasks, timers] = await Promise.all([fetchIncompleteTasks(), fetchActiveTimers()])

      const suggestions: Suggestion[] = []

      if (timers.length > 0) {
        for (const t of timers) {
          const elapsed = Math.floor((Date.now() - new Date(t.startTime).getTime()) / 60000)
          suggestions.push({
            label: `Stop: ${t.title}`,
            detail: `${elapsed}m running`,
            async action() {
              const start = new Date(t.startTime)
              const now = new Date()
              const dur = Math.floor((now.getTime() - start.getTime()) / 60000)
              if (dur > 0) {
                await supabase.from('sessions').insert({
                  taskId: t.taskId, startTime: start.toISOString(), endTime: now.toISOString(),
                  duration_minutes: dur, dateLogged: format(now, 'yyyy-MM-dd'),
                })
              }
              await supabase.from('active_timers').delete().eq('taskId', t.taskId)
              return { success: true, message: `Stopped: ${t.title} (${dur}m)` }
            },
          })
        }
      }

      const activeIds = new Set(timers.map(t => t.taskId))
      for (const task of tasks.filter(t => !activeIds.has(t.id))) {
        suggestions.push({
          label: task.title,
          detail: task.dueDate === format(new Date(), 'yyyy-MM-dd') ? 'Due today' : task.dueDate,
          async action() {
            const now = new Date().toISOString()
            const { error } = await supabase
              .from('active_timers')
              .upsert({ taskId: task.id, startTime: now }, { onConflict: 'taskId,user_id' })
            if (error) return { success: false, message: error.message }
            return { success: true, message: `Timer started: ${task.title}` }
          },
        })
      }

      return suggestions
    },
  },
  {
    cmd: 'note',
    desc: 'Quick note',
    async getSuggestions() { return [] },
    async execute(args) {
      if (!args.trim()) return { success: false, message: 'Provide note text' }

      let { data: subjects } = await supabase.from('subjects').select('id').eq('title', 'Quick Notes').limit(1)
      let subjectId: number

      if (!subjects?.length) {
        const { data, error } = await supabase
          .from('subjects').insert({ title: 'Quick Notes', color: '#ef4444', orderIndex: 999 }).select('id').single()
        if (error || !data) return { success: false, message: 'Failed to create subject' }
        subjectId = data.id
      } else {
        subjectId = subjects[0].id
      }

      const now = new Date().toISOString()
      const { error } = await supabase.from('notes').insert({
        subjectId, title: args.trim().slice(0, 50), content: args.trim(), createdAt: now, updatedAt: now,
      })
      if (error) return { success: false, message: error.message }
      return { success: true, message: 'Note saved' }
    },
  },
  {
    cmd: 'xp',
    desc: 'Show XP stats',
    async getSuggestions() { return [] },
    async execute() {
      const { data: stats } = await supabase.from('stats').select('statName, currentXP, currentLevel')
      if (!stats?.length) return { success: true, message: 'No stats found' }
      const total = stats.reduce((sum, s) => sum + (s.currentXP || 0), 0)
      const lines = stats.map(s => `${s.statName}  Lv${s.currentLevel}  ${s.currentXP} XP`)
      return { success: true, message: `Total: ${total} XP\n${lines.join('\n')}` }
    },
  },
]

export async function executeCommand(input: string): Promise<CommandResult> {
  const trimmed = input.trim()
  if (!trimmed) return { success: false, message: 'Type a command' }

  const spaceIdx = trimmed.indexOf(' ')
  const cmd = spaceIdx === -1 ? trimmed.toLowerCase() : trimmed.slice(0, spaceIdx).toLowerCase()
  const args = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1)

  const command = COMMANDS.find(c => c.cmd === cmd)
  if (!command) return { success: false, message: `Unknown: ${cmd}` }
  if (!command.execute) return { success: false, message: `Select from the list` }

  try {
    return await command.execute(args)
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Error' }
  }
}
