'use client'

import { useState } from 'react'
import * as api from '@/lib/api'

interface BowlerPayout {
  bowler_id: number
  bowler_name: string
  rank: number
  contest_types: string[]
  win_count: number
  total_amount: number
  total_paid: number
  wins: PayoutWin[]
}

interface PayoutWin {
  id: number
  contest_type: string
  description: string
  placement: number | null
  amount: number
  is_paid: boolean
}

interface Props {
  session: any
  payoutSummary: any // { bowlerPayouts: BowlerPayout[], totalPrizePool, totalPaid, totalOutstanding, operatorRevenue }
  onRefresh: () => void
  delegatePerms?: { can_record_payments: boolean } | null
}

const CONTEST_CHIP: Record<string, string> = {
  bracket: 'chip-bracket',
  eliminator: 'chip-eliminator',
  high_game: 'chip-highgame',
  high_series: 'chip-highseries',
  mystery_doubles: 'chip-doubles',
}

const CONTEST_LABEL: Record<string, string> = {
  bracket: 'Bracket',
  eliminator: 'Eliminator',
  high_game: 'High Game',
  high_series: 'High Series',
  mystery_doubles: 'Mystery Doubles',
}

function placementLabel(placement: number | null): { text: string; cls: string } {
  if (placement === null) return { text: 'Winner', cls: 'text-emerald-700 font-semibold' }
  if (placement === 1) return { text: '1st Place', cls: 'text-emerald-700 font-semibold' }
  if (placement === 2) return { text: '2nd Place', cls: 'text-amber-600 font-semibold' }
  if (placement === 3) return { text: '3rd Place', cls: 'text-blue-600 font-semibold' }
  return { text: `${placement}th Place`, cls: 'text-slate-600' }
}

function rankMedal(rank: number): string {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return `#${rank}`
}

function fmt(amount: number): string {
  return `$${amount.toFixed(2)}`
}

