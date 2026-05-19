const express = require('express');
const { pool }        = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/proposals  (contratante envia proposta a um músico)
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      musician_id, evento, data_iso, horario_inicio,
      local, cache, estilos, repertorio, metodo, descricao,
    } = req.body || {};

    if (!musician_id || !evento || !data_iso || !local || cache == null)
      return res.status(400).json({ error: 'musician_id, evento, data_iso, local e cache são obrigatórios.' });

    const { rows: musician } = await pool.query(
      `SELECT id, name FROM users WHERE id = $1 AND role = 'musician'`,
      [parseInt(musician_id)]
    );
    if (!musician.length) return res.status(404).json({ error: 'Músico não encontrado.' });

    const { rows: [proposal] } = await pool.query(
      `INSERT INTO proposals
         (contractor_id, musician_id, evento, data_iso, horario_inicio,
          local, cache, status, estilos, repertorio, metodo, descricao)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$10,$11)
       RETURNING *`,
      [
        req.userId,
        parseInt(musician_id),
        evento,
        data_iso,
        horario_inicio || null,
        local,
        parseFloat(cache),
        JSON.stringify(estilos || []),
        repertorio || null,
        metodo     || null,
        descricao  || null,
      ]
    );

    await pool.query(
      `INSERT INTO notifications (user_id, message) VALUES ($1, $2)`,
      [parseInt(musician_id), `Nova proposta recebida: ${evento}`]
    );

    res.status(201).json({ proposal });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
