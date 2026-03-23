import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { DEFAULT_SETTINGS } from '@/lib/types'

type Ctx = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const db = createServerClient()
  const { data, error } = await db
    .from('sessions')
    .select('*')
    .eq('id', Number(params.id))
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  // Merge stored settings with defaults so new keys always exist
  data.settings = { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) }
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const db = createServerClient()
  const body = await req.json()
  const sessionId = Number(params.id)

  // If updating settings, merge with existing
  if (body.settings) {
    const { data: existing } = await db
      .from('sessions')
      .select('settings')
      .eq('id', sessionId)
      .single()
    body.settings = { ...DEFAULT_SETTINGS, ...(existing?.settings ?? {}), ...body.settings }
  }

  const { data, error } = await db
    .from('sessions')
    .update(body)
    .eq('id', sessionId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  data.settings = { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) }
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const db = createServerClient()
  const { error } = await db.from('sessions').delete().eq('id', Number(params.id))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
