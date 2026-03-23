import { SupabaseClient } from '@supabase/supabase-js'
import { Bracket, BracketMatch, Bowler, SessionSettings } from '@/lib/types'

// Fisher-Yates shuffle
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Round 1 seeding: 1v8, 2v7, 3v6, 4v5
const R1_PAIRS: [number, number][] = [[1,8],[2,7],[3,6],[4,5]]

// Maps R1 match winner positions to R2 match slots
// R2 match 1: winners of R1 matches 1&2  →  (match_position=1)
// R2 match 2: winners of R1 matches 3&4  →  (match_position=2)
function r1WinnerToR2(r1MatchPos: number): { match: number; slot: 1 | 2 } {
  if (r1MatchPos <= 2) return { match: 1, slot: r1MatchPos === 1 ? 1 : 2 }
  return { match: 2, slot: r1MatchPos === 3 ? 1 : 2 }
}

function r2WinnerToR3(r2MatchPos: number): { slot: 1 | 2 } {
  return { slot: r2MatchPos === 1 ? 1 : 2 }
}

export async function generateBrackets(
  sessionId: number,
  db: SupabaseClient,
): Promise<{ numBrackets: number; leftoverCount: number; leftoverBowlerIds: number[] }> {
  // Delete existing brackets for this session
  await db.from('brackets').delete().eq('session_id', sessionId)

  // Get all entry slots: expand each bowler's num_entries
  const { data: bowlers } = await db
    .from('bowlers')
    .select('id, num_entries')
    .eq('session_id', sessionId)

  if (!bowlers || bowlers.length === 0) return { numBrackets: 0, leftoverCount: 0, leftoverBowlerIds: [] }

  // Build entry pool
  const pool: number[] = []
  for (const b of bowlers) {
    for (let i = 0; i < b.num_entries; i++) pool.push(b.id)
  }

  const shuffled = shuffle(pool)
  const numBrackets = Math.floor(shuffled.length / 8)
  const leftover = shuffled.slice(numBrackets * 8)
  const leftoverBowlerIds = [...new Set(leftover)]

  for (let bn = 1; bn <= numBrackets; bn++) {
    const slots = shuffled.slice((bn - 1) * 8, bn * 8)

    // Insert bracket
    const { data: bracket } = await db
      .from('brackets')
      .insert({ session_id: sessionId, bracket_number: bn })
      .select('id')
      .single()

    if (!bracket) continue

    // Insert 8 slots
    await db.from('bracket_slots').insert(
      slots.map((bowlerId, idx) => ({
        bracket_id: bracket.id,
        bowler_id: bowlerId,
        slot_number: idx + 1,
      })),
    )

    // Insert matches for both modes
    for (const mode of ['handicap', 'scratch'] as const) {
      const matches: object[] = []

      // Round 1: 4 matches
      for (let mp = 1; mp <= 4; mp++) {
        const [s1, s2] = R1_PAIRS[mp - 1]
        matches.push({
          bracket_id: bracket.id,
          mode,
          round: 1,
          match_position: mp,
          bowler1_id: slots[s1 - 1],
          bowler2_id: slots[s2 - 1],
        })
      }

      // Round 2: 2 matches (TBD bowlers)
      for (let mp = 1; mp <= 2; mp++) {
        matches.push({ bracket_id: bracket.id, mode, round: 2, match_position: mp })
      }

      // Round 3: 1 match (Final)
      matches.push({ bracket_id: bracket.id, mode, round: 3, match_position: 1 })

      await db.from('bracket_matches').insert(matches)
    }
  }

  return { numBrackets, leftoverCount: leftover.length, leftoverBowlerIds }
}

