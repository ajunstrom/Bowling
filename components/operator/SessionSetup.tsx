'use client'

import { useState, useCallback } from 'react'
import * as api from '@/lib/api'

interface Props {
  session: any
  bowlers: any[]
  onRefresh: () => void
  delegatePerms?: { can_manage_entries: boolean; can_record_payments: boolean } | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toFixed(2)
}

function StatusBadge({ bowler }: { bowler: any }) {
  const owed: number = bowler.amount_owed ?? 0
  const paid: number = bowler.amount_paid ?? 0
  const credit: number = bowler.credit_balance ?? 0

  if (credit > 0) return <span className="badge-purple">Credit</span>
  if (paid >= owed && owed > 0) return <span className="badge-green">Settled</span>
  if (paid < owed && owed > 0) return <span className="badge-red">Owes Money</span>
  return null
}

// ── Sub-component: RakePreview ────────────────────────────────────────────────

function RakePreview({
  label,
  fee,
  rakePct,
  count,
}: {
  label: string
  fee: number
  rakePct: number
  count: number
}) {
  if (!fee || !count) return null
  const gross = fee * count
  const cut = gross * (rakePct / 100)
  const prize = gross - cut
  return (
    <div className="text-xs text-slate-500 mt-1 space-x-3">
      <span>
        {label}: <span className="num text-slate-700">${fmt(gross)}</span> gross &rarr;{' '}
        <span className="num text-emerald-600">${fmt(prize)}</span> prize pool /{' '}
        <span className="num text-blue-600">${fmt(cut)}</span> operator
      </span>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SessionSetup({ session, bowlers, onRefresh, delegatePerms }: Props) {
  const canManageEntries = delegatePerms ? delegatePerms.can_manage_entries : true
  const canRecordPayments = delegatePerms ? delegatePerms.can_record_payments : true

  // ── Add bowler form
  const [addForm, setAddForm] = useState({ name: '', handicap: 0, num_entries: 1 })
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  // ── Inline editing
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<{ name: string; handicap: number; num_entries: number }>({
    name: '',
    handicap: 0,
    num_entries: 1,
  })
  const [savingId, setSavingId] = useState<number | null>(null)

  // ── Payment recording
  const [paymentBowlerId, setPaymentBowlerId] = useState<number | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [payingId, setPayingId] = useState<number | null>(null)

  // ── Applying credit
  const [applyingCreditId, setApplyingCreditId] = useState<number | null>(null)

  // ── Delete
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // ── Settings panel
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<any>(() => ({ ...(session.settings ?? {}) }))
  const [savingSettings, setSavingSettings] = useState(false)

  // ── Bracket generation
  const [generating, setGenerating] = useState(false)
  const [genResult, setGenResult] = useState<any>(null)
  const [genError, setGenError] = useState('')

  // ── Derived stats
  const totalEntries = bowlers.reduce((sum, b) => sum + (b.num_entries ?? 0), 0)
  const totalCollected = bowlers.reduce((sum, b) => sum + (b.amount_paid ?? 0), 0)
  const totalOwed = bowlers.reduce((sum, b) => sum + (b.amount_owed ?? 0), 0)
  const outstandingCount = bowlers.filter(
    (b) => (b.amount_owed ?? 0) > 0 && (b.amount_paid ?? 0) < (b.amount_owed ?? 0),
  ).length
  const numBrackets = Math.floor(totalEntries / 8)
  const leftover = totalEntries % 8

  // ── Bracket prize math
  const s = settings
  const entryFee: number = s.bracket_entry_fee ?? 0
  const opFee: number = s.bracket_operator_fee ?? 0
  const firstPlace: number = s.bracket_first_place ?? 0
  const secondPlace = Math.max(0, 8 * entryFee - opFee - firstPlace)
  const totalOpBracketRevenue = numBrackets * opFee * 2 // both modes

  // ── Helpers
  const startEdit = useCallback(
    (bowler: any) => {
      setEditingId(bowler.id)
      setEditForm({
        name: bowler.name,
        handicap: bowler.handicap ?? 0,
        num_entries: bowler.num_entries ?? 1,
      })
    },
    [],
  )

  const cancelEdit = useCallback(() => {
    setEditingId(null)
  }, [])

  // ── Mutations
  async function handleAdd() {
    if (!addForm.name.trim()) {
      setAddError('Name is required.')
      return
    }
    setAddError('')
    setAdding(true)
    try {
      await api.bowlers.add(session.id, {
        name: addForm.name.trim(),
        handicap: addForm.handicap,
        num_entries: addForm.num_entries,
      })
      setAddForm({ name: '', handicap: 0, num_entries: 1 })
      onRefresh()
    } catch (e: any) {
      setAddError(e.message ?? 'Failed to add bowler.')
    } finally {
      setAdding(false)
    }
  }

  async function handleSaveEdit(bowlerId: number) {
    setSavingId(bowlerId)
    try {
      await api.bowlers.update(session.id, bowlerId, editForm)
      setEditingId(null)
      onRefresh()
    } finally {
      setSavingId(null)
    }
  }

  async function handleDelete(bowlerId: number, name: string) {
    if (!confirm(`Remove "${name}" from this session? This cannot be undone.`)) return
    setDeletingId(bowlerId)
    try {
      await api.bowlers.delete(session.id, bowlerId)
      onRefresh()
    } finally {
      setDeletingId(null)
    }
  }

  async function handleRecordPayment(bowlerId: number) {
    const amt = parseFloat(paymentAmount)
    if (isNaN(amt) || amt <= 0) return
    setPayingId(bowlerId)
    try {
      await api.bowlers.recordPayment(session.id, bowlerId, amt)
      setPaymentBowlerId(null)
      setPaymentAmount('')
      onRefresh()
    } finally {
      setPayingId(null)
    }
  }

  async function handleApplyCredit(bowlerId: number, creditBalance: number) {
    if (!confirm(`Apply $${fmt(creditBalance)} credit to this bowler's balance?`)) return
    setApplyingCreditId(bowlerId)
    try {
      await (api.bowlers as any).applyCredit(session.id, bowlerId, creditBalance)
      onRefresh()
    } finally {
      setApplyingCreditId(null)
    }
  }

  async function handleGenerateBrackets() {
    setGenerating(true)
    setGenResult(null)
    setGenError('')
    try {
      const result = await api.brackets.generate(session.id)
      setGenResult(result)
      onRefresh()
    } catch (e: any) {
      setGenError(e.message ?? 'Failed to generate brackets.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSaveSettings() {
    setSavingSettings(true)
    try {
      await api.sessions.update(session.id, { settings })
      setShowSettings(false)
      onRefresh()
    } finally {
      setSavingSettings(false)
    }
  }

  function setSetting(key: string, value: any) {
    setSettings((prev: any) => ({ ...prev, [key]: value }))
  }

  // ── Eliminator split presets
  const splitPresets = [
    { label: '50/50', value: 50 },
    { label: '60/40', value: 60 },
    { label: '70/30', value: 70 },
    { label: '80/20', value: 80 },
    { label: '90/10', value: 90 },
  ]

  return (
    <div className="space-y-6">

      {/* ── Stats Bar ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4">
          <div className="num text-2xl font-bold text-slate-900">{bowlers.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Bowlers</div>
        </div>
        <div className="card p-4">
          <div className="num text-2xl font-bold text-blue-600">{totalEntries}</div>
          <div className="text-xs text-slate-500 mt-0.5">Total Entries</div>
        </div>
        <div className="card p-4">
          <div className="num text-2xl font-bold text-emerald-600">${fmt(totalCollected)}</div>
          <div className="text-xs text-slate-500 mt-0.5">Total Collected</div>
        </div>
        <div className="card p-4">
          <div className="num text-2xl font-bold text-red-500">{outstandingCount}</div>
          <div className="text-xs text-slate-500 mt-0.5">Outstanding</div>
        </div>
      </div>

      {/* ── Add Bowler Form ───────────────────────────────────────────────── */}
      {canManageEntries && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Add New Bowler</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="label">Name</label>
              <input
                className="input"
                placeholder="Full name"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                autoComplete="off"
              />
            </div>
            <div>
              <label className="label">Handicap</label>
              <input
                className="input"
                type="number"
                min={0}
                max={300}
                value={addForm.handicap}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, handicap: Math.max(0, parseInt(e.target.value) || 0) }))
                }
              />
            </div>
            <div>
              <label className="label">Entries</label>
              <input
                className="input"
                type="number"
                min={1}
                max={20}
                value={addForm.num_entries}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, num_entries: Math.max(1, parseInt(e.target.value) || 1) }))
                }
              />
            </div>
          </div>
          {addError && <p className="text-xs text-red-600 mt-2">{addError}</p>}
          <div className="mt-3">
            <button className="btn-primary" onClick={handleAdd} disabled={adding}>
              {adding ? 'Adding…' : '+ Add Bowler'}
            </button>
          </div>
        </div>
      )}

      {/* ── Bowler Roster Table ───────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Bowler Roster</h3>
          <span className="text-xs text-slate-400">{bowlers.length} bowler{bowlers.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide">
                <th className="text-left px-4 py-2.5">Name</th>
                <th className="text-center px-3 py-2.5">Hdcp</th>
                <th className="text-center px-3 py-2.5">Entries</th>
                <th className="text-right px-3 py-2.5">Owed</th>
                <th className="text-right px-3 py-2.5">Paid</th>
                <th className="text-right px-3 py-2.5">Balance</th>
                <th className="text-center px-3 py-2.5">Status</th>
                <th className="text-right px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bowlers.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-slate-400 py-10 text-sm">
                    No bowlers yet. Add bowlers above to get started.
                  </td>
                </tr>
              )}
              {bowlers.map((bowler) => {
                const owed: number = bowler.amount_owed ?? 0
                const paid: number = bowler.amount_paid ?? 0
                const credit: number = bowler.credit_balance ?? 0
                const balance = paid - owed
                const isEditing = editingId === bowler.id
                const isPaymentOpen = paymentBowlerId === bowler.id
                const isSaving = savingId === bowler.id
                const isPaying = payingId === bowler.id
                const isDeleting = deletingId === bowler.id
                const isApplyingCredit = applyingCreditId === bowler.id

                return (
                  <tr key={bowler.id} className="hover:bg-slate-50 transition-colors">
                    {/* Name */}
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          className="input py-1"
                          value={editForm.name}
                          onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(bowler.id)}
                          autoFocus
                        />
                      ) : (
                        <span
                          className={`font-medium text-slate-900 ${canManageEntries ? 'cursor-pointer hover:text-blue-600' : ''}`}
                          onClick={() => canManageEntries && startEdit(bowler)}
                          title={canManageEntries ? 'Click to edit' : undefined}
                        >
                          {bowler.name}
                        </span>
                      )}
                    </td>

                    {/* Handicap */}
                    <td className="text-center px-3 py-3">
                      {isEditing ? (
                        <input
                          className="input py-1 w-16 text-center"
                          type="number"
                          min={0}
                          max={300}
                          value={editForm.handicap}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, handicap: Math.max(0, parseInt(e.target.value) || 0) }))
                          }
                        />
                      ) : (
                        <span
                          className={`num text-slate-700 ${canManageEntries ? 'cursor-pointer hover:text-blue-600' : ''}`}
                          onClick={() => canManageEntries && startEdit(bowler)}
                          title={canManageEntries ? 'Click to edit' : undefined}
                        >
                          {bowler.handicap ?? 0}
                        </span>
                      )}
                    </td>

                    {/* Entries */}
                    <td className="text-center px-3 py-3">
                      {isEditing ? (
                        <input
                          className="input py-1 w-16 text-center"
                          type="number"
                          min={1}
                          max={20}
                          value={editForm.num_entries}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              num_entries: Math.max(1, parseInt(e.target.value) || 1),
                            }))
                          }
                        />
                      ) : (
                        <span
                          className={`num text-slate-700 ${canManageEntries ? 'cursor-pointer hover:text-blue-600' : ''}`}
                          onClick={() => canManageEntries && startEdit(bowler)}
                          title={canManageEntries ? 'Click to edit' : undefined}
                        >
                          {bowler.num_entries ?? 1}
                        </span>
                      )}
                    </td>

                    {/* Owed */}
                    <td className="text-right px-3 py-3">
                      <span className="num text-slate-700">${fmt(owed)}</span>
                    </td>

                    {/* Paid */}
                    <td className="text-right px-3 py-3">
                      <span className="num text-emerald-600">${fmt(paid)}</span>
                    </td>

                    {/* Balance */}
                    <td className="text-right px-3 py-3">
                      <span className={`num font-medium ${balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {balance >= 0 ? '+' : ''}${fmt(balance)}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="text-center px-3 py-3">
                      <StatusBadge bowler={bowler} />
                    </td>

                    {/* Actions */}
                    <td className="text-right px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {isEditing ? (
                          <>
                            <button
                              className="btn-primary btn-sm"
                              onClick={() => handleSaveEdit(bowler.id)}
                              disabled={isSaving}
                            >
                              {isSaving ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              className="btn-secondary btn-sm"
                              onClick={cancelEdit}
                              disabled={isSaving}
                            >
                              Cancel
                            </button>
                          </>
                        ) : isPaymentOpen ? (
                          <>
                            <span className="text-xs text-slate-500 font-medium">Record $</span>
                            <input
                              className="input py-1 w-20 text-right num"
                              type="number"
                              min={0.01}
                              step={0.5}
                              placeholder="0.00"
                              value={paymentAmount}
                              onChange={(e) => setPaymentAmount(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleRecordPayment(bowler.id)}
                              autoFocus
                            />
                            <button
                              className="btn-primary btn-sm"
                              onClick={() => handleRecordPayment(bowler.id)}
                              disabled={isPaying}
                            >
                              {isPaying ? '…' : 'Pay'}
                            </button>
                            <button
                              className="btn-ghost btn-sm"
                              onClick={() => {
                                setPaymentBowlerId(null)
                                setPaymentAmount('')
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            {canRecordPayments && (
                              <button
                                className="btn-secondary btn-sm"
                                onClick={() => {
                                  setPaymentBowlerId(bowler.id)
                                  setPaymentAmount('')
                                  setEditingId(null)
                                }}
                              >
                                Record Payment $__
                              </button>
                            )}
                            {canRecordPayments && credit > 0 && (
                              <button
                                className="btn-ghost btn-sm text-purple-600 hover:bg-purple-50"
                                onClick={() => handleApplyCredit(bowler.id, credit)}
                                disabled={isApplyingCredit}
                                title={`Apply $${fmt(credit)} credit`}
                              >
                                {isApplyingCredit ? 'Applying…' : `Apply Credit ($${fmt(credit)})`}
                              </button>
                            )}
                            {canManageEntries && (
                              <>
                                <button
                                  className="btn-ghost btn-sm"
                                  onClick={() => {
                                    setPaymentBowlerId(null)
                                    startEdit(bowler)
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  className="btn-danger btn-sm"
                                  onClick={() => handleDelete(bowler.id, bowler.name)}
                                  disabled={isDeleting}
                                >
                                  {isDeleting ? '…' : 'Delete'}
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {bowlers.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
                  <td className="px-4 py-3">
                    Total <span className="font-normal text-slate-400">({bowlers.length} bowlers)</span>
                  </td>
                  <td />
                  <td className="text-center px-3 py-3 num">{totalEntries}</td>
                  <td className="text-right px-3 py-3 num">${fmt(totalOwed)}</td>
                  <td className="text-right px-3 py-3 num text-emerald-600">${fmt(totalCollected)}</td>
                  <td className="text-right px-3 py-3 num font-semibold">
                    <span className={totalCollected - totalOwed >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                      {totalCollected - totalOwed >= 0 ? '+' : ''}${fmt(totalCollected - totalOwed)}
                    </span>
                  </td>
                  <td />
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Bracket Preview ───────────────────────────────────────────────── */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Bracket Preview</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div>
            <div className="text-xs text-slate-500 mb-0.5">Total Entries</div>
            <div className="num text-xl font-bold text-slate-900">{totalEntries}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-0.5">Full Brackets</div>
            <div className="num text-xl font-bold text-blue-600">{numBrackets}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-0.5">Leftover Entries</div>
            <div className={`num text-xl font-bold ${leftover > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
              {leftover}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-0.5">Operator Revenue</div>
            <div className="num text-xl font-bold text-emerald-600">${fmt(totalOpBracketRevenue)}</div>
          </div>
        </div>

        {entryFee > 0 && (
          <div className="bg-slate-50 rounded-lg p-4 mb-4 space-y-1.5 text-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Prize Breakdown Per Bracket
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">1st Place</span>
              <span className="num font-semibold text-slate-900">${fmt(firstPlace)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">2nd Place</span>
              <span className="num font-semibold text-slate-900">${fmt(secondPlace)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-1.5">
              <span className="text-slate-600">Operator Fee (per bracket)</span>
              <span className="num font-semibold text-blue-600">${fmt(opFee)}</span>
            </div>
          </div>
        )}

        {leftover > 0 && (
          <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
            {leftover} leftover {leftover === 1 ? 'entry' : 'entries'} will not fill a complete bracket.
            {entryFee > 0 && ` Each leftover bowler will receive a $${fmt(entryFee)} refund.`}
          </div>
        )}

        {genError && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
            {genError}
          </div>
        )}
        {genResult && (
          <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-4 flex items-start justify-between gap-2">
            <span>
              Brackets generated: <span className="font-semibold">{genResult.numBrackets ?? numBrackets}</span>{' '}
              bracket{(genResult.numBrackets ?? numBrackets) !== 1 ? 's' : ''}.
              {(genResult.leftoverCount ?? leftover) > 0 && (
                <span className="text-amber-600 ml-1">
                  {genResult.leftoverCount ?? leftover} leftover{(genResult.leftoverCount ?? leftover) !== 1 ? 's' : ''}.
                </span>
              )}
            </span>
            <button
              className="text-slate-400 hover:text-slate-600 flex-shrink-0"
              onClick={() => setGenResult(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        <button
          className="btn-primary"
          onClick={handleGenerateBrackets}
          disabled={generating || totalEntries < 2}
        >
          {generating ? 'Generating…' : 'Generate Brackets'}
        </button>
      </div>

      {/* ── Session Settings (collapsible) ───────────────────────────────── */}
      <div className="card overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
          onClick={() => setShowSettings((v) => !v)}
        >
          <span className="text-sm font-semibold text-slate-700">Session Settings</span>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${showSettings ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showSettings && (
          <div className="border-t border-slate-200 p-5 space-y-8">

            {/* Brackets */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded"
                    checked={!!settings.brackets_enabled}
                    onChange={(e) => setSetting('brackets_enabled', e.target.checked)}
                  />
                  <span className="text-sm font-semibold text-slate-700">Brackets</span>
                </label>
              </div>
              {settings.brackets_enabled && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pl-6">
                  <div>
                    <label className="label">Entry Fee ($)</label>
                    <input
                      className="input num"
                      type="number"
                      min={0}
                      step={0.5}
                      value={settings.bracket_entry_fee ?? ''}
                      onChange={(e) => setSetting('bracket_entry_fee', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <label className="label">Operator Fee ($)</label>
                    <input
                      className="input num"
                      type="number"
                      min={0}
                      step={0.5}
                      value={settings.bracket_operator_fee ?? ''}
                      onChange={(e) => setSetting('bracket_operator_fee', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <label className="label">1st Place Prize ($)</label>
                    <input
                      className="input num"
                      type="number"
                      min={0}
                      step={0.5}
                      value={settings.bracket_first_place ?? ''}
                      onChange={(e) => setSetting('bracket_first_place', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  {settings.bracket_entry_fee > 0 && (
                    <div className="sm:col-span-3 text-xs text-slate-500">
                      2nd Place = <span className="num">
                        ${fmt(Math.max(0, 8 * (settings.bracket_entry_fee ?? 0) - (settings.bracket_operator_fee ?? 0) - (settings.bracket_first_place ?? 0)))}
                      </span>
                      {' '}(8 × entry − operator fee − 1st place)
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Eliminator */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded"
                    checked={!!settings.eliminator_enabled}
                    onChange={(e) => setSetting('eliminator_enabled', e.target.checked)}
                  />
                  <span className="text-sm font-semibold text-slate-700">Eliminator Contest</span>
                </label>
              </div>
              {settings.eliminator_enabled && (
                <div className="pl-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Entry Fee ($)</label>
                      <input
                        className="input num"
                        type="number"
                        min={0}
                        step={0.5}
                        value={settings.eliminator_fee ?? ''}
                        onChange={(e) => setSetting('eliminator_fee', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <label className="label">Rake (%)</label>
                      <input
                        className="input num"
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={settings.eliminator_rake_pct ?? ''}
                        onChange={(e) => setSetting('eliminator_rake_pct', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <RakePreview
                    label="Eliminator"
                    fee={settings.eliminator_fee ?? 0}
                    rakePct={settings.eliminator_rake_pct ?? 0}
                    count={bowlers.length}
                  />
                  <div>
                    <label className="label">Places Paid</label>
                    <div className="flex gap-4">
                      {[1, 2, 3].map((n) => (
                        <label key={n} className="flex items-center gap-1.5 cursor-pointer text-sm text-slate-700">
                          <input
                            type="radio"
                            name="eliminator_places_paid"
                            value={n}
                            checked={settings.eliminator_places_paid === n}
                            onChange={() => setSetting('eliminator_places_paid', n)}
                          />
                          {n === 1 ? '1st only' : n === 2 ? '1st & 2nd' : '1st, 2nd & 3rd'}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="label">
                      1st/2nd Split:{' '}
                      <span className="num text-slate-700">
                        {settings.eliminator_split_pct ?? 70}/{100 - (settings.eliminator_split_pct ?? 70)}
                      </span>
                    </label>
                    <input
                      type="range"
                      className="w-full accent-blue-600"
                      min={50}
                      max={90}
                      step={10}
                      value={settings.eliminator_split_pct ?? 70}
                      onChange={(e) => setSetting('eliminator_split_pct', parseInt(e.target.value))}
                    />
                    <div className="flex gap-2 mt-1.5 flex-wrap">
                      {splitPresets.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          className={`btn-xs ${settings.eliminator_split_pct === p.value ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => setSetting('eliminator_split_pct', p.value)}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {settings.eliminator_places_paid === 3 && (
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded"
                        checked={!!settings.eliminator_third_fee_back}
                        onChange={(e) => setSetting('eliminator_third_fee_back', e.target.checked)}
                      />
                      3rd place gets entry fee back
                    </label>
                  )}
                </div>
              )}
            </section>

            {/* High Game */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded"
                    checked={!!settings.high_game_enabled}
                    onChange={(e) => setSetting('high_game_enabled', e.target.checked)}
                  />
                  <span className="text-sm font-semibold text-slate-700">High Game Pot</span>
                </label>
              </div>
              {settings.high_game_enabled && (
                <div className="pl-6 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Entry Fee ($)</label>
                      <input
                        className="input num"
                        type="number"
                        min={0}
                        step={0.5}
                        value={settings.high_game_fee ?? ''}
                        onChange={(e) => setSetting('high_game_fee', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <label className="label">Rake (%)</label>
                      <input
                        className="input num"
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={settings.high_game_rake_pct ?? ''}
                        onChange={(e) => setSetting('high_game_rake_pct', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <RakePreview
                    label="High Game"
                    fee={settings.high_game_fee ?? 0}
                    rakePct={settings.high_game_rake_pct ?? 0}
                    count={bowlers.length}
                  />
                </div>
              )}
            </section>

            {/* High Series */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded"
                    checked={!!settings.high_series_enabled}
                    onChange={(e) => setSetting('high_series_enabled', e.target.checked)}
                  />
                  <span className="text-sm font-semibold text-slate-700">High Series</span>
                </label>
              </div>
              {settings.high_series_enabled && (
                <div className="pl-6 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="label">Entry Fee ($)</label>
                      <input
                        className="input num"
                        type="number"
                        min={0}
                        step={0.5}
                        value={settings.high_series_fee ?? ''}
                        onChange={(e) => setSetting('high_series_fee', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <label className="label">Rake (%)</label>
                      <input
                        className="input num"
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={settings.high_series_rake_pct ?? ''}
                        onChange={(e) => setSetting('high_series_rake_pct', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <label className="label">1st Place % of Prize</label>
                      <input
                        className="input num"
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={settings.high_series_first_pct ?? ''}
                        onChange={(e) => setSetting('high_series_first_pct', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <RakePreview
                    label="High Series"
                    fee={settings.high_series_fee ?? 0}
                    rakePct={settings.high_series_rake_pct ?? 0}
                    count={bowlers.length}
                  />
                </div>
              )}
            </section>

            {/* Mystery Doubles */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded"
                    checked={!!settings.mystery_doubles_enabled}
                    onChange={(e) => setSetting('mystery_doubles_enabled', e.target.checked)}
                  />
                  <span className="text-sm font-semibold text-slate-700">Mystery Doubles</span>
                </label>
              </div>
              {settings.mystery_doubles_enabled && (
                <div className="pl-6 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Entry Fee ($)</label>
                      <input
                        className="input num"
                        type="number"
                        min={0}
                        step={0.5}
                        value={settings.mystery_doubles_fee ?? ''}
                        onChange={(e) => setSetting('mystery_doubles_fee', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <label className="label">Rake (%)</label>
                      <input
                        className="input num"
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={settings.mystery_doubles_rake_pct ?? ''}
                        onChange={(e) => setSetting('mystery_doubles_rake_pct', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <RakePreview
                    label="Mystery Doubles"
                    fee={settings.mystery_doubles_fee ?? 0}
                    rakePct={settings.mystery_doubles_rake_pct ?? 0}
                    count={Math.floor(bowlers.length / 2)}
                  />
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded"
                      checked={!!settings.mystery_doubles_repair}
                      onChange={(e) => setSetting('mystery_doubles_repair', e.target.checked)}
                    />
                    Repair mode (re-draw pairs with byes)
                  </label>
                </div>
              )}
            </section>

            {/* Bowler Submissions */}
            <section>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded"
                  checked={!!settings.allow_bowler_submissions}
                  onChange={(e) => setSetting('allow_bowler_submissions', e.target.checked)}
                />
                <span className="text-sm font-semibold text-slate-700">Allow Bowler Score Submissions</span>
              </label>
              <p className="text-xs text-slate-500 mt-1 pl-6">
                When enabled, bowlers can submit their own scores for operator review.
              </p>
            </section>

            {/* Save/Cancel */}
            <div className="flex gap-3 pt-2 border-t border-slate-200">
              <button className="btn-primary" onClick={handleSaveSettings} disabled={savingSettings}>
                {savingSettings ? 'Saving…' : 'Save Settings'}
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  setSettings({ ...(session.settings ?? {}) })
                  setShowSettings(false)
                }}
                disabled={savingSettings}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
