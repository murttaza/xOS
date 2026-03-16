import { createRequire } from 'node:module';
import path from 'path';
import { app } from 'electron';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const dbPath = path.join(app.getPath('userData'), 'lifeos.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    dueDate TEXT,
    difficulty INTEGER,
    isComplete INTEGER DEFAULT 0,
    statTarget TEXT,
    labels TEXT,
    repeatingTaskId INTEGER,
    subtasks TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    taskId INTEGER,
    startTime TEXT,
    endTime TEXT,
    duration_minutes INTEGER,
    dateLogged TEXT,
    FOREIGN KEY(taskId) REFERENCES tasks(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_dateLogged ON sessions(dateLogged);
  CREATE INDEX IF NOT EXISTS idx_sessions_taskId ON sessions(taskId);

  CREATE TABLE IF NOT EXISTS daily_logs (
    date TEXT PRIMARY KEY,
    journalEntry TEXT,
    prayersCompleted TEXT
  );

  CREATE TABLE IF NOT EXISTS stats (
    statName TEXT PRIMARY KEY,
    currentXP INTEGER DEFAULT 0,
    currentLevel INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS dev_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    isComplete INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS repeating_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    difficulty INTEGER,
    statTarget TEXT,
    labels TEXT,
    repeatType TEXT, -- 'daily', 'weekly'
    repeatDays TEXT, -- JSON array of numbers 0-6
    isActive INTEGER DEFAULT 1,
    lastGeneratedDate TEXT,
    subtasks TEXT,
    streak INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    color TEXT DEFAULT '#ef4444', 
    createdAt TEXT,
    orderIndex INTEGER
  );

  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subjectId INTEGER NOT NULL,
    title TEXT,
    content TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    FOREIGN KEY(subjectId) REFERENCES subjects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS streaks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    currentStreak INTEGER DEFAULT 0,
    lastUpdated TEXT,
    isPaused INTEGER DEFAULT 0,
    createdAt TEXT
  );
`);

// Migration for existing tables
try {
  db.prepare('ALTER TABLE tasks ADD COLUMN repeatingTaskId INTEGER').run();
} catch (error) {
  // Column likely already exists
}
try {
  db.prepare('ALTER TABLE tasks ADD COLUMN subtasks TEXT').run();
} catch (error) {
  // Column likely already exists
}
try {
  db.prepare('ALTER TABLE repeating_tasks ADD COLUMN subtasks TEXT').run();
} catch (error) {
  // Column likely already exists
}
try {
  db.prepare('ALTER TABLE repeating_tasks ADD COLUMN streak INTEGER DEFAULT 0').run();
} catch (error) {
  // Column likely already exists
}
try {
  db.prepare('ALTER TABLE tasks ADD COLUMN completedAt TEXT').run();
} catch (error) {
  // Column likely already exists
}

// Additional migrations for time and noteId
try {
  db.prepare('ALTER TABLE tasks ADD COLUMN noteId INTEGER').run();
} catch (error) {
  // Column likely already exists
}
try {
  db.prepare('ALTER TABLE tasks ADD COLUMN time TEXT').run();
} catch (error) {
  // Column likely already exists
}

// Initialize Stats if empty
const stats = ['Fitness', 'Mental', 'Religion', 'Finance', 'Social'];
const insertStat = db.prepare('INSERT OR IGNORE INTO stats (statName) VALUES (?)');
stats.forEach(stat => insertStat.run(stat));

// Migration: Add curveVersion column for XP curve migration tracking
try {
  db.prepare('ALTER TABLE stats ADD COLUMN curveVersion INTEGER DEFAULT 1').run();
} catch (error) {
  // Column likely already exists
}

// One-time migration: Recalculate XP from old curve (1000*level^1.5) to new curve (800 + 400*level*log2(level+1))
const unmigrated = db.prepare('SELECT * FROM stats WHERE curveVersion = 1 AND currentLevel > 1').all() as Array<{
  statName: string; currentXP: number; currentLevel: number; curveVersion: number;
}>;
if (unmigrated.length > 0) {
  const oldCurve = (l: number) => Math.floor(1000 * Math.pow(l, 1.5));
  const newCurve = (l: number) => Math.floor(800 + 400 * l * Math.log2(l + 1));

  const updateMigrated = db.prepare(
    'UPDATE stats SET currentLevel = ?, currentXP = ?, curveVersion = 2 WHERE statName = ?'
  );

  for (const stat of unmigrated) {
    // Calculate total lifetime XP under old curve
    let totalXP = stat.currentXP;
    for (let l = 1; l < stat.currentLevel; l++) {
      totalXP += oldCurve(l);
    }

    // Re-derive level/XP under new curve
    let level = 1;
    let remaining = totalXP;
    while (remaining >= newCurve(level)) {
      remaining -= newCurve(level);
      level++;
    }

    // Never lose levels
    const finalLevel = Math.max(level, stat.currentLevel);
    const finalXP = finalLevel > level ? 0 : Math.floor(remaining);

    updateMigrated.run(finalLevel, finalXP, stat.statName);
  }
}

// Mark any remaining level-1 stats as migrated (nothing to recalculate)
db.prepare('UPDATE stats SET curveVersion = 2 WHERE curveVersion = 1').run();

export default db;
