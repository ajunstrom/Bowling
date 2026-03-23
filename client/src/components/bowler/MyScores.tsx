interface Props {
  data: any
}

export default function MyScores({ data }: Props) {
  const { bowler, scores, bowlers, session } = data

  const myScores = scores.filter((s: any) => s.bowler_id === bowler.id)
  const game1 = myScores.find((s: any) => s.game === 1)?.raw_score ?? null
  const game2 = myScores.find((s: any) => s.game === 2)?.raw_score ?? null
  const game3 = myScores.find((s: any) => s.game === 3)?.raw_score ?? null

  const hdcp = bowler.handicap
  const h1 = game1 !== null ? game1 + hdcp : null
  const h2 = game2 !== null ? game2 + hdcp : null
  const h3 = game3 !== null ? game3 + hdcp : null
  const rawSeries = (game1 ?? 0) + (game2 ?? 0) + (game3 ?? 0)
  const hdcpSeries = rawSeries + hdcp * myScores.length

  // Build full-field leaderboard ranked by handicap series
  const leaderboard = bowlers
    .map((b: any) => {
      const bs = scores.filter((s: any) => s.bowler_id === b.id)
      const g1 = bs.find((s: any) => s.game === 1)?.raw_score ?? 0
      const g2 = bs.find((s: any) => s.game === 2)?.raw_score ?? 0
      const g3 = bs.find((s: any) => s.game === 3)?.raw_score ?? 0
      const raw = g1 + g2 + g3
      const gamesScored = bs.length
      const hs = raw + b.handicap * gamesScored
      return { ...b, g1, g2, g3, rawSeries: raw, hdcpSeries: hs, gamesScored }
    })
    .filter((b: any) => b.gamesScored > 0)
    .sort((a: any, b: any) => b.hdcpSeries - a.hdcpSeries)

  const myRank = leaderboard.findIndex((b: any) => b.id === bowler.id)

  const gamesPlayed = myScores.length

  return (
    <div className="space-y-5">
      {/* My Scorecard */}
      <div className="card p-4">
        <h2 className="text-base font-semibold text-white mb-3">My Scorecard</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs border-b border-slate-700">
                <th className="text-left py-2 pr-3">Game</th>
                <th className="text-right py-2 px-2">Raw</th>
                <th className="text-right py-2 px-2">+Hdcp</th>
                <th className="text-right py-2 pl-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {[
                { g: 1, raw: game1, total: h1 },
                { g: 2, raw: game2, total: h2 },
                { g: 3, raw: game3, total: h3 },
              ].map(({ g, raw, total }) => (
                <tr key={g} className="text-slate-300">
                  <td className="py-2 pr-3">Game {g}</td>
                  <td className="text-right py-2 px-2">
                    {raw !== null ? raw : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="text-right py-2 px-2 text-slate-500 text-xs">
                    {raw !== null ? `+${hdcp}` : ''}
                  </td>
                  <td className="text-right py-2 pl-2 font-medium text-white">
                    {total !== null ? total : <span className="text-slate-600">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-600">
              <tr>
                <td className="py-2 pr-3 text-xs text-slate-400">Series</td>
                <td className="text-right py-2 px-2 font-bold text-white">
                  {gamesPlayed > 0 ? rawSeries : '—'}
                </td>
                <td className="text-right py-2 px-2 text-slate-500 text-xs">
                  {gamesPlayed > 0 ? `+${hdcp * gamesPlayed}` : ''}
                </td>
                <td className="text-right py-2 pl-2 font-bold text-blue-400">
                  {gamesPlayed > 0 ? hdcpSeries : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-700 flex justify-between text-xs text-slate-400">
          <span>Handicap: <span className="text-white">{hdcp} pins/game</span></span>
          {gamesPlayed > 0 && myRank >= 0 && (
            <span>Standing: <span className="text-white">#{myRank + 1} of {leaderboard.length}</span></span>
          )}
        </div>
      </div>

      {/* Leaderboard */}
      {leaderboard.length > 0 ? (
        <div className="card p-4">
          <h2 className="text-base font-semibold text-white mb-3">
            Leaderboard
            <span className="text-xs font-normal text-slate-400 ml-2">(handicap series)</span>
          </h2>
          <div className="space-y-1">
            {leaderboard.map((b: any, idx: number) => {
              const isMe = b.id === bowler.id
              return (
                <div
                  key={b.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded text-sm ${
                    isMe ? 'bg-blue-900/40 ring-1 ring-blue-600/50' : 'hover:bg-slate-700/30'
                  }`}
                >
                  <span className={`w-6 text-center font-bold text-xs ${
                    idx === 0 ? 'text-yellow-400' :
                    idx === 1 ? 'text-slate-300' :
                    idx === 2 ? 'text-amber-600' :
                    'text-slate-500'
                  }`}>
                    {idx + 1}
                  </span>
                  <span className={`flex-1 ${isMe ? 'text-white font-medium' : 'text-slate-300'}`}>
                    {b.name}
                    {isMe && <span className="ml-1 text-xs text-blue-400">(you)</span>}
                  </span>
                  <div className="flex items-center gap-3 text-right">
                    <span className="text-slate-500 text-xs hidden sm:block">
                      {b.g1 || '—'} / {b.g2 || '—'} / {b.g3 || '—'}
                    </span>
                    <span className={`font-bold w-10 text-right ${isMe ? 'text-blue-400' : 'text-white'}`}>
                      {b.hdcpSeries}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="card p-8 text-center text-slate-500">
          No scores have been entered yet.
        </div>
      )}
    </div>
  )
}
