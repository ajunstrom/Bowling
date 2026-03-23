import { useState, useEffect } from 'react'
import { api } from '../../lib/api'

interface Props {
  session: any
  bowlers: any[]
  scores: any[]
  sessionId: string
  onRefresh: () => void
}

export default function Payouts({ sessionId, scores }: Props) {
  const [summary, setSummary] = useState<any>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [calculating, setCalculating] = useState(false)

  useEffect(() => { load() }, [sessionId, scores])

  async function load() {
    const s = await api.payouts.summary(sessionId)
    setSummary(s)
  }

  async function calculate() {
    setCalculating(true)
    try {
      const s = await api.payouts.calculate(sessionId)
      setSummary(s)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setCalculating(false)
    }
  }

  async function pay(payoutId: string) {
    await api.payouts.pay(sessionId, payoutId)
    load()
  }

  async function payAll(bowlerId: string) {
    await api.payouts.payAll(sessionId, bowlerId)
    load()
  }

  async function forward(bowlerId: string) {
    if (!confirm('Forward all winnings as credit for next session?')) return
    await api.payouts.forward(sessionId, bowlerId)
    load()
  }

  const contestLabel: Record<string, string> = {
    bracket_handicap: '🎳 Bracket (Hdcp)',
    bracket_scratch: '🎳 Bracket (Scratch)',
    eliminator: '⚡ Eliminator',
    high_game: '🎯 High Game',
    high_series: '📊 High Series',
    mystery_doubles: '👫 Mystery Doubles',
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4">
          <div className="text-2xl font-bold text-white">${summary?.totalOwed?.toFixed(2) || '0.00'}</div>
          <div className="text-xs text-slate-400">Total Prize Pool</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-green-400">${summary?.totalPaid?.toFixed(2) || '0.00'}</div>
          <div className="text-xs text-slate-400">Paid Out</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-amber-400">${summary?.totalOutstanding?.toFixed(2) || '0.00'}</div>
          <div className="text-xs text-slate-400">Outstanding</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-blue-400">{summary?.bowlerPayouts?.length || 0}</div>
          <div className="text-xs text-slate-400">Winners</div>
        </div>
      </div>

      <button
        className="btn-primary"
        onClick={calculate}
        disabled={calculating}
      >
        {calculating ? 'Calculating...' : '🔄 Calculate Payouts'}
      </button>

      {/* Payout list */}
      {!summary?.bowlerPayouts?.length ? (
        <div className="card p-8 text-center text-slate-500">
          No payouts calculated yet. Click "Calculate Payouts" after all scores are entered.
        </div>
      ) : (
        <div className="space-y-2">
          {summary.bowlerPayouts.map((bp: any) => {
            const allPaid = bp.items.every((i: any) => i.is_paid || i.forwarded)
            return (
              <div key={bp.bowlerId} className="card overflow-hidden">
                <button
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-700/30"
                  onClick={() => setExpanded(expanded === bp.bowlerId ? null : bp.bowlerId)}
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-medium text-white">{bp.name}</div>
                      <div className="text-xs text-slate-400">{bp.items.length} win{bp.items.length !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-bold text-green-400">${bp.total.toFixed(2)}</div>
                      {bp.paid > 0 && bp.paid < bp.total && (
                        <div className="text-xs text-slate-400">${(bp.total - bp.paid).toFixed(2)} remaining</div>
                      )}
                    </div>
                    {allPaid ? (
                      <span className="badge badge-green">Paid</span>
                    ) : (
                      <span className="badge badge-yellow">Pending</span>
                    )}
                    <span className="text-slate-400">{expanded === bp.bowlerId ? '▲' : '▼'}</span>
                  </div>
                </button>

                {expanded === bp.bowlerId && (
                  <div className="border-t border-slate-700">
                    <div className="p-3 space-y-1">
                      {bp.items.map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between text-sm py-1">
                          <div className="flex items-center gap-2">
                            <span>{contestLabel[item.contest_type] || item.contest_type}</span>
                            <span className="text-slate-400">{item.description?.replace(/.*— /, '')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">${item.amount.toFixed(2)}</span>
                            {item.is_paid || item.forwarded ? (
                              <span className="badge badge-green text-xs">
                                {item.forwarded ? 'Forwarded' : 'Paid'}
                              </span>
                            ) : (
                              <button
                                className="btn btn-sm btn-success"
                                onClick={() => pay(item.id)}
                              >
                                Pay
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {!allPaid && (
                      <div className="p-3 border-t border-slate-700 flex gap-2">
                        <button className="btn-success btn-sm" onClick={() => payAll(bp.bowlerId)}>
                          Pay All (${bp.total.toFixed(2)})
                        </button>
                        <button className="btn-secondary btn-sm" onClick={() => forward(bp.bowlerId)}>
                          Forward as Credit
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
