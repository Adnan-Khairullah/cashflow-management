const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'cashflow.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db = null;

// Save database to disk periodically
function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// Auto-save every 5 seconds
setInterval(saveDb, 5000);

async function initDb() {
  const SQL = await initSqlJs();

  // Load existing database or create new
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON');

  // ─── Create Tables ─────────────────────────────────────────────────────

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'contractor', 'laborer')),
      full_name TEXT NOT NULL DEFAULT '',
      phone TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS contractors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      company_name TEXT DEFAULT ''
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS laborers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      contractor_id TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_number TEXT UNIQUE NOT NULL,
      laborer_id TEXT NOT NULL,
      contractor_id TEXT NOT NULL,
      image_url TEXT,
      amount REAL NOT NULL,
      note TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending_contractor'
        CHECK(status IN (
          'draft',
          'pending_contractor',
          'pending_admin',
          'approved',
          'rejected_contractor',
          'rejected_admin',
          'cancelled'
        )),
      rejection_reason TEXT DEFAULT '',
      rejected_by TEXT DEFAULT '',
      upload_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      contractor_review_timestamp DATETIME,
      admin_review_timestamp DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER,
      user_id TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('credit', 'debit')),
      description TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS balances (
      user_id TEXT PRIMARY KEY,
      current_balance REAL NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT DEFAULT '',
      performed_by TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ─── Seed Data ─────────────────────────────────────────────────────────

  const existingUser = db.exec('SELECT id FROM users LIMIT 1');
  if (existingUser.length === 0) {
    seedUsers();
  }

  saveDb();
  console.log('✓ Database initialized');

  return db;
}

function seedUsers() {
  const salt = bcrypt.genSaltSync(10);

  const users = [
    { user_id: 'ADM0001', username: 'admin',       password: 'admin123', role: 'admin',      full_name: 'Rajesh Kumar (Admin)' },
    { user_id: 'CTR0001', username: 'contractor1',  password: 'contr123', role: 'contractor', full_name: 'Suresh Patel' },
    { user_id: 'CTR0002', username: 'contractor2',  password: 'contr456', role: 'contractor', full_name: 'Amit Sharma' },
    { user_id: 'LAB0001', username: 'laborer1',     password: 'labor123', role: 'laborer',    full_name: 'Ravi Singh' },
    { user_id: 'LAB0002', username: 'laborer2',     password: 'labor456', role: 'laborer',    full_name: 'Deepak Yadav' },
    { user_id: 'LAB0003', username: 'laborer3',     password: 'labor789', role: 'laborer',    full_name: 'Manoj Gupta' },
  ];

  for (const user of users) {
    db.run(
      'INSERT INTO users (user_id, username, password_hash, role, full_name) VALUES (?, ?, ?, ?, ?)',
      [user.user_id, user.username, bcrypt.hashSync(user.password, salt), user.role, user.full_name]
    );

    db.run(
      'INSERT INTO balances (user_id, current_balance) VALUES (?, 0)',
      [user.user_id]
    );
  }

  // Contractors
  db.run('INSERT INTO contractors (user_id, company_name) VALUES (?, ?)', ['CTR0001', 'Patel Construction']);
  db.run('INSERT INTO contractors (user_id, company_name) VALUES (?, ?)', ['CTR0002', 'Sharma Builders']);

  // Laborers → Contractors mapping
  db.run('INSERT INTO laborers (user_id, contractor_id) VALUES (?, ?)', ['LAB0001', 'CTR0001']);
  db.run('INSERT INTO laborers (user_id, contractor_id) VALUES (?, ?)', ['LAB0002', 'CTR0001']);
  db.run('INSERT INTO laborers (user_id, contractor_id) VALUES (?, ?)', ['LAB0003', 'CTR0002']);

  console.log('✓ Database seeded with default users');
}

// ─── Helper functions to mimic better-sqlite3 API ─────────────────────────

/**
 * Get a single row from a query
 */
function getOne(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  if (stmt.step()) {
    const columns = stmt.getColumnNames();
    const values = stmt.get();
    stmt.free();
    const row = {};
    columns.forEach((col, i) => { row[col] = values[i]; });
    return row;
  }
  stmt.free();
  return null;
}

/**
 * Get all rows from a query
 */
function getAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    const columns = stmt.getColumnNames();
    const values = stmt.get();
    const row = {};
    columns.forEach((col, i) => { row[col] = values[i]; });
    rows.push(row);
  }
  stmt.free();
  return rows;
}

/**
 * Run a statement (INSERT/UPDATE/DELETE) and return info
 */
function runSql(sql, params = []) {
  db.run(sql, params);
  const changes = db.getRowsModified();
  // Get last insert rowid
  const result = db.exec('SELECT last_insert_rowid() as id');
  const lastInsertRowid = result.length > 0 ? result[0].values[0][0] : 0;
  saveDb();
  return { changes, lastInsertRowid };
}

module.exports = { initDb, getOne, getAll, runSql, saveDb };
