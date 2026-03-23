import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { resolveBracketRound } from '@/services/brackets'

type Ctx = { params: { id: string; subId: string } }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const db = createServerClient()
  const sessionId = Number(params.id)
  const subId = Number(params.subId)
  const body = await req.json()

  const { data: sub } = await db
    .from('score_submissions')
    .select('*')
    .eq('id', subId)
    .single()

  if (!sub) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // If approving, apply scores to the scores table
  if (body.status === 'approved' && sub.extracted_data) {
    const scoresToUpsert = (sub.extracted_data as any[])
      .filter((item) => item.matched_bowler_id && item.score)
      .map((item) => ({
        session_id: sessionId,
        bowler_id: item.matched_bowler_id,
        game: sub.game,
        raw_score: item.score,
      }))

    if (scoresToUpsert.length > 0) {
      await db.from('scores').upsert(scoresToUpsert, { onConflict: 'bowler_id,game' })
      await resolveBracketRound(sessionId, sub.game, db)
    }
  }

  const { data, error } = await db
    .from('score_submissions')
    .update({ status: body.status })
    .eq('id', subId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
