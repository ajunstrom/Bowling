import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getBracketData } from '@/services/brackets'
import { getContestResults } from '@/services/contests'
import { getPayoutSummary } from '@/services/payouts'
import { DEFAULT_SETTINGS } from '@/lib/types'

type Ctx = { params: { token: string } }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const db = createServerClient()

  const { data: bowler } = await db
    .from('bowlers')
    .select('*')
    .eq('bowler_token', params.token)
    .single()

  if (!bowler) return NextResponse.json({ error: 'Bowler not found' }, { status: 404 })

  const sessionId = bowler.session_id

  const [
    { data: session },
    { data: allBowlers },
    { data: myScores },
    { data: allScores },
    { data: contestEntries },
    { data: pairs },
  ] = await Promise.all([
    db.from('sessions').select('*').eq('id', sessionId).single(),
    db.from('bowlers').select('*').eq('session_id', sessionId).order('sort_order'),
    db.from('scores').select('*').eq('bowler_id', bowler.id),
    db.from('scores').select('*').eq('session_id', sessionId),
    db.from('contest_entries').select('*').eq('session_id', sessionId),
    db.from('mystery_doubles_pairs').select('*').eq('session_id', sessionId),
  ])

  const settings = { ...DEFAULT_SETTINGS, ...(session?.settings ?? {}) }

  const [brackets, contestResults, payoutSummary] = await Promise.all([
    getBracketData(sessionId, db),
    getContestResults(sessionId, settings, db),
    getPayoutSummary(sessionId, settings, db),
  ])

  return NextResponse.json({
    bowler,
    session: { ...session, settings },
    scores: myScores ?? [],
    bowlers: allBowlers ?? [],
    allScores: allScores ?? [],
    brackets,
    contestEntries: contestEntries ?? [],
    contestResults,
    pairs: pairs ?? [],
    payoutSummary,
  })
}
