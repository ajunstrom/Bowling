import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { DEFAULT_SETTINGS } from '@/lib/types'

type Ctx = { params: { id: string } }

function calcOwed(numEntries: number, settings: any): number {
  const bracketCost = settings.brackets_enabled ? numEntries * settings.bracket_entry_fee : 0
  const elimCost = settings.eliminator_enabled ? settings.eliminator_fee : 0
  const hgCost = settings.high_game_enabled ? settings.high_game_fee : 0
  const hsCost = settings.high_series_enabled ? settings.high_series_fee : 0
  const mdCost = settings.mystery_doubles_enabled ? settings.mystery_doubles_fee : 0
  return bracketCost + elimCost + hgCost + hsCost + mdCost
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const db = createServerClient()
  const { data, error } = await db
    .from('bowlers')
    .select('*')
    .eq('session_id', Number(params.id))
    .order('sort_order')
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const db = createServerClient()
  const sessionId = Number(params.id)
  const body = await req.json()

  if (!body.name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  // Get session settings
  const { data: session } = await db.from('sessions').select('settings').eq('id', sessionId).single()
  const settings = { ...DEFAULT_SETTINGS, ...(session?.settings ?? {}) }

  // Get sort order
  const { count } = await db.from('bowlers').select('*', { count: 'exact', head: true }).eq('session_id', sessionId)

  const numEntries = body.num_entries ?? 1
  const amountOwed = calcOwed(numEntries, settings)

  const { data, error } = await db
    .from('bowlers')
    .insert({
      session_id: sessionId,
      name: body.name.trim(),
      handicap: body.handicap ?? 0,
      num_entries: numEntries,
      amount_owed: amountOwed,
      sort_order: count ?? 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-enroll in active contests
  const contestTypes = ['eliminator', 'high_game', 'high_series', 'mystery_doubles'] as const
  const entriesToInsert = contestTypes
    .filter((t) => settings[`${t}_enabled` as keyof typeof settings])
    .map((t) => ({ session_id: sessionId, contest_type: t, bowler_id: data.id }))

  if (entriesToInsert.length > 0) {
    await db.from('contest_entries').upsert(entriesToInsert, { onConflict: 'session_id,contest_type,bowler_id', ignoreDuplicates: true })
  }

  return NextResponse.json(data, { status: 201 })
}
