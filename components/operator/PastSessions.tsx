'use client'

import { useEffect, useState, useCallback } from 'react'
import * as api from '@/lib/api'

interface Props {
  currentSessionId: number
}

interface SessionDetail {
  overview: any | null
  payoutSummary: any | null
  loading: boolean
  error: string | null
}

function fmt(amount: number): string {
  return `$${Number(amount ?? 0).toFixed(2)}`
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function TopWinners({ payoutSummary }: { payoutSummary: any }) {
  const bowlerPayouts: any[] = payoutSummary?.bowlerPayouts ?? []
  const top3 = [...bowlerPayouts]
    .sort((a, b) => b.total_amount - a.total_amount)
    .slice(0, 3)

  const medals = ['🥇', '🥈', '🥉']

  if (top3.length === 0) {
    return <p className="text-xs text-slate-400">No payout data.</p>
  }

  return (
    <ol className="space-y-1">
      {top3.map((bp, i) => (
        <li key={bp.bowler_id} className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5">
            <span>{medals[i]}</span>
            <span className="text-slate-800 font-medium">{bp.bowler_name}</span>
          </span>
          <span className="num font-semibold text-slate-700">{fmt(bp.total_amount)}</span>
        </li>
      ))}
    </ol>
  )
}

function SessionCard({
  session,
  currentSessionId,
}: {
  session: any
  currentSessionId: number
}) {
  const [expanded, setExpanded] = useState(false)
  const [detail, setDetail] = useState<SessionDetail>({
    overview: null,
    payoutSummary: null,
    loading: false,
    error: null,
  })
  const [loaded, setLoaded] = useState(false)

  const fetchDetail = useCallback(async () => {
    setDetail((d) => ({ ...d, loading: true, error: null }))
    try {
      const [ov, ps] = await Promise.all([
        api.overview.get(session.id),
        api.payouts.summary(session.id),
      ])
      setDetail({ overview: ov, payoutSummary: ps, loading: false, error: null })
      setLoaded(true)
    } catch (e: any) {
      setDetail((d) => ({ ...d, loading: false, error: e.message }))
    }
  }, [session.id])

  function handleToggle() {
    const next = !expanded
    setExpanded(next)
    if (next && !loaded) {
      fetchDetail()
    }
  }

  const ov = detail.overview
  const ps = detail.payoutSummary

  return (
    <div className="card overflow-hidden">
      {/* Collapsed header */}
      <button
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors"
        onClick={handleToggle}
      >
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-slate-900 truncate block">{session.name}</span>
          <span className="text-xs text-slate-500">{formatDate(session.date)}</span>
        </div>
        <span className="badge-slate shrink-0">Closed</span>
        <span className={`text-slate-400 transition-transform shrink-0 ${expanded ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3 space-y-4">
          {detail.loading && (
            <p className="text-sm text-slate-400 animate-pulse">Loading summary…</p>
          )}

          {detail.error && (
            <div className="flex items-center gap-2">
              <p className="text-red-600 text-sm">{detail.error}</p>
              <button className="btn-ghost btn-sm" onClick={fetchDetail}>Retry</button>
            </div>
          )}

          {!detail.loading && !detail.error && ov && (
            <>
              {/* Session meta */}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Date</dt>
                  <dd className="font-medium text-slate-800">{formatDate(session.date)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Status</dt>
                  <dd><span className="badge-slate">Closed</span></dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Bowlers</dt>
                  <dd className="num font-semibold text-slate-900">{ov.bowlerCount ?? '—'}</dd>
                </div>
              </dl>

              {/* Financial summary */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white rounded-lg border border-slate-200 px-3 py-2 text-center">
                  <p className="text-xs text-slate-500 mb-0.5">Collected</p>
                  <p className="num font-bold text-emerald-700 text-sm">{fmt(ov.totalCollected)}</p>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 px-3 py-2 text-center">
                  <p className="text-xs text-slate-500 mb-0.5">Operator Rev.</p>
                  <p className="num font-bold text-blue-700 text-sm">{fmt(ov.operatorRevenue)}</p>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 px-3 py-2 text-center">
                  <p className="text-xs text-slate-500 mb-0.5">Prize Pool</p>
                  <p className="num font-bold text-slate-800 text-sm">{fmt(ps?.totalPrizePool ?? 0)}</p>
                </div>
              </div>

              {/* Top 3 winners */}
              {ps && (
                <div>
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-2">Top Winners</p>
                  <TopWinners payoutSummary={ps} />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function PastSessions({ currentSessionId }: Props) {
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const all = await api.sessions.list()
      const past = all.filter(
        (s: any) => s.id !== currentSessionId && s.status === 'closed'
      )
      // Most recent first
      past.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setSessions(past)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [currentSessionId])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Past Sessions</h2>
        {!loading && (
          <span className="text-sm text-slate-500">
            {sessions.length} closed session{sessions.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading && (
        <div className="card px-6 py-8 text-center text-slate-400 animate-pulse">
          Loading past sessions…
        </div>
      )}

      {error && !loading && (
        <div className="card px-4 py-4 border-red-200 bg-red-50 flex items-center gap-3">
          <p className="text-red-700 text-sm flex-1">{error}</p>
          <button className="btn-secondary btn-sm" onClick={fetchSessions}>Retry</button>
        </div>
      )}

      {!loading && !error && sessions.length === 0 && (
        <div className="card px-6 py-10 text-center text-slate-500">
          No past sessions yet. Completed sessions will appear here once closed.
        </div>
      )}

      {!loading && !error && sessions.length > 0 && (
        <div className="space-y-2">
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} currentSessionId={currentSessionId} />
          ))}
        </div>
      )}
    </div>
  )
}
