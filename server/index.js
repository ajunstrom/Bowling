require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const Anthropic = require('@anthropic-ai/sdk');

const { getDb } = require('./db');
const { generateBrackets, resolveBracketRound, getBracketData } = require('./services/brackets');
const { getContestResults, drawMysteryDoubles } = require('./services/contests');
const { calculateAllPayouts, getPayoutSummary } = require('./services/payouts');

const app = express();
const PORT = process.env.PORT || 3001;

// Upload directory
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR));

// Multer for image uploads
const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  },
});

// Anthropic client
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// SSE clients for real-time updates
const sseClients = new Map(); // sessionId -> Set of res objects

function notifySession(sessionId) {
  const clients = sseClients.get(sessionId);
  if (!clients) return;
  const data = JSON.stringify({ type: 'update', sessionId, ts: Date.now() });
  for (const res of clients) {
    try { res.write(`data: ${data}\n\n`); } catch {}
  }
}

// Default session settings
const DEFAULT_SETTINGS = {
  bracket_fee: 5,
  bracket_op_pct: 0.1,
  has_eliminator: true,
  eliminator_fee: 5,
  eliminator_rake: 0.1,
  eliminator_places: 2,
  eliminator_split: 70,
  eliminator_third_fee_back: false,
  has_high_game: true,
  high_game_fee: 5,
  high_game_rake: 0.1,
  has_high_series: true,
  high_series_fee: 5,
  high_series_rake: 0.1,
  has_mystery_doubles: true,
  mystery_doubles_fee: 5,
  mystery_doubles_rake: 0.1,
};

// Helper: recalculate bowler owed amounts
function recalcBowlerOwed(sessionId, db) {
  const session = db.prepare('SELECT settings FROM sessions WHERE id = ?').get(sessionId);
  if (!session) return;
  const s = JSON.parse(session.settings || '{}');
  const bowlers = db.prepare('SELECT * FROM bowlers WHERE session_id = ?').all(sessionId);

  for (const bowler of bowlers) {
    let owed = bowler.num_entries * (s.bracket_fee || 5);
    const types = [
      s.has_eliminator && 'eliminator',
      s.has_high_game && 'high_game',
      s.has_high_series && 'high_series',
      s.has_mystery_doubles && 'mystery_doubles',
    ].filter(Boolean);

    for (const type of types) {
      const enrolled = db.prepare(
        'SELECT 1 FROM contest_entries WHERE session_id = ? AND contest_type = ? AND bowler_id = ?'
      ).get(sessionId, type, bowler.id);
      if (enrolled) {
        const feeKey = type === 'high_game' ? 'high_game_fee' :
                       type === 'high_series' ? 'high_series_fee' :
                       type === 'mystery_doubles' ? 'mystery_doubles_fee' : `${type}_fee`;
        owed += s[feeKey] || 5;
      }
    }
    db.prepare('UPDATE bowlers SET amount_owed = ? WHERE id = ?').run(owed, bowler.id);
  }
}

// Helper: enroll bowler in all active contests
function enrollBowlerInContests(sessionId, bowlerId, db) {
  const session = db.prepare('SELECT settings FROM sessions WHERE id = ?').get(sessionId);
  if (!session) return;
  const s = JSON.parse(session.settings || '{}');
  const types = [
    s.has_eliminator && 'eliminator',
    s.has_high_game && 'high_game',
    s.has_high_series && 'high_series',
    s.has_mystery_doubles && 'mystery_doubles',
  ].filter(Boolean);

  for (const type of types) {
    db.prepare(
      'INSERT OR IGNORE INTO contest_entries (id, session_id, contest_type, bowler_id) VALUES (?,?,?,?)'
    ).run(uuidv4(), sessionId, type, bowlerId);
  }
}

// ============ SSE ============

app.get('/api/sessions/:id/events', (req, res) => {
  const { id } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  if (!sseClients.has(id)) sseClients.set(id, new Set());
  sseClients.get(id).add(res);

  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  req.on('close', () => {
    const clients = sseClients.get(id);
    if (clients) { clients.delete(res); if (clients.size === 0) sseClients.delete(id); }
  });
});

