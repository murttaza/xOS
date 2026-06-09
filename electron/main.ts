import { app, BrowserWindow, ipcMain, screen, globalShortcut, session, desktopCapturer, nativeTheme, clipboard, shell, dialog } from 'electron'
import path from 'node:path'
import db from './db'
import * as vault from './vault'
import { IpcChannels } from '../src/shared/ipc-types'
import { __dirname, VITE_DEV_SERVER_URL, RENDERER_DIST } from './paths'
import { togglePaletteWindow, hidePalette } from './palette-window'
import { toggleWidgetWindow } from './widget-window'
import { createTray, updateTrayState, requestAppState, destroyTray } from './tray'
import { setAutoLaunch, getAutoLaunch } from './auto-launch'
import { loadPrefs, savePrefs, getPrefs, startBreakReminders, startStreakWarnings, scheduleDailyBriefing, stopAllNotificationTimers } from './notifications'
import { startIdleMonitor, stopIdleMonitor } from './idle-monitor'

let win: BrowserWindow | null
let isQuitting = false;

// Single instance lock — prevents duplicate windows and enables taskbar restore
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });
}

// Stop Chromium from throwing 'Failing CreateMapBlock' and other cache-related errors on dev reload
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disk-cache-size', '0');

// Force dark mode at the native level — transparent window looks broken in light mode
nativeTheme.themeSource = 'dark';

