import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { generateBrackets, getBracketData } from '@/services/brackets'

type Ctx = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const db = createServerClient()
  const brackets = await getBracketData(Number(params.id), db)
  return NextResponse.json(brackets)
}

export async function POST(_req: NextRequest, { params }: Ctx) {
  const db = createServerClient()
  const result = await generateBrackets(Number(params.id), db)
  return NextResponse.json(result, { status: 201 })
}