// ============ SESSIONS ============

app.get('/api/sessions', (req, res) => {
  const db = getDb();
  const sessions = db.prepare('SELECT * FROM sessions ORDER BY created_at DESC').all();
  res.json(sessions.map(s => ({ ...s, settings: JSON.parse(s.settings || '{}') })));
});

app.post('/api/sessions', (req, res) => {
  const db = getDb();
  const { name, date } = req.body;
  if (!name || !date) return res.status(400).json({ error: 'name and date required' });

  const id = uuidv4();
  db.prepare('INSERT INTO sessions (id, name, date, settings) VALUES (?,?,?,?)')
    .run(id, name, date, JSON.stringify(DEFAULT_SETTINGS));
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
  res.json({ ...session, settings: JSON.parse(session.settings) });
});

app.get('/api/sessions/:id', (req, res) => {
  const db = getDb();
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Not found' });
  res.json({ ...session, settings: JSON.parse(session.settings) });
});

app.put('/api/sessions/:id', (req, res) => {
  const db = getDb();
  const { name, date, status } = req.body;
  db.prepare('UPDATE sessions SET name = COALESCE(?, name), date = COALESCE(?, date), status = COALESCE(?, status) WHERE id = ?')
    .run(name || null, date || null, status || null, req.params.id);
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  notifySession(req.params.id);
  res.json({ ...session, settings: JSON.parse(session.settings) });
});

app.put('/api/sessions/:id/settings', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
  if (!session) return res.status(404).json({ error: 'Not found' });

  const current = JSON.parse(session.settings || '{}');
  const updated = { ...current, ...req.body };
  db.prepare('UPDATE sessions SET settings = ? WHERE id = ?').run(JSON.stringify(updated), id);

  recalcBowlerOwed(id, db);
  notifySession(id);
  res.json({ settings: updated });
});

