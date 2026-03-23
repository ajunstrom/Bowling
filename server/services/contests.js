const { v4: uuidv4 } = require('uuid');

function getContestEntries(sessionId, contestType, db) {
  return db.prepare(
    'SELECT ce.*, b.name, b.handicap FROM contest_entries ce JOIN bowlers b ON ce.bowler_id = b.id WHERE ce.session_id = ? AND ce.contest_type = ?'
  ).all(sessionId, contestType);
}

function getScoresForGame(sessionId, game, db) {
  return db.prepare(
    'SELECT s.*, b.name, b.handicap FROM scores s JOIN bowlers b ON s.bowler_id = b.id WHERE s.session_id = ? AND s.game = ?'
  ).all(sessionId, game);
}

function getAllScores(sessionId, db) {
  return db.prepare(
    'SELECT s.*, b.name, b.handicap FROM scores s JOIN bowlers b ON s.bowler_id = b.id WHERE s.session_id = ? ORDER BY s.bowler_id, s.game'
  ).all(sessionId);
}

// Returns full contest results for a session
function getContestResults(sessionId, db) {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  if (!session) return null;
  const settings = JSON.parse(session.settings || '{}');

  const bowlers = db.prepare('SELECT * FROM bowlers WHERE session_id = ?').all(sessionId);
  const bowlerMap = Object.fromEntries(bowlers.map(b => [b.id, b]));

  const allScores = getAllScores(sessionId, db);
  // Build score lookup: bowlerId -> { game1, game2, game3, series }
  const scoresByBowler = {};
  for (const s of allScores) {
    if (!scoresByBowler[s.bowler_id]) scoresByBowler[s.bowler_id] = {};
    scoresByBowler[s.bowler_id][`game${s.game}`] = s.raw_score;
  }
  for (const [bid, scores] of Object.entries(scoresByBowler)) {
    scores.series = (scores.game1 || 0) + (scores.game2 || 0) + (scores.game3 || 0);
    scores.handicapSeries = scores.series + 3 * (bowlerMap[bid]?.handicap || 0);
  }

  const results = {};

  // ---- ELIMINATOR ----
  if (settings.has_eliminator) {
    const entries = getContestEntries(sessionId, 'eliminator', db);
    const config = {
      fee: settings.eliminator_fee || 5,
      rake: settings.eliminator_rake || 0.1,
      places: settings.eliminator_places || 2,
      split: settings.eliminator_split || 70,
      thirdFeeBack: settings.eliminator_third_fee_back || false,
    };
    const pool = entries.length * config.fee * (1 - config.rake);

    // Determine survivors after each game
    let survivors = entries.map(e => ({ ...e, bowler: bowlerMap[e.bowler_id] }));
    const eliminatedAfterG1 = [];
    const eliminatedAfterG2 = [];

    if (allScores.some(s => s.game === 1)) {
      // Sort by G1 scratch score descending, eliminate bottom half
      const withG1 = survivors.map(s => ({
        ...s,
        g1: scoresByBowler[s.bowler_id]?.game1 ?? -1,
      })).sort((a, b) => b.g1 - a.g1);

      const keepAfterG1 = Math.ceil(withG1.length / 2);
      const survivors1 = withG1.slice(0, keepAfterG1);
      const elim1 = withG1.slice(keepAfterG1);
      eliminatedAfterG1.push(...elim1);
      survivors = survivors1;

      if (allScores.some(s => s.game === 2) && survivors.length > 0) {
        const targetFinalists = Math.max(config.places + 1, 2);
        const withG2 = survivors.map(s => ({
          ...s,
          g2: scoresByBowler[s.bowler_id]?.game2 ?? -1,
        })).sort((a, b) => b.g2 - a.g2);

        const keepAfterG2 = Math.max(targetFinalists, Math.min(withG2.length, 2));
        const survivors2 = withG2.slice(0, keepAfterG2);
        const elim2 = withG2.slice(keepAfterG2);
        eliminatedAfterG2.push(...elim2);
        survivors = survivors2;
      }
    }

    // G3 finalists ranked by G3 score
    let finalists = [];
    if (allScores.some(s => s.game === 3)) {
      finalists = survivors.map(s => ({
        ...s,
        g3: scoresByBowler[s.bowler_id]?.game3 ?? 0,
      })).sort((a, b) => b.g3 - a.g3);
    } else {
      finalists = survivors;
    }

    // Calculate payouts
    const payoutAmounts = calculateEliminatorPayouts(pool, config);

    results.eliminator = {
      entries: entries.length,
      pool,
      config,
      payouts: payoutAmounts,
      eliminatedAfterG1,
      eliminatedAfterG2,
      finalists,
    };
  }

  // ---- HIGH GAME POT ----
  if (settings.has_high_game) {
    const entries = getContestEntries(sessionId, 'high_game', db);
    const fee = settings.high_game_fee || 5;
    const rake = settings.high_game_rake || 0.1;
    const totalPool = entries.length * fee * (1 - rake);
    const perGamePot = totalPool / 3;

    const games = [1, 2, 3].map(g => {
      const gameScores = entries.map(e => ({
        bowler: bowlerMap[e.bowler_id],
        score: scoresByBowler[e.bowler_id]?.[`game${g}`] ?? null,
      })).filter(x => x.score !== null).sort((a, b) => b.score - a.score);

      return {
        game: g,
        pot: perGamePot,
        leader: gameScores[0] || null,
        scores: gameScores,
      };
    });

    results.high_game = {
      entries: entries.length,
      totalPool,
      perGamePot,
      games,
    };
  }

  // ---- HIGH SERIES ----
  if (settings.has_high_series) {
    const entries = getContestEntries(sessionId, 'high_series', db);
    const fee = settings.high_series_fee || 5;
    const rake = settings.high_series_rake || 0.1;
    const pool = entries.length * fee * (1 - rake);

    const leaderboard = entries.map(e => ({
      bowler: bowlerMap[e.bowler_id],
      game1: scoresByBowler[e.bowler_id]?.game1 ?? null,
      game2: scoresByBowler[e.bowler_id]?.game2 ?? null,
      game3: scoresByBowler[e.bowler_id]?.game3 ?? null,
      series: scoresByBowler[e.bowler_id]?.series ?? 0,
    })).sort((a, b) => b.series - a.series);

    results.high_series = {
      entries: entries.length,
      pool,
      first: pool * 0.7,
      second: pool * 0.3,
      leaderboard,
    };
  }

  // ---- MYSTERY DOUBLES ----
  if (settings.has_mystery_doubles) {
    const entries = getContestEntries(sessionId, 'mystery_doubles', db);
    const fee = settings.mystery_doubles_fee || 5;
    const rake = settings.mystery_doubles_rake || 0.1;
    const pool = entries.length * fee * (1 - rake);

    const pairs = db.prepare(
      'SELECT * FROM mystery_doubles_pairs WHERE session_id = ?'
    ).all(sessionId);

    const pairResults = pairs.map(p => {
      const b1 = bowlerMap[p.bowler1_id];
      const b2 = bowlerMap[p.bowler2_id];
      const s1 = scoresByBowler[p.bowler1_id] || {};
      const s2 = scoresByBowler[p.bowler2_id] || {};
      const combined = (s1.series || 0) + (s2.series || 0);
      return {
        ...p,
        bowler1: b1,
        bowler2: b2,
        scores1: s1,
        scores2: s2,
        combinedSeries: combined,
      };
    }).sort((a, b) => b.combinedSeries - a.combinedSeries);

    // Unpaired bowlers
    const pairedIds = new Set(pairs.flatMap(p => [p.bowler1_id, p.bowler2_id]));
    const unpaired = entries.filter(e => !pairedIds.has(e.bowler_id)).map(e => bowlerMap[e.bowler_id]);

    results.mystery_doubles = {
      entries: entries.length,
      pool,
      pairPrize: pool / 2,
      pairs: pairResults,
      unpaired,
    };
  }

  return results;
}

