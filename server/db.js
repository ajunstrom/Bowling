const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'bowling.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      status TEXT DEFAULT 'setup',
      current_game INTEGER DEFAULT 0,
      settings TEXT NOT NULL DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bowlers (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      name TEXT NOT NULL,
      handicap INTEGER DEFAULT 0,
      num_entries INTEGER DEFAULT 1,
      amount_owed REAL DEFAULT 0,
      amount_paid REAL DEFAULT 0,
      bowler_token TEXT UNIQUE,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS scores (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      bowler_id TEXT NOT NULL,
      game INTEGER NOT NULL CHECK(game IN (1,2,3)),
      raw_score INTEGER NOT NULL,
      submitted_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(bowler_id, game),
      FOREIGN KEY (bowler_id) REFERENCES bowlers(id) ON DELETE CASCADE,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS brackets (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      bracket_number INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bracket_slots (
      id TEXT PRIMARY KEY,
      bracket_id TEXT NOT NULL,
      bowler_id TEXT NOT NULL,
      slot_number INTEGER NOT NULL,
      FOREIGN KEY (bracket_id) REFERENCES brackets(id) ON DELETE CASCADE,
      FOREIGN KEY (bowler_id) REFERENCES bowlers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bracket_matches (
      id TEXT PRIMARY KEY,
      bracket_id TEXT NOT NULL,
      mode TEXT NOT NULL CHECK(mode IN ('handicap','scratch')),
      round INTEGER NOT NULL CHECK(round IN (1,2,3)),
      match_position INTEGER NOT NULL,
      bowler1_id TEXT,
      bowler2_id TEXT,
      winner_id TEXT,
      score1 INTEGER,
      score2 INTEGER,
      FOREIGN KEY (bracket_id) REFERENCES brackets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS contest_entries (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      contest_type TEXT NOT NULL,
      bowler_id TEXT NOT NULL,
      UNIQUE(session_id, contest_type, bowler_id),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (bowler_id) REFERENCES bowlers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS mystery_doubles_pairs (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      bowler1_id TEXT NOT NULL,
      bowler2_id TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payouts (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      bowler_id TEXT NOT NULL,
      contest_type TEXT NOT NULL,
      description TEXT,
      placement INTEGER,
      amount REAL NOT NULL,
      is_paid INTEGER DEFAULT 0,
      forwarded INTEGER DEFAULT 0,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (bowler_id) REFERENCES bowlers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS delegates (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      name TEXT NOT NULL,
      access_code TEXT UNIQUE NOT NULL,
      can_manage_entries INTEGER DEFAULT 0,
      can_enter_scores INTEGER DEFAULT 0,
      can_record_payments INTEGER DEFAULT 0,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS score_submissions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      bowler_id TEXT,
      game INTEGER,
      image_path TEXT,
      extracted_data TEXT,
      status TEXT DEFAULT 'pending',
      submitted_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );
  `);
}

module.exports = { getDb };