app.delete('/api/sessions/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============ BOWLERS ============

app.get('/api/sessions/:id/bowlers', (req, res) => {
  const db = getDb();
  const bowlers = db.prepare('SELECT * FROM bowlers WHERE session_id = ? ORDER BY sort_order, name').all(req.params.id);
  res.json(bowlers);
});

app.post('/api/sessions/:id/bowlers', (req, res) => {
  const db = getDb();
  const { id: sessionId } = req.params;
  const { name, handicap = 0, num_entries = 1 } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const bowlerId = uuidv4();
  const token = uuidv4();
  const count = db.prepare('SELECT COUNT(*) as c FROM bowlers WHERE session_id = ?').get(sessionId).c;

  db.prepare('INSERT INTO bowlers (id, session_id, name, handicap, num_entries, bowler_token, sort_order) VALUES (?,?,?,?,?,?,?)')
    .run(bowlerId, sessionId, name, handicap, num_entries, token, count);

  enrollBowlerInContests(sessionId, bowlerId, db);
  recalcBowlerOwed(sessionId, db);
  notifySession(sessionId);

  const bowler = db.prepare('SELECT * FROM bowlers WHERE id = ?').get(bowlerId);
  res.json(bowler);
});

app.put('/api/sessions/:id/bowlers/:bid', (req, res) => {
  const db = getDb();
  const { id: sessionId, bid } = req.params;
  const { name, handicap, num_entries } = req.body;

  db.prepare('UPDATE bowlers SET name = COALESCE(?, name), handicap = COALESCE(?, handicap), num_entries = COALESCE(?, num_entries) WHERE id = ? AND session_id = ?')
    .run(name ?? null, handicap ?? null, num_entries ?? null, bid, sessionId);

  recalcBowlerOwed(sessionId, db);
  notifySession(sessionId);

  const bowler = db.prepare('SELECT * FROM bowlers WHERE id = ?').get(bid);
  res.json(bowler);
});

app.delete('/api/sessions/:id/bowlers/:bid', (req, res) => {
  const db = getDb();
  const { id: sessionId, bid } = req.params;
  db.prepare('DELETE FROM bowlers WHERE id = ? AND session_id = ?').run(bid, sessionId);
  recalcBowlerOwed(sessionId, db);
  notifySession(sessionId);
  res.json({ ok: true });
});

app.post('/api/sessions/:id/bowlers/:bid/payment', (req, res) => {
  const db = getDb();
  const { bid, id: sessionId } = req.params;
  const { amount } = req.body;
  if (amount == null) return res.status(400).json({ error: 'amount required' });

  const bowler = db.prepare('SELECT * FROM bowlers WHERE id = ?').get(bid);
  if (!bowler) return res.status(404).json({ error: 'Not found' });

  const newPaid = (bowler.amount_paid || 0) + parseFloat(amount);
  db.prepare('UPDATE bowlers SET amount_paid = ? WHERE id = ?').run(newPaid, bid);
  notifySession(sessionId);
  res.json(db.prepare('SELECT * FROM bowlers WHERE id = ?').get(bid));
});

// Toggle contest entry
app.post('/api/sessions/:id/bowlers/:bid/contest-entry', (req, res) => {
  const db = getDb();
  const { id: sessionId, bid } = req.params;
  const { contest_type, enrolled } = req.body;

  if (enrolled) {
    db.prepare('INSERT OR IGNORE INTO contest_entries (id, session_id, contest_type, bowler_id) VALUES (?,?,?,?)')
      .run(uuidv4(), sessionId, contest_type, bid);
  } else {
    db.prepare('DELETE FROM contest_entries WHERE session_id = ? AND contest_type = ? AND bowler_id = ?')
      .run(sessionId, contest_type, bid);
  }

  recalcBowlerOwed(sessionId, db);
  notifySession(sessionId);
  res.json({ ok: true });
});

// Get contest entries for a session
app.get('/api/sessions/:id/contest-entries', (req, res) => {
  const db = getDb();
  const entries = db.prepare('SELECT * FROM contest_entries WHERE session_id = ?').all(req.params.id);
  res.json(entries);
});

// ============ SCORES ============

app.get('/api/sessions/:id/scores', (req, res) => {
  const db = getDb();
  const scores = db.prepare('SELECT * FROM scores WHERE session_id = ? ORDER BY game, bowler_id').all(req.params.id);
  res.json(scores);
});

app.post('/api/sessions/:id/scores', (req, res) => {
  const db = getDb();
  const { id: sessionId } = req.params;
  const { scores } = req.body; // [{ bowler_id, game, raw_score }]
  if (!Array.isArray(scores)) return res.status(400).json({ error: 'scores array required' });

  const upsert = db.prepare(
    'INSERT INTO scores (id, session_id, bowler_id, game, raw_score) VALUES (?,?,?,?,?) ON CONFLICT(bowler_id, game) DO UPDATE SET raw_score = excluded.raw_score'
  );
  const txn = db.transaction(() => {
    for (const s of scores) {
      upsert.run(uuidv4(), sessionId, s.bowler_id, s.game, s.raw_score);
    }
  });
  txn();

  // Resolve brackets for this game
  const game = scores[0]?.game;
  if (game) {
    try { resolveBracketRound(sessionId, game, db); } catch (e) { console.error('Bracket resolve error:', e); }
  }

  notifySession(sessionId);
  res.json({ ok: true });
});

// AI scoresheet scan
app.post('/api/sessions/:id/scores/scan', upload.single('image'), async (req, res) => {
  try {
    const { id: sessionId } = req.params;
    const { game, bowler_id } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ error: 'Image required' });

    const db = getDb();
    const imageData = fs.readFileSync(file.path).toString('base64');
    const ext = file.mimetype.split('/')[1] || 'jpeg';

    const bowlers = db.prepare('SELECT * FROM bowlers WHERE session_id = ? ORDER BY name').all(sessionId);
    const bowlerNames = bowlers.map(b => b.name).join(', ');

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: `image/${ext}`, data: imageData },
          },
          {
            type: 'text',
            text: `This is a bowling scoresheet. The bowlers in this session are: ${bowlerNames}.

Please extract the total score for Game ${game || 'shown'} for each bowler visible.
Return ONLY a JSON object in this exact format:
{"scores": [{"name": "Bowler Name", "score": 185}, ...]}

Only include bowlers where you can clearly read the score. Scores should be between 0 and 300.`,
          },
        ],
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    let extracted = { scores: [] };
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) extracted = JSON.parse(match[0]);
    } catch {}

    // Match names to bowlers (fuzzy)
    const matched = extracted.scores.map(s => {
      const bowler = bowlers.find(b =>
        b.name.toLowerCase().includes(s.name.toLowerCase()) ||
        s.name.toLowerCase().includes(b.name.toLowerCase().split(' ')[0])
      );
      return { ...s, bowler_id: bowler?.id, bowler_name: bowler?.name };
    }).filter(s => s.bowler_id);

    // Save submission
    const submissionId = uuidv4();
    db.prepare('INSERT INTO score_submissions (id, session_id, bowler_id, game, image_path, extracted_data, status) VALUES (?,?,?,?,?,?,?)')
      .run(submissionId, sessionId, bowler_id || null, game || null, file.filename, JSON.stringify(matched), 'pending');

    res.json({ submissionId, matched, rawText: text });
  } catch (err) {
    console.error('Scan error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get pending submissions
app.get('/api/sessions/:id/submissions', (req, res) => {
  const db = getDb();
  const submissions = db.prepare('SELECT * FROM score_submissions WHERE session_id = ? ORDER BY submitted_at DESC').all(req.params.id);
  res.json(submissions.map(s => ({ ...s, extracted_data: JSON.parse(s.extracted_data || '[]') })));
});

// Approve submission
app.post('/api/sessions/:id/submissions/:sid/approve', (req, res) => {
  const db = getDb();
  const { id: sessionId, sid } = req.params;
  const submission = db.prepare('SELECT * FROM score_submissions WHERE id = ?').get(sid);
  if (!submission) return res.status(404).json({ error: 'Not found' });

  const scores = JSON.parse(submission.extracted_data || '[]');
  const upsert = db.prepare(
    'INSERT INTO scores (id, session_id, bowler_id, game, raw_score) VALUES (?,?,?,?,?) ON CONFLICT(bowler_id, game) DO UPDATE SET raw_score = excluded.raw_score'
  );

  db.transaction(() => {
    for (const s of scores) {
      if (s.bowler_id && s.score != null) {
        upsert.run(uuidv4(), sessionId, s.bowler_id, submission.game, s.score);
      }
    }
  })();

  db.prepare('UPDATE score_submissions SET status = ? WHERE id = ?').run('approved', sid);
  if (submission.game) resolveBracketRound(sessionId, submission.game, db);
  notifySession(sessionId);
  res.json({ ok: true });
});

app.post('/api/sessions/:id/submissions/:sid/reject', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE score_submissions SET status = ? WHERE id = ?').run('rejected', req.params.sid);
  res.json({ ok: true });
});

// ============ BRACKETS ============

app.get('/api/sessions/:id/brackets', (req, res) => {
  const db = getDb();
  const brackets = getBracketData(req.params.id, db);
  res.json(brackets);
});

app.post('/api/sessions/:id/brackets/generate', (req, res) => {
  const db = getDb();
  const result = generateBrackets(req.params.id, db);
  notifySession(req.params.id);
  res.json(result);
});

app.post('/api/sessions/:id/brackets/resolve/:game', (req, res) => {
  const db = getDb();
  resolveBracketRound(req.params.id, parseInt(req.params.game), db);
  notifySession(req.params.id);
  res.json({ ok: true });
});

// ============ CONTESTS ============

app.get('/api/sessions/:id/contests', (req, res) => {
  const db = getDb();
  const results = getContestResults(req.params.id, db);
  res.json(results);
});

app.post('/api/sessions/:id/mystery-doubles/draw', (req, res) => {
  const db = getDb();
  const pairs = drawMysteryDoubles(req.params.id, db);
  notifySession(req.params.id);
  res.json(pairs);
});

// ============ PAYOUTS ============

app.get('/api/sessions/:id/payouts', (req, res) => {
  const db = getDb();
  const summary = getPayoutSummary(req.params.id, db);
  res.json(summary);
});

app.post('/api/sessions/:id/payouts/calculate', (req, res) => {
  const db = getDb();
  calculateAllPayouts(req.params.id, db);
  notifySession(req.params.id);
  const summary = getPayoutSummary(req.params.id, db);
  res.json(summary);
});

app.post('/api/sessions/:id/payouts/:pid/pay', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE payouts SET is_paid = 1 WHERE id = ?').run(req.params.pid);
  notifySession(req.params.id);
  res.json({ ok: true });
});

