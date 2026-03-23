const { v4: uuidv4 } = require('uuid');

function generateBrackets(sessionId, db) {
  const bowlers = db.prepare('SELECT * FROM bowlers WHERE session_id = ? ORDER BY sort_order').all(sessionId);

  // Build entry list: each bowler appears num_entries times
  let entries = [];
  for (const bowler of bowlers) {
    for (let i = 0; i < bowler.num_entries; i++) {
      entries.push(bowler.id);
    }
  }

  // Fisher-Yates shuffle
  for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [entries[i], entries[j]] = [entries[j], entries[i]];
  }

  const numBrackets = Math.floor(entries.length / 8);
  const leftoverCount = entries.length % 8;

  // Collect leftover bowler IDs for refund tracking
  const leftoverEntries = entries.slice(numBrackets * 8);
  const leftoverBowlerIds = [...new Set(leftoverEntries)];

  // Clear existing brackets
  const existingBrackets = db.prepare('SELECT id FROM brackets WHERE session_id = ?').all(sessionId);
  for (const b of existingBrackets) {
    db.prepare('DELETE FROM bracket_matches WHERE bracket_id = ?').run(b.id);
    db.prepare('DELETE FROM bracket_slots WHERE bracket_id = ?').run(b.id);
  }
  db.prepare('DELETE FROM brackets WHERE session_id = ?').run(sessionId);

  const createBracket = db.transaction(() => {
    for (let b = 0; b < numBrackets; b++) {
      const bracketId = uuidv4();
      db.prepare('INSERT INTO brackets (id, session_id, bracket_number) VALUES (?, ?, ?)').run(bracketId, sessionId, b + 1);

      const slots = entries.slice(b * 8, (b + 1) * 8);

      // Create slots
      for (let s = 0; s < 8; s++) {
        db.prepare('INSERT INTO bracket_slots (id, bracket_id, bowler_id, slot_number) VALUES (?, ?, ?, ?)')
          .run(uuidv4(), bracketId, slots[s], s + 1);
      }

      // Create match structure for both modes
      for (const mode of ['handicap', 'scratch']) {
        // Round 1: 4 matches (1v2, 3v4, 5v6, 7v8)
        db.prepare('INSERT INTO bracket_matches (id, bracket_id, mode, round, match_position, bowler1_id, bowler2_id) VALUES (?,?,?,?,?,?,?)')
          .run(uuidv4(), bracketId, mode, 1, 1, slots[0], slots[1]);
        db.prepare('INSERT INTO bracket_matches (id, bracket_id, mode, round, match_position, bowler1_id, bowler2_id) VALUES (?,?,?,?,?,?,?)')
          .run(uuidv4(), bracketId, mode, 1, 2, slots[2], slots[3]);
        db.prepare('INSERT INTO bracket_matches (id, bracket_id, mode, round, match_position, bowler1_id, bowler2_id) VALUES (?,?,?,?,?,?,?)')
          .run(uuidv4(), bracketId, mode, 1, 3, slots[4], slots[5]);
        db.prepare('INSERT INTO bracket_matches (id, bracket_id, mode, round, match_position, bowler1_id, bowler2_id) VALUES (?,?,?,?,?,?,?)')
          .run(uuidv4(), bracketId, mode, 1, 4, slots[6], slots[7]);

        // Round 2: 2 matches (W1v W2, W3vW4)
        db.prepare('INSERT INTO bracket_matches (id, bracket_id, mode, round, match_position) VALUES (?,?,?,?,?)')
          .run(uuidv4(), bracketId, mode, 2, 1);
        db.prepare('INSERT INTO bracket_matches (id, bracket_id, mode, round, match_position) VALUES (?,?,?,?,?)')
          .run(uuidv4(), bracketId, mode, 2, 2);

        // Round 3: Final
        db.prepare('INSERT INTO bracket_matches (id, bracket_id, mode, round, match_position) VALUES (?,?,?,?,?)')
          .run(uuidv4(), bracketId, mode, 3, 1);
      }
    }
  });

  createBracket();

  return { numBrackets, leftoverCount, leftoverBowlerIds };
}

