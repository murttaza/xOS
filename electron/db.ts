import { createRequire } from 'node:module';
import path from 'path';
import { app } from 'electron';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const dbPath = path.join(app.getPath('userData'), 'lifeos.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// The local database holds ONLY the password vault. All other app data
// (tasks, notes, budget, fitness, …) lives in Supabase — the legacy local
// tables that predate the cloud migration are intentionally no longer
// created here. Existing installs keep their old tables inert on disk;
// nothing reads or writes them.
db.exec(`
  CREATE TABLE IF NOT EXISTS passwords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT,
    passwordEnc TEXT,
    url TEXT,
    notes TEXT,
    category TEXT,
    isPinned INTEGER DEFAULT 0,
    orderIndex INTEGER DEFAULT 0,
    createdAt TEXT,
    updatedAt TEXT,
    lastUsed TEXT
  );

  CREATE TABLE IF NOT EXISTS vault_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

export default db;