app.post('/api/sessions/:id/payouts/bowler/:bid/pay-all', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE payouts SET is_paid = 1 WHERE session_id = ? AND bowler_id = ?').run(req.params.id, req.params.bid);
  notifySession(req.params.id);
  res.json({ ok: true });
});

app.post('/api/sessions/:id/payouts/bowler/:bid/forward', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE payouts SET forwarded = 1, is_paid = 1 WHERE session_id = ? AND bowler_id = ?').run(req.params.id, req.params.bid);
  notifySession(req.params.id);
  res.json({ ok: true });
});

// ============ DELEGATES ============

app.get('/api/sessions/:id/delegates', (req, res) => {
  const db = getDb();
  const delegates = db.prepare('SELECT * FROM delegates WHERE session_id = ?').all(req.params.id);
  res.json(delegates);
});

app.post('/api/sessions/:id/delegates', (req, res) => {
  const db = getDb();
  const { id: sessionId } = req.params;
  const { name, can_manage_entries = 0, can_enter_scores = 0, can_record_payments = 0 } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  // Generate a readable access code
  const day = new Date().toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const code = `${day}-${Math.floor(1000 + Math.random() * 9000)}`;

  const id = uuidv4();
  db.prepare('INSERT INTO delegates (id, session_id, name, access_code, can_manage_entries, can_enter_scores, can_record_payments) VALUES (?,?,?,?,?,?,?)')
    .run(id, sessionId, name, code, can_manage_entries ? 1 : 0, can_enter_scores ? 1 : 0, can_record_payments ? 1 : 0);

  res.json(db.prepare('SELECT * FROM delegates WHERE id = ?').get(id));
});

