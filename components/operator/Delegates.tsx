'use client'

import { useState } from 'react'
import * as api from '@/lib/api'

interface Props {
  session: any
  delegates: any[]
  onRefresh: () => void
}

interface PermToggleProps {
  label: string
  field: string
  value: boolean
  delegateId: number
  sessionId: number
  onRefresh: () => void
}

function PermToggle({ label, field, value, delegateId, sessionId, onRefresh }: PermToggleProps) {
  const [busy, setBusy] = useState(false)

  async function handleChange(checked: boolean) {
    setBusy(true)
    try {
      await api.delegates.update(sessionId, delegateId, { [field]: checked })
      onRefresh()
    } catch {
      // silently ignore; UI stays put until refresh
    } finally {
      setBusy(false)
    }
  }

  return (
    <label className={`flex items-center gap-2 cursor-pointer select-none ${busy ? 'opacity-50' : ''}`}>
      <input
        type="checkbox"
        checked={value}
        disabled={busy}
        onChange={(e) => handleChange(e.target.checked)}
        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
      />
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  )
}

function DelegateCard({
  delegate,
  session,
  onRefresh,
}: {
  delegate: any
  session: any
  onRefresh: () => void
}) {
  const [copying, setCopying] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [revoking, setRevoking] = useState(false)

  const isActive = session.status !== 'closed'

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(delegate.access_code)
      setCopying(true)
      setTimeout(() => setCopying(false), 1500)
    } catch {
      // clipboard not available
    }
  }

  async function handleRevoke() {
    setRevoking(true)
    try {
      await api.delegates.remove(session.id, delegate.id)
      onRefresh()
    } catch {
      setRevoking(false)
      setConfirmRevoke(false)
    }
  }

  return (
    <div className="card px-4 py-4 space-y-3">
      {/* Top row: name + status + revoke */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-slate-900 truncate">{delegate.name}</span>
          {isActive ? (
            <span className="badge-green shrink-0">Active</span>
          ) : (
            <span className="badge-slate shrink-0">Expired</span>
          )}
        </div>

        {confirmRevoke ? (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-600">Revoke?</span>
            <button
              className="btn-danger btn-sm"
              onClick={handleRevoke}
              disabled={revoking}
            >
              {revoking ? 'Revoking…' : 'Yes, Revoke'}
            </button>
            <button
              className="btn-ghost btn-sm"
              onClick={() => setConfirmRevoke(false)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            className="btn-danger btn-sm shrink-0"
            onClick={() => setConfirmRevoke(true)}
          >
            Revoke
          </button>
        )}
      </div>

      {/* Access code */}
      <div>
        <p className="label">Access Code</p>
        <div className="flex items-center gap-2">
          <span className="num text-sm bg-slate-100 rounded-md px-3 py-1.5 font-mono tracking-widest text-slate-800 select-all">
            {delegate.access_code}
          </span>
          <button
            className="btn-secondary btn-sm"
            onClick={handleCopy}
          >
            {copying ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Last seen */}
      <p className="text-xs text-slate-400">Last seen: N/A</p>

      {/* Permissions */}
      <div>
        <p className="label">Permissions</p>
        <div className="flex flex-col gap-2">
          <PermToggle
            label="Manage Entries"
            field="can_manage_entries"
            value={delegate.can_manage_entries}
            delegateId={delegate.id}
            sessionId={session.id}
            onRefresh={onRefresh}
          />
          <PermToggle
            label="Enter Scores"
            field="can_enter_scores"
            value={delegate.can_enter_scores}
            delegateId={delegate.id}
            sessionId={session.id}
            onRefresh={onRefresh}
          />
          <PermToggle
            label="Record Payments"
            field="can_record_payments"
            value={delegate.can_record_payments}
            delegateId={delegate.id}
            sessionId={session.id}
            onRefresh={onRefresh}
          />
        </div>
      </div>
    </div>
  )
}

export default function Delegates({ session, delegates, onRefresh }: Props) {
  const [name, setName] = useState('')
  const [canManageEntries, setCanManageEntries] = useState(false)
  const [canEnterScores, setCanEnterScores] = useState(true)
  const [canRecordPayments, setCanRecordPayments] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setAdding(true)
    setAddError(null)
    try {
      await api.delegates.add(session.id, {
        name: name.trim(),
        can_manage_entries: canManageEntries,
        can_enter_scores: canEnterScores,
        can_record_payments: canRecordPayments,
      })
      setName('')
      setCanManageEntries(false)
      setCanEnterScores(true)
      setCanRecordPayments(false)
      onRefresh()
    } catch (e: any) {
      setAddError(e.message)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Delegates</h2>
        <span className="text-sm text-slate-500">{delegates.length} delegate{delegates.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Explanation */}
      <div className="card px-4 py-3 bg-blue-50 border-blue-200">
        <p className="text-sm text-blue-800">
          Delegates can help run the session using a unique access code. Share the code with your helper — they log in at the delegate login page and get access based on their permissions. Codes are tied to this session only.
        </p>
      </div>

      {/* Existing delegates */}
      {delegates.length === 0 ? (
        <div className="card px-6 py-8 text-center text-slate-500">
          No delegates yet. Add one below to get started.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {delegates.map((d) => (
            <DelegateCard
              key={d.id}
              delegate={d}
              session={session}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}

      {/* Add delegate form */}
      <div className="card px-4 py-4">
        <h3 className="font-semibold text-slate-800 mb-3">Add Delegate</h3>
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="label" htmlFor="delegate-name">Name</label>
            <input
              id="delegate-name"
              className="input"
              placeholder="e.g. Lane Assistant"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <p className="label mb-2">Permissions</p>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={canManageEntries}
                  onChange={(e) => setCanManageEntries(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">Manage Entries</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={canEnterScores}
                  onChange={(e) => setCanEnterScores(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">Enter Scores</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={canRecordPayments}
                  onChange={(e) => setCanRecordPayments(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">Record Payments</span>
              </label>
            </div>
          </div>

          {addError && (
            <p className="text-red-600 text-sm">{addError}</p>
          )}

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={adding || !name.trim()}
          >
            {adding ? 'Adding…' : 'Add Delegate'}
          </button>
        </form>
      </div>
    </div>
  )
}
