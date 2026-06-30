const express = require('express');
const bcrypt = require('bcryptjs');
const { getOne, getAll, runSql } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// POST /api/users/create — Create a user (admin only)
router.post('/create', requireAuth, requireRole('admin'), (req, res) => {
  const { username, password, full_name, phone, role, company_name, contractor_id } = req.body;

  if (!username || !password || !full_name || !role) {
    return res.status(400).json({ error: 'Username, password, full name, and role are required' });
  }

  if (!['contractor', 'laborer'].includes(role)) {
    return res.status(400).json({ error: 'Role must be contractor or laborer' });
  }

  // Check duplicate username
  const existing = getOne('SELECT id FROM users WHERE username = ?', [username]);
  if (existing) {
    return res.status(409).json({ error: 'Username already exists' });
  }

  if (role === 'laborer' && !contractor_id) {
    return res.status(400).json({ error: 'Contractor ID is required for laborers' });
  }

  if (role === 'laborer') {
    const contractorExists = getOne("SELECT user_id FROM users WHERE user_id = ? AND role = 'contractor'", [contractor_id]);
    if (!contractorExists) {
      return res.status(400).json({ error: 'Invalid contractor ID' });
    }
  }

  // Generate user_id
  const prefix = role === 'contractor' ? 'CTR' : 'LAB';
  const countResult = getOne("SELECT COUNT(*) as cnt FROM users WHERE role = ?", [role]);
  const count = (countResult ? countResult.cnt : 0) + 1;
  const user_id = `${prefix}${String(count).padStart(4, '0')}`;

  const salt = bcrypt.genSaltSync(10);
  const password_hash = bcrypt.hashSync(password, salt);

  runSql(
    'INSERT INTO users (user_id, username, password_hash, role, full_name, phone) VALUES (?, ?, ?, ?, ?, ?)',
    [user_id, username, password_hash, role, full_name, phone || '']
  );

  runSql('INSERT INTO balances (user_id, current_balance) VALUES (?, 0)', [user_id]);

  if (role === 'contractor' && company_name) {
    runSql('INSERT INTO contractors (user_id, company_name) VALUES (?, ?)', [user_id, company_name]);
  } else if (role === 'contractor') {
    runSql('INSERT INTO contractors (user_id, company_name) VALUES (?, ?)', [user_id, '']);
  }

  if (role === 'laborer' && contractor_id) {
    runSql('INSERT INTO laborers (user_id, contractor_id) VALUES (?, ?)', [user_id, contractor_id]);
  }

  runSql(
    'INSERT INTO audit_logs (entity_type, entity_id, action, performed_by) VALUES (?, ?, ?, ?)',
    ['user', user_id, 'created_by_admin', req.session.user.user_id]
  );

  res.json({ success: true, user: { user_id, username, full_name, role, phone: phone || '' } });
});

// GET /api/users/laborers — List laborers (contractors see only theirs, admin sees all)
router.get('/laborers', requireAuth, requireRole('contractor', 'admin'), (req, res) => {
  const user = req.session.user;
  let laborers;

  if (user.role === 'contractor') {
    laborers = getAll(
      `SELECT u.user_id, u.username, u.full_name, u.phone, b.current_balance
       FROM laborers l
       JOIN users u ON l.user_id = u.user_id
       LEFT JOIN balances b ON u.user_id = b.user_id
       WHERE l.contractor_id = ?
       ORDER BY u.full_name`,
      [user.user_id]
    );
  } else {
    laborers = getAll(
      `SELECT u.user_id, u.username, u.full_name, u.phone, b.current_balance,
        l.contractor_id, cu.full_name as contractor_name
       FROM laborers l
       JOIN users u ON l.user_id = u.user_id
       LEFT JOIN balances b ON u.user_id = b.user_id
       LEFT JOIN users cu ON l.contractor_id = cu.user_id
       ORDER BY u.full_name`
    );
  }

  res.json({ laborers });
});

// GET /api/users/contractors — List contractors (admin only)
router.get('/contractors', requireAuth, requireRole('admin'), (req, res) => {
  const contractors = getAll(
    `SELECT u.user_id, u.username, u.full_name, u.phone, c.company_name,
      (SELECT COUNT(*) FROM laborers l WHERE l.contractor_id = u.user_id) as laborer_count
     FROM contractors c
     JOIN users u ON c.user_id = u.user_id
     ORDER BY u.full_name`
  );

  res.json({ contractors });
});

