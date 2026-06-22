const express = require('express');
const { getOne, getAll, runSql } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

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

module.exports = router;
