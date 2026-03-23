-- =============================================
-- Bowling Side Action App — Supabase Schema
-- Run this in your Supabase SQL Editor
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Sessions ───────────────────────────────
CREATE TABLE sessions (
  id          bigserial PRIMARY KEY,
  name        text NOT NULL,
  date        date NOT NULL,
  status      text NOT NULL DEFAULT 'setup' CHECK (status IN ('setup','active','closed')),
  current_game int NOT NULL DEFAULT 0,
  settings    jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);

-- ─── Bowlers ────────────────────────────────
CREATE TABLE bowlers (
  id             bigserial PRIMARY KEY,
  session_id     bigint NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name           text NOT NULL,
  handicap       int NOT NULL DEFAULT 0,
  num_entries    int NOT NULL DEFAULT 1,
  amount_owed    numeric(10,2) NOT NULL DEFAULT 0,
  amount_paid    numeric(10,2) NOT NULL DEFAULT 0,
  credit_balance numeric(10,2) NOT NULL DEFAULT 0,
  bowler_token   uuid NOT NULL DEFAULT gen_random_uuid(),
  sort_order     int NOT NULL DEFAULT 0,
  created_at     timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX bowlers_token_idx ON bowlers(bowler_token);

-- ─── Scores ─────────────────────────────────
CREATE TABLE scores (
  id         bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  bowler_id  bigint NOT NULL REFERENCES bowlers(id) ON DELETE CASCADE,
  game       int NOT NULL CHECK (game IN (1,2,3)),
  raw_score  int NOT NULL CHECK (raw_score >= 0 AND raw_score <= 300),
  UNIQUE(bowler_id, game)
);

-- ─── Brackets ───────────────────────────────
CREATE TABLE brackets (
  id             bigserial PRIMARY KEY,
  session_id     bigint NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  bracket_number int NOT NULL
);

CREATE TABLE bracket_slots (
  id          bigserial PRIMARY KEY,
  bracket_id  bigint NOT NULL REFERENCES brackets(id) ON DELETE CASCADE,
  bowler_id   bigint NOT NULL REFERENCES bowlers(id) ON DELETE CASCADE,
  slot_number int NOT NULL CHECK (slot_number BETWEEN 1 AND 8)
);

CREATE TABLE bracket_matches (
  id             bigserial PRIMARY KEY,
  bracket_id     bigint NOT NULL REFERENCES brackets(id) ON DELETE CASCADE,
  mode           text NOT NULL CHECK (mode IN ('handicap','scratch')),
  round          int NOT NULL CHECK (round IN (1,2,3)),
  match_position int NOT NULL,
  bowler1_id     bigint REFERENCES bowlers(id),
  bowler2_id     bigint REFERENCES bowlers(id),
  winner_id      bigint REFERENCES bowlers(id),
  score1         int,
  score2         int
);

-- ─── Contest Entries ────────────────────────
CREATE TABLE contest_entries (
  id           bigserial PRIMARY KEY,
  session_id   bigint NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  contest_type text NOT NULL,
  bowler_id    bigint NOT NULL REFERENCES bowlers(id) ON DELETE CASCADE,
  UNIQUE(session_id, contest_type, bowler_id)
);

-- ─── Mystery Doubles Pairs ──────────────────
CREATE TABLE mystery_doubles_pairs (
  id         bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  bowler1_id bigint NOT NULL REFERENCES bowlers(id) ON DELETE CASCADE,
  bowler2_id bigint NOT NULL REFERENCES bowlers(id) ON DELETE CASCADE,
  game       int  -- NULL = same pair all night; 1/2/3 if re-pair each game
);

-- ─── Payouts ────────────────────────────────
CREATE TABLE payouts (
  id           bigserial PRIMARY KEY,
  session_id   bigint NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  bowler_id    bigint NOT NULL REFERENCES bowlers(id) ON DELETE CASCADE,
  contest_type text NOT NULL,
  description  text,
  placement    int,
  amount       numeric(10,2) NOT NULL,
  is_paid      boolean NOT NULL DEFAULT false,
  forwarded    boolean NOT NULL DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

-- ─── Delegates ──────────────────────────────
CREATE TABLE delegates (
  id                 bigserial PRIMARY KEY,
  session_id         bigint NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name               text NOT NULL,
  access_code        text NOT NULL,
  can_manage_entries boolean NOT NULL DEFAULT false,
  can_enter_scores   boolean NOT NULL DEFAULT false,
  can_record_payments boolean NOT NULL DEFAULT false,
  created_at         timestamptz DEFAULT now()
);

-- ─── Score Submissions (bowler uploads) ─────
CREATE TABLE score_submissions (
  id             bigserial PRIMARY KEY,
  session_id     bigint NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  bowler_id      bigint REFERENCES bowlers(id) ON DELETE SET NULL,
  game           int NOT NULL CHECK (game IN (1,2,3)),
  image_url      text,
  extracted_data jsonb,
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  submitted_at   timestamptz DEFAULT now()
);

-- ─── Realtime ───────────────────────────────
-- Enable Realtime for live score propagation
ALTER TABLE sessions        REPLICA IDENTITY FULL;
ALTER TABLE bowlers         REPLICA IDENTITY FULL;
ALTER TABLE scores          REPLICA IDENTITY FULL;
ALTER TABLE bracket_matches REPLICA IDENTITY FULL;
ALTER TABLE payouts         REPLICA IDENTITY FULL;
ALTER TABLE score_submissions REPLICA IDENTITY FULL;
ALTER TABLE mystery_doubles_pairs REPLICA IDENTITY FULL;

-- Add tables to the realtime publication
-- (Supabase creates supabase_realtime publication automatically)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE
      sessions, bowlers, scores, bracket_matches,
      payouts, score_submissions, mystery_doubles_pairs;
  END IF;
END $$;

-- ─── Row Level Security ─────────────────────
-- We use the service role key server-side, so RLS is permissive.
-- Tighten these if you add Supabase Auth later.
ALTER TABLE sessions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE bowlers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores               ENABLE ROW LEVEL SECURITY;
ALTER TABLE brackets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE bracket_slots        ENABLE ROW LEVEL SECURITY;
ALTER TABLE bracket_matches      ENABLE ROW LEVEL SECURITY;
ALTER TABLE contest_entries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE mystery_doubles_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE delegates            ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_submissions    ENABLE ROW LEVEL SECURITY;

-- Allow all operations from service role (used by API routes)
CREATE POLICY "service_all" ON sessions             FOR ALL USING (true);
CREATE POLICY "service_all" ON bowlers              FOR ALL USING (true);
CREATE POLICY "service_all" ON scores               FOR ALL USING (true);
CREATE POLICY "service_all" ON brackets             FOR ALL USING (true);
CREATE POLICY "service_all" ON bracket_slots        FOR ALL USING (true);
CREATE POLICY "service_all" ON bracket_matches      FOR ALL USING (true);
CREATE POLICY "service_all" ON contest_entries      FOR ALL USING (true);
CREATE POLICY "service_all" ON mystery_doubles_pairs FOR ALL USING (true);
CREATE POLICY "service_all" ON payouts              FOR ALL USING (true);
CREATE POLICY "service_all" ON delegates            FOR ALL USING (true);
CREATE POLICY "service_all" ON score_submissions    FOR ALL USING (true);

-- Allow anon key read-only on public data (for bowler dashboard realtime)
CREATE POLICY "anon_read" ON sessions      FOR SELECT USING (true);
CREATE POLICY "anon_read" ON bowlers       FOR SELECT USING (true);
CREATE POLICY "anon_read" ON scores        FOR SELECT USING (true);
CREATE POLICY "anon_read" ON bracket_matches FOR SELECT USING (true);
CREATE POLICY "anon_read" ON bracket_slots FOR SELECT USING (true);
CREATE POLICY "anon_read" ON brackets      FOR SELECT USING (true);
CREATE POLICY "anon_read" ON contest_entries FOR SELECT USING (true);
CREATE POLICY "anon_read" ON mystery_doubles_pairs FOR SELECT USING (true);
CREATE POLICY "anon_read" ON payouts       FOR SELECT USING (true);
CREATE POLICY "anon_read" ON score_submissions FOR SELECT USING (true);
