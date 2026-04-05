import { powerMonitor, BrowserWindow } from 'electron'

let pollInterval: ReturnType<typeof setInterval> | null = null
let wasTimerRunning = false
let idleStartTime = 0

const IDLE_THRESHOLD_SECONDS = 300  // 5 minutes

export function startIdleMonitor(
  getMainWindow: () => BrowserWindow | null,
  isTimerActive: () => Promise<boolean>,
) {
  // System suspend/lock -> pause timers
  powerMonitor.on('suspend', () => handleIdleStart(getMainWindow))
  powerMonitor.on('lock-screen', () => handleIdleStart(getMainWindow))

  // Resume/unlock -> prompt about idle time
  powerMonitor.on('resume', () => handleIdleEnd(getMainWindow))
  powerMonitor.on('unlock-screen', () => handleIdleEnd(getMainWindow))

  // Poll system idle time every 60s for keyboard/mouse inactivity
  pollInterval = setInterval(async () => {
    let timerActive: boolean
    try {
      timerActive = await isTimerActive()
    } catch {
      return // Can't check timer state — skip this cycle
    }

    // Skip idle-time check entirely if no timer is running and we're not tracking idle
    if (!timerActive && !wasTimerRunning) return

    const idleSeconds = powerMonitor.getSystemIdleTime()

    if (idleSeconds >= IDLE_THRESHOLD_SECONDS && timerActive && !wasTimerRunning) {
      // User went idle while timer was running
      wasTimerRunning = true
      idleStartTime = Date.now() - (idleSeconds * 1000)
      const win = getMainWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.send('idle:timer-paused', { idleStartTime })
      }
    } else if (idleSeconds < IDLE_THRESHOLD_SECONDS && wasTimerRunning) {
      // User returned from idle
      handleIdleEnd(getMainWindow)
    }
  }, 60000) // Check every 60s — lightweight polling
}

function handleIdleStart(getMainWindow: () => BrowserWindow | null) {
  wasTimerRunning = true
  idleStartTime = Date.now()
  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send('idle:timer-paused', { idleStartTime })
  }
}

function handleIdleEnd(getMainWindow: () => BrowserWindow | null) {
  if (!wasTimerRunning) return

  const idleDurationMs = Date.now() - idleStartTime
  const idleMinutes = Math.round(idleDurationMs / 60000)
  wasTimerRunning = false
  idleStartTime = 0

  if (idleMinutes < 1) return // Don't prompt for very short idles

  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send('idle:return-prompt', { idleMinutes })
    // Bring app to attention
    if (win.isMinimized()) win.restore()
    win.flashFrame(true)
  }
}

export function stopIdleMonitor() {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
  powerMonitor.removeAllListeners('suspend')
  powerMonitor.removeAllListeners('lock-screen')
  powerMonitor.removeAllListeners('resume')
  powerMonitor.removeAllListeners('unlock-screen')
}
