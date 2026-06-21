const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getOne, getAll, runSql } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// ─── Multer config for photo uploads ─────────────────────────────────────────

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const uniqueName = `bill_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|heic/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext || mime) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  },
});

// ─── Generate bill number ────────────────────────────────────────────────────

function generateBillNumber() {
  const result = getOne('SELECT COUNT(*) as cnt FROM bills');
  const count = result ? result.cnt : 0;
  return `BILL-${String(count + 1).padStart(5, '0')}`;
}

// ─── GET /api/bills/stats/summary — Dashboard stats (defined BEFORE /:id) ───

router.get('/stats/summary', requireAuth, (req, res) => {
  const user = req.session.user;

  if (user.role === 'laborer') {
    const balance = getOne('SELECT current_balance FROM balances WHERE user_id = ?', [user.user_id]);
    const pending = getOne("SELECT COUNT(*) as cnt FROM bills WHERE laborer_id = ? AND status IN ('pending_contractor', 'pending_admin')", [user.user_id]);
    const approved = getOne("SELECT COUNT(*) as cnt FROM bills WHERE laborer_id = ? AND status = 'approved'", [user.user_id]);
    const total = getOne('SELECT COUNT(*) as cnt FROM bills WHERE laborer_id = ?', [user.user_id]);

    res.json({
      balance: balance ? balance.current_balance : 0,
      pending_bills: pending ? pending.cnt : 0,
      approved_bills: approved ? approved.cnt : 0,
      total_bills: total ? total.cnt : 0,
    });

  } else if (user.role === 'contractor') {
    const pending = getOne("SELECT COUNT(*) as cnt FROM bills WHERE contractor_id = ? AND status = 'pending_contractor'", [user.user_id]);
    const approvedToday = getOne("SELECT COUNT(*) as cnt FROM bills WHERE contractor_id = ? AND status IN ('pending_admin', 'approved') AND DATE(contractor_review_timestamp) = DATE('now')", [user.user_id]);
    const rejected = getOne("SELECT COUNT(*) as cnt FROM bills WHERE contractor_id = ? AND status = 'rejected_contractor'", [user.user_id]);
    const laborers = getOne('SELECT COUNT(*) as cnt FROM laborers WHERE contractor_id = ?', [user.user_id]);

    res.json({
      pending_reviews: pending ? pending.cnt : 0,
      approved_today: approvedToday ? approvedToday.cnt : 0,
      rejected_bills: rejected ? rejected.cnt : 0,
      active_laborers: laborers ? laborers.cnt : 0,
    });

  } else if (user.role === 'admin') {
    const pending = getOne("SELECT COUNT(*) as cnt FROM bills WHERE status = 'pending_admin'");
    const todayExpenses = getOne("SELECT COALESCE(SUM(amount), 0) as total FROM bills WHERE status = 'approved' AND DATE(admin_review_timestamp) = DATE('now')");
    const monthExpenses = getOne("SELECT COALESCE(SUM(amount), 0) as total FROM bills WHERE status = 'approved' AND strftime('%Y-%m', admin_review_timestamp) = strftime('%Y-%m', 'now')");
    const contractors = getOne("SELECT COUNT(*) as cnt FROM users WHERE role = 'contractor'");
    const laborers = getOne("SELECT COUNT(*) as cnt FROM users WHERE role = 'laborer'");

    res.json({
      pending_approvals: pending ? pending.cnt : 0,
      today_expenses: todayExpenses ? todayExpenses.total : 0,
      month_expenses: monthExpenses ? monthExpenses.total : 0,
      active_contractors: contractors ? contractors.cnt : 0,
      active_laborers: laborers ? laborers.cnt : 0,
    });
  }
});

// ─── POST /api/bills — Upload a new bill ─────────────────────────────────────

router.post('/', requireAuth, requireRole('laborer'), upload.single('photo'), (req, res) => {
  try {
    const { amount, note } = req.body;
    const user = req.session.user;

    if (!amount || isNaN(parseFloat(amount))) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Bill photo is required' });
    }

    const billNumber = generateBillNumber();
    const imageUrl = `/uploads/${req.file.filename}`;

    // Get laborer's contractor
    const laborer = getOne('SELECT contractor_id FROM laborers WHERE user_id = ?', [user.user_id]);
    if (!laborer) {
      return res.status(400).json({ error: 'Laborer is not assigned to a contractor' });
    }

    const result = runSql(
      "INSERT INTO bills (bill_number, laborer_id, contractor_id, image_url, amount, note, status) VALUES (?, ?, ?, ?, ?, ?, 'pending_contractor')",
      [billNumber, user.user_id, laborer.contractor_id, imageUrl, parseFloat(amount), note || '']
    );

    // Audit log
    runSql(
      'INSERT INTO audit_logs (entity_type, entity_id, action, details, performed_by) VALUES (?, ?, ?, ?, ?)',
      ['bill', String(result.lastInsertRowid), 'created', `Amount: ₹${amount}`, user.user_id]
    );

    res.json({
      success: true,
      bill: {
        id: result.lastInsertRowid,
        bill_number: billNumber,
        amount: parseFloat(amount),
        status: 'pending_contractor',
        image_url: imageUrl,
      },
    });
  } catch (err) {
    console.error('Bill upload error:', err);
    res.status(500).json({ error: 'Failed to upload bill' });
  }
});

// ─── GET /api/bills — List bills (filtered by role) ──────────────────────────

router.get('/', requireAuth, (req, res) => {
  const user = req.session.user;
  let bills;

  if (user.role === 'laborer') {
    bills = getAll(
      `SELECT b.*, u.full_name as laborer_name
       FROM bills b
       JOIN users u ON b.laborer_id = u.user_id
       WHERE b.laborer_id = ?
       ORDER BY b.created_at DESC`,
      [user.user_id]
    );

  } else if (user.role === 'contractor') {
    const statusFilter = req.query.status;
    if (statusFilter) {
      bills = getAll(
        `SELECT b.*, u.full_name as laborer_name
         FROM bills b
         JOIN users u ON b.laborer_id = u.user_id
         WHERE b.contractor_id = ? AND b.status = ?
         ORDER BY b.created_at DESC`,
        [user.user_id, statusFilter]
      );
    } else {
      bills = getAll(
        `SELECT b.*, u.full_name as laborer_name
         FROM bills b
         JOIN users u ON b.laborer_id = u.user_id
         WHERE b.contractor_id = ?
         ORDER BY b.created_at DESC`,
        [user.user_id]
      );
    }

  } else if (user.role === 'admin') {
    const statusFilter = req.query.status;
    if (statusFilter) {
      bills = getAll(
        `SELECT b.*,
          u1.full_name as laborer_name,
          u2.full_name as contractor_name
         FROM bills b
         JOIN users u1 ON b.laborer_id = u1.user_id
         JOIN users u2 ON b.contractor_id = u2.user_id
         WHERE b.status = ?
         ORDER BY b.created_at DESC`,
        [statusFilter]
      );
    } else {
      bills = getAll(
        `SELECT b.*,
          u1.full_name as laborer_name,
          u2.full_name as contractor_name
         FROM bills b
         JOIN users u1 ON b.laborer_id = u1.user_id
         JOIN users u2 ON b.contractor_id = u2.user_id
         ORDER BY b.created_at DESC`
      );
    }

  } else {
    return res.status(403).json({ error: 'Access denied' });
  }

  res.json({ bills });
});

// ─── GET /api/bills/:id — Get single bill ────────────────────────────────────

router.get('/:id', requireAuth, (req, res) => {
  const bill = getOne(
    `SELECT b.*,
      u1.full_name as laborer_name,
      u2.full_name as contractor_name
     FROM bills b
     JOIN users u1 ON b.laborer_id = u1.user_id
     JOIN users u2 ON b.contractor_id = u2.user_id
     WHERE b.id = ?`,
    [parseInt(req.params.id)]
  );

  if (!bill) {
    return res.status(404).json({ error: 'Bill not found' });
  }

  res.json({ bill });
});

// ─── PATCH /api/bills/:id/approve — Approve a bill ──────────────────────────

router.patch('/:id/approve', requireAuth, (req, res) => {
  const user = req.session.user;
  const bill = getOne('SELECT * FROM bills WHERE id = ?', [parseInt(req.params.id)]);

  if (!bill) {
    return res.status(404).json({ error: 'Bill not found' });
  }

  if (user.role === 'contractor') {
    if (bill.status !== 'pending_contractor') {
      return res.status(400).json({ error: 'Bill is not pending contractor review' });
    }
    if (bill.contractor_id !== user.user_id) {
      return res.status(403).json({ error: 'Not your bill to approve' });
    }

    runSql(
      "UPDATE bills SET status = 'pending_admin', contractor_review_timestamp = CURRENT_TIMESTAMP WHERE id = ?",
      [bill.id]
    );

    runSql(
      'INSERT INTO audit_logs (entity_type, entity_id, action, performed_by) VALUES (?, ?, ?, ?)',
      ['bill', String(bill.id), 'approved_by_contractor', user.user_id]
    );

  } else if (user.role === 'admin') {
    if (bill.status !== 'pending_admin') {
      return res.status(400).json({ error: 'Bill is not pending admin approval' });
    }

    // Approve: update bill, create transaction, update balance
    runSql(
      "UPDATE bills SET status = 'approved', admin_review_timestamp = CURRENT_TIMESTAMP WHERE id = ?",
      [bill.id]
    );

    runSql(
      "INSERT INTO transactions (bill_id, user_id, amount, type, description) VALUES (?, ?, ?, 'debit', ?)",
      [bill.id, bill.laborer_id, bill.amount, `Bill ${bill.bill_number} approved`]
    );

    runSql(
      'UPDATE balances SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      [bill.amount, bill.laborer_id]
    );

    runSql(
      'INSERT INTO audit_logs (entity_type, entity_id, action, details, performed_by) VALUES (?, ?, ?, ?, ?)',
      ['bill', String(bill.id), 'approved_by_admin', `Amount: ₹${bill.amount} credited to ${bill.laborer_id}`, user.user_id]
    );
  } else {
    return res.status(403).json({ error: 'Not authorized to approve' });
  }

  const updated = getOne('SELECT * FROM bills WHERE id = ?', [bill.id]);
  res.json({ success: true, bill: updated });
});

// ─── PATCH /api/bills/:id/reject — Reject a bill ────────────────────────────

router.patch('/:id/reject', requireAuth, (req, res) => {
  const user = req.session.user;
  const { reason } = req.body;

  if (!reason) {
    return res.status(400).json({ error: 'Rejection reason is required' });
  }

  const validReasons = ['Wrong Amount', 'Blurry Bill', 'Duplicate Bill', 'Invalid Expense', 'Other'];
  if (!validReasons.includes(reason)) {
    return res.status(400).json({ error: 'Invalid rejection reason', validReasons });
  }

  const bill = getOne('SELECT * FROM bills WHERE id = ?', [parseInt(req.params.id)]);

  if (!bill) {
    return res.status(404).json({ error: 'Bill not found' });
  }

  if (user.role === 'contractor') {
    if (bill.status !== 'pending_contractor') {
      return res.status(400).json({ error: 'Bill is not pending contractor review' });
    }
    if (bill.contractor_id !== user.user_id) {
      return res.status(403).json({ error: 'Not your bill to reject' });
    }

    runSql(
      "UPDATE bills SET status = 'rejected_contractor', rejection_reason = ?, rejected_by = ?, contractor_review_timestamp = CURRENT_TIMESTAMP WHERE id = ?",
      [reason, user.user_id, bill.id]
    );

  } else if (user.role === 'admin') {
    if (bill.status !== 'pending_admin') {
      return res.status(400).json({ error: 'Bill is not pending admin approval' });
    }

    runSql(
      "UPDATE bills SET status = 'rejected_admin', rejection_reason = ?, rejected_by = ?, admin_review_timestamp = CURRENT_TIMESTAMP WHERE id = ?",
      [reason, user.user_id, bill.id]
    );

  } else {
    return res.status(403).json({ error: 'Not authorized to reject' });
  }

  runSql(
    'INSERT INTO audit_logs (entity_type, entity_id, action, details, performed_by) VALUES (?, ?, ?, ?, ?)',
    ['bill', String(bill.id), `rejected_by_${user.role}`, `Reason: ${reason}`, user.user_id]
  );

  const updated = getOne('SELECT * FROM bills WHERE id = ?', [bill.id]);
  res.json({ success: true, bill: updated });
});

module.exports = router;
