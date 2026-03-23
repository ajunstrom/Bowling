import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { calculateAllPayouts, getPayoutSummary } from '@/services/payouts'
import { DEFAULT_SETTINGS } from '@/lib/types'

type Ctx = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const db = createServerClient()
  const sessionId = Number(params.id)
  const { data: session } = await db.from('sessions').select('settings').eq('id', sessionId).single()
  const settings = { ...DEFAULT_SETTINGS, ...(session?.settings ?? {}) }
  const summary = await getPayoutSummary(sessionId, settings, db)
  return NextResponse.json(summary)
}

export async function POST(_req: NextRequest, { params }: Ctx) {
  const db = createServerClient()
  const sessionId = Number(params.id)
  const { data: session } = await db.from('sessions').select('settings').eq('id', sessionId).single()
  const settings = { ...DEFAULT_SETTINGS, ...(session?.settings ?? {}) }
  await calculateAllPayouts(sessionId, settings, db)
  const summary = await getPayoutSummary(sessionId, settings, db)
  return NextResponse.json(summary)
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const db = createServerClient()
  const sessionId = Number(params.id)
  const body = await req.json()

  // Mark individual payout as paid
  if (body.payout_id && body.is_paid) {
    await db.from('payouts').update({ is_paid: true }).eq('id', body.payout_id).eq('session_id', sessionId)
    return NextResponse.json({ ok: true })
  }

  // Pay all for a bowler
  if (body.bowler_id && body.pay_all) {
    await db.from('payouts')
      .update({ is_paid: true })
      .eq('session_id', sessionId)
      .eq('bowler_id', body.bowler_id)
      .eq('is_paid', false)
    return NextResponse.json({ ok: true })
  }

  // Forward as credit to next session
  if (body.bowler_id && body.forward) {
    const { data: unpaid } = await db
      .from('payouts')
      .select('amount')
      .eq('session_id', sessionId)
      .eq('bowler_id', body.bowler_id)
      .eq('is_paid', false)
      .eq('forwarded', false)

    const totalCredit = (unpaid ?? []).reduce((s: number, p: any) => s + p.amount, 0)

    await db.from('payouts')
      .update({ forwarded: true, is_paid: true })
      .eq('session_id', sessionId)
      .eq('bowler_id', body.bowler_id)
      .eq('is_paid', false)

    // Add credit to bowler's balance
    if (totalCredit > 0) {
      const { data: bowler } = await db.from('bowlers').select('credit_balance').eq('id', body.bowler_id).single()
      await db.from('bowlers').update({
        credit_balance: (bowler?.credit_balance ?? 0) + totalCredit,
      }).eq('id', body.bowler_id)
    }

    return NextResponse.json({ ok: true, credit: totalCredit })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
