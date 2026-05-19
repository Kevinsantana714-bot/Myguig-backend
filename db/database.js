const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = path.join(__dirname, 'myguig.db');

const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    email      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password   TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS token_blacklist (
    token      TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL
  );
`);

// Migration: add role column if not present
try {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'musician'");
} catch (_) { /* column already exists */ }

db.exec(`
  CREATE TABLE IF NOT EXISTS proposals (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    contractor_id    INTEGER NOT NULL REFERENCES users(id),
    musician_id      INTEGER NOT NULL REFERENCES users(id),
    evento           TEXT    NOT NULL,
    data_iso         TEXT    NOT NULL,
    horario_inicio   TEXT,
    horario_termino  TEXT,
    local            TEXT    NOT NULL,
    cache            INTEGER NOT NULL DEFAULT 0,
    estilos          TEXT    NOT NULL DEFAULT '[]',
    repertorio       TEXT,
    metodo           TEXT,
    descricao        TEXT,
    status           TEXT    NOT NULL DEFAULT 'pending',
    decline_reason   TEXT,
    created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS counter_proposals (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    proposal_id  INTEGER NOT NULL REFERENCES proposals(id),
    author_id    INTEGER NOT NULL REFERENCES users(id),
    novo_cache   INTEGER,
    novo_horario TEXT,
    mensagem     TEXT,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id),
    type         TEXT    NOT NULL,
    proposal_id  INTEGER REFERENCES proposals(id),
    message      TEXT    NOT NULL,
    read         INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

module.exports = db;