export async function resolveBracketRound(
  sessionId: number,
  game: number,
  db: SupabaseClient,
): Promise<void> {
  // Get all bowlers with their handicap
  const { data: bowlers } = await db
    .from('bowlers')
    .select('id, handicap')
    .eq('session_id', sessionId)

  const { data: scores } = await db
    .from('scores')
    .select('bowler_id, game, raw_score')
    .eq('session_id', sessionId)
    .eq('game', game)

  if (!bowlers || !scores) return

  const handicapMap: Record<number, number> = {}
  for (const b of bowlers) handicapMap[b.id] = b.handicap

  const scoreMap: Record<number, number> = {}
  for (const s of scores) scoreMap[s.bowler_id] = s.raw_score

  // Get all matches for this round
  const { data: brackets } = await db
    .from('brackets')
    .select('id')
    .eq('session_id', sessionId)

  if (!brackets) return

  for (const bracket of brackets) {
    for (const mode of ['handicap', 'scratch'] as const) {
      const { data: matches } = await db
        .from('bracket_matches')
        .select('*')
        .eq('bracket_id', bracket.id)
        .eq('mode', mode)
        .eq('round', game)

      if (!matches) continue

      for (const match of matches) {
        if (!match.bowler1_id || !match.bowler2_id) continue
        const raw1 = scoreMap[match.bowler1_id] ?? null
        const raw2 = scoreMap[match.bowler2_id] ?? null
        if (raw1 === null || raw2 === null) continue

        const s1 = mode === 'handicap' ? raw1 + (handicapMap[match.bowler1_id] ?? 0) : raw1
        const s2 = mode === 'handicap' ? raw2 + (handicapMap[match.bowler2_id] ?? 0) : raw2

        const winner = s1 > s2 ? match.bowler1_id : s2 > s1 ? match.bowler2_id : match.bowler1_id

        await db
          .from('bracket_matches')
          .update({ score1: s1, score2: s2, winner_id: winner })
          .eq('id', match.id)

        // Propagate winner to next round
        if (game < 3) {
          const nextRound = game + 1
          if (game === 1) {
            const { match: nextMatchPos, slot } = r1WinnerToR2(match.match_position)
            const field = slot === 1 ? 'bowler1_id' : 'bowler2_id'
            await db
              .from('bracket_matches')
              .update({ [field]: winner })
              .eq('bracket_id', bracket.id)
              .eq('mode', mode)
              .eq('round', nextRound)
              .eq('match_position', nextMatchPos)
          } else if (game === 2) {
            const { slot } = r2WinnerToR3(match.match_position)
            const field = slot === 1 ? 'bowler1_id' : 'bowler2_id'
            await db
              .from('bracket_matches')
              .update({ [field]: winner })
              .eq('bracket_id', bracket.id)
              .eq('mode', mode)
              .eq('round', 3)
              .eq('match_position', 1)
          }
        }
      }
    }
  }
}

export async function getBracketData(sessionId: number, db: SupabaseClient): Promise<Bracket[]> {
  const { data: brackets } = await db
    .from('brackets')
    .select('id, bracket_number')
    .eq('session_id', sessionId)
    .order('bracket_number')

  if (!brackets) return []

  const { data: allSlots } = await db
    .from('bracket_slots')
    .select('*, bowler:bowlers(id,name,handicap)')
    .in('bracket_id', brackets.map((b) => b.id))

  const { data: allMatches } = await db
    .from('bracket_matches')
    .select('*, bowler1:bowlers!bracket_matches_bowler1_id_fkey(id,name), bowler2:bowlers!bracket_matches_bowler2_id_fkey(id,name), winner:bowlers!bracket_matches_winner_id_fkey(id,name)')
    .in('bracket_id', brackets.map((b) => b.id))
    .order('round')
    .order('match_position')

  return brackets.map((b) => {
    const slots = (allSlots ?? []).filter((s) => s.bracket_id === b.id)
    const matches = (allMatches ?? []).filter((m) => m.bracket_id === b.id)
    return {
      ...b,
      session_id: sessionId,
      slots,
      handicap_matches: matches.filter((m) => m.mode === 'handicap'),
      scratch_matches: matches.filter((m) => m.mode === 'scratch'),
    }
  })
}

// Calculate bracket prize amounts from settings
export function bracketPrizes(settings: SessionSettings): {
  gross: number
  operatorCut: number
  firstPlace: number
  secondPlace: number
} {
  const gross = settings.bracket_entry_fee * 8
  const operatorCut = settings.bracket_operator_fee
  const firstPlace = settings.bracket_first_place
  const secondPlace = Math.max(0, gross - operatorCut - firstPlace)
  return { gross, operatorCut, firstPlace, secondPlace }
}
