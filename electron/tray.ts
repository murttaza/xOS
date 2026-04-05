import { Tray, Menu, nativeImage, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'

let tray: Tray | null = null
let cachedState: AppStateSnapshot | null = null

export interface AppStateSnapshot {
  totalXP: number
  maxStreak: number
  hasActiveTimer: boolean
  streakAtRisk: boolean
  tasksDueToday: number
}

// Generate a simple 16x16 tray icon with a colored dot indicator
function createTrayIcon(baseIconPath: string): Electron.NativeImage {
  const icon = nativeImage.createFromPath(baseIconPath)
  if (!icon.isEmpty()) return icon.resize({ width: 16, height: 16 })

  // Fallback: use app favicon
  const fallback = nativeImage.createFromPath(
    baseIconPath.replace(/tray-[a-z]+\.ico$/, 'favicon.ico')
  )
  if (!fallback.isEmpty()) return fallback.resize({ width: 16, height: 16 })

  // Last resort: empty (Electron will show a default)
  return nativeImage.createEmpty()
}

export function createTray(
  iconDir: string,
  callbacks: {
    onToggleWidget: () => void
    onOpenPalette: () => void
    onToggleTimer: () => void
    onOpenApp: () => void
    onQuit: () => void
  }
) {
  // Use the existing app icon for the tray
  const icon = createTrayIcon(path.join(iconDir, 'app-icon.ico'))

  tray = new Tray(icon)
  tray.setToolTip('xOS')

  tray.on('click', () => {
    callbacks.onToggleWidget()
  })

  tray.on('right-click', () => {
    const menu = buildContextMenu(callbacks)
    tray?.popUpContextMenu(menu)
  })

  return tray
}

function buildContextMenu(callbacks: {
  onToggleWidget: () => void
  onOpenPalette: () => void
  onToggleTimer: () => void
  onOpenApp: () => void
  onQuit: () => void
}) {
  const state = cachedState

  const items: Electron.MenuItemConstructorOptions[] = []

  if (state) {
    items.push(
      { label: `XP: ${state.totalXP.toLocaleString()}`, enabled: false },
      { label: `Streak: ${state.maxStreak} days`, enabled: false },
      { label: `Tasks due: ${state.tasksDueToday}`, enabled: false },
      { type: 'separator' },
    )
  }

  items.push(
    { label: 'Quick Add Task...', accelerator: 'CommandOrControl+Space', click: callbacks.onOpenPalette },
    {
      label: state?.hasActiveTimer ? 'Stop Timer' : 'Start Timer',
      click: callbacks.onToggleTimer,
    },
    { type: 'separator' },
    { label: 'Show Widget', click: callbacks.onToggleWidget },
    { label: 'Open xOS', click: callbacks.onOpenApp },
    { type: 'separator' },
    { label: 'Quit', click: callbacks.onQuit },
  )

  return Menu.buildFromTemplate(items)
}

export function updateTrayState(state: AppStateSnapshot, _iconDir: string) {
  if (!tray || tray.isDestroyed()) return

  cachedState = state

  // Update tooltip
  const parts = [
    `${state.tasksDueToday} tasks due`,
    `Streak: ${state.maxStreak}`,
    state.hasActiveTimer ? 'Timer running' : '',
  ].filter(Boolean)
  tray.setToolTip(`xOS - ${parts.join(' | ')}`)
}

export function requestAppState(mainWindow: BrowserWindow): Promise<AppStateSnapshot | null> {
  return new Promise((resolve) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      resolve(null)
      return
    }

    const timeout = setTimeout(() => {
      try { ipcMain.removeHandler('app-state-response') } catch {}
      resolve(null)
    }, 3000)

    // Remove any existing handler before registering
    try { ipcMain.removeHandler('app-state-response') } catch {}

    ipcMain.handleOnce('app-state-response', (_event, state: AppStateSnapshot) => {
      clearTimeout(timeout)
      resolve(state)
      return undefined
    })

    try {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('request-app-state')
      } else {
        clearTimeout(timeout)
        try { ipcMain.removeHandler('app-state-response') } catch {}
        resolve(null)
      }
    } catch {
      clearTimeout(timeout)
      try { ipcMain.removeHandler('app-state-response') } catch {}
      resolve(null)
    }
  })
}

export function getTray() {
  return tray
}

export function destroyTray() {
  if (tray && !tray.isDestroyed()) {
    tray.destroy()
    tray = null
  }
}
