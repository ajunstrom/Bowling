import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { api, subscribeToSession } from '../lib/api'
import SessionSetup from '../components/operator/SessionSetup'
import EnterScores from '../components/operator/EnterScores'
import Contests from '../components/operator/Contests'
import Payouts from '../components/operator/Payouts'
import Delegates from '../components/operator/Delegates'
import Overview from '../components/operator/Overview'
import PastSessions from '../components/operator/PastSessions'

const TABS = [
  { id: 'setup', label: 'Setup' },
  { id: 'scores', label: 'Scores' },
  { id: 'contests', label: 'Contests' },
  { id: 'payouts', label: 'Payouts' },
  { id: 'delegates', label: 'Delegates' },
  { id: 'overview', label: 'Overview' },
  { id: 'history', label: 'History' },
]

export default function OperatorDashboard() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState('setup')
  const [session, setSession] = useState<any>(null)
  const [bowlers, setBowlers] = useState<any[]>([])
  const [scores, setScores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const delegateId = searchParams.get('delegate')
  const isDelegate = !!delegateId

  const loadSession = useCallback(async () => {
    if (!sessionId) return
    try {
      const [s, b, sc] = await Promise.all([
        api.sessions.get(sessionId),
        api.bowlers.list(sessionId),
        api.scores.list(sessionId),
      ])
      setSession(s)
      setBowlers(b)
      setScores(sc)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    loadSession()
    const unsub = subscribeToSession(sessionId!, loadSession)
    return unsub
  }, [sessionId, loadSession])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-slate-400 mb-4">Session not found</div>
          <button className="btn-secondary" onClick={() => navigate('/')}>Go Home</button>
        </div>
      </div>
    )
  }

  const tabProps = { session, bowlers, scores, onRefresh: loadSession, sessionId: sessionId! }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="text-slate-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="font-semibold text-white">{session.name}</h1>
              <div className="text-xs text-slate-400">
                {new Date(session.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                {isDelegate && <span className="ml-2 badge badge-yellow">Delegate</span>}
              </div>
            </div>
          </div>
          <span className={`badge ${session.status === 'complete' ? 'badge-green' : 'badge-blue'}`}>
            {session.status}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex overflow-x-auto gap-1 no-scrollbar">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${tab === t.id ? 'tab-active' : 'tab-inactive'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-4">
        {tab === 'setup' && <SessionSetup {...tabProps} />}
        {tab === 'scores' && <EnterScores {...tabProps} />}
        {tab === 'contests' && <Contests {...tabProps} />}
        {tab === 'payouts' && <Payouts {...tabProps} />}
        {tab === 'delegates' && <Delegates {...tabProps} />}
        {tab === 'overview' && <Overview {...tabProps} />}
        {tab === 'history' && <PastSessions {...tabProps} />}
      </div>
    </div>
  )
}
