import { BrowserWindow, screen, app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { VITE_DEV_SERVER_URL, RENDERER_DIST } from './paths'

let widgetWin: BrowserWindow | null = null

// Lazy-init: app.getPath() not available before app.ready
let _posFile: string | null = null
function getPositionFile() {
  if (!_posFile) _posFile = path.join(app.getPath('userData'), 'widget-position.json')
  return _posFile
}

function loadPosition(): { x: number; y: number } | null {
  try {
    const data = fs.readFileSync(getPositionFile(), 'utf-8')
    const pos = JSON.parse(data)
    if (typeof pos.x === 'number' && typeof pos.y === 'number') return pos
  } catch { /* no saved position */ }
  return null
}

/** Validate that a position is visible on at least one connected display */
function clampToVisibleDisplay(x: number, y: number, w: number, h: number): { x: number; y: number } {
  const displays = screen.getAllDisplays()
  // Check if at least 50px of the widget is visible on any display
  for (const display of displays) {
    const { x: dx, y: dy, width: dw, height: dh } = display.workArea
    if (x + w > dx + 50 && x < dx + dw - 50 && y + h > dy + 50 && y < dy + dh - 50) {
      return { x, y } // Position is visible
    }
  }
  // Not visible on any display — snap to bottom-right of primary
  const primary = screen.getPrimaryDisplay()
  const { x: px, y: py, width: pw, height: ph } = primary.workArea
  return { x: px + pw - w - 16, y: py + ph - h - 16 }
}

let _saveTimeout: ReturnType<typeof setTimeout> | null = null
function savePosition(x: number, y: number) {
  // Debounce: only write to disk 500ms after the last move event
  if (_saveTimeout) clearTimeout(_saveTimeout)
  _saveTimeout = setTimeout(() => {
    try {
      fs.writeFileSync(getPositionFile(), JSON.stringify({ x, y }))
    } catch { /* best effort */ }
  }, 500)
}

export function createWidgetWindow(preloadPath: string) {
  if (widgetWin && !widgetWin.isDestroyed()) return widgetWin

  const saved = loadPosition()

  widgetWin = new BrowserWindow({
    width: 320,
    height: 88,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    hasShadow: true,
    webPreferences: {
      preload: preloadPath,
      backgroundThrottling: true,
    },
  })

  // Position: use saved position (clamped to visible display) or bottom-right of primary
  if (saved) {
    const clamped = clampToVisibleDisplay(saved.x, saved.y, 320, 88)
    widgetWin.setBounds({ x: clamped.x, y: clamped.y, width: 320, height: 88 })
  } else {
    const display = screen.getPrimaryDisplay()
    const { x, y, width, height } = display.workArea
    widgetWin.setBounds({
      x: x + width - 320 - 16,
      y: y + height - 88 - 16,
      width: 320,
      height: 88,
    })
  }

  // Save position when dragged
  widgetWin.on('moved', () => {
    if (widgetWin && !widgetWin.isDestroyed()) {
      const [wx, wy] = widgetWin.getPosition()
      savePosition(wx, wy)
    }
  })

  widgetWin.on('closed', () => {
    widgetWin = null
  })

  if (VITE_DEV_SERVER_URL) {
    widgetWin.loadURL(`${VITE_DEV_SERVER_URL}/widget.html`)
  } else {
    widgetWin.loadFile(path.join(RENDERER_DIST, 'widget.html'))
  }

  return widgetWin
}

export function toggleWidgetWindow(preloadPath: string) {
  if (!widgetWin || widgetWin.isDestroyed()) {
    createWidgetWindow(preloadPath)
  }

  if (widgetWin!.isVisible()) {
    widgetWin!.hide()
  } else {
    widgetWin!.show()
  }
}

export function getWidgetWindow() {
  return widgetWin && !widgetWin.isDestroyed() ? widgetWin : null
}
