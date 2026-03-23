import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

type Ctx = { params: { id: string; delId: string } }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const db = createServerClient()
  const body = await req.json()
  const { data, error } = await db
    .from('delegates')
    .update(body)
    .eq('id', Number(params.delId))
    .eq('session_id', Number(params.id))
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const db = createServerClient()
  const { error } = await db
    .from('delegates')
    .delete()
    .eq('id', Number(params.delId))
    .eq('session_id', Number(params.id))

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
