const express = require('express');
const bcrypt = require('bcryptjs');
const { getOne, runSql } = require('../db');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const user = await getOne('users', 'username', username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const sessionUser = {
      id: user.id,
      user_id: user.user_id,
      username: user.username,
      role: user.role,
      full_name: user.full_name,
      phone: user.phone,
    };

    if (user.role === 'contractor') {
      const contractor = await getOne('contractors', 'user_id', user.user_id);
      if (contractor) sessionUser.company_name = contractor.company_name;
    }

    req.session.user = sessionUser;

    await runSql('audit_logs', 'insert', {
      entity_type: 'user',
      entity_id: user.user_id,
      action: 'login',
      performed_by: user.user_id
    });

    res.json({ success: true, user: sessionUser });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/logout', async (req, res) => {
  if (req.session.user) {
    await runSql('audit_logs', 'insert', {
      entity_type: 'user',
      entity_id: req.session.user.user_id,
      action: 'logout',
      performed_by: req.session.user.user_id
    });
  }
  req.session.destroy(() => res.json({ success: true }));
});

router.get('/me', async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });

  const balance = await getOne('balances', 'user_id', req.session.user.user_id);
  res.json({ user: req.session.user, balance: balance?.current_balance || 0 });
});

module.exports = router;