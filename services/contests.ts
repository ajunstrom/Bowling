import { SupabaseClient } from '@supabase/supabase-js'
import {
  SessionSettings,
  ContestResults,
  EliminatorResult,
  EliminatorFinalist,
  HighGameResult,
  HighSeriesResult,
  MysteryDoublesResult,
  MysteryDoublesPairResult,
} from '@/lib/types'

function prizePool(entries: number, fee: number, rakePct: number): { pool: number; rake: number; prizePool: number } {
  const pool = entries * fee
  const rake = Math.round(pool * rakePct) / 100
  return { pool, rake, prizePool: pool - rake }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export async function getContestResults(
  sessionId: number,
  settings: SessionSettings,
  db: SupabaseClient,
): Promise<ContestResults> {
  const [
    { data: entries },
    { data: scores },
    { data: bowlers },
    { data: pairs },
  ] = await Promise.all([
    db.from('contest_entries').select('*').eq('session_id', sessionId),
    db.from('scores').select('*').eq('session_id', sessionId),
    db.from('bowlers').select('id, name, handicap').eq('session_id', sessionId),
    db.from('mystery_doubles_pairs').select('*').eq('session_id', sessionId),
  ])

  const bowlerMap: Record<number, { name: string; handicap: number }> = {}
  for (const b of bowlers ?? []) bowlerMap[b.id] = { name: b.name, handicap: b.handicap }

  // Score helpers
  const getScore = (bowlerId: number, game: number) =>
    (scores ?? []).find((s) => s.bowler_id === bowlerId && s.game === game)?.raw_score ?? null

  const getSeries = (bowlerId: number) => {
    const g1 = getScore(bowlerId, 1) ?? 0
    const g2 = getScore(bowlerId, 2) ?? 0
    const g3 = getScore(bowlerId, 3) ?? 0
    return g1 + g2 + g3
  }

  // ─── Eliminator ──────────────────────────────────────────────────────────
  let eliminator: EliminatorResult | null = null
  if (settings.eliminator_enabled) {
    const elimEntries = (entries ?? []).filter((e) => e.contest_type === 'eliminator')
    const elimBowlerIds = elimEntries.map((e) => e.bowler_id)
    const { pool, rake, prizePool: pp } = prizePool(elimBowlerIds.length, settings.eliminator_fee, settings.eliminator_rake_pct)

    // After G1: cut to top 50% (ceil)
    const afterG1Target = Math.ceil(elimBowlerIds.length / 2)

    const g1Ranked = elimBowlerIds
      .filter((id) => getScore(id, 1) !== null)
      .sort((a, b) => (getScore(b, 1) ?? 0) - (getScore(a, 1) ?? 0))

    const survivorsAfterG1 = g1Ranked.length >= elimBowlerIds.length
      ? g1Ranked.slice(0, afterG1Target)
      : elimBowlerIds  // G1 not complete yet

    // After G2: cut to places_paid + 1 (so G3 determines final ordering)
    const afterG2Target = settings.eliminator_places_paid + 1

    const g2Ranked = survivorsAfterG1
      .filter((id) => getScore(id, 2) !== null)
      .sort((a, b) => (getScore(b, 2) ?? 0) - (getScore(a, 2) ?? 0))

    const survivorsAfterG2 = g2Ranked.length >= survivorsAfterG1.length
      ? g2Ranked.slice(0, afterG2Target)
      : survivorsAfterG1

    // G3 finalists sorted by G3 scratch score
    const g3Finalists = survivorsAfterG2
      .filter((id) => getScore(id, 3) !== null)
      .sort((a, b) => (getScore(b, 3) ?? 0) - (getScore(a, 3) ?? 0))

    // Payout structure
    const payoutStructure = buildEliminatorPayouts(pp, settings)

    const finalists: EliminatorFinalist[] = (g3Finalists.length > 0 ? g3Finalists : survivorsAfterG2).map(
      (id, idx) => ({
        bowlerId: id,
        name: bowlerMap[id]?.name ?? '?',
        g1: getScore(id, 1) ?? 0,
        g2: getScore(id, 2) ?? 0,
        g3: getScore(id, 3),
        series: getSeries(id),
        place: idx + 1,
        prize: payoutStructure.find((p) => p.place === idx + 1)?.amount ?? 0,
      }),
    )

    eliminator = {
      entries: elimBowlerIds.length,
      pool,
      rake,
      prizePool: pp,
      survivorsAfterG1: survivorsAfterG1,
      survivorsAfterG2: survivorsAfterG2,
      finalists,
      payoutStructure,
    }
  }

  // ─── High Game ───────────────────────────────────────────────────────────
  let high_game: HighGameResult | null = null
  if (settings.high_game_enabled) {
    const hgEntries = (entries ?? []).filter((e) => e.contest_type === 'high_game')
    const hgIds = hgEntries.map((e) => e.bowler_id)
    const { pool, rake, prizePool: pp } = prizePool(hgIds.length, settings.high_game_fee, settings.high_game_rake_pct)

    // 3 equal pots; G3 gets rounding remainder
    const basePot = Math.floor((pp / 3) * 100) / 100
    const g3Pot = Math.round((pp - basePot * 2) * 100) / 100

    const pots = ([1, 2, 3] as const).map((game) => {
      const ranked = hgIds
        .map((id) => ({ bowlerId: id, name: bowlerMap[id]?.name ?? '?', score: getScore(id, game) ?? -1 }))
        .filter((x) => x.score >= 0)
        .sort((a, b) => b.score - a.score)

      return {
        game,
        winner: ranked[0] ?? null,
        top4: ranked.slice(0, 4),
        pot: game === 3 ? g3Pot : basePot,
      }
    })

    high_game = { entries: hgIds.length, pool, rake, prizePool: pp, potPerGame: basePot, pots }
  }

  // ─── High Series ─────────────────────────────────────────────────────────
  let high_series: HighSeriesResult | null = null
  if (settings.high_series_enabled) {
    const hsEntries = (entries ?? []).filter((e) => e.contest_type === 'high_series')
    const hsIds = hsEntries.map((e) => e.bowler_id)
    const { pool, rake, prizePool: pp } = prizePool(hsIds.length, settings.high_series_fee, settings.high_series_rake_pct)

    const leaderboard = hsIds
      .map((id) => ({
        bowlerId: id,
        name: bowlerMap[id]?.name ?? '?',
        g1: getScore(id, 1) ?? 0,
        g2: getScore(id, 2) ?? 0,
        g3: getScore(id, 3) ?? 0,
        series: getSeries(id),
      }))
      .sort((a, b) => b.series - a.series)

    high_series = {
      entries: hsIds.length,
      pool,
      rake,
      prizePool: pp,
      firstPct: settings.high_series_first_pct,
      leaderboard,
    }
  }

  // ─── Mystery Doubles ─────────────────────────────────────────────────────
  let mystery_doubles: MysteryDoublesResult | null = null
  if (settings.mystery_doubles_enabled) {
    const mdEntries = (entries ?? []).filter((e) => e.contest_type === 'mystery_doubles')
    const mdIds = mdEntries.map((e) => e.bowler_id)
    const { pool, rake, prizePool: pp } = prizePool(mdIds.length, settings.mystery_doubles_fee, settings.mystery_doubles_rake_pct)

    const pairsData = pairs ?? []
    const pairedIds = new Set<number>()
    const pairResults: MysteryDoublesPairResult[] = []

    for (const pair of pairsData) {
      if (!mdIds.includes(pair.bowler1_id) || !mdIds.includes(pair.bowler2_id)) continue
      pairedIds.add(pair.bowler1_id)
      pairedIds.add(pair.bowler2_id)

      const breakdown = [1, 2, 3].map((game) => ({
        game,
        b1: getScore(pair.bowler1_id, game) ?? 0,
        b2: getScore(pair.bowler2_id, game) ?? 0,
        combined: (getScore(pair.bowler1_id, game) ?? 0) + (getScore(pair.bowler2_id, game) ?? 0),
      }))

      pairResults.push({
        pairId: pair.id,
        bowler1: { id: pair.bowler1_id, name: bowlerMap[pair.bowler1_id]?.name ?? '?' },
        bowler2: { id: pair.bowler2_id, name: bowlerMap[pair.bowler2_id]?.name ?? '?' },
        gameBreakdown: breakdown,
        combinedSeries: breakdown.reduce((s, g) => s + g.combined, 0),
        place: 0,
      })
    }

    pairResults.sort((a, b) => b.combinedSeries - a.combinedSeries)
    pairResults.forEach((p, i) => { p.place = i + 1 })

    const unpaired = mdIds
      .filter((id) => !pairedIds.has(id))
      .map((id) => ({ bowlerId: id, name: bowlerMap[id]?.name ?? '?' }))

    mystery_doubles = {
      entries: mdIds.length,
      pool,
      rake,
      prizePool: pp,
      repairPerGame: settings.mystery_doubles_repair ?? false,
      pairs: pairResults,
      unpaired,
    }
  }

  return { eliminator, high_game, high_series, mystery_doubles }
}

export function buildEliminatorPayouts(
  prizePool: number,
  settings: SessionSettings,
): { place: number; amount: number }[] {
  const places = settings.eliminator_places_paid
  const split = settings.eliminator_split_pct / 100
  const feeBack = settings.eliminator_third_fee_back ? settings.eliminator_fee : 0

  if (places === 1) {
    return [{ place: 1, amount: Math.round(prizePool * 100) / 100 }]
  }

  const pool = places === 3 && settings.eliminator_third_fee_back
    ? prizePool - feeBack
    : prizePool

  const first = Math.round(pool * split * 100) / 100
  const second = Math.round((pool - first) * 100) / 100

  const result = [
    { place: 1, amount: first },
    { place: 2, amount: second },
  ]
  if (places === 3) result.push({ place: 3, amount: feeBack })
  return result
}

export async function drawMysteryDoubles(sessionId: number, db: SupabaseClient): Promise<void> {
  // Delete existing pairs
  await db.from('mystery_doubles_pairs').delete().eq('session_id', sessionId)

  const { data: entries } = await db
    .from('contest_entries')
    .select('bowler_id')
    .eq('session_id', sessionId)
    .eq('contest_type', 'mystery_doubles')

  if (!entries || entries.length < 2) return

  const ids = shuffle(entries.map((e) => e.bowler_id))
  const pairsToInsert: object[] = []

  for (let i = 0; i < ids.length - 1; i += 2) {
    pairsToInsert.push({
      session_id: sessionId,
      bowler1_id: ids[i],
      bowler2_id: ids[i + 1],
    })
  }

  if (pairsToInsert.length > 0) {
    await db.from('mystery_doubles_pairs').insert(pairsToInsert)
  }
}