function ContestIcons({ types }: { types: string[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {[...new Set(types)].map((t) => (
        <span key={t} className={CONTEST_CHIP[t] ?? 'badge badge-slate'}>
          {CONTEST_LABEL[t] ?? t}
        </span>
      ))}
    </span>
  )
}

function StatusBadge({ total, paid }: { total: number; paid: number }) {
  const outstanding = total - paid
  if (outstanding <= 0) {
    return <span className="badge-green whitespace-nowrap">Fully Paid ✓</span>
  }
  if (paid > 0) {
    return <span className="badge-yellow whitespace-nowrap">Partial</span>
  }
  return (
    <span className="badge-red whitespace-nowrap num">
      {fmt(outstanding)} owed
    </span>
  )
}

function BowlerRow({
  bp,
  sessionId,
  canPay,
  onRefresh,
}: {
  bp: BowlerPayout
  sessionId: number
  canPay: boolean
  onRefresh: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [paying, setPaying] = useState<Record<number, boolean>>({})
  const [payingAll, setPayingAll] = useState(false)
  const [forwarding, setForwarding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const unpaidWins = bp.wins.filter((w) => !w.is_paid)

  async function handlePay(winId: number) {
    setPaying((p) => ({ ...p, [winId]: true }))
    setError(null)
    try {
      await api.payouts.markPaid(sessionId, winId)
      onRefresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setPaying((p) => ({ ...p, [winId]: false }))
    }
  }

  async function handlePayAll() {
    setPayingAll(true)
    setError(null)
    try {
      await api.payouts.markAllPaid(sessionId, bp.bowler_id)
      onRefresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setPayingAll(false)
    }
  }

  async function handleForward() {
    setForwarding(true)
    setError(null)
    try {
      await api.payouts.forward(sessionId, bp.bowler_id)
      onRefresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setForwarding(false)
    }
  }

  return (
    <div className="card overflow-hidden">
      {/* Collapsed row — always visible */}
      <button
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        {/* Rank */}
        <span className="text-lg w-8 shrink-0 text-center leading-none">
          {bp.rank <= 3 ? rankMedal(bp.rank) : <span className="num text-slate-500 text-sm">{rankMedal(bp.rank)}</span>}
        </span>

        {/* Name */}
        <span className="font-semibold text-slate-900 flex-1 min-w-0 truncate">
          {bp.bowler_name}
        </span>

        {/* Contest type icons */}
        <span className="hidden sm:flex gap-1">
          <ContestIcons types={bp.contest_types} />
        </span>

        {/* Win count */}
        <span className="text-slate-500 text-sm whitespace-nowrap">
          {bp.win_count} win{bp.win_count !== 1 ? 's' : ''}
        </span>

        {/* Total */}
        <span className="num font-semibold text-slate-900 w-20 text-right whitespace-nowrap">
          {fmt(bp.total_amount)}
        </span>

        {/* Status */}
        <span className="w-28 text-right">
          <StatusBadge total={bp.total_amount} paid={bp.total_paid} />
        </span>

        {/* Chevron */}
        <span className={`text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
          {error && (
            <p className="text-red-600 text-sm mb-2">{error}</p>
          )}

          {/* Action buttons */}
          {canPay && unpaidWins.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                className="btn-primary btn-sm"
                onClick={handlePayAll}
                disabled={payingAll}
              >
                {payingAll ? 'Paying…' : `Pay All (${unpaidWins.length})`}
              </button>
              <button
                className="btn-secondary btn-sm"
                onClick={handleForward}
                disabled={forwarding}
              >
                {forwarding ? 'Forwarding…' : 'Forward as Credit →'}
              </button>
            </div>
          )}

          {/* Wins table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <th className="pb-1.5 pr-3 font-medium">Contest</th>
                  <th className="pb-1.5 pr-3 font-medium">Description</th>
                  <th className="pb-1.5 pr-3 font-medium">Placement</th>
                  <th className="pb-1.5 pr-3 font-medium text-right">Amount</th>
                  {canPay && <th className="pb-1.5 font-medium text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bp.wins.map((win) => {
                  const pl = placementLabel(win.placement)
                  return (
                    <tr key={win.id} className={win.is_paid ? 'opacity-50' : ''}>
                      <td className="py-2 pr-3">
                        <span className={CONTEST_CHIP[win.contest_type] ?? 'badge badge-slate'}>
                          {CONTEST_LABEL[win.contest_type] ?? win.contest_type}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-slate-700">{win.description}</td>
                      <td className={`py-2 pr-3 ${pl.cls}`}>{pl.text}</td>
                      <td className="py-2 pr-3 text-right">
                        <span className="num font-semibold">{fmt(win.amount)}</span>
                        {win.is_paid && (
                          <span className="ml-1 badge-green">paid</span>
                        )}
                      </td>
                      {canPay && (
                        <td className="py-2 text-right">
                          {!win.is_paid && (
                            <button
                              className="btn-primary btn-sm"
                              onClick={() => handlePay(win.id)}
                              disabled={paying[win.id]}
                            >
                              {paying[win.id] ? '…' : 'Pay'}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
              {/* Subtotal */}
              <tfoot>
                <tr className="border-t-2 border-slate-300 font-semibold">
                  <td colSpan={canPay ? 3 : 3} className="pt-2 text-slate-600 text-xs uppercase tracking-wide">
                    Subtotal
                  </td>
                  <td className="pt-2 text-right">
                    <span className="num">{fmt(bp.total_amount)}</span>
                  </td>
                  {canPay && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Payouts({ session, payoutSummary, onRefresh, delegatePerms }: Props) {
  const [calculating, setCalculating] = useState(false)
  const [calcError, setCalcError] = useState<string | null>(null)

  const canPay = delegatePerms === undefined || delegatePerms === null
    ? true // operator — full access
    : delegatePerms.can_record_payments

  async function handleCalculate() {
    setCalculating(true)
    setCalcError(null)
    try {
      await api.payouts.calculate(session.id)
      onRefresh()
    } catch (e: any) {
      setCalcError(e.message)
    } finally {
      setCalculating(false)
    }
  }

  const bowlerPayouts: BowlerPayout[] = payoutSummary?.bowlerPayouts ?? []
  const sorted = [...bowlerPayouts].sort((a, b) => b.total_amount - a.total_amount)

  const totalPrizePool = payoutSummary?.totalPrizePool ?? 0
  const totalPaid = payoutSummary?.totalPaid ?? 0
  const totalOutstanding = payoutSummary?.totalOutstanding ?? 0
  const operatorRevenue = payoutSummary?.operatorRevenue ?? 0

  return (
    <div className="space-y-4">
      {/* Header action */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Payouts</h2>
        <button
          className="btn-primary"
          onClick={handleCalculate}
          disabled={calculating}
        >
          {calculating ? 'Calculating…' : 'Calculate Payouts'}
        </button>
      </div>

      {calcError && (
        <div className="card px-4 py-3 border-red-200 bg-red-50">
          <p className="text-red-700 text-sm">{calcError}</p>
        </div>
      )}

      {/* Bowler payout rows */}
      {sorted.length === 0 ? (
        <div className="card px-6 py-10 text-center text-slate-500">
          No payouts calculated yet. Click "Calculate Payouts" to begin.
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((bp) => (
            <BowlerRow
              key={bp.bowler_id}
              bp={bp}
              sessionId={session.id}
              canPay={canPay}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}

      {/* Summary footer */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
        <div className="card px-4 py-3 text-center">
          <p className="text-xs text-slate-500 mb-1">Total Prize Pool</p>
          <p className="num text-xl font-bold text-slate-900">{fmt(totalPrizePool)}</p>
        </div>
        <div className="card px-4 py-3 text-center">
          <p className="text-xs text-slate-500 mb-1">Total Paid</p>
          <p className="num text-xl font-bold text-emerald-700">{fmt(totalPaid)}</p>
        </div>
        <div className="card px-4 py-3 text-center">
          <p className="text-xs text-slate-500 mb-1">Outstanding</p>
          <p className="num text-xl font-bold text-red-600">{fmt(totalOutstanding)}</p>
        </div>
        <div className="card px-4 py-3 text-center">
          <p className="text-xs text-slate-500 mb-1">Operator Revenue (night)</p>
          <p className="num text-xl font-bold text-blue-700">{fmt(operatorRevenue)}</p>
        </div>
      </div>
    </div>
  )
}
