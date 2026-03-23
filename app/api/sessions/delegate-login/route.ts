import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const db = createServerClient()
  const { code } = await req.json()

  if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 })

  const { data, error } = await db
    .from('delegates')
    .select('*, session:sessions(id, status)')
    .eq('access_code', code.toUpperCase().trim())
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Invalid access code' }, { status: 404 })
  }

  if (data.session?.status === 'closed') {
    return NextResponse.json({ error: 'Session is closed — this code is no longer valid.' }, { status: 403 })
  }

  return NextResponse.json({
    id: data.id,
    session_id: data.session_id,
    name: data.name,
    can_manage_entries: data.can_manage_entries,
    can_enter_scores: data.can_enter_scores,
    can_record_payments: data.can_record_payments,
  })
}
