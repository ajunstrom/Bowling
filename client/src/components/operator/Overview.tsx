import { useState, useEffect } from 'react'
import { api } from '../../lib/api'

interface Props {
  session: any
  bowlers: any[]
  scores: any[]
  sessionId: string
  onRefresh: () => void
}

export default function Overview({ session, sessionId, bowlers, scores }: Props) {
  const [overview, setOverview] = useState<any>(null)

  useEffect(() => { load() }, [sessionId, scores, bowlers])

  async function load() {
    const o = await api.sessions.overview(sessionId)
    setOverview(o)
  }

  if (!overview) return <div className="text-slate-400">Loading...</div>

  const gameStatus = (g: { game: number; scored: number; total: number }) => {
    if (g.scored === 0) return { label: 'Not Started', color: 'text-slate-500' }
    if (g.scored === g.total && g.total > 0) return { label: 'Complete', color: 'text-green-400' }
    return { label: `${g.scored}/${g.total} scored`, color: 'text-amber-400' }
  }

  const fullyPaid = bowlers.filter(b => b.amount_paid >= b.amount_owed).length
  const outstanding = bowlers.filter(b => b.amount_paid < b.amount_owed).length

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-white">Session Overview</h2>

      {/* Financial summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4">
          <div className="text-2xl font-bold text-white">{overview.totalEntries}</div>
          <div className="text-xs text-slate-400">Total Entries</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-green-400">${overview.totalCollected.toFixed(2)}</div>
          <div className="text-xs text-slate-400">Collected</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-blue-400">${overview.operatorRevenue.toFixed(2)}</div>
          <div className="text-xs text-slate-400">Your Revenue</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-amber-400">{overview.outstanding}</div>
          <div className="text-xs text-slate-400">Bowlers Owing</div>
        </div>
      </div>

      {/* Game progress */}
      <div className="card p-5">
        <h3 className="font-medium text-white mb-4">Game Progress</h3>
        <div className="grid grid-cols-3 gap-4">
          {overview.gamesScored.map((g: any) => {
            const status = gameStatus(g)
            const pct = g.total > 0 ? (g.scored / g.total) * 100 : 0
            return (
              <div key={g.game}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">Game {g.game}</span>
                  <span className={`text-xs ${status.color}`}>{status.label}</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-500' : pct > 0 ? 'bg-amber-500' : 'bg-slate-600'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Payment status */}
      <div className="card p-5">
        <h3 className="font-medium text-white mb-4">Payment Status</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-green-400">{fullyPaid}</div>
            <div className="text-xs text-slate-400">Fully Settled</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-400">{outstanding}</div>
            <div className="text-xs text-slate-400">Balance Due</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-400">
              {bowlers.filter(b => b.amount_paid === 0 && b.amount_owed > 0).length}
            </div>
            <div className="text-xs text-slate-400">Unpaid</div>
          </div>
        </div>

        {outstanding > 0 && (
          <div className="mt-4 space-y-1">
            <div className="text-xs text-slate-400 mb-2">Outstanding balances:</div>
            {bowlers
              .filter(b => b.amount_paid < b.amount_owed)
              .sort((a, b) => (b.amount_owed - b.amount_paid) - (a.amount_owed - a.amount_paid))
              .map(b => (
                <div key={b.id} className="flex justify-between text-sm">
                  <span className="text-slate-300">{b.name}</span>
                  <span className="text-red-400">${(b.amount_owed - b.amount_paid).toFixed(2)}</span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Payout status */}
      {overview.totalPayouts > 0 && (
        <div className="card p-5">
          <h3 className="font-medium text-white mb-4">Payout Status</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-white">${overview.totalPayouts.toFixed(2)}</div>
              <div className="text-xs text-slate-400">Total Owed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">${overview.paidPayouts.toFixed(2)}</div>
              <div className="text-xs text-slate-400">Paid Out</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-400">${overview.payoutsOwed.toFixed(2)}</div>
              <div className="text-xs text-slate-400">Still Owed</div>
            </div>
          </div>
        </div>
      )}

      {/* Session info */}
      <div className="card p-5">
        <h3 className="font-medium text-white mb-4">Session Info</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-slate-400">Session: </span><span className="text-white">{session.name}</span></div>
          <div><span className="text-slate-400">Date: </span><span className="text-white">{new Date(session.date).toLocaleDateString()}</span></div>
          <div><span className="text-slate-400">Status: </span><span className="text-white">{session.status}</span></div>
          <div><span className="text-slate-400">Bowlers: </span><span className="text-white">{overview.bowlerCount}</span></div>
          <div><span className="text-slate-400">Bracket Fee: </span><span className="text-white">${session.settings.bracket_fee}/entry</span></div>
          <div><span className="text-slate-400">Op Take: </span><span className="text-white">{Math.round(session.settings.bracket_op_pct * 100)}%</span></div>
        </div>
      </div>
    </div>
  )
}
