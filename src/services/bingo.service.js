// ============================================================
// BOLAMU — Bingo Santé : service dédié (5e jeu Zora)
// ============================================================
// Grille 5x5 persistante sur une semaine (reset le lundi) — ne passe PAS
// par playGame()/checkDailyPlays() (câblés en dur sur "aujourd'hui" et
// sur une liste fermée de game_type). Le reset hebdomadaire est géré
// entièrement ici via bingo_grids.week_start. Zéro dépendance sur les
// fichiers partagés par scratch/wheel/chest/quiz.
const pool = require('../config/db');
const { awardZora } = require('./zora.service');

const GRID_SIZE = 25;

/** Lundi (00:00) de la semaine ISO contenant `date`, au format YYYY-MM-DD */
function mondayOf(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0=dimanche .. 6=samedi
  const diff = day === 0 ? -6 : 1 - day; // ramène au lundi de la semaine ISO
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Les 12 lignes possibles : 5 lignes, 5 colonnes, 2 diagonales */
function allLines() {
  const lines = [];
  for (let r = 0; r < 5; r++) lines.push({ key: 'row' + r, type: 'line', indices: [0, 1, 2, 3, 4].map(c => r * 5 + c) });
  for (let c = 0; c < 5; c++) lines.push({ key: 'col' + c, type: 'line', indices: [0, 1, 2, 3, 4].map(r => r * 5 + c) });
  lines.push({ key: 'diag1', type: 'diag', indices: [0, 6, 12, 18, 24] });
  lines.push({ key: 'diag2', type: 'diag', indices: [4, 8, 12, 16, 20] });
  return lines;
}

async function getGame() {
  const r = await pool.query("SELECT * FROM zora_games WHERE game_type = 'bingo' AND is_active = TRUE");
  return r.rows[0] || null;
}

async function buildActionGrid(client) {
  const r = await client.query('SELECT id FROM bingo_actions ORDER BY RANDOM() LIMIT $1', [GRID_SIZE]);
  if (r.rows.length < GRID_SIZE) throw new Error('bingo_actions_insufficient');
  return r.rows.map(row => row.id);
}

async function hydrateGrid(gridRow) {
  const ids = gridRow.grid;
  const actionsRes = await pool.query('SELECT id, action, pilier FROM bingo_actions WHERE id = ANY($1::int[])', [ids]);
  const byId = {};
  actionsRes.rows.forEach(a => { byId[a.id] = { action: a.action, pilier: a.pilier }; });
  const cells = ids.map((id, i) => ({
    index: i,
    action_id: id,
    action: byId[id] ? byId[id].action : '—',
    pilier: byId[id] ? byId[id].pilier : '',
    checked: gridRow.checked.includes(i)
  }));
  return {
    week_start: gridRow.week_start,
    cells,
    checked: gridRow.checked,
    lines_rewarded: gridRow.lines_rewarded,
    bingo_rewarded: gridRow.bingo_rewarded
  };
}

/** Récupère la grille de la semaine en cours pour ce patient, la crée si absente. */
async function getOrCreateWeeklyGrid({ phone }) {
  const weekStart = mondayOf(new Date());
  const existing = await pool.query('SELECT * FROM bingo_grids WHERE phone = $1 AND week_start = $2', [phone, weekStart]);
  if (existing.rows.length > 0) {
    return { success: true, data: await hydrateGrid(existing.rows[0]) };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const grid = await buildActionGrid(client);
    const inserted = await client.query(
      `INSERT INTO bingo_grids (phone, week_start, grid, checked, lines_rewarded, bingo_rewarded)
       VALUES ($1, $2, $3::jsonb, '[]'::jsonb, '[]'::jsonb, FALSE)
       ON CONFLICT (phone, week_start) DO NOTHING
       RETURNING *`,
      [phone, weekStart, JSON.stringify(grid)]
    );
    await client.query('COMMIT');

    if (inserted.rows.length > 0) {
      return { success: true, data: await hydrateGrid(inserted.rows[0]) };
    }
    // Course concurrente : une autre requête a créé la grille entre-temps.
    const race = await pool.query('SELECT * FROM bingo_grids WHERE phone = $1 AND week_start = $2', [phone, weekStart]);
    return { success: true, data: await hydrateGrid(race.rows[0]) };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[BINGO] Erreur getOrCreateWeeklyGrid:', error.message);
    return { success: false, error: 'server_error' };
  } finally {
    client.release();
  }
}

/** Coche une case (idempotent), crédite les lignes/diagonales/bingo nouvellement complétées. */
async function checkCell({ phone, index }) {
  if (!Number.isInteger(index) || index < 0 || index >= GRID_SIZE) {
    return { success: false, error: 'invalid_index' };
  }

  const weekStart = mondayOf(new Date());
  const client = await pool.connect();
  let gridRow;
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      'SELECT * FROM bingo_grids WHERE phone = $1 AND week_start = $2 FOR UPDATE',
      [phone, weekStart]
    );

    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'grid_not_found' };
    }

    gridRow = existing.rows[0];

    if (gridRow.checked.includes(index)) {
      await client.query('ROLLBACK');
      return { success: false, error: 'already_checked' };
    }

    const newChecked = gridRow.checked.concat([index]);
    const updated = await client.query(
      `UPDATE bingo_grids SET checked = $3::jsonb, updated_at = NOW()
       WHERE phone = $1 AND week_start = $2 RETURNING *`,
      [phone, weekStart, JSON.stringify(newChecked)]
    );
    gridRow = updated.rows[0];
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[BINGO] Erreur checkCell (marquage case):', error.message);
    return { success: false, error: 'server_error' };
  } finally {
    client.release();
  }

  // Détection + crédit des lignes/diagonales nouvellement complétées, et du bingo complet.
  // Fait après COMMIT de la case cochée, même précaution anti-deadlock que playGame()/
  // submitQuizAnswer() : awardZora() ouvre sa propre transaction sur zora_points.
  const checkedSet = new Set(gridRow.checked);
  const rewardedSet = new Set(gridRow.lines_rewarded);
  const newlyRewarded = [];
  let newLinesRewarded = gridRow.lines_rewarded.slice();

  for (const line of allLines()) {
    if (rewardedSet.has(line.key)) continue;
    const complete = line.indices.every(i => checkedSet.has(i));
    if (!complete) continue;

    const points = line.type === 'diag' ? 20 : 15;
    try {
      const result = await awardZora({
        phone,
        action_type: 'game_bingo',
        proof_class: 'system_event',
        proof_source: 'game_engine',
        recording_method: null,
        proof_reference: 'bingo_' + gridRow.id + '_line_' + line.key,
        override_points: points
      });
      if (result.success) {
        newLinesRewarded.push(line.key);
        newlyRewarded.push({ type: line.type, key: line.key, points });
      } else {
        console.error(`[BINGO] Crédit ligne échoué phone=${phone}, line=${line.key}, raison=${result.reason}`);
      }
    } catch (creditError) {
      console.error('[BINGO] Exception crédit ligne:', creditError.message);
    }
  }

  let bingoRewarded = gridRow.bingo_rewarded;
  let bingoJustWon = false;
  if (!bingoRewarded && checkedSet.size === GRID_SIZE) {
    try {
      const result = await awardZora({
        phone,
        action_type: 'game_bingo',
        proof_class: 'system_event',
        proof_source: 'game_engine',
        recording_method: null,
        proof_reference: 'bingo_' + gridRow.id + '_full',
        override_points: 100
      });
      if (result.success) {
        bingoRewarded = true;
        bingoJustWon = true;
      } else {
        console.error(`[BINGO] Crédit bingo complet échoué phone=${phone}, raison=${result.reason}`);
      }
    } catch (creditError) {
      console.error('[BINGO] Exception crédit bingo complet:', creditError.message);
    }
  }

  if (newLinesRewarded.length !== gridRow.lines_rewarded.length || bingoRewarded !== gridRow.bingo_rewarded) {
    await pool.query(
      `UPDATE bingo_grids SET lines_rewarded = $3::jsonb, bingo_rewarded = $4, updated_at = NOW()
       WHERE phone = $1 AND week_start = $2`,
      [phone, weekStart, JSON.stringify(newLinesRewarded), bingoRewarded]
    );
    gridRow.lines_rewarded = newLinesRewarded;
    gridRow.bingo_rewarded = bingoRewarded;
  }

  const data = await hydrateGrid(gridRow);
  data.newly_rewarded = newlyRewarded;
  data.bingo_just_won = bingoJustWon;
  return { success: true, data };
}

