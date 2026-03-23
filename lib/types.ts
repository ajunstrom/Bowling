// ─── Session ──────────────────────────────────────────────────────────────────

export interface Session {
  id: number
  name: string
  date: string
  status: 'setup' | 'active' | 'closed'
  current_game: number
  settings: SessionSettings
  created_at: string
}

export interface SessionSettings {
  // Brackets
  brackets_enabled: boolean
  bracket_entry_fee: number        // per seat (default $1.00)
  bracket_operator_fee: number     // flat per bracket (default $1.00)
  bracket_first_place: number      // flat 1st prize per bracket (default $5.00)
  // 2nd place = (8 × entry_fee) − operator_fee − first_place (auto-calculated)

  // Eliminator
  eliminator_enabled: boolean
  eliminator_fee: number
  eliminator_rake_pct: number      // 0–100
  eliminator_places_paid: 1 | 2 | 3
  eliminator_split_pct: number     // % to 1st place (e.g. 70 → 70/30 split)
  eliminator_third_fee_back: boolean

  // High Game Pot
  high_game_enabled: boolean
  high_game_fee: number
  high_game_rake_pct: number

  // High Series
  high_series_enabled: boolean
  high_series_fee: number
  high_series_rake_pct: number
  high_series_first_pct: number    // % to 1st (default 70)

  // Mystery Doubles
  mystery_doubles_enabled: boolean
  mystery_doubles_fee: number
  mystery_doubles_rake_pct: number
  mystery_doubles_repair: boolean  // re-pair each game

  // Bowler self-submissions
  allow_bowler_submissions: boolean
}

export const DEFAULT_SETTINGS: SessionSettings = {
  brackets_enabled: true,
  bracket_entry_fee: 1.00,
  bracket_operator_fee: 1.00,
  bracket_first_place: 5.00,

  eliminator_enabled: true,
  eliminator_fee: 5.00,
  eliminator_rake_pct: 10,
  eliminator_places_paid: 2,
  eliminator_split_pct: 70,
  eliminator_third_fee_back: false,

  high_game_enabled: true,
  high_game_fee: 5.00,
  high_game_rake_pct: 10,

  high_series_enabled: true,
  high_series_fee: 5.00,
  high_series_rake_pct: 10,
  high_series_first_pct: 70,

  mystery_doubles_enabled: true,
  mystery_doubles_fee: 5.00,
  mystery_doubles_rake_pct: 10,
  mystery_doubles_repair: false,

  allow_bowler_submissions: false,
} as unknown as SessionSettings

// ─── Bowlers ──────────────────────────────────────────────────────────────────

export interface Bowler {
  id: number
  session_id: number
  name: string
  handicap: number
  num_entries: number
  amount_owed: number
  amount_paid: number
  credit_balance: number
  bowler_token: string
  sort_order: number
  created_at: string
}

// ─── Scores ───────────────────────────────────────────────────────────────────

export interface Score {
  id: number
  session_id: number
  bowler_id: number
  game: 1 | 2 | 3
  raw_score: number
}

// ─── Brackets ─────────────────────────────────────────────────────────────────

export interface Bracket {
  id: number
  session_id: number
  bracket_number: number
  slots: BracketSlot[]
  handicap_matches: BracketMatch[]
  scratch_matches: BracketMatch[]
}

export interface BracketSlot {
  id: number
  bracket_id: number
  bowler_id: number
  slot_number: number
  bowler?: Bowler
}

export interface BracketMatch {
  id: number
  bracket_id: number
  mode: 'handicap' | 'scratch'
  round: 1 | 2 | 3
  match_position: number
  bowler1_id: number | null
  bowler2_id: number | null
  winner_id: number | null
  score1: number | null
  score2: number | null
  bowler1?: Bowler | null
  bowler2?: Bowler | null
  winner?: Bowler | null
}

// ─── Contests ─────────────────────────────────────────────────────────────────

export interface ContestEntry {
  id: number
  session_id: number
  contest_type: string
  bowler_id: number
}

export interface MysteryDoublesPair {
  id: number
  session_id: number
  bowler1_id: number
  bowler2_id: number
  game: number | null
  bowler1?: Bowler
  bowler2?: Bowler
}

