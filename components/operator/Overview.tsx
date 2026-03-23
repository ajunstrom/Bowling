'use client'

import { useState } from 'react'
import * as api from '@/lib/api'

interface Props {
  session: any
  overviewData: any // { totalEntries, totalCollected, operatorRevenue, outstandingCount, gamesComplete, bowlerCount, paymentBreakdown }
  bowlers: any[]
}

function fmt(amount: number): string {
  return `$${Number(amount ?? 0).toFixed(2)}`
}

function GameBar({ game, complete }: { game: number; complete: boolean | undefined }) {
  if (complete === undefined || complete === null) {
    // Not started
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-600 w-16 shrink-0">Game {game}</span>
        <div className="flex-1 h-2.5 rounded-full bg-slate-200" />
        <span className="badge-slate text-xs whitespace-nowrap">Not Started</span>
      </div>
    )
  }
  if (complete) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-600 w-16 shrink-0">Game {game}</span>
        <div className="flex-1 h-2.5 rounded-full bg-emerald-500" />
        <span className="badge-green text-xs whitespace-nowrap">Complete ✓</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-slate-600 w-16 shrink-0">Game {game}</span>
      <div className="flex-1 h-2.5 rounded-full bg-slate-200 overflow-hidden">
        <div className="h-full w-1/2 bg-yellow-400 rounded-full animate-pulse" />
      </div>
      <span className="badge-yellow text-xs whitespace-nowrap">In Progress</span>
    </div>
  )
}

