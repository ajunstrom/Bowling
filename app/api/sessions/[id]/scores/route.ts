import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { resolveBracketRound } from '@/services/brackets'

type Ctx = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const db = createServerClient()
  const { data, error } = await db
    .from('scores')
    .select('*')
    .eq('session_id', Number(params.id))

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const db = createServerClient()
  const sessionId = Number(params.id)
  const body = await req.json()

  const scores: { bowler_id: number; game: number; raw_score: number }[] = body.scores ?? []
  if (!scores.length) return NextResponse.json({ error: 'No scores provided' }, { status: 400 })

  // Upsert scores
  const toUpsert = scores.map((s) => ({
    session_id: sessionId,
    bowler_id: s.bowler_id,
    game: s.game,
    raw_score: s.raw_score,
  }))

  const { error } = await db
    .from('scores')
    .upsert(toUpsert, { onConflict: 'bowler_id,game' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Resolve bracket round for each game submitted
  const games = [...new Set(scores.map((s) => s.game))]
  for (const game of games) {
    await resolveBracketRound(sessionId, game, db)
  }

  return NextResponse.json({ ok: true })
}
