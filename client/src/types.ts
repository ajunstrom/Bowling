export interface Session {
  id: string;
  name: string;
  date: string;
  status: string;
  current_game: number;
  settings: SessionSettings;
  created_at: string;
}

export interface SessionSettings {
  bracket_fee: number;
  bracket_op_pct: number;
  has_eliminator: boolean;
  eliminator_fee: number;
  eliminator_rake: number;
  eliminator_places: number;
  eliminator_split: number;
  eliminator_third_fee_back: boolean;
  has_high_game: boolean;
  high_game_fee: number;
  high_game_rake: number;
  has_high_series: boolean;
  high_series_fee: number;
  high_series_rake: number;
  has_mystery_doubles: boolean;
  mystery_doubles_fee: number;
  mystery_doubles_rake: number;
}

export interface Bowler {
  id: string;
  session_id: string;
  name: string;
  handicap: number;
  num_entries: number;
  amount_owed: number;
  amount_paid: number;
  bowler_token: string;
  sort_order: number;
}

export interface Score {
  id: string;
  session_id: string;
  bowler_id: string;
  game: number;
  raw_score: number;
}

export interface BracketSlot {
  id: string;
  bracket_id: string;
  bowler_id: string;
  slot_number: number;
  bowler?: Bowler;
}

export interface BracketMatch {
  id: string;
  bracket_id: string;
  mode: 'handicap' | 'scratch';
  round: number;
  match_position: number;
  bowler1_id: string | null;
  bowler2_id: string | null;
  winner_id: string | null;
  score1: number | null;
  score2: number | null;
  bowler1?: Bowler | null;
  bowler2?: Bowler | null;
  winner?: Bowler | null;
}

export interface Bracket {
  id: string;
  session_id: string;
  bracket_number: number;
  slots: BracketSlot[];
  matches: {
    handicap: BracketMatch[];
    scratch: BracketMatch[];
  };
}

export interface ContestEntry {
  id: string;
  session_id: string;
  contest_type: string;
  bowler_id: string;
}

export interface Delegate {
  id: string;
  session_id: string;
  name: string;
  access_code: string;
  can_manage_entries: number;
  can_enter_scores: number;
  can_record_payments: number;
}

export interface Payout {
  id: string;
  session_id: string;
  bowler_id: string;
  contest_type: string;
  description: string;
  placement: number;
  amount: number;
  is_paid: number;
  forwarded: number;
  bowler_name?: string;
}

export interface PayoutSummary {
  bowlerPayouts: {
    bowlerId: string;
    name: string;
    total: number;
    paid: number;
    items: Payout[];
  }[];
  totalOwed: number;
  totalPaid: number;
  totalOutstanding: number;
}

export interface ScoreSubmission {
  id: string;
  session_id: string;
  game: number;
  image_path: string;
  extracted_data: Array<{ name: string; score: number; bowler_id?: string; bowler_name?: string }>;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
}

export interface OverviewData {
  totalEntries: number;
  totalCollected: number;
  totalOwed: number;
  outstanding: number;
  operatorRevenue: number;
  bowlerCount: number;
  gamesScored: { game: number; scored: number; total: number }[];
  totalPayouts: number;
  paidPayouts: number;
  payoutsOwed: number;
}

export interface EliminatorResult {
  entries: number;
  pool: number;
  config: {
    fee: number;
    rake: number;
    places: number;
    split: number;
    thirdFeeBack: boolean;
  };
  payouts: { place: number; amount: number }[];
  eliminatedAfterG1: any[];
  eliminatedAfterG2: any[];
  finalists: any[];
}

export interface HighGameResult {
  entries: number;
  totalPool: number;
  perGamePot: number;
  games: {
    game: number;
    pot: number;
    leader: { bowler: Bowler; score: number } | null;
    scores: { bowler: Bowler; score: number }[];
  }[];
}

export interface HighSeriesResult {
  entries: number;
  pool: number;
  first: number;
  second: number;
  leaderboard: {
    bowler: Bowler;
    game1: number | null;
    game2: number | null;
    game3: number | null;
    series: number;
  }[];
}

export interface MysteryDoublesResult {
  entries: number;
  pool: number;
  pairPrize: number;
  pairs: {
    id: string;
    bowler1: Bowler;
    bowler2: Bowler;
    scores1: Record<string, number>;
    scores2: Record<string, number>;
    combinedSeries: number;
  }[];
  unpaired: Bowler[];
}

export interface ContestResults {
  eliminator?: EliminatorResult;
  high_game?: HighGameResult;
  high_series?: HighSeriesResult;
  mystery_doubles?: MysteryDoublesResult;
}
