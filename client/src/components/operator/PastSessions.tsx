import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'

interface Props {
  session: any
  bowlers: any[]
  scores: any[]
  sessionId: string
  onRefresh: () => void
}

export default function PastSessions({ sessionId }: Props) {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<any[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [sessionData, setSessionData] = useState<Record<string, any>>({})

  useEffect(() => {
    api.sessions.list().then(setSessions).catch(console.error)
  }, [])

  async function loadSessionData(id: string) {
    if (sessionData[id]) return
    const [bowlers, scores, payouts] = await Promise.all([
      api.bowlers.list(id),
      api.scores.list(id),
      api.payouts.summary(id),
    ])
    setSessionData(prev => ({ ...prev, [id]: { bowlers, scores, payouts } }))
  }

  async function toggleSession(id: string) {
    if (expanded === id) {
      setExpanded(null)
    } else {
      await loadSessionData(id)
      setExpanded(id)
    }
  }

  const pastSessions = sessions.filter(s => s.id !== sessionId)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Session History</h2>
        <div className="text-sm text-slate-400">{pastSessions.length} past sessions</div>
      </div>

      {pastSessions.length === 0 ? (
        <div className="card p-8 text-center text-slate-500">
          No past sessions yet. Sessions will appear here once you've run more nights.
        </div>
      ) : (
        pastSessions.map(s => {
          const data = sessionData[s.id]
          return (
            <div key={s.id} className="card overflow-hidden">
              <button
                className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-700/30"
                onClick={() => toggleSession(s.id)}
              >
                <div>
                  <div className="font-medium text-white">{s.name}</div>
                  <div className="text-sm text-slate-400">
                    {new Date(s.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`badge ${s.status === 'complete' ? 'badge-green' : 'badge-slate'}`}>{s.status}</span>
                  <button
                    className="btn-secondary btn-sm"
                    onClick={(e) => { e.stopPropagation(); navigate(`/operator/${s.id}`) }}
                  >
                    Open
                  </button>
                  <span className="text-slate-400">{expanded === s.id ? '▲' : '▼'}</span>
                </div>
              </button>

              {expanded === s.id && data && (
                <div className="border-t border-slate-700 p-4 space-y-4">
                  {/* Summary stats */}
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="card p-3 text-center">
                      <div className="text-xl font-bold text-white">{data.bowlers.length}</div>
                      <div className="text-xs text-slate-400">Bowlers</div>
                    </div>
                    <div className="card p-3 text-center">
                      <div className="text-xl font-bold text-green-400">
                        ${data.bowlers.reduce((s: number, b: any) => s + b.amount_paid, 0).toFixed(2)}
                      </div>
                      <div className="text-xs text-slate-400">Collected</div>
                    </div>
                    <div className="card p-3 text-center">
                      <div className="text-xl font-bold text-blue-400">${data.payouts?.totalOwed?.toFixed(2) || '0.00'}</div>
                      <div className="text-xs text-slate-400">Prize Pool</div>
                    </div>
                  </div>

                  {/* Winners */}
                  {data.payouts?.bowlerPayouts?.length > 0 && (
                    <div>
                      <div className="text-xs text-slate-400 mb-2">Top Winners</div>
                      <div className="space-y-1">
                        {data.payouts.bowlerPayouts.slice(0, 5).map((bp: any) => (
                          <div key={bp.bowlerId} className="flex justify-between text-sm">
                            <span className="text-slate-300">{bp.name}</span>
                            <span className="text-green-400">${bp.total.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
