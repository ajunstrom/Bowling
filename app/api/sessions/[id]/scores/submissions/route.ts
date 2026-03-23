import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { resolveBracketRound } from '@/services/brackets'

type Ctx = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const db = createServerClient()
  const { data, error } = await db
    .from('score_submissions')
    .select('*, bowler:bowlers(id,name)')
    .eq('session_id', Number(params.id))
    .order('submitted_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Bowler submitting their own scoresheet photo
export async function POST(req: NextRequest, { params }: Ctx) {
  const db = createServerClient()
  const sessionId = Number(params.id)

  // Verify bowler submissions are enabled
  const { data: session } = await db.from('sessions').select('settings').eq('id', sessionId).single()
  if (!session?.settings?.allow_bowler_submissions) {
    return NextResponse.json({ error: 'Bowler submissions not enabled for this session' }, { status: 403 })
  }

  const form = await req.formData()
  const game = Number(form.get('game') ?? 1)
  const bowlerToken = form.get('bowler_token') as string | null

  let bowlerId: number | null = null
  if (bowlerToken) {
    const { data: bowler } = await db
      .from('bowlers')
      .select('id')
      .eq('bowler_token', bowlerToken)
      .single()
    bowlerId = bowler?.id ?? null
  }

  // In a real deployment, upload image to Supabase Storage and get URL.
  // For now we store a placeholder.
  const image = form.get('image') as File | null
  const imageUrl = image ? `submission_${Date.now()}` : null

  const { data, error } = await db
    .from('score_submissions')
    .insert({ session_id: sessionId, bowler_id: bowlerId, game, image_url: imageUrl, status: 'pending' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// Operator: approve_all pending submissions
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const db = createServerClient()
  const sessionId = Number(params.id)
  const body = await req.json()

  if (!body.approve_all) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  // Get all pending submissions with extracted_data
  const { data: pending } = await db
    .from('score_submissions')
    .select('*')
    .eq('session_id', sessionId)
    .eq('status', 'pending')

  const scoresToUpsert: { session_id: number; bowler_id: number; game: number; raw_score: number }[] = []
  const gamesAffected = new Set<number>()

  for (const sub of pending ?? []) {
    if (!sub.extracted_data) continue
    for (const item of sub.extracted_data) {
      if (item.matched_bowler_id && item.score) {
        scoresToUpsert.push({
          session_id: sessionId,
          bowler_id: item.matched_bowler_id,
          game: sub.game,
          raw_score: item.score,
        })
        gamesAffected.add(sub.game)
      }
    }
  }

  if (scoresToUpsert.length > 0) {
    await db.from('scores').upsert(scoresToUpsert, { onConflict: 'bowler_id,game' })
    for (const game of gamesAffected) {
      await resolveBracketRound(sessionId, game, db)
    }
  }

  // Mark all pending as approved
  await db
    .from('score_submissions')
    .update({ status: 'approved' })
    .eq('session_id', sessionId)
    .eq('status', 'pending')

  return NextResponse.json({ ok: true, applied: scoresToUpsert.length })
}