/** Régénère la grille de la semaine (perd la progression actuelle) contre extra_play_cost. */
async function rerollGrid({ phone }) {
  const game = await getGame();
  if (!game) return { success: false, error: 'game_not_found' };

  const weekStart = mondayOf(new Date());
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT * FROM bingo_grids WHERE phone = $1 AND week_start = $2 FOR UPDATE',
      [phone, weekStart]
    );
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'grid_not_found' };
    }

    const balanceResult = await client.query('SELECT balance FROM zora_points WHERE phone = $1', [phone]);
    const balance = balanceResult.rows[0]?.balance || 0;
    if (balance < game.extra_play_cost) {
      await client.query('ROLLBACK');
      return { success: false, error: 'insufficient_balance' };
    }

    await client.query('UPDATE zora_points SET balance = balance - $1 WHERE phone = $2', [game.extra_play_cost, phone]);
    await client.query(
      `INSERT INTO zora_ledger (phone, points, category, action_type, proof_class, proof_source, recording_method, proof_reference, verified, earned_at, expires_at)
       VALUES ($1, $2, 'plateforme', 'game_play_cost', 'system_event', 'game_engine', NULL, $3, TRUE, NOW(), NOW() + INTERVAL '12 months')`,
      [phone, -game.extra_play_cost, require('crypto').randomBytes(16).toString('hex')]
    );

    const newGrid = await buildActionGrid(client);
    const updated = await client.query(
      `UPDATE bingo_grids SET grid = $3::jsonb, checked = '[]'::jsonb, lines_rewarded = '[]'::jsonb,
         bingo_rewarded = FALSE, updated_at = NOW()
       WHERE phone = $1 AND week_start = $2 RETURNING *`,
      [phone, weekStart, JSON.stringify(newGrid)]
    );

    await client.query('COMMIT');
    return { success: true, data: await hydrateGrid(updated.rows[0]), cost: game.extra_play_cost };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[BINGO] Erreur rerollGrid:', error.message);
    return { success: false, error: 'server_error' };
  } finally {
    client.release();
  }
}

module.exports = { getOrCreateWeeklyGrid, checkCell, rerollGrid, getGame };
