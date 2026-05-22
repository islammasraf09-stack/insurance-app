'use strict';
const { Pool } = require('pg');

// Uses DATABASE_URL environment variable set on Render
// For local dev: uses local SQLite fallback
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS declarations (
      id          TEXT PRIMARY KEY,
      make_model  TEXT NOT NULL,
      year        INTEGER NOT NULL,
      chassis_vin TEXT NOT NULL,
      engine_no   TEXT NOT NULL,
      idv         NUMERIC NOT NULL,
      currency    TEXT NOT NULL DEFAULT 'AED',
      signatory   TEXT NOT NULL,
      company     TEXT NOT NULL DEFAULT 'Raja Tahir Motors FZCO',
      issued_date TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'active',
      created_at  TIMESTAMP DEFAULT NOW(),
      updated_at  TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_declarations_created ON declarations(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_declarations_status  ON declarations(status);
  `);
  console.log('✅  PostgreSQL database ready');
}

module.exports = { pool, initDB };