export default function Overview({ session, overviewData, bowlers }: Props) {
  const [closing, setClosing] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)

  const isClosed = session?.status === 'closed'

  const totalEntries = overviewData?.totalEntries ?? 0
  const totalCollected = overviewData?.totalCollected ?? 0
  const operatorRevenue = overviewData?.operatorRevenue ?? 0
  const outstandingCount = overviewData?.outstandingCount ?? 0
  const gamesComplete: (boolean | undefined)[] = overviewData?.gamesComplete ?? [undefined, undefined, undefined]
  const bowlerCount = overviewData?.bowlerCount ?? bowlers?.length ?? 0
  const paymentBreakdown = overviewData?.paymentBreakdown ?? { settled: 0, owes: 0, hasCredit: 0 }

  // Normalise gamesComplete to a 3-element array (index 0 = game 1)
  const gameStatuses: (boolean | undefined)[] = [
    gamesComplete[0],
    gamesComplete[1],
    gamesComplete[2],
  ]

  const bracketCount = bowlers?.filter((b: any) => b.in_bracket || b.num_brackets > 0).length ?? 0

  async function handleClose() {
    setClosing(true)
    setCloseError(null)
    try {
      await api.sessions.close(session.id)
      // After close, trigger a full page refresh or parent refresh
      window.location.reload()
    } catch (e: any) {
      setCloseError(e.message)
      setClosing(false)
      setConfirmClose(false)
    }
  }

  // Payment breakdown totals for percentage bars
  const payTotal = (paymentBreakdown.settled ?? 0) + (paymentBreakdown.owes ?? 0) + (paymentBreakdown.hasCredit ?? 0)
  function pct(val: number) {
    if (!payTotal) return 0
    return Math.round((val / payTotal) * 100)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Session Overview</h2>
        {isClosed && (
          <span className="badge-slate">Closed</span>
        )}
      </div>

      {/* 4 stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card px-4 py-4 text-center">
          <p className="text-xs text-slate-500 mb-1 uppercase tracking-wide">Total Entries</p>
          <p className="num text-3xl font-bold text-slate-900">{totalEntries}</p>
        </div>
        <div className="card px-4 py-4 text-center">
          <p className="text-xs text-slate-500 mb-1 uppercase tracking-wide">Total Collected</p>
          <p className="num text-3xl font-bold text-emerald-700">{fmt(totalCollected)}</p>
        </div>
        <div className="card px-4 py-4 text-center">
          <p className="text-xs text-slate-500 mb-1 uppercase tracking-wide">Operator Revenue</p>
          <p className="num text-3xl font-bold text-blue-700">{fmt(operatorRevenue)}</p>
        </div>
        <div className="card px-4 py-4 text-center">
          <p className="text-xs text-slate-500 mb-1 uppercase tracking-wide">Outstanding</p>
          <p className="num text-3xl font-bold text-red-600">{outstandingCount}</p>
          <p className="text-xs text-slate-400 mt-0.5">bowler{outstandingCount !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Game progress */}
      <div className="card px-4 py-4">
        <h3 className="font-semibold text-slate-800 mb-3">Game Progress</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((g) => (
            <GameBar key={g} game={g} complete={gameStatuses[g - 1]} />
          ))}
        </div>
      </div>

      {/* Payment status breakdown */}
      <div className="card px-4 py-4">
        <h3 className="font-semibold text-slate-800 mb-3">Payment Status</h3>

        {/* Horizontal segmented bar */}
        {payTotal > 0 ? (
          <>
            <div className="flex h-3 rounded-full overflow-hidden gap-0.5 mb-3">
              {pct(paymentBreakdown.settled) > 0 && (
                <div
                  className="bg-emerald-500 h-full"
                  style={{ width: `${pct(paymentBreakdown.settled)}%` }}
                />
              )}
              {pct(paymentBreakdown.owes) > 0 && (
                <div
                  className="bg-red-400 h-full"
                  style={{ width: `${pct(paymentBreakdown.owes)}%` }}
                />
              )}
              {pct(paymentBreakdown.hasCredit) > 0 && (
                <div
                  className="bg-purple-400 h-full"
                  style={{ width: `${pct(paymentBreakdown.hasCredit)}%` }}
                />
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-sm text-slate-700">
                  Settled{' '}
                  <span className="num font-semibold">{paymentBreakdown.settled ?? 0}</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400 shrink-0" />
                <span className="text-sm text-slate-700">
                  Owes Money{' '}
                  <span className="num font-semibold">{paymentBreakdown.owes ?? 0}</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400 shrink-0" />
                <span className="text-sm text-slate-700">
                  Has Credit{' '}
                  <span className="num font-semibold">{paymentBreakdown.hasCredit ?? 0}</span>
                </span>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-400">No payment data yet.</p>
        )}
      </div>

      {/* Session info grid */}
      <div className="card px-4 py-4">
        <h3 className="font-semibold text-slate-800 mb-3">Session Info</h3>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-xs text-slate-500 mb-0.5">Session Name</dt>
            <dd className="font-medium text-slate-900">{session?.name ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 mb-0.5">Date</dt>
            <dd className="font-medium text-slate-900">
              {session?.date
                ? new Date(session.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 mb-0.5">Status</dt>
            <dd>
              {isClosed ? (
                <span className="badge-slate">Closed</span>
              ) : (
                <span className="badge-green">Active</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 mb-0.5">Bowlers</dt>
            <dd className="num font-semibold text-slate-900">{bowlerCount}</dd>
          </div>
          {bracketCount > 0 && (
            <div>
              <dt className="text-xs text-slate-500 mb-0.5">In Brackets</dt>
              <dd className="num font-semibold text-slate-900">{bracketCount}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Close Session */}
      {!isClosed && (
        <div className="card px-4 py-4 border-red-200">
          <h3 className="font-semibold text-red-700 mb-1">Close Session</h3>
          <p className="text-sm text-slate-600 mb-3">
            Closing the session will lock entries and scores. This cannot be undone.
          </p>
          {closeError && (
            <p className="text-red-600 text-sm mb-2">{closeError}</p>
          )}
          {confirmClose ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-700">Are you sure?</span>
              <button
                className="btn-danger btn-sm"
                onClick={handleClose}
                disabled={closing}
              >
                {closing ? 'Closing…' : 'Yes, Close Session'}
              </button>
              <button
                className="btn-ghost btn-sm"
                onClick={() => setConfirmClose(false)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              className="btn-danger"
              onClick={() => setConfirmClose(true)}
            >
              Close Session
            </button>
          )}
        </div>
      )}
    </div>
  )
}