function resolveBracketRound(sessionId, game, db) {
  const round = game;
  const brackets = db.prepare('SELECT * FROM brackets WHERE session_id = ?').all(sessionId);

  for (const bracket of brackets) {
    for (const mode of ['handicap', 'scratch']) {
      const matches = db.prepare(
        'SELECT * FROM bracket_matches WHERE bracket_id = ? AND mode = ? AND round = ? ORDER BY match_position'
      ).all(bracket.id, mode, round);

      for (const match of matches) {
        if (!match.bowler1_id || !match.bowler2_id) continue;

        const score1Row = db.prepare('SELECT raw_score FROM scores WHERE bowler_id = ? AND game = ?').get(match.bowler1_id, game);
        const score2Row = db.prepare('SELECT raw_score FROM scores WHERE bowler_id = ? AND game = ?').get(match.bowler2_id, game);

        if (!score1Row || !score2Row) continue;

        let s1 = score1Row.raw_score;
        let s2 = score2Row.raw_score;

        if (mode === 'handicap') {
          const b1 = db.prepare('SELECT handicap FROM bowlers WHERE id = ?').get(match.bowler1_id);
          const b2 = db.prepare('SELECT handicap FROM bowlers WHERE id = ?').get(match.bowler2_id);
          s1 += (b1?.handicap || 0);
          s2 += (b2?.handicap || 0);
        }

        // Tiebreak: higher raw score wins; if tied, slot 1 wins
        const winnerId = s1 >= s2 ? match.bowler1_id : match.bowler2_id;

        db.prepare('UPDATE bracket_matches SET winner_id = ?, score1 = ?, score2 = ? WHERE id = ?')
          .run(winnerId, s1, s2, match.id);

        // Propagate winner to next round
        if (round < 3) {
          const nextRound = round + 1;
          const nextPos = Math.ceil(match.match_position / 2);
          const isFirstSlot = match.match_position % 2 === 1;

          const nextMatch = db.prepare(
            'SELECT * FROM bracket_matches WHERE bracket_id = ? AND mode = ? AND round = ? AND match_position = ?'
          ).get(bracket.id, mode, nextRound, nextPos);

          if (nextMatch) {
            if (isFirstSlot) {
              db.prepare('UPDATE bracket_matches SET bowler1_id = ? WHERE id = ?').run(winnerId, nextMatch.id);
            } else {
              db.prepare('UPDATE bracket_matches SET bowler2_id = ? WHERE id = ?').run(winnerId, nextMatch.id);
            }
          }
        }
      }
    }
  }
}

function getBracketData(sessionId, db) {
  const brackets = db.prepare('SELECT * FROM brackets WHERE session_id = ? ORDER BY bracket_number').all(sessionId);
  const bowlers = db.prepare('SELECT * FROM bowlers WHERE session_id = ?').all(sessionId);
  const bowlerMap = Object.fromEntries(bowlers.map(b => [b.id, b]));

  return brackets.map(bracket => {
    const slots = db.prepare('SELECT * FROM bracket_slots WHERE bracket_id = ? ORDER BY slot_number').all(bracket.id);
    const slotsWithBowler = slots.map(s => ({ ...s, bowler: bowlerMap[s.bowler_id] }));

    const matchesByMode = {};
    for (const mode of ['handicap', 'scratch']) {
      const matches = db.prepare(
        'SELECT * FROM bracket_matches WHERE bracket_id = ? AND mode = ? ORDER BY round, match_position'
      ).all(bracket.id, mode);

      matchesByMode[mode] = matches.map(m => ({
        ...m,
        bowler1: m.bowler1_id ? bowlerMap[m.bowler1_id] : null,
        bowler2: m.bowler2_id ? bowlerMap[m.bowler2_id] : null,
        winner: m.winner_id ? bowlerMap[m.winner_id] : null,
      }));
    }

    return {
      ...bracket,
      slots: slotsWithBowler,
      matches: matchesByMode,
    };
  });
}

module.exports = { generateBrackets, resolveBracketRound, getBracketData };
