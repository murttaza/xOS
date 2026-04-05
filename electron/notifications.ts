import { Notification, app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { AppStateSnapshot } from './tray'

export interface NotificationPrefs {
  breakReminderEnabled: boolean
  breakIntervalMinutes: number
  streakWarningEnabled: boolean
  dailyBriefingEnabled: boolean
  dailyBriefingTime: string  // HH:mm
  focusCompleteEnabled: boolean
}

const DEFAULT_PREFS: NotificationPrefs = {
  breakReminderEnabled: true,
  breakIntervalMinutes: 50,
  streakWarningEnabled: true,
  dailyBriefingEnabled: true,
  dailyBriefingTime: '08:00',
  focusCompleteEnabled: true,
}

// Lazy-init: app.getPath() not available before app.ready
let _prefsFile: string | null = null
function getPrefsFile() {
  if (!_prefsFile) _prefsFile = path.join(app.getPath('userData'), 'notification-prefs.json')
  return _prefsFile
}

let prefs: NotificationPrefs = DEFAULT_PREFS
let breakCheckInterval: ReturnType<typeof setInterval> | null = null
let streakCheckInterval: ReturnType<typeof setInterval> | null = null
let dailyBriefingTimeout: ReturnType<typeof setTimeout> | null = null
let lastBreakNotification = 0
let lastStreakNotification = 0
let timerActiveStartTime = 0
// Persist the getAppState callback so savePrefs can reschedule the daily briefing
let _persistedGetAppState: (() => Promise<AppStateSnapshot | null>) | null = null

export function loadPrefs(): NotificationPrefs {
  try {
    const data = fs.readFileSync(getPrefsFile(), 'utf-8')
    prefs = { ...DEFAULT_PREFS, ...JSON.parse(data) }
  } catch {
    prefs = { ...DEFAULT_PREFS }
  }
  return prefs
}

export function savePrefs(newPrefs: Partial<NotificationPrefs>) {
  prefs = { ...prefs, ...newPrefs }
  try {
    fs.writeFileSync(getPrefsFile(), JSON.stringify(prefs, null, 2))
  } catch { /* best effort */ }

  // Re-schedule daily briefing if time changed (use persisted callback)
  if (newPrefs.dailyBriefingTime !== undefined || newPrefs.dailyBriefingEnabled !== undefined) {
    scheduleDailyBriefing(_persistedGetAppState)
  }
}

export function getPrefs(): NotificationPrefs {
  return prefs
}

function showNotification(title: string, body: string) {
  if (!Notification.isSupported()) return
  const notif = new Notification({
    title,
    body,
    icon: path.join(process.env.VITE_PUBLIC || '', 'app-icon.ico'),
  })
  notif.show()
}

// --- Break Reminders ---

export function startBreakReminders(getAppState: () => Promise<AppStateSnapshot | null>) {
  if (breakCheckInterval) clearInterval(breakCheckInterval)
  if (!prefs.breakReminderEnabled) return

  // Check every 60s if timer has been running long enough
  breakCheckInterval = setInterval(async () => {
    if (!prefs.breakReminderEnabled) {
      // Prefs changed while interval was running — stop polling
      if (breakCheckInterval) { clearInterval(breakCheckInterval); breakCheckInterval = null }
      return
    }

    const state = await getAppState()
    if (!state?.hasActiveTimer) {
      timerActiveStartTime = 0
      return
    }

    if (timerActiveStartTime === 0) {
      timerActiveStartTime = Date.now()
      return
    }

    const elapsedMin = (Date.now() - timerActiveStartTime) / 60000
    const now = Date.now()

    if (elapsedMin >= prefs.breakIntervalMinutes && now - lastBreakNotification > 300000) {
      showNotification(
        'Take a Break!',
        `You've been focused for ${Math.round(elapsedMin)} minutes. Stand up, stretch, drink water.`
      )
      lastBreakNotification = now
      timerActiveStartTime = Date.now() // Reset so it triggers again after another interval
    }
  }, 60000)
}

// --- Streak Warnings ---

export function startStreakWarnings(getAppState: () => Promise<AppStateSnapshot | null>) {
  if (streakCheckInterval) clearInterval(streakCheckInterval)

  // Check every 30 minutes
  streakCheckInterval = setInterval(async () => {
    if (!prefs.streakWarningEnabled) return

    const hour = new Date().getHours()
    if (hour < 20) return // Only warn after 8 PM

    const state = await getAppState()
    if (!state?.streakAtRisk) return

    const now = Date.now()
    // Don't spam — max once per 2 hours
    if (now - lastStreakNotification < 7200000) return

    showNotification(
      'Streak at Risk!',
      'Your streak is about to break. Log something before midnight!'
    )
    lastStreakNotification = now
  }, 1800000) // 30 minutes
}

// --- Daily Briefing ---

export function scheduleDailyBriefing(getAppState: (() => Promise<AppStateSnapshot | null>) | null) {
  if (dailyBriefingTimeout) clearTimeout(dailyBriefingTimeout)
  if (!prefs.dailyBriefingEnabled || !getAppState) return

  // Persist the callback so savePrefs can reschedule
  _persistedGetAppState = getAppState

  const parts = (prefs.dailyBriefingTime || '08:00').split(':').map(Number)
  const hours = !isNaN(parts[0]) && parts[0] >= 0 && parts[0] <= 23 ? parts[0] : 8
  const minutes = !isNaN(parts[1]) && parts[1] >= 0 && parts[1] <= 59 ? parts[1] : 0
  const now = new Date()
  const target = new Date(now)
  target.setHours(hours, minutes, 0, 0)

  // If time has passed today, schedule for tomorrow
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1)
  }

  const delay = target.getTime() - now.getTime()

  dailyBriefingTimeout = setTimeout(async () => {
    const state = await getAppState()
    if (state) {
      showNotification(
        'Good Morning! Here\'s your day:',
        `${state.tasksDueToday} tasks due today | Streak: ${state.maxStreak} days | Total XP: ${state.totalXP}`
      )
    }
    // Reschedule for next day
    scheduleDailyBriefing(getAppState)
  }, delay)
}

// --- Focus Complete ---

export function notifyFocusComplete(durationMinutes: number) {
  if (!prefs.focusCompleteEnabled) return
  if (durationMinutes < 25) return // Only for meaningful sessions

  showNotification(
    'Focus Session Complete!',
    `Great work! You focused for ${durationMinutes} minutes.`
  )
}

// --- Cleanup ---

export function stopAllNotificationTimers() {
  if (breakCheckInterval) { clearInterval(breakCheckInterval); breakCheckInterval = null }
  if (streakCheckInterval) { clearInterval(streakCheckInterval); streakCheckInterval = null }
  if (dailyBriefingTimeout) { clearTimeout(dailyBriefingTimeout); dailyBriefingTimeout = null }
}
