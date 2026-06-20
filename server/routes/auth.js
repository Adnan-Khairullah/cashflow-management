const express = require('express');
const bcrypt = require('bcryptjs');
const { getOne, getAll, runSql } = require('../db');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = getOne(
    'SELECT id, user_id, username, password_hash, role, full_name, phone FROM users WHERE username = ?',
    [username]
  );

  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  // Build session user object
  const sessionUser = {
    id: user.id,
    user_id: user.user_id,
    username: user.username,
    role: user.role,
    full_name: user.full_name,
    phone: user.phone,
  };

  // If contractor, attach company info
  if (user.role === 'contractor') {
    const contractor = getOne('SELECT company_name FROM contractors WHERE user_id = ?', [user.user_id]);
    if (contractor) sessionUser.company_name = contractor.company_name;
  }

  // If laborer, attach contractor info
  if (user.role === 'laborer') {
    const laborer = getOne('SELECT contractor_id FROM laborers WHERE user_id = ?', [user.user_id]);
    if (laborer) {
      sessionUser.contractor_id = laborer.contractor_id;
      const contractor = getOne('SELECT full_name FROM users WHERE user_id = ?', [laborer.contractor_id]);
      if (contractor) sessionUser.contractor_name = contractor.full_name;
    }
  }

  req.session.user = sessionUser;

  // Log audit
  runSql(
    'INSERT INTO audit_logs (entity_type, entity_id, action, performed_by) VALUES (?, ?, ?, ?)',
    ['user', user.user_id, 'login', user.user_id]
  );

  res.json({ success: true, user: sessionUser });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  if (req.session.user) {
    runSql(
      'INSERT INTO audit_logs (entity_type, entity_id, action, performed_by) VALUES (?, ?, ?, ?)',
      ['user', req.session.user.user_id, 'logout', req.session.user.user_id]
    );
  }
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Also return balance
  const balance = getOne('SELECT current_balance FROM balances WHERE user_id = ?', [req.session.user.user_id]);

  res.json({
    user: req.session.user,
    balance: balance ? balance.current_balance : 0,
  });
});

module.exports = router;
