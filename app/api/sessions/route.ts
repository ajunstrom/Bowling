import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { DEFAULT_SETTINGS } from '@/lib/types'

export async function GET() {
  const db = createServerClient()
  const { data, error } = await db
    .from('sessions')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const db = createServerClient()
  const body = await req.json()

  if (!body.name || !body.date) {
    return NextResponse.json({ error: 'name and date are required' }, { status: 400 })
  }

  const { data, error } = await db
    .from('sessions')
    .insert({
      name: body.name.trim(),
      date: body.date,
      status: 'setup',
      settings: DEFAULT_SETTINGS,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