// ─── Contest Results ──────────────────────────────────────────────────────────

export interface EliminatorResult {
  entries: number
  pool: number
  rake: number
  prizePool: number
  survivorsAfterG1: number[]
  survivorsAfterG2: number[]
  finalists: EliminatorFinalist[]
  payoutStructure: { place: number; amount: number }[]
}

export interface EliminatorFinalist {
  bowlerId: number
  name: string
  g1: number
  g2: number
  g3: number | null
  series: number
  place: number
  prize: number
}

export interface HighGameResult {
  entries: number
  pool: number
  rake: number
  prizePool: number
  potPerGame: number
  pots: HighGamePot[]
}

export interface HighGamePot {
  game: 1 | 2 | 3
  winner: { bowlerId: number; name: string; score: number } | null
  top4: { bowlerId: number; name: string; score: number }[]
  pot: number
}

export interface HighSeriesResult {
  entries: number
  pool: number
  rake: number
  prizePool: number
  firstPct: number
  leaderboard: HighSeriesEntry[]
}

export interface HighSeriesEntry {
  bowlerId: number
  name: string
  g1: number
  g2: number
  g3: number
  series: number
}

export interface MysteryDoublesResult {
  entries: number
  pool: number
  rake: number
  prizePool: number
  repairPerGame: boolean
  pairs: MysteryDoublesPairResult[]
  unpaired: { bowlerId: number; name: string }[]
}

export interface MysteryDoublesPairResult {
  pairId: number
  bowler1: { id: number; name: string }
  bowler2: { id: number; name: string }
  gameBreakdown: { game: number; b1: number; b2: number; combined: number }[]
  combinedSeries: number
  place: number
}

export interface ContestResults {
  eliminator: EliminatorResult | null
  high_game: HighGameResult | null
  high_series: HighSeriesResult | null
  mystery_doubles: MysteryDoublesResult | null
}

// ─── Payouts ──────────────────────────────────────────────────────────────────

export interface Payout {
  id: number
  session_id: number
  bowler_id: number
  contest_type: string
  description: string | null
  placement: number | null
  amount: number
  is_paid: boolean
  forwarded: boolean
  created_at: string
  bowler?: Bowler
}

export interface BowlerPayout {
  bowlerId: number
  name: string
  payouts: Payout[]
  total: number
  totalPaid: number
  totalOutstanding: number
}

export interface PayoutSummary {
  bowlerPayouts: BowlerPayout[]
  totalPrizePool: number
  totalPaid: number
  totalOutstanding: number
  operatorRevenue: number
}

// ─── Delegates ────────────────────────────────────────────────────────────────

export interface Delegate {
  id: number
  session_id: number
  name: string
  access_code: string
  can_manage_entries: boolean
  can_enter_scores: boolean
  can_record_payments: boolean
  created_at: string
}

// ─── Score Submissions ────────────────────────────────────────────────────────

export interface ScoreSubmission {
  id: number
  session_id: number
  bowler_id: number | null
  game: 1 | 2 | 3
  image_url: string | null
  extracted_data: ExtractedScore[] | null
  status: 'pending' | 'approved' | 'rejected'
  submitted_at: string
  bowler?: Bowler | null
}

export interface ExtractedScore {
  name: string
  score: number
  matched_bowler_id?: number | null
  matched_name?: string
}

// ─── Overview ─────────────────────────────────────────────────────────────────

export interface OverviewData {
  totalEntries: number
  totalCollected: number
  operatorRevenue: number
  outstandingCount: number
  gamesComplete: boolean[]  // [g1done, g2done, g3done]
  bowlerCount: number
  paymentBreakdown: { settled: number; owes: number; credit: number }
}

// ─── Bowler Dashboard ─────────────────────────────────────────────────────────

export interface BowlerDashboardData {
  bowler: Bowler
  session: Session
  scores: Score[]
  bowlers: Bowler[]
  allScores: Score[]
  brackets: Bracket[]
  contestEntries: ContestEntry[]
  contestResults: ContestResults
  pairs: MysteryDoublesPair[]
  payoutSummary: PayoutSummary
}
