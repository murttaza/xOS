import { BrowserWindow, screen } from 'electron'
import path from 'node:path'
import { VITE_DEV_SERVER_URL, RENDERER_DIST } from './paths'

let paletteWin: BrowserWindow | null = null

const PALETTE_WIDTH = 440
const PALETTE_HEIGHT = 320 // Big enough to never clip — transparent area is invisible

export function createPaletteWindow(preloadPath: string) {
  if (paletteWin && !paletteWin.isDestroyed()) return paletteWin

  paletteWin = new BrowserWindow({
    width: PALETTE_WIDTH,
    height: PALETTE_HEIGHT,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    hasShadow: false, // The content has its own shadow via CSS
    webPreferences: {
      preload: preloadPath,
      backgroundThrottling: true,
    },
  })

  // Position: center-x, 20% from top of current display
  positionPalette()

  paletteWin.on('blur', () => paletteWin?.hide())
  paletteWin.on('closed', () => { paletteWin = null })

  if (VITE_DEV_SERVER_URL) {
    paletteWin.loadURL(`${VITE_DEV_SERVER_URL}/palette.html`)
  } else {
    paletteWin.loadFile(path.join(RENDERER_DIST, 'palette.html'))
  }

  return paletteWin
}

function positionPalette() {
  if (!paletteWin || paletteWin.isDestroyed()) return
  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const { x, y, width, height } = display.workArea
  paletteWin.setBounds({
    x: x + Math.round((width - PALETTE_WIDTH) / 2),
    y: y + Math.round(height * 0.18),
    width: PALETTE_WIDTH,
    height: PALETTE_HEIGHT,
  })
}

export function togglePaletteWindow(preloadPath: string) {
  if (!paletteWin || paletteWin.isDestroyed()) {
    createPaletteWindow(preloadPath)
  }

  if (paletteWin!.isVisible()) {
    paletteWin!.hide()
  } else {
    positionPalette()
    paletteWin!.show()
    paletteWin!.focus()
  }
}

export function hidePalette() {
  if (paletteWin && !paletteWin.isDestroyed()) {
    paletteWin.hide()
  }
}

export function getPaletteWindow() {
  return paletteWin && !paletteWin.isDestroyed() ? paletteWin : null
}
