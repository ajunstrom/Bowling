import { useState, useRef } from 'react'
import { api, scanScoresheet } from '../../lib/api'

interface Props {
  session: any
  bowlers: any[]
  scores: any[]
  sessionId: string
  onRefresh: () => void
}

export default function EnterScores({ session, bowlers, scores, sessionId, onRefresh }: Props) {
  const [game, setGame] = useState(1)
  const [scoreInputs, setScoreInputs] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<any>(null)
  const [submissions, setSubmissions] = useState<any[]>([])
  const [showSubmissions, setShowSubmissions] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getScore = (bowlerId: string, g: number) =>
    scores.find(s => s.bowler_id === bowlerId && s.game === g)?.raw_score

  const scoreMap = Object.fromEntries(
    scores.map(s => [`${s.bowler_id}-${s.game}`, s.raw_score])
  )

  async function saveScores() {
    const toSave = Object.entries(scoreInputs)
      .filter(([, v]) => v !== '' && !isNaN(parseInt(v)))
      .map(([key, v]) => {
        const [bowler_id] = key.split(`-game${game}`)
        return { bowler_id, game, raw_score: parseInt(v) }
      })
    if (toSave.length === 0) return

    setSaving(true)
    try {
      await api.scores.submit(sessionId, toSave)
      setScoreInputs({})
      onRefresh()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setScanning(true)
    setScanResult(null)
    try {
      const result = await scanScoresheet(sessionId, game, file)
      setScanResult(result)
      // Pre-populate score inputs from scan
      const inputs: Record<string, string> = {}
      for (const m of result.matched) {
        inputs[`${m.bowler_id}-game${game}`] = String(m.score)
      }
      setScoreInputs(prev => ({ ...prev, ...inputs }))
    } catch (e: any) {
      alert(`Scan failed: ${e.message}`)
    } finally {
      setScanning(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function loadSubmissions() {
    const subs = await api.scores.submissions(sessionId)
    setSubmissions(subs.filter((s: any) => s.status === 'pending'))
    setShowSubmissions(true)
  }

  async function approveSubmission(sid: string) {
    await api.scores.approveSubmission(sessionId, sid)
    setSubmissions(prev => prev.filter(s => s.id !== sid))
    onRefresh()
  }

  async function rejectSubmission(sid: string) {
    await api.scores.rejectSubmission(sessionId, sid)
    setSubmissions(prev => prev.filter(s => s.id !== sid))
  }

  const gamesComplete = [1, 2, 3].map(g => {
    const scored = bowlers.filter(b => scoreMap[`${b.id}-${g}`] !== undefined).length
    return { game: g, scored, total: bowlers.length, complete: scored === bowlers.length && bowlers.length > 0 }
  })

  return (
    <div className="space-y-6">
      {/* Game status */}
      <div className="grid grid-cols-3 gap-3">
        {gamesComplete.map(({ game: g, scored, total, complete }) => (
          <div
            key={g}
            onClick={() => setGame(g)}
            className={`card p-4 cursor-pointer transition-all ${game === g ? 'border-blue-500' : ''}`}
          >
            <div className="text-sm font-medium text-slate-400">Game {g}</div>
            <div className={`text-2xl font-bold ${complete ? 'text-green-400' : scored > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
              {scored}/{total}
            </div>
            <div className="text-xs text-slate-500">{complete ? '✓ Complete' : scored > 0 ? 'In Progress' : 'Not Started'}</div>
          </div>
        ))}
      </div>

      {/* Score Entry for selected game */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h3 className="font-semibold text-white">Game {game} Scores</h3>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleScan}
            />
            <button
              className="btn-secondary btn-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={scanning}
            >
              {scanning ? 'Scanning...' : '📷 AI Scan'}
            </button>
            <button
              className="btn-secondary btn-sm"
              onClick={loadSubmissions}
            >
              📋 Submissions
            </button>
          </div>
        </div>

        {/* Scan result */}
        {scanResult && (
          <div className="p-4 bg-blue-900/20 border-b border-blue-800">
            <div className="text-sm font-medium text-blue-300 mb-2">
              AI detected {scanResult.matched.length} score{scanResult.matched.length !== 1 ? 's' : ''}
            </div>
            <div className="text-xs text-slate-400">Scores pre-filled below. Review and save.</div>
            <button className="text-xs text-slate-500 mt-1" onClick={() => setScanResult(null)}>Dismiss</button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-xs">
                <th className="text-left p-3">Bowler</th>
                <th className="text-center p-3">Hdcp</th>
                <th className="text-center p-3">Current Score</th>
                <th className="text-center p-3">Enter Score</th>
                <th className="text-center p-3">Hdcp Score</th>
              </tr>
            </thead>
            <tbody>
              {bowlers.map(bowler => {
                const existing = scoreMap[`${bowler.id}-${game}`]
                const inputKey = `${bowler.id}-game${game}`
                const inputVal = scoreInputs[inputKey]
                const displayScore = inputVal !== undefined ? parseInt(inputVal) || 0 : existing
                return (
                  <tr key={bowler.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                    <td className="p-3 font-medium text-white">{bowler.name}</td>
                    <td className="text-center p-3 text-slate-400">{bowler.handicap}</td>
                    <td className="text-center p-3">
                      {existing !== undefined ? (
                        <span className="text-green-400 font-medium">{existing}</span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="text-center p-3">
                      <input
                        className="input py-1 w-20 text-center"
                        type="number"
                        min="0"
                        max="300"
                        placeholder={existing !== undefined ? String(existing) : '—'}
                        value={inputVal || ''}
                        onChange={e => setScoreInputs(prev => ({ ...prev, [inputKey]: e.target.value }))}
                      />
                    </td>
                    <td className="text-center p-3 text-slate-400">
                      {displayScore !== undefined ? displayScore + bowler.handicap : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-700">
          <button
            className="btn-primary"
            onClick={saveScores}
            disabled={saving || Object.keys(scoreInputs).length === 0}
          >
            {saving ? 'Saving...' : 'Save Scores'}
          </button>
        </div>
      </div>

      {/* Pending Submissions */}
      {showSubmissions && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h3 className="font-semibold text-white">Pending Bowler Submissions</h3>
            <button className="btn-secondary btn-sm" onClick={() => setShowSubmissions(false)}>Close</button>
          </div>
          {submissions.length === 0 ? (
            <div className="p-6 text-center text-slate-500">No pending submissions</div>
          ) : (
            submissions.map(sub => (
              <div key={sub.id} className="p-4 border-b border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-white">Game {sub.game} — Submitted {new Date(sub.submitted_at).toLocaleTimeString()}</div>
                  <div className="flex gap-2">
                    <button className="btn-success btn-sm" onClick={() => approveSubmission(sub.id)}>✓ Accept</button>
                    <button className="btn-danger btn-sm" onClick={() => rejectSubmission(sub.id)}>✕ Reject</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sub.extracted_data.map((d: any, i: number) => (
                    <span key={i} className="badge badge-slate">
                      {d.bowler_name || d.name}: <strong>{d.score}</strong>
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Full score grid */}
      {scores.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h3 className="font-semibold text-white">All Scores</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-xs">
                  <th className="text-left p-3">Bowler</th>
                  <th className="text-center p-3">Hdcp</th>
                  <th className="text-center p-3">Game 1</th>
                  <th className="text-center p-3">Game 2</th>
                  <th className="text-center p-3">Game 3</th>
                  <th className="text-center p-3">Series</th>
                  <th className="text-center p-3">Hdcp Series</th>
                </tr>
              </thead>
              <tbody>
                {bowlers.map(b => {
                  const g1 = scoreMap[`${b.id}-1`]
                  const g2 = scoreMap[`${b.id}-2`]
                  const g3 = scoreMap[`${b.id}-3`]
                  const series = (g1 || 0) + (g2 || 0) + (g3 || 0)
                  const hdcpSeries = series + 3 * b.handicap
                  return (
                    <tr key={b.id} className="border-b border-slate-700/50">
                      <td className="p-3 font-medium text-white">{b.name}</td>
                      <td className="text-center p-3 text-slate-400">{b.handicap}</td>
                      {[g1, g2, g3].map((g, i) => (
                        <td key={i} className={`text-center p-3 ${g !== undefined ? 'text-white' : 'text-slate-600'}`}>
                          {g !== undefined ? g : '—'}
                        </td>
                      ))}
                      <td className="text-center p-3 font-medium text-white">{series > 0 ? series : '—'}</td>
                      <td className="text-center p-3 text-slate-400">{series > 0 ? hdcpSeries : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
