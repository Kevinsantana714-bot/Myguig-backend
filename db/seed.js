require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcrypt');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'myguig.db'));
const SALT_ROUNDS = 12;

async function seed() {
  console.log('\n🌱 Iniciando seed...\n');

  // ── Usuários de teste ──────────────────────────────────────
  const musicicoEmail    = 'musico@test.com';
  const contratanteEmail = 'contratante@test.com';

  let musicoId, contratanteId;

  const existingMusico = db.prepare('SELECT id FROM users WHERE email = ?').get(musicicoEmail);
  if (existingMusico) {
    musicoId = existingMusico.id;
    console.log(`✓ Músico já existe  (id=${musicoId})`);
  } else {
    const hash = await bcrypt.hash('senha123', SALT_ROUNDS);
    const r = db.prepare(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'musician')"
    ).run('Pedro Alves (Músico)', musicicoEmail, hash);
    musicoId = r.lastInsertRowid;
    console.log(`✓ Músico criado     (id=${musicoId})`);
  }

  const existingContr = db.prepare('SELECT id FROM users WHERE email = ?').get(contratanteEmail);
  if (existingContr) {
    contratanteId = existingContr.id;
    console.log(`✓ Contratante já existe (id=${contratanteId})`);
  } else {
    const hash = await bcrypt.hash('senha123', SALT_ROUNDS);
    const r = db.prepare(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'contractor')"
    ).run('Carlos (Contratante)', contratanteEmail, hash);
    contratanteId = r.lastInsertRowid;
    console.log(`✓ Contratante criado (id=${contratanteId})`);
  }

  // ── Propostas do MOCK_DATA ─────────────────────────────────
  const alreadyHasProposals = db.prepare(
    'SELECT COUNT(*) as c FROM proposals WHERE musician_id = ?'
  ).get(musicoId);

  if (Number(alreadyHasProposals.c) > 0) {
    console.log(`\n⚠  Propostas já existem para o músico — seed ignorado para evitar duplicatas.`);
  } else {
    const insertProposal = db.prepare(`
      INSERT INTO proposals
        (contractor_id, musician_id, evento, data_iso, horario_inicio, local, cache, estilos,
         repertorio, metodo, descricao, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const proposals = [
      {
        evento: 'Show de Aniversário', data_iso: '2026-07-18', horario: '19:00',
        local: 'Bar Tiki — Vila Madalena, SP', cache: 800,
        estilos: ['Rock', 'MPB'], repertorio: '20 músicas — 90 min',
        metodo: 'PA própria. Ensaio prévio necessário. Traje: smart casual.',
        descricao: 'Evento de aniversário de 40 anos. Público de aprox. 80 pessoas.',
        status: 'pending',
      },
      {
        evento: 'Casamento — Cerimônia', data_iso: '2026-07-25', horario: '16:00',
        local: 'Espaço Jardim, São Paulo', cache: 1500,
        estilos: ['Bossa Nova', 'Jazz'], repertorio: '15 músicas — 60 min',
        metodo: 'Equipamento do espaço. Traje: social completo.',
        descricao: 'Cerimônia ao ar livre. Repertório romântico e instrumental.',
        status: 'pending',
      },
      {
        evento: 'Evento Corporativo', data_iso: '2026-08-02', horario: '20:00',
        local: 'Hotel Maksoud — São Paulo', cache: 2000,
        estilos: ['Jazz', 'Lounge'], repertorio: '30 músicas — 2h',
        metodo: 'Empresa fornece backline. Dois sets de 50 min.',
        descricao: 'Jantar corporativo. Público executivo. Preferência por instrumental.',
        status: 'negotiating',
      },
      {
        evento: 'Show de Bar', data_iso: '2026-08-10', horario: '21:00',
        local: 'Bar do Juarez, São Paulo', cache: 600,
        estilos: ['Rock', 'Blues'], repertorio: '25 músicas — 2h',
        metodo: 'PA do local. Soundcheck às 19h.',
        descricao: 'Show semanal de bar com público fixo.',
        status: 'confirmed',
      },
    ];

    for (const p of proposals) {
      const r = insertProposal.run(
        contratanteId, musicoId, p.evento, p.data_iso, p.horario,
        p.local, p.cache, JSON.stringify(p.estilos),
        p.repertorio, p.metodo, p.descricao, p.status
      );
      // Notification for musician on pending proposals
      if (p.status === 'pending') {
        db.prepare(
          "INSERT INTO notifications (user_id, type, proposal_id, message) VALUES (?, 'new_proposal', ?, ?)"
        ).run(musicoId, r.lastInsertRowid, `Nova proposta de show: ${p.evento}`);
      }
      console.log(`  + Proposta "${p.evento}" (${p.status})`);
    }

    // Counter proposal for the negotiating one
    const negotiating = db.prepare(
      "SELECT id FROM proposals WHERE musician_id = ? AND status = 'negotiating' LIMIT 1"
    ).get(musicoId);
    if (negotiating) {
      db.prepare(
        'INSERT INTO counter_proposals (proposal_id, author_id, novo_cache, mensagem) VALUES (?, ?, ?, ?)'
      ).run(negotiating.id, contratanteId, 2400, 'Podemos chegar a R$ 2.400 se incluir mais 30 minutos.');
    }

    console.log('\n✓ 4 propostas inseridas com sucesso.');
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CREDENCIAIS DE TESTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Músico:      musico@test.com      / senha123
  Contratante: contratante@test.com / senha123
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Inicie o servidor:  npm run dev
  Abra:               MyGUIG_Front.html
`);
}

seed().catch(err => { console.error('Seed falhou:', err); process.exit(1); });
