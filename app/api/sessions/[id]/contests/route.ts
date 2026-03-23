import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getContestResults, drawMysteryDoubles } from '@/services/contests'
import { DEFAULT_SETTINGS } from '@/lib/types'

type Ctx = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const db = createServerClient()
  const sessionId = Number(params.id)

  const { data: session } = await db.from('sessions').select('settings').eq('id', sessionId).single()
  const settings = { ...DEFAULT_SETTINGS, ...(session?.settings ?? {}) }

  const results = await getContestResults(sessionId, settings, db)
  return NextResponse.json(results)
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const db = createServerClient()
  const sessionId = Number(params.id)
  const body = await req.json()

  if (body.action === 'draw_doubles') {
    await drawMysteryDoubles(sessionId, db)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// Toggle a bowler's contest enrollment
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const db = createServerClient()
  const sessionId = Number(params.id)
  const body = await req.json()
  const { contest_type, bowler_id, enrolled } = body

  if (enrolled) {
    await db.from('contest_entries').upsert(
      { session_id: sessionId, contest_type, bowler_id },
      { onConflict: 'session_id,contest_type,bowler_id', ignoreDuplicates: true },
    )
  } else {
    await db.from('contest_entries')
      .delete()
      .eq('session_id', sessionId)
      .eq('contest_type', contest_type)
      .eq('bowler_id', bowler_id)
  }

  return NextResponse.json({ ok: true })
}