// GET /api/users/transactions — Transaction history
router.get('/transactions', requireAuth, (req, res) => {
  const user = req.session.user;
  let transactions;

  if (user.role === 'laborer') {
    transactions = getAll(
      `SELECT t.*, b.bill_number
       FROM transactions t
       LEFT JOIN bills b ON t.bill_id = b.id
       WHERE t.user_id = ?
       ORDER BY t.created_at DESC
       LIMIT 50`,
      [user.user_id]
    );
  } else if (user.role === 'contractor') {
    transactions = getAll(
      `SELECT t.*, b.bill_number, u.full_name as laborer_name
       FROM transactions t
       LEFT JOIN bills b ON t.bill_id = b.id
       LEFT JOIN users u ON t.user_id = u.user_id
       WHERE t.user_id IN (SELECT user_id FROM laborers WHERE contractor_id = ?)
       ORDER BY t.created_at DESC
       LIMIT 100`,
      [user.user_id]
    );
  } else {
    transactions = getAll(
      `SELECT t.*, b.bill_number, u.full_name as user_name
       FROM transactions t
       LEFT JOIN bills b ON t.bill_id = b.id
       LEFT JOIN users u ON t.user_id = u.user_id
       ORDER BY t.created_at DESC
       LIMIT 200`
    );
  }

  res.json({ transactions });
});

// GET /api/users/all — List all non-admin users with credentials info (admin only)
router.get('/all', requireAuth, requireRole('admin'), (req, res) => {
  const users = getAll(
    `SELECT u.user_id, u.username, u.full_name, u.phone, u.role, u.created_at,
            c.company_name,
            (SELECT cu.full_name FROM users cu JOIN laborers l2 ON cu.user_id = l2.contractor_id WHERE l2.user_id = u.user_id) as contractor_name
     FROM users u
     LEFT JOIN contractors c ON u.user_id = c.user_id
     WHERE u.role IN ('contractor', 'laborer')
     ORDER BY u.role, u.full_name`
  );

  res.json({ users });
});

// POST /api/users/:user_id/reset-password — Reset a user's password (admin only)
router.post('/:user_id/reset-password', requireAuth, requireRole('admin'), (req, res) => {
  const { user_id } = req.params;
  const { password } = req.body;

  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }

  const user = getOne('SELECT id, username, full_name FROM users WHERE user_id = ?', [user_id]);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const salt = bcrypt.genSaltSync(10);
  const password_hash = bcrypt.hashSync(password, salt);

  runSql('UPDATE users SET password_hash = ? WHERE user_id = ?', [password_hash, user_id]);

  runSql(
    'INSERT INTO audit_logs (entity_type, entity_id, action, performed_by) VALUES (?, ?, ?, ?)',
    ['user', user_id, 'password_reset_by_admin', req.session.user.user_id]
  );

  res.json({ success: true, message: `Password reset for ${user.full_name} (${user.username})` });
});

// DELETE /api/users/:user_id — Delete a user and all related data (admin only)
router.delete('/:user_id', requireAuth, requireRole('admin'), (req, res) => {
  const { user_id } = req.params;

  const user = getOne('SELECT id, role, full_name FROM users WHERE user_id = ?', [user_id]);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (user.role === 'admin') {
    return res.status(403).json({ error: 'Cannot delete admin users' });
  }

  const fullName = user.full_name;

  // Delete related records
  if (user.role === 'contractor') {
    // Delete laborers assigned to this contractor
    const laborers = getAll('SELECT user_id FROM laborers WHERE contractor_id = ?', [user_id]);
    for (const lab of laborers) {
      runSql('DELETE FROM transactions WHERE user_id = ?', [lab.user_id]);
      runSql('DELETE FROM balances WHERE user_id = ?', [lab.user_id]);
      runSql('UPDATE bills SET status = ? WHERE laborer_id = ?', ['cancelled', lab.user_id]);
      runSql('DELETE FROM laborers WHERE user_id = ?', [lab.user_id]);
      runSql('DELETE FROM audit_logs WHERE entity_id = ?', [lab.user_id]);
      runSql('DELETE FROM users WHERE user_id = ?', [lab.user_id]);
    }
    runSql('DELETE FROM contractors WHERE user_id = ?', [user_id]);
  }

  if (user.role === 'laborer') {
    runSql('DELETE FROM laborers WHERE user_id = ?', [user_id]);
  }

  runSql('DELETE FROM transactions WHERE user_id = ?', [user_id]);
  runSql('DELETE FROM balances WHERE user_id = ?', [user_id]);
  runSql('UPDATE bills SET status = ? WHERE laborer_id = ?', ['cancelled', user_id]);
  runSql("UPDATE bills SET status = ? WHERE contractor_id = ? AND status IN ('pending_contractor', 'pending_admin')", ['cancelled', user_id]);
  runSql('DELETE FROM audit_logs WHERE entity_id = ?', [user_id]);
  runSql('DELETE FROM users WHERE user_id = ?', [user_id]);

  runSql(
    'INSERT INTO audit_logs (entity_type, entity_id, action, details, performed_by) VALUES (?, ?, ?, ?, ?)',
    ['user', user_id, 'deleted_by_admin', `Deleted user: ${fullName}`, req.session.user.user_id]
  );

  res.json({ success: true, message: `User ${fullName} (${user_id}) deleted` });
});

module.exports = router;
