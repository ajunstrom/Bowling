import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { api, subscribeToSession } from '../lib/api'
import MyContests from '../components/bowler/MyContests'
import MyScores from '../components/bowler/MyScores'
import SessionInfo from '../components/bowler/SessionInfo'

const TABS = [
  { id: 'contests', label: 'My Contests' },
  { id: 'scores', label: 'My Scores' },
  { id: 'info', label: 'Session Info' },
]

export default function BowlerDashboard() {
  const { token } = useParams<{ token: string }>()
  const [tab, setTab] = useState('contests')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!token) return
    try {
      const d = await api.bowlerDashboard(token)
      setData(d)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!data?.session?.id) return
    return subscribeToSession(data.session.id, load)
  }, [data?.session?.id, load])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-slate-400">Loading...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="text-4xl mb-4">🎳</div>
          <div className="text-red-400 mb-2">Bowler not found</div>
          <div className="text-slate-400 text-sm">This link may be invalid or expired.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-bold text-white">{data.bowler.name}</div>
              <div className="text-xs text-slate-400">{data.session.name}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400">{new Date(data.session.date).toLocaleDateString()}</div>
              <div className="text-xs">
                <span className="text-slate-400">Hdcp: </span>
                <span className="text-white">{data.bowler.handicap}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs - bottom navigation style */}
      <div className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-lg mx-auto px-4">
          <div className="flex">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === t.id ? 'tab-active' : 'tab-inactive'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto p-4">
        {tab === 'contests' && <MyContests data={data} />}
        {tab === 'scores' && <MyScores data={data} />}
        {tab === 'info' && <SessionInfo data={data} />}
      </div>
    </div>
  )
}
