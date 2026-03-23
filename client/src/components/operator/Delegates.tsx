import { useState, useEffect } from 'react'
import { api } from '../../lib/api'

interface Props {
  session: any
  bowlers: any[]
  scores: any[]
  sessionId: string
  onRefresh: () => void
}

export default function Delegates({ sessionId }: Props) {
  const [delegates, setDelegates] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', can_manage_entries: false, can_enter_scores: false, can_record_payments: false })

  useEffect(() => { load() }, [sessionId])

  async function load() {
    const d = await api.delegates.list(sessionId)
    setDelegates(d)
  }

  async function addDelegate() {
    if (!form.name.trim()) return
    await api.delegates.create(sessionId, form)
    setForm({ name: '', can_manage_entries: false, can_enter_scores: false, can_record_payments: false })
    setShowForm(false)
    load()
  }

  async function updatePermissions(delegate: any, key: string, value: boolean) {
    await api.delegates.update(sessionId, delegate.id, {
      ...delegate,
      [key]: value ? 1 : 0,
    })
    load()
  }

  async function removeDelegate(id: string) {
    if (!confirm('Remove this delegate?')) return
    await api.delegates.delete(sessionId, id)
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Delegates</h2>
          <p className="text-sm text-slate-400">Give trusted helpers controlled access to this session</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>+ Add Delegate</button>
      </div>

      {showForm && (
        <div className="card p-4 space-y-4">
          <h3 className="font-medium text-white">New Delegate</h3>
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              placeholder="Jane Smith"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Permissions</label>
            <div className="space-y-2">
              {[
                { key: 'can_manage_entries', label: 'Add / Edit Entries' },
                { key: 'can_enter_scores', label: 'Enter Scores' },
                { key: 'can_record_payments', label: 'Record Payments' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                  />
                  <span className="text-sm text-slate-300">{label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={addDelegate}>Create Delegate</button>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {delegates.length === 0 && !showForm ? (
        <div className="card p-8 text-center text-slate-500">
          No delegates yet. Add a delegate to let others help manage this session.
        </div>
      ) : (
        <div className="space-y-3">
          {delegates.map(delegate => (
            <div key={delegate.id} className="card p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-medium text-white">{delegate.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-400">Access Code:</span>
                    <span className="font-mono text-blue-300 font-bold tracking-widest bg-blue-900/30 px-2 py-0.5 rounded">
                      {delegate.access_code}
                    </span>
                  </div>
                </div>
                <button
                  className="btn-danger btn-sm"
                  onClick={() => removeDelegate(delegate.id)}
                >
                  Remove
                </button>
              </div>

              <div className="border-t border-slate-700 pt-3">
                <div className="text-xs text-slate-400 mb-2">Permissions</div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'can_manage_entries', label: 'Manage Entries' },
                    { key: 'can_enter_scores', label: 'Enter Scores' },
                    { key: 'can_record_payments', label: 'Record Payments' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!delegate[key]}
                        onChange={e => updatePermissions(delegate, key, e.target.checked)}
                      />
                      <span className="text-xs text-slate-300">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card p-4 bg-slate-800/50">
        <div className="text-sm font-medium text-slate-300 mb-1">How Delegate Access Works</div>
        <div className="text-xs text-slate-400 space-y-1">
          <div>Delegates enter their access code at the home screen to access the operator dashboard with limited permissions.</div>
          <div>Permissions can be updated at any time. All delegate codes expire when the session is closed.</div>
        </div>
      </div>
    </div>
  )
}