function calculateEliminatorPayouts(pool, config) {
  const { places, split, thirdFeeBack, fee } = config;
  if (places === 1) {
    return [{ place: 1, amount: pool }];
  }
  if (places === 2) {
    const pct1 = split / 100;
    return [
      { place: 1, amount: pool * pct1 },
      { place: 2, amount: pool * (1 - pct1) },
    ];
  }
  // 3 places
  const thirdAmount = thirdFeeBack ? (fee || 5) : 0;
  const remaining = pool - thirdAmount;
  const pct1 = split / 100;
  return [
    { place: 1, amount: remaining * pct1 },
    { place: 2, amount: remaining * (1 - pct1) },
    { place: 3, amount: thirdAmount },
  ];
}

function drawMysteryDoubles(sessionId, db) {
  const entries = getContestEntries(sessionId, 'mystery_doubles', db);
  const ids = entries.map(e => e.bowler_id);

  // Shuffle
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }

  // Clear existing pairs
  db.prepare('DELETE FROM mystery_doubles_pairs WHERE session_id = ?').run(sessionId);

  // Create pairs
  const pairs = [];
  for (let i = 0; i < Math.floor(ids.length / 2); i++) {
    const id = uuidv4();
    db.prepare('INSERT INTO mystery_doubles_pairs (id, session_id, bowler1_id, bowler2_id) VALUES (?,?,?,?)')
      .run(id, sessionId, ids[i * 2], ids[i * 2 + 1]);
    pairs.push({ id, bowler1_id: ids[i * 2], bowler2_id: ids[i * 2 + 1] });
  }

  return pairs;
}

module.exports = { getContestResults, drawMysteryDoubles, calculateEliminatorPayouts };
