'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { scores as scoresApi, scanScoresheet, submissions as submissionsApi } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  session: any
  bowlers: any[]
  scores: any[]
  onRefresh: () => void
  delegatePerms?: { can_enter_scores: boolean } | null
}

interface ScanMatch {
  name: string
  score: number
  matched_bowler_id: number | null
  matched_name: string | null
}

interface ScanResult {
  extracted: ScanMatch[]
}

interface Submission {
  id: number
  bowler_id: number | null
  game: 1 | 2 | 3
  status: 'pending' | 'approved' | 'rejected'
  submitted_at: string
  extracted_data: { name: string; score: number; matched_bowler_id?: number | null; matched_name?: string }[] | null
  bowler?: { name: string } | null
}

// ─── Game tab labels ──────────────────────────────────────────────────────────

const GAME_LABELS: Record<number, string> = {
  1: 'Game 1 — Round 1',
  2: 'Game 2 — Semifinals',
  3: 'Game 3 — Final',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EnterScores({ session, bowlers, scores, onRefresh, delegatePerms }: Props) {
  const sessionId: number = session?.id

  // Main tab: 1 | 2 | 3 | 'submissions'
  const [activeTab, setActiveTab] = useState<1 | 2 | 3 | 'submissions'>(1)
  const currentGame = activeTab === 'submissions' ? 1 : activeTab

  // Per-game score input state: key = `${bowlerId}-${game}`
  const [scoreInputs, setScoreInputs] = useState<Record<string, string>>({})

  // Save state
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Scan state
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [scanChecked, setScanChecked] = useState<Record<number, boolean>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Submissions state
  const [subs, setSubs] = useState<Submission[]>([])
  const [subsLoading, setSubsLoading] = useState(false)
  const [subsError, setSubsError] = useState<string | null>(null)
  const [approvingAll, setApprovingAll] = useState(false)

  // ── Derived: score lookup ─────────────────────────────────────────────────

  const scoreMap = new Map<string, number>()
  for (const s of scores) {
    scoreMap.set(`${s.bowler_id}-${s.game}`, s.raw_score)
  }

  function getCommitted(bowlerId: number, game: number): number | undefined {
    return scoreMap.get(`${bowlerId}-${game}`)
  }

  function getInput(bowlerId: number, game: number): string {
    return scoreInputs[`${bowlerId}-${game}`] ?? ''
  }

  function getDisplayRaw(bowlerId: number, game: number): number | undefined {
    const inp = scoreInputs[`${bowlerId}-${game}`]
    if (inp !== undefined && inp !== '') {
      const v = parseInt(inp, 10)
      return isNaN(v) ? undefined : v
    }
    return getCommitted(bowlerId, game)
  }

  // ── Lane coverage / progress chips ───────────────────────────────────────

  function gameProgress(game: number) {
    const entered = bowlers.filter((b) => getCommitted(b.id, game) !== undefined).length
    const total = bowlers.length
    const missing = total - entered
    return { entered, total, missing, allEntered: missing === 0 && total > 0 }
  }

  // ── Changed inputs for current game ──────────────────────────────────────

  function changedScoresForGame(game: number) {
    return bowlers
      .map((b) => {
        const inp = scoreInputs[`${b.id}-${game}`]
        if (inp === undefined || inp === '') return null
        const v = parseInt(inp, 10)
        if (isNaN(v) || v < 0 || v > 300) return null
        return { bowler_id: b.id as number, game, raw_score: v }
      })
      .filter(Boolean) as { bowler_id: number; game: number; raw_score: number }[]
  }

  // ── Save scores ───────────────────────────────────────────────────────────

  async function handleSave() {
    const game = activeTab as 1 | 2 | 3
    const toSave = changedScoresForGame(game)
    if (toSave.length === 0) return
    setSaving(true)
    setSaveError(null)
    try {
      await scoresApi.upsert(sessionId, toSave)
      // Clear inputs for this game
      setScoreInputs((prev) => {
        const next = { ...prev }
        for (const { bowler_id, game: g } of toSave) {
          delete next[`${bowler_id}-${g}`]
        }
        return next
      })
      onRefresh()
    } catch (err: any) {
      setSaveError(err.message ?? 'Failed to save scores.')
    } finally {
      setSaving(false)
    }
  }

  // ── AI Scan ───────────────────────────────────────────────────────────────

  function openFilePicker() {
    fileInputRef.current?.click()
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset file input so same file can be re-selected
    e.target.value = ''
    setScanError(null)
    setScanResult(null)
    setScanChecked({})
    setScanning(true)
    try {
      const result: ScanResult = await scanScoresheet(sessionId, currentGame, file)
      setScanResult(result)
      // Pre-check rows that have a match
      const checked: Record<number, boolean> = {}
      result.extracted.forEach((m, i) => {
        checked[i] = m.matched_bowler_id != null
      })
      setScanChecked(checked)
    } catch (err: any) {
      setScanError(err.message ?? 'Scan failed.')
    } finally {
      setScanning(false)
    }
  }

  function applySelectedScanScores() {
    if (!scanResult) return
    const game = activeTab as 1 | 2 | 3
    const updates: Record<string, string> = {}
    scanResult.extracted.forEach((m, i) => {
      if (scanChecked[i] && m.matched_bowler_id != null) {
        updates[`${m.matched_bowler_id}-${game}`] = String(m.score)
      }
    })
    setScoreInputs((prev) => ({ ...prev, ...updates }))
    setScanResult(null)
    setScanChecked({})
  }

  // ── Submissions ────────────────────────────────────────────────────────────

  const loadSubmissions = useCallback(async () => {
    setSubsLoading(true)
    setSubsError(null)
    try {
      const data = await submissionsApi.list(sessionId)
      setSubs(data)
    } catch (err: any) {
      setSubsError(err.message ?? 'Failed to load submissions.')
    } finally {
      setSubsLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    if (activeTab === 'submissions') {
      loadSubmissions()
    }
  }, [activeTab, loadSubmissions])

  async function handleApprove(subId: number) {
    try {
      await submissionsApi.approve(sessionId, subId)
      setSubs((prev) => prev.map((s) => (s.id === subId ? { ...s, status: 'approved' } : s)))
      onRefresh()
    } catch (err: any) {
      alert(err.message ?? 'Failed to approve.')
    }
  }

  async function handleReject(subId: number) {
    try {
      await submissionsApi.reject(sessionId, subId)
      setSubs((prev) => prev.map((s) => (s.id === subId ? { ...s, status: 'rejected' } : s)))
    } catch (err: any) {
      alert(err.message ?? 'Failed to reject.')
    }
  }

  async function handleApproveAll() {
    setApprovingAll(true)
    try {
      await submissionsApi.approveAll(sessionId)
      setSubs((prev) => prev.map((s) => (s.status === 'pending' ? { ...s, status: 'approved' } : s)))
      onRefresh()
    } catch (err: any) {
      alert(err.message ?? 'Failed to approve all.')
    } finally {
      setApprovingAll(false)
    }
  }

  const pendingCount = subs.filter((s) => s.status === 'pending').length

  // ── Read-only guard ───────────────────────────────────────────────────────

  const canEdit = delegatePerms == null || delegatePerms.can_enter_scores === true

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderLaneCoveragePanel(game: number) {
    const { entered, total, missing, allEntered } = gameProgress(game)
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Score Progress:</span>
        {allEntered ? (
          <span className="badge-green">All Entered</span>
        ) : (
          <>
            <span className="badge-green">{entered} Entered</span>
            <span className="badge-yellow font-semibold">{missing} Missing</span>
          </>
        )}
        <span className="badge-slate num">{entered}/{total}</span>
      </div>
    )
  }

  function renderScoreGrid(game: number) {
    const inputsForGame = changedScoresForGame(game)
    const hasChanges = inputsForGame.length > 0

    return (
      <div className="card overflow-hidden">
        {/* Header row with lane coverage + scan button */}
        <div className="px-4 py-3 border-b border-slate-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {renderLaneCoveragePanel(game)}
          {canEdit && (
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileSelected}
              />
              <button
                className="btn-secondary btn-sm"
                onClick={openFilePicker}
                disabled={scanning}
              >
                {scanning ? 'Scanning…' : '📷 Scan Scoresheet'}
              </button>
            </div>
          )}
        </div>

        {/* Scan error */}
        {scanError && (
          <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-sm text-red-700 flex items-center justify-between">
            <span>{scanError}</span>
            <button className="btn-ghost btn-sm" onClick={() => setScanError(null)}>Dismiss</button>
          </div>
        )}

        {/* Scan results panel */}
        {scanResult && (
          <div className="px-4 py-4 bg-blue-50 border-b border-blue-200 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-blue-800">
                Scan Results — {scanResult.extracted.length} row{scanResult.extracted.length !== 1 ? 's' : ''} extracted
              </p>
              <button
                className="btn-ghost btn-sm text-blue-700"
                onClick={() => { setScanResult(null); setScanChecked({}) }}
              >
                Close
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-blue-700 border-b border-blue-200">
                    <th className="text-left py-1.5 pr-3 w-8">Use</th>
                    <th className="text-left py-1.5 pr-3">Extracted Name</th>
                    <th className="text-left py-1.5 pr-3">Matched Bowler</th>
                    <th className="text-right py-1.5">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {scanResult.extracted.map((m, i) => (
                    <tr key={i} className="border-b border-blue-100 last:border-0">
                      <td className="py-1.5 pr-3">
                        <input
                          type="checkbox"
                          checked={scanChecked[i] ?? false}
                          disabled={m.matched_bowler_id == null}
                          onChange={(e) =>
                            setScanChecked((prev) => ({ ...prev, [i]: e.target.checked }))
                          }
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="py-1.5 pr-3 text-slate-700">{m.name}</td>
                      <td className="py-1.5 pr-3">
                        {m.matched_name ? (
                          <span className="text-emerald-700 font-medium">{m.matched_name}</span>
                        ) : (
                          <span className="text-slate-400 italic">No match</span>
                        )}
                      </td>
                      <td className="py-1.5 text-right num font-medium text-slate-800">{m.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <button
                className="btn-primary btn-sm"
                onClick={applySelectedScanScores}
                disabled={!Object.values(scanChecked).some(Boolean)}
              >
                Apply Selected Scores
              </button>
            </div>
          </div>
        )}

        {/* Score entry table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500">
                <th className="text-left px-4 py-2.5 font-medium">Bowler Name</th>
                <th className="text-center px-3 py-2.5 font-medium">Hdcp</th>
                <th className="text-center px-3 py-2.5 font-medium">Raw Score</th>
                <th className="text-center px-3 py-2.5 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {bowlers.map((b) => {
                const committed = getCommitted(b.id, game)
                const inputVal = getInput(b.id, game)
                const displayRaw = getDisplayRaw(b.id, game)
                const hasInput = inputVal !== ''
                const hasScore = committed !== undefined || hasInput
                const total =
                  displayRaw !== undefined ? displayRaw + (b.handicap ?? 0) : undefined
                const cellClass = hasScore ? 'score-cell-entered' : 'score-cell-pending'
                const inputKey = `${b.id}-${game}`

                return (
                  <tr
                    key={b.id}
                    className={`border-b border-slate-100 last:border-0 ${cellClass}`}
                  >
                    <td className="px-4 py-2 font-medium text-slate-900">{b.name}</td>
                    <td className="px-3 py-2 text-center num text-slate-500">
                      {b.handicap ?? 0}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {canEdit ? (
                        <input
                          type="number"
                          min={0}
                          max={300}
                          placeholder={committed !== undefined ? String(committed) : '—'}
                          value={inputVal}
                          onChange={(e) =>
                            setScoreInputs((prev) => ({ ...prev, [inputKey]: e.target.value }))
                          }
                          className="input w-20 text-center py-1 num"
                        />
                      ) : (
                        <span className={`num font-medium ${committed !== undefined ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {committed !== undefined ? committed : '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center num font-semibold text-slate-700">
                      {total !== undefined ? total : '—'}
                    </td>
                  </tr>
                )
              })}
              {bowlers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400 text-sm">
                    No bowlers added to this session yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Save button */}
        {canEdit && (
          <div className="px-4 py-3 border-t border-slate-200 flex items-center gap-3">
            <button
              className="btn-primary"
              onClick={handleSave}
              disabled={saving || !hasChanges}
            >
              {saving ? 'Saving…' : 'Save Scores'}
            </button>
            {hasChanges && (
              <span className="text-xs text-slate-500">
                {inputsForGame.length} unsaved change{inputsForGame.length !== 1 ? 's' : ''}
              </span>
            )}
            {saveError && (
              <span className="text-xs text-red-600">{saveError}</span>
            )}
          </div>
        )}
      </div>
    )
  }

  function renderSubmissionsTab() {
    if (subsLoading) {
      return (
        <div className="card p-8 text-center text-slate-400 text-sm">Loading submissions…</div>
      )
    }
    if (subsError) {
      return (
        <div className="card p-6">
          <p className="text-sm text-red-600 mb-3">{subsError}</p>
          <button className="btn-secondary btn-sm" onClick={loadSubmissions}>Retry</button>
        </div>
      )
    }

    const pending = subs.filter((s) => s.status === 'pending')
    const others = subs.filter((s) => s.status !== 'pending')

    return (
      <div className="space-y-4">
        {/* Accept All */}
        {canEdit && pending.length > 0 && (
          <div className="flex justify-end">
            <button
              className="btn-success"
              onClick={handleApproveAll}
              disabled={approvingAll}
            >
              {approvingAll ? 'Approving…' : `Accept All (${pending.length})`}
            </button>
          </div>
        )}

        {subs.length === 0 && (
          <div className="card p-8 text-center text-slate-400 text-sm">No submissions found.</div>
        )}

        {/* Pending */}
        {pending.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800 text-sm">Pending ({pending.length})</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {pending.map((sub) => renderSubmissionRow(sub))}
            </div>
          </div>
        )}

        {/* Resolved */}
        {others.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800 text-sm text-slate-500">Resolved ({others.length})</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {others.map((sub) => renderSubmissionRow(sub))}
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderSubmissionRow(sub: Submission) {
    const submittedAt = new Date(sub.submitted_at).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })
    const bowlerName = sub.bowler?.name ?? 'Unknown Bowler'
    const statusBadge =
      sub.status === 'pending'
        ? <span className="badge-yellow">Pending</span>
        : sub.status === 'approved'
        ? <span className="badge-green">Approved</span>
        : <span className="badge-red">Rejected</span>

    return (
      <div key={sub.id} className="px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-medium text-slate-800 text-sm">{bowlerName}</span>
              <span className="badge-blue">Game {sub.game}</span>
              {statusBadge}
              <span className="text-xs text-slate-400">{submittedAt}</span>
            </div>
            {sub.extracted_data && sub.extracted_data.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {sub.extracted_data.map((d, i) => (
                  <span key={i} className="badge-slate num">
                    {d.matched_name ?? d.name}: <strong>{d.score}</strong>
                  </span>
                ))}
              </div>
            )}
          </div>
          {canEdit && sub.status === 'pending' && (
            <div className="flex gap-2 shrink-0">
              <button
                className="btn-success btn-sm"
                onClick={() => handleApprove(sub.id)}
              >
                Approve
              </button>
              <button
                className="btn-danger btn-sm"
                onClick={() => handleReject(sub.id)}
              >
                Reject
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  function renderScoreSummaryGrid() {
    if (bowlers.length === 0) return null
    return (
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800 text-sm">Score Summary</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500">
                <th className="text-left px-4 py-2 font-medium">Bowler</th>
                <th className="text-center px-3 py-2 font-medium">G1</th>
                <th className="text-center px-3 py-2 font-medium">G2</th>
                <th className="text-center px-3 py-2 font-medium">G3</th>
                <th className="text-center px-3 py-2 font-medium">Series</th>
              </tr>
            </thead>
            <tbody>
              {bowlers.map((b) => {
                const g1 = getCommitted(b.id, 1)
                const g2 = getCommitted(b.id, 2)
                const g3 = getCommitted(b.id, 3)
                const series =
                  g1 !== undefined && g2 !== undefined && g3 !== undefined
                    ? g1 + g2 + g3
                    : undefined
                const hasSome = g1 !== undefined || g2 !== undefined || g3 !== undefined

                return (
                  <tr key={b.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-800">{b.name}</td>
                    {([g1, g2, g3] as (number | undefined)[]).map((g, idx) => (
                      <td key={idx} className="px-3 py-2 text-center">
                        <span className={`num font-medium ${g !== undefined ? 'text-emerald-700' : 'text-slate-300'}`}>
                          {g !== undefined ? g : '—'}
                        </span>
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center">
                      <span className={`num font-semibold ${series !== undefined ? 'text-slate-900' : hasSome ? 'text-slate-400' : 'text-slate-300'}`}>
                        {series !== undefined ? series : '—'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ── Tab bar ───────────────────────────────────────────────────────────────

  const gameTabs: (1 | 2 | 3)[] = [1, 2, 3]

  return (
    <div className="space-y-5">
      {/* Tab navigation */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Score tabs">
          {gameTabs.map((g) => {
            const { allEntered, entered, total } = gameProgress(g)
            const isActive = activeTab === g
            return (
              <button
                key={g}
                onClick={() => setActiveTab(g)}
                className={`px-4 py-2.5 text-sm whitespace-nowrap flex items-center gap-2 transition-colors ${
                  isActive ? 'tab-active' : 'tab-inactive'
                }`}
              >
                <span>{GAME_LABELS[g]}</span>
                {allEntered && total > 0 ? (
                  <span className="badge-green">Complete</span>
                ) : entered > 0 ? (
                  <span className="badge-yellow num">{entered}/{total}</span>
                ) : null}
              </button>
            )
          })}
          {/* Submissions tab */}
          <button
            onClick={() => setActiveTab('submissions')}
            className={`px-4 py-2.5 text-sm whitespace-nowrap flex items-center gap-2 transition-colors ${
              activeTab === 'submissions' ? 'tab-active' : 'tab-inactive'
            }`}
          >
            <span>Pending Submissions</span>
            {pendingCount > 0 && (
              <span className="badge-yellow num">{pendingCount}</span>
            )}
          </button>
        </nav>
      </div>

      {/* Read-only notice */}
      {!canEdit && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800">
          You have read-only access to scores for this session.
        </div>
      )}

      {/* Tab content */}
      {activeTab !== 'submissions' ? (
        <div className="space-y-5">
          {renderScoreGrid(activeTab)}
          {renderScoreSummaryGrid()}
        </div>
      ) : (
        renderSubmissionsTab()
      )}
    </div>
  )
}
