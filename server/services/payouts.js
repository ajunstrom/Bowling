const { v4: uuidv4 } = require('uuid');
const { getContestResults } = require('./contests');
const { getBracketData } = require('./brackets');

function calculateAllPayouts(sessionId, db) {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  if (!session) return;

  const settings = JSON.parse(session.settings || '{}');
  const bowlers = db.prepare('SELECT * FROM bowlers WHERE session_id = ?').all(sessionId);
  const bowlerMap = Object.fromEntries(bowlers.map(b => [b.id, b]));

  // Clear existing payouts
  db.prepare('DELETE FROM payouts WHERE session_id = ?').run(sessionId);

  const insert = db.prepare(
    'INSERT INTO payouts (id, session_id, bowler_id, contest_type, description, placement, amount) VALUES (?,?,?,?,?,?,?)'
  );

  const addPayout = (bowlerId, contestType, description, placement, amount) => {
    if (amount > 0 && bowlerMap[bowlerId]) {
      insert.run(uuidv4(), sessionId, bowlerId, contestType, description, placement, Math.round(amount * 100) / 100);
    }
  };

  // ---- BRACKETS ----
  const brackets = getBracketData(sessionId, db);
  const bracketFee = settings.bracket_fee || 5;
  const bracketOpPct = settings.bracket_op_pct || 0.1;
  const prizePerBracket = 8 * bracketFee * (1 - bracketOpPct);

  for (const bracket of brackets) {
    for (const mode of ['handicap', 'scratch']) {
      const modeMatches = bracket.matches[mode] || [];
      const final = modeMatches.find(m => m.round === 3 && m.match_position === 1);
      if (final?.winner_id) {
        const desc = `Bracket #${bracket.bracket_number} (${mode === 'handicap' ? 'Hdcp' : 'Scratch'}) - Winner`;
        addPayout(final.winner_id, `bracket_${mode}`, desc, 1, prizePerBracket);

        // Runner up
        const runnerUpId = final.winner_id === final.bowler1_id ? final.bowler2_id : final.bowler1_id;
        if (runnerUpId) {
          // Runner-up gets nothing by default (can be configured)
        }
      }
    }
  }

  // ---- CONTEST RESULTS ----
  const contestResults = getContestResults(sessionId, db);

  // ELIMINATOR
  if (contestResults.eliminator) {
    const { finalists, payouts: payoutAmounts } = contestResults.eliminator;
    for (let i = 0; i < Math.min(finalists.length, payoutAmounts.length); i++) {
      const finalist = finalists[i];
      const payout = payoutAmounts[i];
      if (payout.amount > 0) {
        addPayout(finalist.bowler_id, 'eliminator', `Eliminator - ${ordinal(payout.place)} Place`, payout.place, payout.amount);
      }
    }
  }

  // HIGH GAME POT
  if (contestResults.high_game) {
    for (const game of contestResults.high_game.games) {
      if (game.leader && game.pot > 0) {
        addPayout(game.leader.bowler.id, 'high_game', `High Game Pot - Game ${game.game}`, 1, game.pot);
      }
    }
  }

  // HIGH SERIES
  if (contestResults.high_series) {
    const { leaderboard, first, second } = contestResults.high_series;
    if (leaderboard[0]?.bowler) {
      addPayout(leaderboard[0].bowler.id, 'high_series', 'High Series - 1st Place', 1, first);
    }
    if (leaderboard[1]?.bowler) {
      addPayout(leaderboard[1].bowler.id, 'high_series', 'High Series - 2nd Place', 2, second);
    }
  }

  // MYSTERY DOUBLES
  if (contestResults.mystery_doubles) {
    const { pairs, pairPrize } = contestResults.mystery_doubles;
    if (pairs[0] && pairs[0].combinedSeries > 0) {
      const winner = pairs[0];
      addPayout(winner.bowler1_id, 'mystery_doubles', 'Mystery Doubles - Winning Pair', 1, pairPrize);
      addPayout(winner.bowler2_id, 'mystery_doubles', 'Mystery Doubles - Winning Pair', 1, pairPrize);
    }
  }
}

function getPayoutSummary(sessionId, db) {
  const payouts = db.prepare(`
    SELECT p.*, b.name as bowler_name
    FROM payouts p
    JOIN bowlers b ON p.bowler_id = b.id
    WHERE p.session_id = ?
    ORDER BY p.amount DESC
  `).all(sessionId);

  // Group by bowler
  const byBowler = {};
  for (const payout of payouts) {
    if (!byBowler[payout.bowler_id]) {
      byBowler[payout.bowler_id] = {
        bowlerId: payout.bowler_id,
        name: payout.bowler_name,
        total: 0,
        paid: 0,
        items: [],
      };
    }
    byBowler[payout.bowler_id].total += payout.amount;
    if (payout.is_paid || payout.forwarded) {
      byBowler[payout.bowler_id].paid += payout.amount;
    }
    byBowler[payout.bowler_id].items.push(payout);
  }

  const bowlerPayouts = Object.values(byBowler).sort((a, b) => b.total - a.total);

  const totalOwed = bowlerPayouts.reduce((s, b) => s + b.total, 0);
  const totalPaid = bowlerPayouts.reduce((s, b) => s + b.paid, 0);

  return {
    bowlerPayouts,
    totalOwed,
    totalPaid,
    totalOutstanding: totalOwed - totalPaid,
  };
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

module.exports = { calculateAllPayouts, getPayoutSummary };