app.put('/api/sessions/:id/delegates/:did', (req, res) => {
  const db = getDb();
  const { can_manage_entries, can_enter_scores, can_record_payments } = req.body;
  db.prepare('UPDATE delegates SET can_manage_entries = ?, can_enter_scores = ?, can_record_payments = ? WHERE id = ?')
    .run(can_manage_entries ? 1 : 0, can_enter_scores ? 1 : 0, can_record_payments ? 1 : 0, req.params.did);
  res.json(db.prepare('SELECT * FROM delegates WHERE id = ?').get(req.params.did));
});

app.delete('/api/sessions/:id/delegates/:did', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM delegates WHERE id = ? AND session_id = ?').run(req.params.did, req.params.id);
  res.json({ ok: true });
});

// Delegate auth
app.post('/api/delegate/auth', (req, res) => {
  const db = getDb();
  const { access_code } = req.body;
  const delegate = db.prepare('SELECT d.*, s.name as session_name FROM delegates d JOIN sessions s ON d.session_id = s.id WHERE d.access_code = ?').get(access_code);
  if (!delegate) return res.status(401).json({ error: 'Invalid access code' });
  res.json(delegate);
});

// ============ BOWLER DASHBOARD ============

app.get('/api/bowler/:token', (req, res) => {
  const db = getDb();
  const bowler = db.prepare('SELECT * FROM bowlers WHERE bowler_token = ?').get(req.params.token);
  if (!bowler) return res.status(404).json({ error: 'Not found' });

  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(bowler.session_id);
  const settings = JSON.parse(session.settings || '{}');

  const scores = db.prepare('SELECT * FROM scores WHERE bowler_id = ? ORDER BY game').all(bowler.id);
  const allScores = db.prepare('SELECT s.*, b.name, b.handicap FROM scores s JOIN bowlers b ON s.bowler_id = b.id WHERE s.session_id = ?').all(bowler.session_id);

  // Contest entries
  const entries = db.prepare('SELECT contest_type FROM contest_entries WHERE session_id = ? AND bowler_id = ?').all(bowler.session_id, bowler.id);
  const contestTypes = entries.map(e => e.contest_type);

  // Bracket data for this bowler
  const allBrackets = getBracketData(bowler.session_id, db);
  const myBrackets = allBrackets.filter(b =>
    b.slots.some(s => s.bowler_id === bowler.id)
  );

  // Contest results
  const contestResults = getContestResults(bowler.session_id, db);

  // All bowlers for leaderboard
  const allBowlers = db.prepare('SELECT * FROM bowlers WHERE session_id = ? ORDER BY name').all(bowler.session_id);

  // Payouts for this bowler
  const payouts = db.prepare('SELECT * FROM payouts WHERE session_id = ? AND bowler_id = ? ORDER BY amount DESC').all(bowler.session_id, bowler.id);

  res.json({
    bowler,
    session: { ...session, settings },
    scores,
    allScores,
    allBowlers,
    contestTypes,
    myBrackets,
    contestResults,
    payouts,
  });
});

