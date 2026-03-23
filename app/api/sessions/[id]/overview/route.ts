import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { DEFAULT_SETTINGS } from '@/lib/types'

type Ctx = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const db = createServerClient()
  const sessionId = Number(params.id)

  const [
    { data: session },
    { data: bowlers },
    { data: scores },
    { data: entries },
    { data: brackets },
    { data: payouts },
  ] = await Promise.all([
    db.from('sessions').select('settings').eq('id', sessionId).single(),
    db.from('bowlers').select('*').eq('session_id', sessionId),
    db.from('scores').select('game').eq('session_id', sessionId),
    db.from('contest_entries').select('contest_type').eq('session_id', sessionId),
    db.from('brackets').select('id').eq('session_id', sessionId),
    db.from('payouts').select('amount, is_paid, forwarded').eq('session_id', sessionId),
  ])

  const settings = { ...DEFAULT_SETTINGS, ...(session?.settings ?? {}) }
  const bl = bowlers ?? []

  // Entry counts
  const bracketEntries = bl.reduce((s, b) => s + b.num_entries, 0)
  const contestEntryCount = (entries ?? []).length
  const totalEntries = bracketEntries + contestEntryCount

  // Financial
  const totalCollected = bl.reduce((s, b) => s + b.amount_paid, 0)

  // Operator revenue
  const numBrackets = (brackets ?? []).length
  const bracketRevenue = numBrackets * settings.bracket_operator_fee * 2 // hdcp + scratch
  const contestRake = (['eliminator', 'high_game', 'high_series', 'mystery_doubles'] as const).reduce(
    (sum, type) => {
      const count = (entries ?? []).filter((e) => e.contest_type === type).length
      let fee = 0, rake = 0
      if (type === 'eliminator') { fee = settings.eliminator_fee; rake = settings.eliminator_rake_pct }
      if (type === 'high_game') { fee = settings.high_game_fee; rake = settings.high_game_rake_pct }
      if (type === 'high_series') { fee = settings.high_series_fee; rake = settings.high_series_rake_pct }
      if (type === 'mystery_doubles') { fee = settings.mystery_doubles_fee; rake = settings.mystery_doubles_rake_pct }
      return sum + Math.round(count * fee * rake) / 100
    }, 0,
  )

  // Outstanding bowlers
  const outstandingCount = bl.filter((b) => b.amount_paid < b.amount_owed).length

  // Games complete
  const bowlerIds = bl.map((b) => b.id)
  const gamesComplete = [1, 2, 3].map((g) =>
    bowlerIds.length > 0 &&
    bowlerIds.every((id) => (scores ?? []).some((s) => s.game === g && (s as any).bowler_id === id))
  )

  // Payment breakdown
  const settled = bl.filter((b) => b.amount_paid >= b.amount_owed && b.amount_owed > 0).length
  const owes = bl.filter((b) => b.amount_paid < b.amount_owed).length
  const credit = bl.filter((b) => b.credit_balance > 0).length

  return NextResponse.json({
    totalEntries,
    totalCollected,
    operatorRevenue: bracketRevenue + contestRake,
    outstandingCount,
    gamesComplete,
    bowlerCount: bl.length,
    paymentBreakdown: { settled, owes, credit },
  })
}
