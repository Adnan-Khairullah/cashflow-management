const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDb } = require('./db');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

async function startServer() {
  // Initialize database first
  await initDb();

  const app = express();
  const PORT = process.env.PORT || 3000;

  // ─── Middleware ─────────────────────────────────────────────────────────

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(session({
    secret: 'cashflow-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      sameSite: 'lax',
    },
  }));

  // ─── Static files ──────────────────────────────────────────────────────

  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use('/uploads', express.static(uploadsDir));

  // ─── Routes ────────────────────────────────────────────────────────────

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/bills', require('./routes/bills'));
  app.use('/api/users', require('./routes/users'));

  // ─── SPA fallback ──────────────────────────────────────────────────────

  app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
  });

  // ─── 404 catch ─────────────────────────────────────────────────────────

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // ─── Error handler ─────────────────────────────────────────────────────

  app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  // ─── Start ─────────────────────────────────────────────────────────────

  app.listen(PORT, () => {
    console.log(`\n  ┌─────────────────────────────────────────────┐`);
    console.log(`  │  Cash Flow Management Server                │`);
    console.log(`  │  Running on http://localhost:${PORT}            │`);
    console.log(`  │                                             │`);
    console.log(`  │  Admin: admin / admin123                    │`);
    console.log(`  └─────────────────────────────────────────────┘\n`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
