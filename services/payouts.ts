import { SupabaseClient } from '@supabase/supabase-js'
import { PayoutSummary, BowlerPayout, Payout, SessionSettings } from '@/lib/types'
import { getContestResults, buildEliminatorPayouts } from './contests'
import { getBracketData, bracketPrizes } from './brackets'

export async function calculateAllPayouts(
  sessionId: number,
  settings: SessionSettings,
  db: SupabaseClient,
): Promise<void> {
  // Clear existing payouts
  await db.from('payouts').delete().eq('session_id', sessionId)

  const payoutsToInsert: object[] = []

  // ─── Bracket payouts ────────────────────────────────────────────────────
  if (settings.brackets_enabled) {
    const brackets = await getBracketData(sessionId, db)
    const { firstPlace, secondPlace } = bracketPrizes(settings)

    for (const bracket of brackets) {
      for (const mode of ['handicap', 'scratch'] as const) {
        const matches = mode === 'handicap' ? bracket.handicap_matches : bracket.scratch_matches
        const final = matches.find((m) => m.round === 3 && m.match_position === 1)
        if (!final?.winner_id) continue

        // Champion
        payoutsToInsert.push({
          session_id: sessionId,
          bowler_id: final.winner_id,
          contest_type: 'bracket',
          description: `Bracket #${bracket.bracket_number} ${mode === 'handicap' ? 'Hdcp' : 'Scratch'} Champion`,
          placement: 1,
          amount: firstPlace,
        })

        // Runner-up: the loser of the final
        const runnerUpId = final.winner_id === final.bowler1_id ? final.bowler2_id : final.bowler1_id
        if (runnerUpId && secondPlace > 0) {
          payoutsToInsert.push({
            session_id: sessionId,
            bowler_id: runnerUpId,
            contest_type: 'bracket',
            description: `Bracket #${bracket.bracket_number} ${mode === 'handicap' ? 'Hdcp' : 'Scratch'} Runner-Up`,
            placement: 2,
            amount: secondPlace,
          })
        }
      }
    }
  }

  // ─── Contest payouts ─────────────────────────────────────────────────────
  const results = await getContestResults(sessionId, settings, db)

  // Eliminator
  if (results.eliminator) {
    const { finalists, payoutStructure } = results.eliminator
    for (const payout of payoutStructure) {
      const finalist = finalists.find((f) => f.place === payout.place)
      if (!finalist || payout.amount <= 0) continue
      const label = payout.place === 3 && settings.eliminator_third_fee_back ? 'Entry Refund' : `${ordinal(payout.place)} Place`
      payoutsToInsert.push({
        session_id: sessionId,
        bowler_id: finalist.bowlerId,
        contest_type: 'eliminator',
        description: `Eliminator ${label} · G3 scratch ${finalist.g3 ?? '—'}`,
        placement: payout.place,
        amount: payout.amount,
      })
    }
  }

  // High Game
  if (results.high_game) {
    for (const pot of results.high_game.pots) {
      if (!pot.winner || pot.pot <= 0) continue
      payoutsToInsert.push({
        session_id: sessionId,
        bowler_id: pot.winner.bowlerId,
        contest_type: 'high_game',
        description: `High Game G${pot.game} · scratch ${pot.winner.score}`,
        placement: 1,
        amount: pot.pot,
      })
    }
  }

  // High Series
  if (results.high_series && results.high_series.leaderboard.length > 0) {
    const { leaderboard, prizePool: pp, firstPct } = results.high_series
    const first = Math.round(pp * firstPct) / 100
    const second = Math.round((pp - first) * 100) / 100

    if (leaderboard[0]) {
      payoutsToInsert.push({
        session_id: sessionId,
        bowler_id: leaderboard[0].bowlerId,
        contest_type: 'high_series',
        description: `High Series 1st · scratch ${leaderboard[0].series} · ${firstPct}% of $${pp.toFixed(2)}`,
        placement: 1,
        amount: first,
      })
    }
    if (leaderboard[1] && second > 0) {
      payoutsToInsert.push({
        session_id: sessionId,
        bowler_id: leaderboard[1].bowlerId,
        contest_type: 'high_series',
        description: `High Series 2nd · scratch ${leaderboard[1].series} · ${100 - firstPct}% of $${pp.toFixed(2)}`,
        placement: 2,
        amount: second,
      })
    }
  }

  // Mystery Doubles
  if (results.mystery_doubles && results.mystery_doubles.pairs.length > 0) {
    const { pairs, prizePool: pp } = results.mystery_doubles
    const winner = pairs.find((p) => p.place === 1)
    if (winner && pp > 0) {
      const perBowler = Math.round((pp / 2) * 100) / 100
      payoutsToInsert.push({
        session_id: sessionId,
        bowler_id: winner.bowler1.id,
        contest_type: 'mystery_doubles',
        description: `Mystery Doubles Champions · ${winner.bowler1.name} & ${winner.bowler2.name}`,
        placement: 1,
        amount: perBowler,
      })
      payoutsToInsert.push({
        session_id: sessionId,
        bowler_id: winner.bowler2.id,
        contest_type: 'mystery_doubles',
        description: `Mystery Doubles Champions · ${winner.bowler1.name} & ${winner.bowler2.name}`,
        placement: 1,
        amount: perBowler,
      })
    }
  }

  if (payoutsToInsert.length > 0) {
    await db.from('payouts').insert(payoutsToInsert)
  }
}

