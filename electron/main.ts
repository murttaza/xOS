import { app, BrowserWindow, ipcMain, screen, globalShortcut, session, desktopCapturer, nativeTheme } from 'electron'
import path from 'node:path'
import db from './db'
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

  // DevTools shortcut: Ctrl+Shift+I
  win.webContents.on('before-input-event', (_event, input) => {
    if (input.control && input.shift && input.key === 'I') {
      win?.webContents.toggleDevTools();
    }
  });

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
    // win.loadFile('dist/index.html')
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
  // const { session, desktopCapturer } = require('electron') as typeof import('electron'); // imported at top level
  session.defaultSession.setPermissionRequestHandler((_webContents: Electron.WebContents, permission: string, callback: (granted: boolean) => void) => {
    // Allow audio and video capture for system audio loopback
    if (permission === 'media' || permission === 'audioCapture' || permission === 'videoCapture') {
      callback(true);
    } else {
      callback(false); // Deny non-media permissions
    }
  });

  // Also set display media request handler for screen/audio capture
  session.defaultSession.setDisplayMediaRequestHandler((_request: unknown, callback: (streams: { video: Electron.DesktopCapturerSource; audio: 'loopback' }) => void) => {
    // Auto-select the primary screen
    desktopCapturer.getSources({ types: ['screen'] }).then((sources: Electron.DesktopCapturerSource[]) => {
      if (sources.length > 0) {
        callback({ video: sources[0], audio: 'loopback' });
      }
    });
  });

  // Pre-cache prepared statements for frequently-called IPC handlers
  const stmts = {
    getTasks: db.prepare('SELECT * FROM tasks'),
    addTask: db.prepare('INSERT INTO tasks (title, description, dueDate, difficulty, statTarget, labels, repeatingTaskId, subtasks, noteId, time) VALUES (@title, @description, @dueDate, @difficulty, @statTarget, @labels, @repeatingTaskId, @subtasks, @noteId, @time)'),
    updateTask: db.prepare('UPDATE tasks SET title = @title, description = @description, dueDate = @dueDate, difficulty = @difficulty, isComplete = @isComplete, statTarget = @statTarget, labels = @labels, subtasks = @subtasks, completedAt = @completedAt, noteId = @noteId, time = @time WHERE id = @id'),
    deleteTask: db.prepare('DELETE FROM tasks WHERE id = ?'),
    addSession: db.prepare('INSERT INTO sessions (taskId, startTime, endTime, duration_minutes, dateLogged) VALUES (@taskId, @startTime, @endTime, @duration_minutes, @dateLogged)'),
    getSessionsByDate: db.prepare('SELECT * FROM sessions WHERE dateLogged = ?'),
    getSessionsRange: db.prepare('SELECT * FROM sessions WHERE dateLogged BETWEEN ? AND ?'),
    getSessionsByTask: db.prepare('SELECT * FROM sessions WHERE taskId = ? ORDER BY startTime DESC'),
    getStats: db.prepare('SELECT * FROM stats'),
    updateStat: db.prepare('UPDATE stats SET currentXP = ?, currentLevel = ? WHERE statName = ?'),
    addStat: db.prepare('INSERT INTO stats (statName) VALUES (?)'),
    deleteStat: db.prepare('DELETE FROM stats WHERE statName = ?'),
    getDailyLog: db.prepare('SELECT * FROM daily_logs WHERE date = ?'),
    saveDailyLog: db.prepare('INSERT OR REPLACE INTO daily_logs (date, journalEntry, prayersCompleted) VALUES (@date, @journalEntry, @prayersCompleted)'),
    getDailyLogForJournal: db.prepare('SELECT * FROM daily_logs WHERE date = ?'),
    updateJournalEntry: db.prepare('UPDATE daily_logs SET journalEntry = ? WHERE date = ?'),
    insertJournalEntry: db.prepare("INSERT INTO daily_logs (date, journalEntry, prayersCompleted) VALUES (?, ?, '{}')"),
    getDevItems: db.prepare('SELECT * FROM dev_items'),
    addDevItem: db.prepare('INSERT INTO dev_items (text) VALUES (?)'),
    toggleDevItem: db.prepare('UPDATE dev_items SET isComplete = ? WHERE id = ?'),
    deleteDevItem: db.prepare('DELETE FROM dev_items WHERE id = ?'),
    getRepeatingTasks: db.prepare('SELECT * FROM repeating_tasks'),
    addRepeatingTask: db.prepare('INSERT INTO repeating_tasks (title, description, difficulty, statTarget, labels, repeatType, repeatDays, isActive, lastGeneratedDate, subtasks, streak) VALUES (@title, @description, @difficulty, @statTarget, @labels, @repeatType, @repeatDays, @isActive, @lastGeneratedDate, @subtasks, @streak)'),
    updateRepeatingTask: db.prepare('UPDATE repeating_tasks SET title = @title, description = @description, difficulty = @difficulty, statTarget = @statTarget, labels = @labels, repeatType = @repeatType, repeatDays = @repeatDays, isActive = @isActive, lastGeneratedDate = @lastGeneratedDate, subtasks = @subtasks, streak = @streak WHERE id = @id'),
    deleteRepeatingTask: db.prepare('DELETE FROM repeating_tasks WHERE id = ?'),
    getSubjects: db.prepare('SELECT * FROM subjects ORDER BY orderIndex ASC, id ASC'),
    createSubject: db.prepare('INSERT INTO subjects (title, color, createdAt, orderIndex) VALUES (@title, @color, @createdAt, @orderIndex)'),
    updateSubject: db.prepare('UPDATE subjects SET title = @title, color = @color WHERE id = @id'),
    deleteSubject: db.prepare('DELETE FROM subjects WHERE id = ?'),
    getNotes: db.prepare('SELECT * FROM notes WHERE subjectId = ? ORDER BY updatedAt DESC'),
    createNote: db.prepare('INSERT INTO notes (subjectId, title, content, createdAt, updatedAt) VALUES (@subjectId, @title, @content, @createdAt, @updatedAt)'),
    getNote: db.prepare('SELECT n.*, s.title as subjectTitle, s.color as subjectColor FROM notes n JOIN subjects s ON n.subjectId = s.id WHERE n.id = ?'),
    updateNote: db.prepare('UPDATE notes SET title = @title, content = @content, updatedAt = @updatedAt WHERE id = @id'),
    deleteNote: db.prepare('DELETE FROM notes WHERE id = ?'),
    searchNotes: db.prepare('SELECT n.*, s.title as subjectTitle, s.color as subjectColor FROM notes n JOIN subjects s ON n.subjectId = s.id WHERE n.title LIKE ? OR n.content LIKE ? ORDER BY n.updatedAt DESC'),
    getStreaks: db.prepare('SELECT * FROM streaks ORDER BY id ASC'),
    createStreak: db.prepare('INSERT INTO streaks (title, currentStreak, lastUpdated, isPaused, createdAt) VALUES (@title, @currentStreak, @lastUpdated, @isPaused, @createdAt)'),
    updateStreak: db.prepare('UPDATE streaks SET title = @title, currentStreak = @currentStreak, lastUpdated = @lastUpdated, isPaused = @isPaused, createdAt = @createdAt WHERE id = @id'),
    deleteStreak: db.prepare('DELETE FROM streaks WHERE id = ?'),
    renameStatUpdate: db.prepare('UPDATE stats SET statName = ? WHERE statName = ?'),
    renameStatGetTasks: db.prepare('SELECT id, statTarget FROM tasks'),
    renameStatUpdateTask: db.prepare('UPDATE tasks SET statTarget = ? WHERE id = ?'),
  };

  // IPC Handlers (using cached prepared statements)
  ipcMain.handle(IpcChannels.GetTasks, () => {
    return stmts.getTasks.all();
  });

  ipcMain.handle(IpcChannels.AddTask, (_, task) => {
    return stmts.addTask.run({
      ...task,
      statTarget: JSON.stringify(task.statTarget),
      labels: JSON.stringify(task.labels),
      repeatingTaskId: task.repeatingTaskId || null,
      subtasks: JSON.stringify(task.subtasks || []),
      noteId: task.noteId || null,
      time: task.time || null
    });
  });

  ipcMain.handle(IpcChannels.UpdateTask, (_, task) => {
    return stmts.updateTask.run({
      ...task,
      completedAt: task.completedAt || null,
      statTarget: JSON.stringify(task.statTarget),
      labels: JSON.stringify(task.labels),
      subtasks: JSON.stringify(task.subtasks || []),
      noteId: task.noteId || null,
      time: task.time || null
    });
  });

  ipcMain.handle(IpcChannels.DeleteTask, (_, id) => {
    return stmts.deleteTask.run(id);
  });

  // Batch insert multiple tasks in a single transaction
  ipcMain.handle(IpcChannels.BatchAddTasks, (_, tasks: any[]) => {
    const batchInsert = db.transaction((taskList: any[]) => {
      const results = [];
      for (const task of taskList) {
        results.push(stmts.addTask.run({
          ...task,
          statTarget: JSON.stringify(task.statTarget),
          labels: JSON.stringify(task.labels),
          repeatingTaskId: task.repeatingTaskId || null,
          subtasks: JSON.stringify(task.subtasks || []),
          noteId: task.noteId || null,
          time: task.time || null
        }));
      }
      return results;
    });
    return batchInsert(tasks);
  });

  // Sessions
  ipcMain.handle(IpcChannels.AddSession, (_, session) => {
    return stmts.addSession.run(session);
  });

  ipcMain.handle(IpcChannels.GetSessionsByDate, (_, date) => {
    return stmts.getSessionsByDate.all(date);
  });

  ipcMain.handle(IpcChannels.GetSessionsRange, (_, { startDate, endDate }) => {
    return stmts.getSessionsRange.all(startDate, endDate);
  });

  ipcMain.handle(IpcChannels.GetSessionsByTask, (_, taskId) => {
    return stmts.getSessionsByTask.all(taskId);
  });
  // Stats
  ipcMain.handle(IpcChannels.GetStats, () => {
    return stmts.getStats.all();
  });

  ipcMain.handle(IpcChannels.UpdateStat, (_, { statName, currentXP, currentLevel }) => {
    return stmts.updateStat.run(currentXP, currentLevel, statName);
  });

  ipcMain.handle(IpcChannels.AddStat, (_, statName) => {
    return stmts.addStat.run(statName);
  });

  ipcMain.handle(IpcChannels.DeleteStat, (_, statName) => {
    return stmts.deleteStat.run(statName);
  });

  ipcMain.handle(IpcChannels.RenameStat, (_, { oldName, newName }) => {
    const transaction = db.transaction(() => {
      stmts.renameStatUpdate.run(newName, oldName);

      const tasks = stmts.renameStatGetTasks.all();

      tasks.forEach((task: { id: number; statTarget: string }) => {
        let targets: string[] = [];
        try {
          targets = JSON.parse(task.statTarget || '[]');
        } catch (e) {
          targets = [];
        }

        if (Array.isArray(targets) && targets.includes(oldName)) {
          targets = targets.map(t => t === oldName ? newName : t);
          stmts.renameStatUpdateTask.run(JSON.stringify(targets), task.id);
        }
      });
    });
    return transaction();
  });

  // Daily Log
  ipcMain.handle(IpcChannels.GetDailyLog, (_, date) => {
    return stmts.getDailyLog.get(date);
  });

  ipcMain.handle(IpcChannels.SaveDailyLog, (_, log) => {
    return stmts.saveDailyLog.run(log);
  });

  ipcMain.handle(IpcChannels.SaveJournalEntry, (_, { date, entry }) => {
    const row = stmts.getDailyLogForJournal.get(date);
    if (row) {
      return stmts.updateJournalEntry.run(entry, date);
    } else {
      return stmts.insertJournalEntry.run(date, entry);
    }
  });

  // Dev Items
  ipcMain.handle(IpcChannels.GetDevItems, () => {
    return stmts.getDevItems.all();
  });

  ipcMain.handle(IpcChannels.AddDevItem, (_, text) => {
    return stmts.addDevItem.run(text);
  });

  ipcMain.handle(IpcChannels.ToggleDevItem, (_, { id, isComplete }) => {
    return stmts.toggleDevItem.run(isComplete, id);
  });

  ipcMain.handle(IpcChannels.DeleteDevItem, (_, id) => {
    return stmts.deleteDevItem.run(id);
  });

  // Repeating Tasks
  ipcMain.handle(IpcChannels.GetRepeatingTasks, () => {
    return stmts.getRepeatingTasks.all();
  });

  ipcMain.handle(IpcChannels.AddRepeatingTask, (_, task) => {
    return stmts.addRepeatingTask.run({
      ...task,
      lastGeneratedDate: task.lastGeneratedDate || null,
      statTarget: JSON.stringify(task.statTarget),
      labels: JSON.stringify(task.labels),
      repeatDays: JSON.stringify(task.repeatDays),
      subtasks: JSON.stringify(task.subtasks || []),
      streak: task.streak || 0
    });
  });

  ipcMain.handle(IpcChannels.UpdateRepeatingTask, (_, task) => {
    return stmts.updateRepeatingTask.run({
      ...task,
      lastGeneratedDate: task.lastGeneratedDate || null,
      statTarget: JSON.stringify(task.statTarget),
      labels: JSON.stringify(task.labels),
      repeatDays: JSON.stringify(task.repeatDays),
      subtasks: JSON.stringify(task.subtasks || []),
      streak: task.streak || 0
    });
  });

  ipcMain.handle(IpcChannels.DeleteRepeatingTask, (_, id) => {
    return stmts.deleteRepeatingTask.run(id);
  });

  // Notes Mode
  ipcMain.handle(IpcChannels.GetSubjects, () => {
    return stmts.getSubjects.all();
  });

  ipcMain.handle(IpcChannels.CreateSubject, (_, subject) => {
    return stmts.createSubject.run({
      ...subject,
      createdAt: new Date().toISOString()
    });
  });

  ipcMain.handle(IpcChannels.UpdateSubject, (_, subject) => {
    return stmts.updateSubject.run(subject);
  });

  ipcMain.handle(IpcChannels.DeleteSubject, (_, id) => {
    return stmts.deleteSubject.run(id);
  });

  ipcMain.handle(IpcChannels.GetNotes, (_, subjectId) => {
    return stmts.getNotes.all(subjectId);
  });

  ipcMain.handle(IpcChannels.CreateNote, (_, note) => {
    const now = new Date().toISOString();
    return stmts.createNote.run({
      ...note,
      createdAt: now,
      updatedAt: now
    });
  });

  ipcMain.handle(IpcChannels.GetNote, (_, id) => {
    return stmts.getNote.get(id);
  });

  ipcMain.handle(IpcChannels.UpdateNote, (_, note) => {
    return stmts.updateNote.run({
      ...note,
      updatedAt: new Date().toISOString()
    });
  });

  ipcMain.handle(IpcChannels.DeleteNote, (_, id) => {
    return stmts.deleteNote.run(id);
  });

  ipcMain.handle(IpcChannels.SearchNotes, (_, query) => {
    const likeQuery = `%${query}%`;
    return stmts.searchNotes.all(likeQuery, likeQuery);
  });

  // Streaks
  ipcMain.handle(IpcChannels.GetStreaks, () => {
    return stmts.getStreaks.all();
  });

  ipcMain.handle(IpcChannels.CreateStreak, (_, streak) => {
    const now = new Date().toISOString();
    return stmts.createStreak.run({
      ...streak,
      lastUpdated: streak.lastUpdated || now,
      createdAt: streak.createdAt || now
    });
  });

  ipcMain.handle(IpcChannels.UpdateStreak, (_, streak) => {
    return stmts.updateStreak.run(streak);
  });

  ipcMain.handle(IpcChannels.DeleteStreak, (_, id) => {
    return stmts.deleteStreak.run(id);
  });

  // Data Export - dumps all tables into a single JSON object
  ipcMain.handle(IpcChannels.ExportAllData, () => {
    return {
      tasks: db.prepare('SELECT * FROM tasks').all(),
      sessions: db.prepare('SELECT * FROM sessions').all(),
      stats: db.prepare('SELECT * FROM stats').all(),
      dailyLogs: db.prepare('SELECT * FROM daily_logs').all(),
      devItems: db.prepare('SELECT * FROM dev_items').all(),
      repeatingTasks: db.prepare('SELECT * FROM repeating_tasks').all(),
      subjects: db.prepare('SELECT * FROM subjects').all(),
      notes: db.prepare('SELECT * FROM notes').all(),
      streaks: db.prepare('SELECT * FROM streaks').all(),
      exportedAt: new Date().toISOString()
    };
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
  ipcMain.handle(IpcChannels.SetAutoLaunch, (_, enabled: boolean) => {
    setAutoLaunch(enabled);
  });

  ipcMain.handle(IpcChannels.GetAutoLaunch, () => {
    return getAutoLaunch();
  });

  // ── Notification prefs IPC ────────────────────────────────────
  ipcMain.handle(IpcChannels.SetNotificationPrefs, (_, prefs) => {
    savePrefs(prefs);
  });

  ipcMain.handle(IpcChannels.GetNotificationPrefs, () => {
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

  // Auto-update: check for updates via GitHub Releases
  try {
    import('electron-updater').then(({ autoUpdater }) => {
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;
      autoUpdater.checkForUpdatesAndNotify();
    });
  } catch {
    // electron-updater may not be available in dev mode
  }
})

app.on('before-quit', () => {
  isQuitting = true;
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  destroyTray()
  stopAllNotificationTimers()
  stopIdleMonitor()
})