// Overview data
app.get('/api/sessions/:id/overview', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
  if (!session) return res.status(404).json({ error: 'Not found' });

  const settings = JSON.parse(session.settings || '{}');
  const bowlers = db.prepare('SELECT * FROM bowlers WHERE session_id = ?').all(id);
  const scores = db.prepare('SELECT * FROM scores WHERE session_id = ?').all(id);
  const payouts = db.prepare('SELECT * FROM payouts WHERE session_id = ?').all(id);

  const totalEntries = bowlers.reduce((s, b) => s + b.num_entries, 0);
  const totalCollected = bowlers.reduce((s, b) => s + b.amount_paid, 0);
  const totalOwed = bowlers.reduce((s, b) => s + b.amount_owed, 0);
  const outstanding = bowlers.filter(b => b.amount_paid < b.amount_owed).length;

  // Operator revenue = total bracket rake + contest rakes
  let operatorRevenue = 0;
  const numBrackets = db.prepare('SELECT COUNT(*) as c FROM brackets WHERE session_id = ?').get(id).c;
  operatorRevenue += numBrackets * 8 * (settings.bracket_fee || 5) * (settings.bracket_op_pct || 0.1);

  const contestEntries = db.prepare('SELECT contest_type, COUNT(*) as c FROM contest_entries WHERE session_id = ? GROUP BY contest_type').all(id);
  for (const ce of contestEntries) {
    const feeKey = ce.contest_type === 'high_game' ? 'high_game_fee' :
                   ce.contest_type === 'high_series' ? 'high_series_fee' :
                   ce.contest_type === 'mystery_doubles' ? 'mystery_doubles_fee' : 'eliminator_fee';
    const rakeKey = ce.contest_type === 'high_game' ? 'high_game_rake' :
                    ce.contest_type === 'high_series' ? 'high_series_rake' :
                    ce.contest_type === 'mystery_doubles' ? 'mystery_doubles_rake' : 'eliminator_rake';
    operatorRevenue += ce.c * (settings[feeKey] || 5) * (settings[rakeKey] || 0.1);
  }

  const gamesScored = [1, 2, 3].map(g => ({
    game: g,
    scored: scores.filter(s => s.game === g).length,
    total: bowlers.length,
  }));

  const totalPayouts = payouts.reduce((s, p) => s + p.amount, 0);
  const paidPayouts = payouts.filter(p => p.is_paid).reduce((s, p) => s + p.amount, 0);

  res.json({
    totalEntries,
    totalCollected,
    totalOwed,
    outstanding,
    operatorRevenue,
    bowlerCount: bowlers.length,
    gamesScored,
    totalPayouts,
    paidPayouts,
    payoutsOwed: totalPayouts - paidPayouts,
  });
});

app.listen(PORT, () => {
  console.log(`Bowling server running on port ${PORT}`);
});
