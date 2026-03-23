import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { DEFAULT_SETTINGS } from '@/lib/types'

type Ctx = { params: { id: string; bowlerId: string } }

function calcOwed(numEntries: number, settings: any): number {
  const bracketCost = settings.brackets_enabled ? numEntries * settings.bracket_entry_fee : 0
  const elimCost = settings.eliminator_enabled ? settings.eliminator_fee : 0
  const hgCost = settings.high_game_enabled ? settings.high_game_fee : 0
  const hsCost = settings.high_series_enabled ? settings.high_series_fee : 0
  const mdCost = settings.mystery_doubles_enabled ? settings.mystery_doubles_fee : 0
  return bracketCost + elimCost + hgCost + hsCost + mdCost
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const db = createServerClient()
  const bowlerId = Number(params.bowlerId)
  const sessionId = Number(params.id)
  const body = await req.json()

  const { data: current } = await db.from('bowlers').select('*').eq('id', bowlerId).single()
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: session } = await db.from('sessions').select('settings').eq('id', sessionId).single()
  const settings = { ...DEFAULT_SETTINGS, ...(session?.settings ?? {}) }

  const updates: Record<string, any> = {}

  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.handicap !== undefined) updates.handicap = body.handicap
  if (body.sort_order !== undefined) updates.sort_order = body.sort_order

  if (body.num_entries !== undefined) {
    updates.num_entries = body.num_entries
    updates.amount_owed = calcOwed(body.num_entries, settings)
  }

  // Record cash payment
  if (body.payment !== undefined && body.payment > 0) {
    updates.amount_paid = (current.amount_paid ?? 0) + Number(body.payment)
  }

  // Apply session credit
  if (body.apply_credit !== undefined && body.apply_credit > 0) {
    updates.amount_paid = (current.amount_paid ?? 0) + Number(body.apply_credit)
    updates.credit_balance = Math.max(0, (current.credit_balance ?? 0) - Number(body.apply_credit))
  }

  const { data, error } = await db
    .from('bowlers')
    .update(updates)
    .eq('id', bowlerId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const db = createServerClient()
  const { error } = await db.from('bowlers').delete().eq('id', Number(params.bowlerId))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
