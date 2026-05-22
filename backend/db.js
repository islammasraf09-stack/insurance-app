'use strict';
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const DB_PATH = process.env.DB_PATH || path.join(DB_DIR, 'insurance.db');
const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS declarations (
    id          TEXT PRIMARY KEY,
    make_model  TEXT NOT NULL,
    year        INTEGER NOT NULL,
    chassis_vin TEXT NOT NULL,
    engine_no   TEXT NOT NULL,
    idv         REAL NOT NULL,
    currency    TEXT NOT NULL DEFAULT 'AED',
    signatory   TEXT NOT NULL,
    company     TEXT NOT NULL DEFAULT 'Raja Tahir Motors FZCO',
    issued_date TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'active',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_declarations_created ON declarations(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_declarations_status  ON declarations(status);
`);

module.exports = db;
