'use client'

// ─── Helpers ────────────────────────────────────────────────────────────────

function sign(n: number) {
  return n >= 0 ? `+${n}` : `${n}`
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export default function MyScores({ data }: { data: any }) {
  const bowler = data?.bowler
  const scores: any[] = data?.scores ?? []
  const allScores: any[] = data?.allScores ?? []
  const bowlers: any[] = data?.bowlers ?? []
  const handicap: number = bowler?.handicap ?? 0

  // Build per-game scorecard
  const games = [1, 2, 3] as const
  const gameRows = games.map((g) => {
    const s = scores.find((sc: any) => sc.game === g)
    const raw = s?.raw_score ?? null
    const hdcp = raw !== null ? handicap : null
    const total = raw !== null && hdcp !== null ? raw + hdcp : null
    return { game: g, raw, hdcp, total }
  })

  const rawSeries = gameRows.reduce((sum, r) => sum + (r.raw ?? 0), 0)
  const hdcpSeries = gameRows.reduce((sum, r) => sum + (r.total ?? r.raw ?? 0), 0)
  const hasAnyScore = gameRows.some((r) => r.raw !== null)

  // Build full field leaderboard by handicap series
  interface LeaderEntry {
    bowlerId: number
    name: string
    raw: number[]
    hdcp: number
    rawSeries: number
    hdcpSeries: number
  }

  const leaderboard: LeaderEntry[] = bowlers.map((b: any) => {
    const bScores = allScores.filter((s: any) => s.bowler_id === b.id)
    const raw = games.map((g) => {
      const found = bScores.find((s: any) => s.game === g)
      return found?.raw_score ?? 0
    })
    const rs = raw.reduce((a, c) => a + c, 0)
    const hs = rs + b.handicap * raw.filter((r) => r > 0).length
    // Use handicap per game (not per series) — apply handicap to each game played
    const hdcpAdjusted = raw.map((r, i) => (r > 0 ? r + b.handicap : 0))
    const hdcpSer = hdcpAdjusted.reduce((a, c) => a + c, 0)
    return {
      bowlerId: b.id,
      name: b.name,
      raw,
      hdcp: b.handicap,
      rawSeries: rs,
      hdcpSeries: hdcpSer,
    }
  })

  const sorted = [...leaderboard].sort((a, b) => b.hdcpSeries - a.hdcpSeries)
  const myRank = sorted.findIndex((e) => e.bowlerId === bowler?.id) + 1

  return (
    <div className="space-y-4 pb-4">
      {/* ── Scorecard ── */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <h3 className="text-sm font-semibold text-white tracking-wide uppercase">
            My Scorecard
          </h3>
          {handicap > 0 && (
            <p className="text-xs text-slate-400 mt-0.5">
              Handicap:{' '}
              <span className="num font-bold text-blue-300">+{handicap}</span> per game
            </p>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="px-4 py-2 text-left text-slate-400 font-medium w-16">
                  Game
                </th>
                <th className="px-3 py-2 text-right text-slate-400 font-medium">
                  Raw
                </th>
                <th className="px-3 py-2 text-right text-slate-400 font-medium">
                  +Hdcp
                </th>
                <th className="px-3 py-2 text-right text-slate-400 font-medium pr-4">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {gameRows.map((row) => (
                <tr
                  key={row.game}
                  className="border-b border-slate-700/50 last:border-0"
                >
                  <td className="px-4 py-2.5 text-slate-400 font-medium">
                    G{row.game}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {row.raw !== null ? (
                      <span className="num font-bold text-white text-sm">
                        {row.raw}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {row.hdcp !== null ? (
                      <span className="num text-blue-300">+{row.hdcp}</span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right pr-4">
                    {row.total !== null ? (
                      <span className="num font-bold text-emerald-300 text-sm">
                        {row.total}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-600 bg-slate-700/40">
                <td className="px-4 py-2.5 text-slate-300 font-semibold text-xs uppercase tracking-wide">
                  Series
                </td>
                <td className="px-3 py-2.5 text-right">
                  {hasAnyScore ? (
                    <span className="num font-bold text-white">{rawSeries}</span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {hasAnyScore && handicap > 0 ? (
                    <span className="num text-blue-300">
                      +{hdcpSeries - rawSeries}
                    </span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right pr-4">
                  {hasAnyScore ? (
                    <span className="num font-bold text-emerald-300 text-base">
                      {hdcpSeries}
                    </span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Summary chips ── */}
      {hasAnyScore && (
        <div className="flex gap-2 flex-wrap">
          <div className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-center">
            <p className="text-xs text-slate-400 mb-0.5">Raw Series</p>
            <p className="num font-bold text-white text-lg">{rawSeries}</p>
          </div>
          {handicap > 0 && (
            <div className="flex-1 min-w-0 bg-slate-800 border border-blue-800 rounded-xl px-3 py-2 text-center">
              <p className="text-xs text-slate-400 mb-0.5">Hdcp Series</p>
              <p className="num font-bold text-emerald-300 text-lg">{hdcpSeries}</p>
            </div>
          )}
          {myRank > 0 && (
            <div className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-center">
              <p className="text-xs text-slate-400 mb-0.5">Rank</p>
              <p className="num font-bold text-blue-300 text-lg">
                #{myRank}
                <span className="text-xs text-slate-500 font-normal"> / {sorted.length}</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Full field leaderboard ── */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <h3 className="text-sm font-semibold text-white tracking-wide uppercase">
            Leaderboard
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Sorted by handicap series</p>
        </div>

        {sorted.length === 0 ? (
          <div className="px-4 py-6 text-center text-slate-500 text-sm">
            No scores entered yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50 max-h-96 overflow-y-auto">
            {sorted.map((entry, idx) => {
              const isMe = entry.bowlerId === bowler?.id
              const rank = idx + 1
              const gamesEntered = entry.raw.filter((r) => r > 0).length

              return (
                <div
                  key={entry.bowlerId}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs ${
                    isMe
                      ? 'bg-blue-900/40 border-l-2 border-blue-500'
                      : rank === 1
                      ? 'bg-amber-900/20'
                      : ''
                  }`}
                >
                  <span
                    className={`num w-5 text-center font-bold shrink-0 ${
                      rank === 1
                        ? 'text-amber-400'
                        : rank === 2
                        ? 'text-slate-300'
                        : rank === 3
                        ? 'text-amber-700'
                        : 'text-slate-500'
                    }`}
                  >
                    {rank}
                  </span>
                  <span
                    className={`flex-1 font-medium truncate ${
                      isMe ? 'text-blue-300' : 'text-slate-200'
                    }`}
                  >
                    {entry.name}
                    {isMe && (
                      <span className="ml-1 text-blue-400 font-normal">(you)</span>
                    )}
                  </span>
                  {gamesEntered > 0 ? (
                    <>
                      <span className="num text-slate-400 text-right shrink-0">
                        {entry.raw
                          .map((r, i) => (r > 0 ? r : '—'))
                          .join(' / ')}
                      </span>
                      <span className="num font-bold text-emerald-300 w-12 text-right shrink-0">
                        {entry.hdcpSeries}
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-600 num">—</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