export async function getPayoutSummary(
  sessionId: number,
  settings: SessionSettings,
  db: SupabaseClient,
): Promise<PayoutSummary> {
  const { data: payouts } = await db
    .from('payouts')
    .select('*, bowler:bowlers(id,name)')
    .eq('session_id', sessionId)
    .order('amount', { ascending: false })

  const { data: bowlers } = await db
    .from('bowlers')
    .select('id, num_entries')
    .eq('session_id', sessionId)

  const all: Payout[] = (payouts ?? []) as Payout[]

  // Group by bowler
  const byBowler: Record<number, BowlerPayout> = {}
  for (const p of all) {
    if (!byBowler[p.bowler_id]) {
      byBowler[p.bowler_id] = {
        bowlerId: p.bowler_id,
        name: (p as any).bowler?.name ?? '?',
        payouts: [],
        total: 0,
        totalPaid: 0,
        totalOutstanding: 0,
      }
    }
    byBowler[p.bowler_id].payouts.push(p)
    byBowler[p.bowler_id].total += p.amount
    if (p.is_paid || p.forwarded) byBowler[p.bowler_id].totalPaid += p.amount
    else byBowler[p.bowler_id].totalOutstanding += p.amount
  }

  const bowlerPayouts = Object.values(byBowler).sort((a, b) => b.total - a.total)

  const totalPrizePool = all.reduce((s, p) => s + p.amount, 0)
  const totalPaid = all.filter((p) => p.is_paid || p.forwarded).reduce((s, p) => s + p.amount, 0)

  // Operator revenue calculation
  const { data: entries } = await db
    .from('contest_entries')
    .select('contest_type, bowler_id')
    .eq('session_id', sessionId)

  const { data: brackets } = await db
    .from('brackets')
    .select('id')
    .eq('session_id', sessionId)

  const numBrackets = (brackets ?? []).length
  const bracketRevenue = numBrackets * settings.bracket_operator_fee * 2 // handicap + scratch

  const contestRake = (['eliminator', 'high_game', 'high_series', 'mystery_doubles'] as const).reduce(
    (sum, type) => {
      const count = (entries ?? []).filter((e) => e.contest_type === type).length
      let fee = 0, rake = 0
      if (type === 'eliminator') { fee = settings.eliminator_fee; rake = settings.eliminator_rake_pct }
      if (type === 'high_game') { fee = settings.high_game_fee; rake = settings.high_game_rake_pct }
      if (type === 'high_series') { fee = settings.high_series_fee; rake = settings.high_series_rake_pct }
      if (type === 'mystery_doubles') { fee = settings.mystery_doubles_fee; rake = settings.mystery_doubles_rake_pct }
      return sum + Math.round(count * fee * rake) / 100
    },
    0,
  )

  return {
    bowlerPayouts,
    totalPrizePool,
    totalPaid,
    totalOutstanding: totalPrizePool - totalPaid,
    operatorRevenue: bracketRevenue + contestRake,
  }
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}
