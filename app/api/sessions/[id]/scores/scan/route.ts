import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

type Ctx = { params: { id: string } }

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function fuzzyMatch(name: string, bowlers: { id: number; name: string }[]): { id: number; name: string } | null {
  const n = name.toLowerCase().trim()
  // Exact match
  const exact = bowlers.find((b) => b.name.toLowerCase() === n)
  if (exact) return exact
  // Partial match (both directions)
  const partial = bowlers.find(
    (b) => b.name.toLowerCase().includes(n) || n.includes(b.name.toLowerCase()),
  )
  if (partial) return partial
  // First/last name match
  const parts = n.split(/\s+/)
  const firstLast = bowlers.find((b) => {
    const bn = b.name.toLowerCase().split(/\s+/)
    return parts.some((p) => bn.some((bp) => bp.startsWith(p) || p.startsWith(bp)))
  })
  return firstLast ?? null
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const db = createServerClient()
  const sessionId = Number(params.id)

  const form = await req.formData()
  const image = form.get('image') as File | null
  const game = Number(form.get('game') ?? 1)

  if (!image) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

  // Convert image to base64
  const bytes = await image.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mediaType = (image.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp'

  // Get session bowlers for matching
  const { data: bowlers } = await db
    .from('bowlers')
    .select('id, name')
    .eq('session_id', sessionId)

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            {
              type: 'text',
              text: `This is a bowling scoresheet for Game ${game}. Extract every bowler name and their total score for this game. Return ONLY a JSON array like: [{"name":"John Smith","score":187},{"name":"Jane Doe","score":210}]. Include only bowlers with a visible score. Do not include any other text.`,
            },
          ],
        },
      ],
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = rawText.match(/\[[\s\S]*\]/)
    const extracted: { name: string; score: number }[] = jsonMatch ? JSON.parse(jsonMatch[0]) : []

    // Fuzzy-match names to roster
    const matched = extracted.map((e) => {
      const m = fuzzyMatch(e.name, bowlers ?? [])
      return {
        name: e.name,
        score: e.score,
        matched_bowler_id: m?.id ?? null,
        matched_name: m?.name ?? null,
      }
    })

    return NextResponse.json({ extracted: matched, game })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'AI scan failed' }, { status: 500 })
  }
}