// ── Web-contents hardening ───────────────────────────────────────────
// Applies to every window (main, palette, widget): never open child windows
// in-app, never navigate away from the app's own origin. External http(s)
// links go to the system browser.
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url).catch((err) => console.error('openExternal failed:', err));
    }
    return { action: 'deny' };
  });

  contents.on('will-navigate', (event, url) => {
    const allowed = VITE_DEV_SERVER_URL
      ? url.startsWith(VITE_DEV_SERVER_URL)
      : url.startsWith('file://');
    if (!allowed) event.preventDefault();
  });
});

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(process.env.VITE_PUBLIC || '', 'favicon.ico'),
    autoHideMenuBar: true,
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: false,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      // Defense-in-depth: explicit security flags even though Electron 30 defaults are already secure.
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      // Tells the preload which IPC allow-list applies (see src/shared/ipc-types.ts)
      additionalArguments: ['--mos-window=main'],
      // backgroundThrottling intentionally left as default (true)
      // This allows Chromium to throttle the renderer when minimized/hidden,
      // drastically reducing CPU usage. Timers are kept alive via main process IPC.
    },
  })

  win.setAspectRatio(1200 / 800)

  // Minimize to tray instead of quitting when the user clicks X
  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      win?.hide();
    }
  })

  win.on('maximize', () => {
    win?.webContents.send('window-maximized', true)
  })

  win.on('unmaximize', () => {
    win?.webContents.send('window-maximized', false)
  })

  // Notify renderer of window focus state for pausing expensive work
  win.on('focus', () => {
    win?.webContents.send('window-focus-state', true)
  })

  win.on('blur', () => {
    win?.webContents.send('window-focus-state', false)
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
    win?.webContents.send('window-maximized', win?.isMaximized())
    win?.webContents.send('window-focus-state', win?.isFocused())
  })

  // DevTools shortcut (Ctrl+Shift+I) — development builds only. The packaged
  // renderer holds the Supabase session and the unlocked vault UI; don't ship
  // an inspector into it.
  if (!app.isPackaged) {
    win.webContents.on('before-input-event', (_event, input) => {
      if (input.control && input.shift && input.key === 'I') {
        win?.webContents.toggleDevTools();
      }
    });
  }

  // Log any renderer crash or failure
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('Renderer process gone:', details);
  });

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  // Don't quit — the app stays alive in the system tray.
  // Actual quit happens via tray "Quit" or app.quit().
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  // Set the App User Model ID for Windows to ensure the correct icon is displayed in the taskbar
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.murtaza.mos');
  }

  // Handle permission requests for media (audio/video capture)
  session.defaultSession.setPermissionRequestHandler((_webContents: Electron.WebContents, permission: string, callback: (granted: boolean) => void) => {
    // Allow audio and video capture for system audio loopback
    if (permission === 'media' || permission === 'audioCapture' || permission === 'videoCapture') {
      callback(true);
    } else {
      callback(false); // Deny non-media permissions
    }
  });

  // Screen/loopback-audio capture is only granted in a short window after the
  // renderer explicitly arms it from a user action (the focus-mode audio
  // visualizer). Anything else asking for display media is denied.
  let audioCaptureArmedUntil = 0;
  ipcMain.on(IpcChannels.ArmAudioCapture, () => {
    audioCaptureArmedUntil = Date.now() + 15_000;
  });

  session.defaultSession.setDisplayMediaRequestHandler((_request: unknown, callback: (streams: { video: Electron.DesktopCapturerSource; audio: 'loopback' }) => void) => {
    if (Date.now() > audioCaptureArmedUntil) {
      // Deny: invoke the callback with no streams
      (callback as unknown as (streams?: unknown) => void)();
      return;
    }
    audioCaptureArmedUntil = 0; // single use
    desktopCapturer.getSources({ types: ['screen'] }).then((sources: Electron.DesktopCapturerSource[]) => {
      if (sources.length > 0) {
        callback({ video: sources[0], audio: 'loopback' });
      }
    });
  });

  // ── Password vault (local-only; layered passphrase + OS keychain) ──
  const stmts = {
    getPasswords: db.prepare('SELECT id, name, username, url, notes, category, isPinned, orderIndex, createdAt, updatedAt, lastUsed FROM passwords ORDER BY isPinned DESC, lastUsed DESC, name ASC'),
    createPassword: db.prepare('INSERT INTO passwords (name, username, passwordEnc, url, notes, category, isPinned, orderIndex, createdAt, updatedAt, lastUsed) VALUES (@name, @username, @passwordEnc, @url, @notes, @category, @isPinned, @orderIndex, @createdAt, @updatedAt, @lastUsed)'),
    updatePassword: db.prepare('UPDATE passwords SET name = @name, username = @username, url = @url, notes = @notes, category = @category, isPinned = @isPinned, updatedAt = @updatedAt WHERE id = @id'),
    updatePasswordWithCipher: db.prepare('UPDATE passwords SET name = @name, username = @username, passwordEnc = @passwordEnc, url = @url, notes = @notes, category = @category, isPinned = @isPinned, updatedAt = @updatedAt WHERE id = @id'),
    deletePassword: db.prepare('DELETE FROM passwords WHERE id = ?'),
    getPasswordCipher: db.prepare('SELECT passwordEnc FROM passwords WHERE id = ?'),
    touchPassword: db.prepare('UPDATE passwords SET lastUsed = ? WHERE id = ?'),
    togglePinPassword: db.prepare('UPDATE passwords SET isPinned = ? WHERE id = ?'),
  };

  // Wraps ipcMain.handle with try/catch so SQLite/runtime errors surface as
  // proper serializable Error objects in the renderer (avoiding raw exception
  // leaks and silent white-screens). The `any[]` rest param matches the
  // permissiveness of ipcMain.handle so existing handler signatures don't change.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const safeHandle = (channel: string, fn: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => unknown) => {
    ipcMain.handle(channel, async (event, ...args) => {
      try {
        return await fn(event, ...args);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[IPC ${channel}]`, err);
        throw new Error(msg);
      }
    });
  };

  /** Throws when the vault has a passphrase and is locked — every password
   *  operation (even metadata reads) requires an unlocked vault. */
  const requireUnlockedVault = () => {
    if (vault.isLocked()) throw new Error('vault-locked');
    vault.touchActivity();
  };

  safeHandle(IpcChannels.GetPasswords, () => {
    requireUnlockedVault();
    return stmts.getPasswords.all();
  });

  safeHandle(IpcChannels.CreatePassword, (_, { entry, plaintext }: { entry: any; plaintext: string }) => {
    requireUnlockedVault();
    const now = new Date().toISOString();
    const result = stmts.createPassword.run({
      name: entry.name,
      username: entry.username || '',
      passwordEnc: vault.encryptSecret(plaintext || ''),
      url: entry.url || '',
      notes: entry.notes || '',
      category: entry.category || '',
      isPinned: entry.isPinned ? 1 : 0,
      orderIndex: entry.orderIndex ?? 0,
      createdAt: now,
      updatedAt: now,
      lastUsed: null,
    });
    return result.lastInsertRowid;
  });

  safeHandle(IpcChannels.UpdatePassword, (_, { entry, plaintext }: { entry: any; plaintext?: string }) => {
    requireUnlockedVault();
    const now = new Date().toISOString();
    if (typeof plaintext === 'string' && plaintext.length > 0) {
      return stmts.updatePasswordWithCipher.run({
        id: entry.id,
        name: entry.name,
        username: entry.username || '',
        passwordEnc: vault.encryptSecret(plaintext),
        url: entry.url || '',
        notes: entry.notes || '',
        category: entry.category || '',
        isPinned: entry.isPinned ? 1 : 0,
        updatedAt: now,
      });
    }
    return stmts.updatePassword.run({
      id: entry.id,
      name: entry.name,
      username: entry.username || '',
      url: entry.url || '',
      notes: entry.notes || '',
      category: entry.category || '',
      isPinned: entry.isPinned ? 1 : 0,
      updatedAt: now,
    });
  });

  safeHandle(IpcChannels.DeletePassword, (_, id: number) => {
    requireUnlockedVault();
    return stmts.deletePassword.run(id);
  });

  safeHandle(IpcChannels.RevealPassword, (_, id: number) => {
    requireUnlockedVault();
    const row = stmts.getPasswordCipher.get(id) as { passwordEnc: string } | undefined;
    if (!row) return '';
    return vault.decryptSecret(row.passwordEnc);
  });

  safeHandle(IpcChannels.TouchPassword, (_, id: number) => {
    requireUnlockedVault();
    return stmts.touchPassword.run(new Date().toISOString(), id);
  });

  safeHandle(IpcChannels.TogglePinPassword, (_, { id, isPinned }: { id: number; isPinned: number }) => {
    requireUnlockedVault();
    return stmts.togglePinPassword.run(isPinned, id);
  });

  // ── Vault lock IPC ────────────────────────────────────────────────
  safeHandle(IpcChannels.VaultStatus, () => vault.getStatus());
  safeHandle(IpcChannels.VaultSetup, (_, passphrase: string) => vault.setup(passphrase));
  safeHandle(IpcChannels.VaultUnlock, (_, passphrase: string) => vault.unlock(passphrase));
  safeHandle(IpcChannels.VaultLock, () => vault.lock());
  safeHandle(IpcChannels.VaultChangePassphrase, (_, { current, next }: { current: string; next: string }) =>
    vault.changePassphrase(current, next));
  safeHandle(IpcChannels.VaultExport, (_, { passphrase }: { passphrase: string }) =>
    vault.exportVault(win, passphrase));
  safeHandle(IpcChannels.VaultImport, (_, { passphrase }: { passphrase: string }) =>
    vault.importVault(win, passphrase));

  vault.setOnStateChanged(() => {
    BrowserWindow.getAllWindows().forEach(w => {
      if (!w.isDestroyed()) w.webContents.send(IpcChannels.VaultStateChanged, vault.getStatus());
    });
  });
  vault.startAutoLock();

  // ── Clipboard (uses Electron's native clipboard module — more reliable than navigator.clipboard) ──
  safeHandle(IpcChannels.ClipboardWrite, (_, text: string) => {
    try {
      clipboard.writeText(text ?? '');
      return true;
    } catch (err) {
      console.error('Clipboard write failed:', err);
      return false;
    }
  });

  safeHandle(IpcChannels.ClipboardClearIfMatch, (_, text: string) => {
    try {
      const current = clipboard.readText();
      if (current === text) {
        clipboard.writeText('');
        return true;
      }
      return false;
    } catch (err) {
      console.error('Clipboard clear failed:', err);
      return false;
    }
  });

  ipcMain.on('minimize-window', () => {
    win?.setAlwaysOnTop(false);
    win?.minimize();
  });

  let windowSizeState = 0; // 0: Normal, 1: Third, 2: Full

  ipcMain.on('set-window-size', (_, newState: number) => {
    if (!win) return;
    if (newState === windowSizeState) return;

    windowSizeState = newState;
    const winBounds = win.getBounds();
    const display = screen.getDisplayNearestPoint({ x: winBounds.x, y: winBounds.y });
    // Use workArea to avoid overlapping with the taskbar
    const { width, height, x, y } = display.workArea;

    // Briefly enable resizing to allow the window size to change properly
    win.setResizable(true);

    if (windowSizeState === 0) {
      if (win.isMaximized()) win.unmaximize();
      win.setAspectRatio(1200 / 800);
      win.setSize(1200, 800);
      win.center();
      win.webContents.send('window-size-state', 0);
    } else if (windowSizeState === 1) {
      if (win.isMaximized()) win.unmaximize();
      win.setAspectRatio(0);
      const thirdWidth = Math.floor(width / 3);
      // Snap to left edge, taking full height
      win.setBounds({ x, y, width: thirdWidth, height });
      win.webContents.send('window-size-state', 1);
    } else if (windowSizeState === 2) {
      win.setAspectRatio(0);
      win.maximize();
      win.webContents.send('window-size-state', 2);
    }

    win.setResizable(false);
  });

  ipcMain.on('toggle-pin', (_, shouldPin) => {
    win?.setAlwaysOnTop(shouldPin);
  });

  ipcMain.on('close-window', () => {
    // Hide to tray instead of closing
    win?.hide();
  });

  ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.setIgnoreMouseEvents(ignore, options)
  })

  ipcMain.on('set-overlay-mode', (_, enable) => {
    if (!win || win.isDestroyed()) return;
    // Make window invisible during resize — opacity is instant, no animation
    win.setOpacity(0);
    win.setResizable(true);
    if (enable) {
      const winBounds = win.getBounds();
      const display = screen.getDisplayNearestPoint({ x: winBounds.x, y: winBounds.y });
      const { x, y, width, height } = display.bounds;
      win.setAspectRatio(0);
      if (win.isMaximized()) win.unmaximize();
      win.setBounds({ x, y, width, height });
      win.setAlwaysOnTop(true, 'screen-saver');
      win.setIgnoreMouseEvents(true, { forward: true });
    } else {
      windowSizeState = 0;
      win.setAspectRatio(1200 / 800);
      win.setAlwaysOnTop(false);
      win.setIgnoreMouseEvents(false);
      win.setSize(1200, 800);
      win.center();
      win.webContents.send('window-size-state', 0);
    }
    win.setResizable(false);
    // Restore visibility after all properties are set
    win.setOpacity(1);
  });

  // Global Shortcut for Notes Mode
  globalShortcut.register('CommandOrControl+`', () => {
    win?.webContents.send('toggle-notes-mode');
    if (win?.isMinimized()) win.restore();
    win?.focus();
  });

  // Global Shortcut for Year Mode (Ctrl + numpad 1)
  globalShortcut.register('CommandOrControl+num1', () => {
    win?.webContents.send('toggle-year-mode');
    if (win?.isMinimized()) win.restore();
    win?.focus();
  });

  // Global Shortcut for Budget Mode (Ctrl + numpad 2)
  globalShortcut.register('CommandOrControl+num2', () => {
    win?.webContents.send('toggle-budget-mode');
    if (win?.isMinimized()) win.restore();
    win?.focus();
  });

  // Global Shortcut for Fitness Mode (Ctrl + numpad 3)
  globalShortcut.register('CommandOrControl+num3', () => {
    win?.webContents.send('toggle-fitness-mode');
    if (win?.isMinimized()) win.restore();
    win?.focus();
  });

  // Global Shortcut for Passwords Mode (Ctrl + numpad 0)
  globalShortcut.register('CommandOrControl+num0', () => {
    win?.webContents.send('toggle-passwords-mode');
    if (win?.isMinimized()) win.restore();
    win?.focus();
  });

  // Global Shortcut for Command Palette (Ctrl+Space)
  globalShortcut.register('CommandOrControl+Space', () => {
    const preloadPath = path.join(__dirname, 'preload.mjs');
    togglePaletteWindow(preloadPath);
  });

  // ── Multi-window data-changed broadcast ───────────────────────
  ipcMain.on(IpcChannels.DataChanged, (event, payload) => {
    // Broadcast to all windows except the sender
    const senderId = event.sender.id;
    BrowserWindow.getAllWindows().forEach(w => {
      if (w.webContents.id !== senderId && !w.isDestroyed()) {
        w.webContents.send(IpcChannels.DataChanged, payload);
      }
    });
    // Also refresh tray state
    refreshTrayState();
  });

  // ── Palette IPC handlers ──────────────────────────────────────
  ipcMain.on('hide-palette', () => {
    hidePalette();
  });

  // ── Open full app (from tray/widget) ──────────────────────────
  ipcMain.on(IpcChannels.OpenFullApp, () => {
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });

  // ── Auto-launch IPC ───────────────────────────────────────────
  safeHandle(IpcChannels.SetAutoLaunch, (_, enabled: boolean) => {
    setAutoLaunch(enabled);
  });

  safeHandle(IpcChannels.GetAutoLaunch, () => {
    return getAutoLaunch();
  });

  // ── Notification prefs IPC ────────────────────────────────────
  safeHandle(IpcChannels.SetNotificationPrefs, (_, prefs) => {
    savePrefs(prefs);
  });

  safeHandle(IpcChannels.GetNotificationPrefs, () => {
    return getPrefs();
  });

  // ── Idle return response ──────────────────────────────────────
  ipcMain.on(IpcChannels.IdleReturnResponse, () => {
    // The renderer handles the actual timer logic;
    // this is just for any future main-process tracking
  });

  createWindow()

  // ── System Tray ───────────────────────────────────────────────
  const preloadPath = path.join(__dirname, 'preload.mjs');
  const iconDir = process.env.VITE_PUBLIC!;

  createTray(iconDir, {
    onToggleWidget: () => toggleWidgetWindow(preloadPath),
    onOpenPalette: () => togglePaletteWindow(preloadPath),
    onToggleTimer: () => {
      if (win && !win.isDestroyed()) win.webContents.send('tray-toggle-timer');
    },
    onOpenApp: () => {
      if (win && !win.isDestroyed()) {
        if (win.isMinimized()) win.restore();
        win.show();
        win.focus();
      }
    },
    onQuit: () => app.quit(),
  });

  // ── Tray state refresh ────────────────────────────────────────
  const refreshTrayState = async () => {
    if (!win || win.isDestroyed()) return;
    const state = await requestAppState(win);
    if (state) updateTrayState(state, iconDir);
  };

  // Refresh tray every 60s (lightweight — just one IPC roundtrip)
  setInterval(refreshTrayState, 60000);
  // Initial refresh once main window is ready
  win?.webContents.once('did-finish-load', () => {
    setTimeout(refreshTrayState, 3000); // Small delay for store to hydrate
  });

  // ── Notifications ─────────────────────────────────────────────
  loadPrefs();
  const getAppState = () => {
    if (!win || win.isDestroyed()) return Promise.resolve(null);
    return requestAppState(win);
  };
  startBreakReminders(getAppState);
  startStreakWarnings(getAppState);
  scheduleDailyBriefing(getAppState);

  // ── Idle Monitor ──────────────────────────────────────────────
  startIdleMonitor(
    () => win && !win.isDestroyed() ? win : null,
    async () => {
      const state = await getAppState();
      return state?.hasActiveTimer ?? false;
    },
  );

  // Auto-update: check via GitHub Releases. Downloads happen in the
  // background, but installation always asks the user first — never
  // silently swap the binary under them.
  import('electron-updater')
    .then(({ autoUpdater }) => {
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = false;
      autoUpdater.on('error', (err) => console.error('[auto-update]', err));
      autoUpdater.on('update-downloaded', (info) => {
        if (!win || win.isDestroyed()) return;
        dialog.showMessageBox(win, {
          type: 'info',
          title: 'Update ready',
          message: `mOS ${info.version} has been downloaded.`,
          detail: 'Restart now to install it, or keep working and install later.',
          buttons: ['Restart now', 'Later'],
          defaultId: 0,
          cancelId: 1,
        }).then(({ response }) => {
          if (response === 0) {
            isQuitting = true; // allow the close handler to let windows close
            autoUpdater.quitAndInstall();
          }
        });
      });
      autoUpdater.checkForUpdates().catch((err) => {
        console.warn('[auto-update] checkForUpdates rejected:', err?.message ?? err);
      });
    })
    .catch((err) => {
      // electron-updater may not be available in dev mode — log instead of swallowing.
      console.warn('[auto-update] electron-updater unavailable:', err?.message ?? err);
    });
})

app.on('before-quit', () => {
  isQuitting = true;
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  destroyTray()
  stopAllNotificationTimers()
  stopIdleMonitor()
  vault.stopAutoLock()
})
