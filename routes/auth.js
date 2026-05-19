const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const { pool }       = require('../db');
const { requireAuth } = require('../middleware/auth');

const router      = express.Router();
const SALT_ROUNDS = 10;

function makeToken(user) {
  return jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// POST /auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password)
      return res.status(400).json({ error: 'name, email e password são obrigatórios.' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres.' });

    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (rows.length) return res.status(400).json({ error: 'E-mail já cadastrado.' });

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows: [created] } = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name.trim(), email.trim().toLowerCase(), password_hash]
    );

    res.status(201).json({ token: makeToken(created), user: { id: created.id, name: created.name, email: created.email } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ error: 'email e password são obrigatórios.' });

    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    const row   = rows[0];
    const valid = row && await bcrypt.compare(password, row.password_hash);
    if (!valid) return res.status(401).json({ error: 'Credenciais inválidas.' });

    res.json({ token: makeToken(row), user: { id: row.id, name: row.name, email: row.email } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /auth/logout
router.post('/logout', requireAuth, (_req, res) => res.json({ ok: true }));

// GET /auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [req.userId]);
    if (!rows.length) return res.status(401).json({ error: 'Usuário não encontrado.' });
    res.json({ user: rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
