'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import * as api from '@/lib/api'

export default function Home() {
  const router = useRouter()
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', date: new Date().toISOString().slice(0, 10) })
  const [delegateCode, setDelegateCode] = useState('')
  const [delegateError, setDelegateError] = useState('')

  useEffect(() => {
    api.sessions.list().then(setSessions).finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setCreating(true)
    try {
      const session = await api.sessions.create({ name: form.name.trim(), date: form.date })
      router.push(`/operator/${session.id}`)
    } finally {
      setCreating(false)
    }
  }

  async function handleDelegateLogin(e: React.FormEvent) {
    e.preventDefault()
    setDelegateError('')
    try {
      const result = await api.delegates.verify(delegateCode.toUpperCase().trim())
      router.push(`/operator/${result.session_id}?delegate=${result.id}`)
    } catch {
      setDelegateError('Invalid access code. Check with the operator.')
    }
  }

  const active = sessions.filter((s) => s.status !== 'closed')
  const past = sessions.filter((s) => s.status === 'closed')

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-5">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold text-slate-900">🎳 Bowling Side Action</h1>
          <p className="text-sm text-slate-500 mt-0.5">League bracket & contest management</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* New Session */}
        <div className="card p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Start a New Session</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="label">Session Name</label>
              <input
                className="input"
                placeholder="e.g. Thursday Night Classic — Week 3"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">Date</label>
              <input
                type="date"
                className="input"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={creating}>
              {creating ? 'Creating…' : 'Create Session →'}
            </button>
          </form>
        </div>

        {/* Delegate Login */}
        <div className="card p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Delegate Access</h2>
          <form onSubmit={handleDelegateLogin} className="space-y-4">
            <div>
              <label className="label">Access Code</label>
              <input
                className="input uppercase tracking-widest"
                placeholder="e.g. THU-4829"
                value={delegateCode}
                onChange={(e) => setDelegateCode(e.target.value)}
                required
              />
              {delegateError && <p className="text-xs text-red-600 mt-1">{delegateError}</p>}
            </div>
            <button type="submit" className="btn-secondary w-full">
              Join as Delegate →
            </button>
          </form>
        </div>

        {/* Active Sessions */}
        {!loading && active.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Active Sessions</h2>
            <div className="space-y-2">
              {active.map((s) => (
                <button
                  key={s.id}
                  onClick={() => router.push(`/operator/${s.id}`)}
                  className="card p-4 w-full text-left hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{s.name}</p>
                      <p className="text-sm text-slate-500">{new Date(s.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                    </div>
                    <span className="badge-blue capitalize">{s.status}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Past Sessions */}
        {!loading && past.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Past Sessions</h2>
            <div className="space-y-2">
              {past.slice(0, 10).map((s) => (
                <button
                  key={s.id}
                  onClick={() => router.push(`/operator/${s.id}`)}
                  className="card p-4 w-full text-left hover:shadow-md transition-shadow opacity-75 hover:opacity-100"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-700">{s.name}</p>
                      <p className="text-sm text-slate-400">{new Date(s.date).toLocaleDateString()}</p>
                    </div>
                    <span className="badge-slate">Closed</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
