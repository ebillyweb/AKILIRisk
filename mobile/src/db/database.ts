import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const SCHEMA = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS drafts (
  questionId   TEXT PRIMARY KEY NOT NULL,
  interviewId  TEXT NOT NULL,
  mode         TEXT NOT NULL,            -- 'TYPE' | 'VOICE'
  text         TEXT,
  audioUri     TEXT,
  updatedAt    TEXT NOT NULL,
  syncState    TEXT NOT NULL             -- SAVED_LOCAL | QUEUED | SYNCED | FAILED
);

CREATE TABLE IF NOT EXISTS outbox (
  id             TEXT PRIMARY KEY NOT NULL,   -- client UUID = idempotency key
  interviewId    TEXT NOT NULL,
  questionId     TEXT NOT NULL,
  mode           TEXT NOT NULL,
  text           TEXT,
  audioUri       TEXT,
  updatedAt      TEXT NOT NULL,
  createdAt      TEXT NOT NULL,
  attempts       INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | DEAD
  lastError      TEXT
);

CREATE INDEX IF NOT EXISTS idx_outbox_status_created ON outbox (status, createdAt);
CREATE INDEX IF NOT EXISTS idx_drafts_interview ON drafts (interviewId);
`;

/** Opens (once) and migrates the on-device database. */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('akilirisk.db').then(async (db) => {
      await db.execAsync(SCHEMA);
      return db;
    });
  }
  return dbPromise;
}
