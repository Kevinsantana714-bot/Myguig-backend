const express = require('express');
const { pool }        = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

async function normalize(row) {
  const { rows: counters } = await pool.query(
    'SELECT novo_cache, novo_horario, mensagem FROM counters WHERE proposal_id = $1 ORDER BY id DESC LIMIT 1',
    [row.id]
  );
  const { rows: contractors } = await pool.query('SELECT name FROM users WHERE id = $1', [row.contractor_id]);

  const lastCounter = counters[0] || null;
  const contractor  = contractors[0] || null;

  return {
    id:            row.id,
    data_iso:      row.data_iso,
    evento:        row.evento,
    local:         row.local,
    cache:         parseFloat(row.cache).toFixed(2),
    horario_inicio: row.horario_inicio,
    status:        row.status,
    estilos:       JSON.parse(row.estilos || '[]'),
    repertorio:    row.repertorio,
    metodo:        row.metodo,
    descricao:     row.descricao,
    contractor:    { name: contractor ? contractor.name : '' },
    lastCounter:   lastCounter
      ? { novo_cache: lastCounter.novo_cache, novo_horario: lastCounter.novo_horario, mensagem: lastCounter.mensagem }
      : null,
  };
}

// GET /api/proposals
router.get('/', requireAuth, async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const status = req.query.status;
    const uid    = req.userId;
    const offset = (page - 1) * limit;

    let totalRes, rowsRes;
    if (status && status !== 'all') {
      totalRes = await pool.query('SELECT COUNT(*)::int AS total FROM proposals WHERE musician_id = $1 AND status = $2', [uid, status]);
      rowsRes  = await pool.query('SELECT * FROM proposals WHERE musician_id = $1 AND status = $2 ORDER BY data_iso ASC LIMIT $3 OFFSET $4', [uid, status, limit, offset]);
    } else {
      totalRes = await pool.query('SELECT COUNT(*)::int AS total FROM proposals WHERE musician_id = $1', [uid]);
      rowsRes  = await pool.query('SELECT * FROM proposals WHERE musician_id = $1 ORDER BY data_iso ASC LIMIT $2 OFFSET $3', [uid, limit, offset]);
    }

    const total = totalRes.rows[0].total;
    const data  = await Promise.all(rowsRes.rows.map(normalize));

    res.json({ data, pagination: { page, limit, total } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/proposals/:id/accept
router.patch('/:id/accept', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { rows } = await pool.query('SELECT id FROM proposals WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Proposta não encontrada.' });

    await pool.query("UPDATE proposals SET status = 'confirmed', updated_at = NOW() WHERE id = $1", [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/proposals/:id/decline
router.patch('/:id/decline', requireAuth, async (req, res) => {
  try {
    const id     = parseInt(req.params.id);
    const reason = (req.body || {}).reason;
    if (!reason) return res.status(400).json({ error: 'reason é obrigatório.' });

    const { rows } = await pool.query('SELECT id FROM proposals WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Proposta não encontrada.' });

    await pool.query("UPDATE proposals SET status = 'declined', updated_at = NOW() WHERE id = $1", [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/proposals/:id/counter
router.post('/:id/counter', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { novo_cache, novo_horario, mensagem } = req.body || {};

    if (!novo_cache && !novo_horario && !mensagem)
      return res.status(400).json({ error: 'Preencha ao menos um campo.' });

    const { rows } = await pool.query('SELECT id FROM proposals WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Proposta não encontrada.' });

    await pool.query(
      'INSERT INTO counters (proposal_id, author_id, novo_cache, novo_horario, mensagem) VALUES ($1,$2,$3,$4,$5)',
      [id, req.userId, novo_cache || null, novo_horario || null, mensagem || null]
    );
    await pool.query("UPDATE proposals SET status = 'negotiating', updated_at = NOW() WHERE id = $1", [id]);

    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
