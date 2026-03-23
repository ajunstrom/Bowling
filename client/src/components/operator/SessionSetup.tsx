import { useState } from 'react'
import { api } from '../../lib/api'

interface Props {
  session: any
  bowlers: any[]
  scores: any[]
  sessionId: string
  onRefresh: () => void
}

export default function SessionSetup({ session, bowlers, sessionId, onRefresh }: Props) {
  const [showAddBowler, setShowAddBowler] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', handicap: 0, num_entries: 1 })
  const [editForm, setEditForm] = useState<any>({})
  const [settings, setSettings] = useState(session.settings)
  const [showSettings, setShowSettings] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genResult, setGenResult] = useState<any>(null)
  const [paymentBowlerId, setPaymentBowlerId] = useState<string | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')

  const s = session.settings

  async function addBowler() {
    if (!form.name.trim()) return
    await api.bowlers.create(sessionId, form)
    setForm({ name: '', handicap: 0, num_entries: 1 })
    setShowAddBowler(false)
    onRefresh()
  }

  async function saveBowler(bid: string) {
    await api.bowlers.update(sessionId, bid, editForm)
    setEditingId(null)
    onRefresh()
  }

  async function deleteBowler(bid: string) {
    if (!confirm('Remove this bowler?')) return
    await api.bowlers.delete(sessionId, bid)
    onRefresh()
  }

  async function recordPayment(bid: string) {
    const amt = parseFloat(paymentAmount)
    if (isNaN(amt) || amt <= 0) return
    await api.bowlers.payment(sessionId, bid, amt)
    setPaymentBowlerId(null)
    setPaymentAmount('')
    onRefresh()
  }

  async function saveSettings() {
    await api.sessions.updateSettings(sessionId, settings)
    setShowSettings(false)
    onRefresh()
  }

  async function generateBrackets() {
    setGenerating(true)
    try {
      const result = await api.brackets.generate(sessionId)
      setGenResult(result)
      onRefresh()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const totalEntries = bowlers.reduce((s, b) => s + b.num_entries, 0)
  const numBrackets = Math.floor(totalEntries / 8)
  const leftover = totalEntries % 8

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4">
          <div className="text-2xl font-bold text-white">{bowlers.length}</div>
          <div className="text-xs text-slate-400">Bowlers</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-blue-400">{totalEntries}</div>
          <div className="text-xs text-slate-400">Total Entries</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-green-400">${bowlers.reduce((s, b) => s + b.amount_paid, 0).toFixed(2)}</div>
          <div className="text-xs text-slate-400">Collected</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-amber-400">
            ${(bowlers.reduce((s, b) => s + b.amount_owed, 0) - bowlers.reduce((s, b) => s + b.amount_paid, 0)).toFixed(2)}
          </div>
          <div className="text-xs text-slate-400">Outstanding</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button className="btn-primary" onClick={() => setShowAddBowler(true)}>+ Add Bowler</button>
        <button className="btn-secondary" onClick={() => setShowSettings(!showSettings)}>
          ⚙ Session Settings
        </button>
        <button
          className="btn-success"
          onClick={generateBrackets}
          disabled={generating || bowlers.length < 2}
        >
          {generating ? 'Generating...' : `Generate Brackets (${numBrackets} full, ${leftover} leftover)`}
        </button>
      </div>

      {/* Generate result */}
      {genResult && (
        <div className="card p-4 bg-green-900/30 border-green-700">
          <div className="font-medium text-green-300">Brackets Generated!</div>
          <div className="text-sm text-slate-300 mt-1">
            {genResult.numBrackets} bracket{genResult.numBrackets !== 1 ? 's' : ''} created.
            {genResult.leftoverCount > 0 && (
              <span className="text-amber-300 ml-2">
                {genResult.leftoverCount} leftover entries need refund.
              </span>
            )}
          </div>
          <button className="text-xs text-slate-400 mt-2" onClick={() => setGenResult(null)}>Dismiss</button>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="card p-6 space-y-6">
          <h3 className="font-semibold text-white">Session Settings</h3>

          {/* Brackets */}
          <div>
            <h4 className="text-sm font-medium text-slate-300 mb-3">Brackets</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Entry Fee ($)</label>
                <input className="input" type="number" step="0.50" value={settings.bracket_fee}
                  onChange={e => setSettings((s: any) => ({ ...s, bracket_fee: parseFloat(e.target.value) }))} />
              </div>
              <div>
                <label className="label">Operator Take (%)</label>
                <input className="input" type="number" step="1" min="0" max="100"
                  value={Math.round(settings.bracket_op_pct * 100)}
                  onChange={e => setSettings((s: any) => ({ ...s, bracket_op_pct: parseFloat(e.target.value) / 100 }))} />
              </div>
            </div>
          </div>

          {/* Eliminator */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <input type="checkbox" id="has_elim" checked={!!settings.has_eliminator}
                onChange={e => setSettings((s: any) => ({ ...s, has_eliminator: e.target.checked }))} />
              <label htmlFor="has_elim" className="text-sm font-medium text-slate-300">Eliminator Contest</label>
            </div>
            {settings.has_eliminator && (
              <div className="grid grid-cols-2 gap-3 pl-6">
                <div>
                  <label className="label">Entry Fee ($)</label>
                  <input className="input" type="number" step="0.50" value={settings.eliminator_fee}
                    onChange={e => setSettings((s: any) => ({ ...s, eliminator_fee: parseFloat(e.target.value) }))} />
                </div>
                <div>
                  <label className="label">Rake (%)</label>
                  <input className="input" type="number" step="1" min="0" max="100"
                    value={Math.round(settings.eliminator_rake * 100)}
                    onChange={e => setSettings((s: any) => ({ ...s, eliminator_rake: parseFloat(e.target.value) / 100 }))} />
                </div>
                <div>
                  <label className="label">Places Paid</label>
                  <select className="input" value={settings.eliminator_places}
                    onChange={e => setSettings((s: any) => ({ ...s, eliminator_places: parseInt(e.target.value) }))}>
                    <option value={1}>1st only</option>
                    <option value={2}>1st & 2nd</option>
                    <option value={3}>1st, 2nd & 3rd</option>
                  </select>
                </div>
                <div>
                  <label className="label">1st/2nd Split: {settings.eliminator_split}/{100 - settings.eliminator_split}</label>
                  <input className="input" type="range" min="50" max="90" step="5"
                    value={settings.eliminator_split}
                    onChange={e => setSettings((s: any) => ({ ...s, eliminator_split: parseInt(e.target.value) }))} />
                </div>
                {settings.eliminator_places === 3 && (
                  <div className="flex items-center gap-2 col-span-2">
                    <input type="checkbox" id="third_fee" checked={!!settings.eliminator_third_fee_back}
                      onChange={e => setSettings((s: any) => ({ ...s, eliminator_third_fee_back: e.target.checked }))} />
                    <label htmlFor="third_fee" className="text-sm text-slate-300">3rd place gets entry fee back</label>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* High Game */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <input type="checkbox" id="has_hg" checked={!!settings.has_high_game}
                onChange={e => setSettings((s: any) => ({ ...s, has_high_game: e.target.checked }))} />
              <label htmlFor="has_hg" className="text-sm font-medium text-slate-300">High Game Pot</label>
            </div>
            {settings.has_high_game && (
              <div className="grid grid-cols-2 gap-3 pl-6">
                <div>
                  <label className="label">Entry Fee ($)</label>
                  <input className="input" type="number" step="0.50" value={settings.high_game_fee}
                    onChange={e => setSettings((s: any) => ({ ...s, high_game_fee: parseFloat(e.target.value) }))} />
                </div>
                <div>
                  <label className="label">Rake (%)</label>
                  <input className="input" type="number" step="1" min="0" max="100"
                    value={Math.round(settings.high_game_rake * 100)}
                    onChange={e => setSettings((s: any) => ({ ...s, high_game_rake: parseFloat(e.target.value) / 100 }))} />
                </div>
              </div>
            )}
          </div>

          {/* High Series */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <input type="checkbox" id="has_hs" checked={!!settings.has_high_series}
                onChange={e => setSettings((s: any) => ({ ...s, has_high_series: e.target.checked }))} />
              <label htmlFor="has_hs" className="text-sm font-medium text-slate-300">High Series</label>
            </div>
            {settings.has_high_series && (
              <div className="grid grid-cols-2 gap-3 pl-6">
                <div>
                  <label className="label">Entry Fee ($)</label>
                  <input className="input" type="number" step="0.50" value={settings.high_series_fee}
                    onChange={e => setSettings((s: any) => ({ ...s, high_series_fee: parseFloat(e.target.value) }))} />
                </div>
                <div>
                  <label className="label">Rake (%)</label>
                  <input className="input" type="number" step="1" min="0" max="100"
                    value={Math.round(settings.high_series_rake * 100)}
                    onChange={e => setSettings((s: any) => ({ ...s, high_series_rake: parseFloat(e.target.value) / 100 }))} />
                </div>
              </div>
            )}
          </div>

          {/* Mystery Doubles */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <input type="checkbox" id="has_md" checked={!!settings.has_mystery_doubles}
                onChange={e => setSettings((s: any) => ({ ...s, has_mystery_doubles: e.target.checked }))} />
              <label htmlFor="has_md" className="text-sm font-medium text-slate-300">Mystery Doubles</label>
            </div>
            {settings.has_mystery_doubles && (
              <div className="grid grid-cols-2 gap-3 pl-6">
                <div>
                  <label className="label">Entry Fee ($)</label>
                  <input className="input" type="number" step="0.50" value={settings.mystery_doubles_fee}
                    onChange={e => setSettings((s: any) => ({ ...s, mystery_doubles_fee: parseFloat(e.target.value) }))} />
                </div>
                <div>
                  <label className="label">Rake (%)</label>
                  <input className="input" type="number" step="1" min="0" max="100"
                    value={Math.round(settings.mystery_doubles_rake * 100)}
                    onChange={e => setSettings((s: any) => ({ ...s, mystery_doubles_rake: parseFloat(e.target.value) / 100 }))} />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button className="btn-primary" onClick={saveSettings}>Save Settings</button>
            <button className="btn-secondary" onClick={() => { setSettings(session.settings); setShowSettings(false) }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Add Bowler Form */}
      {showAddBowler && (
        <div className="card p-4">
          <h3 className="font-medium text-white mb-3">Add Bowler</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3 md:col-span-1">
              <label className="label">Name</label>
              <input className="input" placeholder="John Smith" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addBowler()} autoFocus />
            </div>
            <div>
              <label className="label">Handicap</label>
              <input className="input" type="number" min="0" max="300" value={form.handicap}
                onChange={e => setForm(f => ({ ...f, handicap: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="label">Entries</label>
              <input className="input" type="number" min="1" max="10" value={form.num_entries}
                onChange={e => setForm(f => ({ ...f, num_entries: parseInt(e.target.value) || 1 }))} />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button className="btn-primary" onClick={addBowler}>Add Bowler</button>
            <button className="btn-secondary" onClick={() => setShowAddBowler(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Bowler Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-xs">
                <th className="text-left p-3">Bowler</th>
                <th className="text-center p-3">Hdcp</th>
                <th className="text-center p-3">Entries</th>
                <th className="text-right p-3">Owed</th>
                <th className="text-right p-3">Paid</th>
                <th className="text-right p-3">Balance</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bowlers.map(bowler => {
                const balance = bowler.amount_paid - bowler.amount_owed
                const isEditing = editingId === bowler.id
                return (
                  <tr key={bowler.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="p-3">
                      {isEditing ? (
                        <input className="input py-1" value={editForm.name || ''} onChange={e => setEditForm((f: any) => ({ ...f, name: e.target.value }))} />
                      ) : (
                        <div className="font-medium text-white">{bowler.name}</div>
                      )}
                      <div className="text-xs text-slate-500 font-mono">{bowler.bowler_token?.slice(0, 8)}...</div>
                    </td>
                    <td className="text-center p-3">
                      {isEditing ? (
                        <input className="input py-1 w-16 text-center" type="number" value={editForm.handicap ?? bowler.handicap}
                          onChange={e => setEditForm((f: any) => ({ ...f, handicap: parseInt(e.target.value) || 0 }))} />
                      ) : bowler.handicap}
                    </td>
                    <td className="text-center p-3">
                      {isEditing ? (
                        <input className="input py-1 w-16 text-center" type="number" value={editForm.num_entries ?? bowler.num_entries}
                          onChange={e => setEditForm((f: any) => ({ ...f, num_entries: parseInt(e.target.value) || 1 }))} />
                      ) : bowler.num_entries}
                    </td>
                    <td className="text-right p-3">${bowler.amount_owed.toFixed(2)}</td>
                    <td className="text-right p-3 text-green-400">${bowler.amount_paid.toFixed(2)}</td>
                    <td className="text-right p-3">
                      <span className={balance >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {balance >= 0 ? '+' : ''}${balance.toFixed(2)}
                      </span>
                    </td>
                    <td className="text-right p-3">
                      <div className="flex items-center justify-end gap-1">
                        {paymentBowlerId === bowler.id ? (
                          <>
                            <input className="input py-1 w-20 text-right" type="number" step="0.50"
                              placeholder="$0.00" value={paymentAmount}
                              onChange={e => setPaymentAmount(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && recordPayment(bowler.id)} autoFocus />
                            <button className="btn btn-sm btn-success" onClick={() => recordPayment(bowler.id)}>✓</button>
                            <button className="btn btn-sm btn-secondary" onClick={() => setPaymentBowlerId(null)}>✕</button>
                          </>
                        ) : isEditing ? (
                          <>
                            <button className="btn btn-sm btn-success" onClick={() => saveBowler(bowler.id)}>Save</button>
                            <button className="btn btn-sm btn-secondary" onClick={() => setEditingId(null)}>Cancel</button>
                          </>
                        ) : (
                          <>
                            <button className="btn btn-sm btn-success" onClick={() => { setPaymentBowlerId(bowler.id); setPaymentAmount('') }}>
                              Pay
                            </button>
                            <button className="btn btn-sm btn-secondary" onClick={() => { setEditingId(bowler.id); setEditForm({ name: bowler.name, handicap: bowler.handicap, num_entries: bowler.num_entries }) }}>
                              Edit
                            </button>
                            <button className="btn btn-sm btn-danger" onClick={() => deleteBowler(bowler.id)}>✕</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {bowlers.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-slate-500 py-8">
                    No bowlers yet. Add bowlers to get started.
                  </td>
                </tr>
              )}
            </tbody>
            {bowlers.length > 0 && (
              <tfoot>
                <tr className="border-t border-slate-700 text-slate-300 text-xs font-medium">
                  <td className="p-3">Total ({bowlers.length} bowlers)</td>
                  <td></td>
                  <td className="text-center p-3">{totalEntries}</td>
                  <td className="text-right p-3">${bowlers.reduce((s, b) => s + b.amount_owed, 0).toFixed(2)}</td>
                  <td className="text-right p-3 text-green-400">${bowlers.reduce((s, b) => s + b.amount_paid, 0).toFixed(2)}</td>
                  <td className="text-right p-3">
                    <span className={bowlers.reduce((s, b) => s + b.amount_paid - b.amount_owed, 0) >= 0 ? 'text-green-400' : 'text-red-400'}>
                      ${bowlers.reduce((s, b) => s + b.amount_paid - b.amount_owed, 0).toFixed(2)}
                    </span>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Bracket preview */}
      {bowlers.length > 0 && (
        <div className="card p-4">
          <h3 className="font-medium text-white mb-2">Bracket Preview</h3>
          <div className="text-sm text-slate-400 space-y-1">
            <div>{totalEntries} total entries → <span className="text-white font-medium">{numBrackets} complete brackets</span></div>
            {leftover > 0 && (
              <div className="text-amber-400">{leftover} leftover {leftover === 1 ? 'entry' : 'entries'} — these bowlers will receive a refund of ${s.bracket_fee?.toFixed(2) || '5.00'} each</div>
            )}
            <div>Prize per bracket: <span className="text-green-400 font-medium">${(8 * (s.bracket_fee || 5) * (1 - (s.bracket_op_pct || 0.1))).toFixed(2)}</span></div>
            <div>Operator per bracket: <span className="text-blue-400 font-medium">${(8 * (s.bracket_fee || 5) * (s.bracket_op_pct || 0.1)).toFixed(2)}</span></div>
          </div>
        </div>
      )}
    </div>
  )
}
