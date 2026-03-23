import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

type Ctx = { params: { id: string } }

function generateAccessCode(date: string): string {
  const days = ['SUN','MON','TUE','WED','THU','FRI','SAT']
  const d = new Date(date)
  const day = days[d.getUTCDay()]
  const num = Math.floor(1000 + Math.random() * 9000)
  return `${day}-${num}`
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const db = createServerClient()
  const { data, error } = await db
    .from('delegates')
    .select('*')
    .eq('session_id', Number(params.id))
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const db = createServerClient()
  const sessionId = Number(params.id)
  const body = await req.json()

  if (!body.name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const { data: session } = await db.from('sessions').select('date').eq('id', sessionId).single()
  const code = generateAccessCode(session?.date ?? new Date().toISOString())

  const { data, error } = await db
    .from('delegates')
    .insert({
      session_id: sessionId,
      name: body.name.trim(),
      access_code: code,
      can_manage_entries: body.can_manage_entries ?? false,
      can_enter_scores: body.can_enter_scores ?? false,
      can_record_payments: body.can_record_payments ?? false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
