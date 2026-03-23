import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

export default function Home() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<any[]>([])
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ name: '', date: new Date().toISOString().split('T')[0] })
  const [delegateCode, setDelegateCode] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.sessions.list().then(setSessions).catch(console.error)
  }, [])

  async function createSession() {
    if (!form.name || !form.date) return
    setLoading(true)
    try {
      const session = await api.sessions.create(form)
      navigate(`/operator/${session.id}`)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function delegateLogin() {
    if (!delegateCode.trim()) return
    try {
      const delegate = await api.delegates.auth(delegateCode.trim().toUpperCase())
      navigate(`/operator/${delegate.session_id}?delegate=${delegate.id}&code=${delegateCode}`)
    } catch {
      alert('Invalid access code')
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-6xl mb-3">🎳</div>
          <h1 className="text-4xl font-bold text-white mb-2">Bowling Side Action</h1>
          <p className="text-slate-400">Manage brackets, contests, and payouts for league night</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* New Session */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Start New Session</h2>
            {!showNew ? (
              <button className="btn-primary w-full" onClick={() => setShowNew(true)}>
                + New Session
              </button>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="label">Session Name</label>
                  <input
                    className="input"
                    placeholder="Thursday Night League"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Date</label>
                  <input
                    className="input"
                    type="date"
                    value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary flex-1" onClick={createSession} disabled={loading}>
                    {loading ? 'Creating...' : 'Create Session'}
                  </button>
                  <button className="btn-secondary" onClick={() => setShowNew(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* Delegate Login */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Delegate Access</h2>
            <p className="text-slate-400 text-sm mb-3">Have an access code? Enter it to assist with the session.</p>
            <div className="space-y-3">
              <input
                className="input font-mono uppercase tracking-widest"
                placeholder="THU-1234"
                value={delegateCode}
                onChange={e => setDelegateCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && delegateLogin()}
              />
              <button className="btn-secondary w-full" onClick={delegateLogin}>
                Enter as Delegate
              </button>
            </div>
          </div>
        </div>

        {/* Past Sessions */}
        {sessions.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-white mb-4">Recent Sessions</h2>
            <div className="space-y-2">
              {sessions.map(s => (
                <div
                  key={s.id}
                  className="card p-4 flex items-center justify-between cursor-pointer hover:bg-slate-700 transition-colors"
                  onClick={() => navigate(`/operator/${s.id}`)}
                >
                  <div>
                    <div className="font-medium text-white">{s.name}</div>
                    <div className="text-sm text-slate-400">{new Date(s.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`badge ${s.status === 'complete' ? 'badge-green' : s.status === 'setup' ? 'badge-slate' : 'badge-blue'}`}>
                      {s.status}
                    </span>
                    <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
