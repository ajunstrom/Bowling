import { useState } from 'react'

interface Props {
  data: any
}

export default function MyContests({ data }: Props) {
  const { bowler, myBrackets, contestResults, contestTypes } = data
  const [expanded, setExpanded] = useState<string | null>(null)

  const scoresByBowler: Record<string, any> = {}
  for (const s of data.allScores || []) {
    if (!scoresByBowler[s.bowler_id]) scoresByBowler[s.bowler_id] = {}
    scoresByBowler[s.bowler_id][`game${s.game}`] = s.raw_score
  }
  const myScores = scoresByBowler[bowler.id] || {}
  const mySeries = (myScores.game1 || 0) + (myScores.game2 || 0) + (myScores.game3 || 0)

  return (
    <div className="space-y-4">
      {/* Brackets */}
      {myBrackets.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <div className="font-semibold text-white">Brackets</div>
            <div className="text-sm text-slate-400">{myBrackets.length} bracket slot{myBrackets.length !== 1 ? 's' : ''}</div>
          </div>
          {myBrackets.map((bracket: any) => (
            <div key={bracket.id} className="border-b border-slate-700/50">
              <button
                className="w-full p-4 flex items-center justify-between text-left"
                onClick={() => setExpanded(expanded === `bracket-${bracket.id}` ? null : `bracket-${bracket.id}`)}
              >
                <div className="font-medium text-white">Bracket #{bracket.bracket_number}</div>
                <span className="text-slate-400">{expanded === `bracket-${bracket.id}` ? '▲' : '▼'}</span>
              </button>

              {expanded === `bracket-${bracket.id}` && (
                <div className="border-t border-slate-700/50 p-4 space-y-4">
                  {(['handicap', 'scratch'] as const).map(mode => {
                    const matches = (bracket.matches[mode] || []).filter(
                      (m: any) => m.bowler1_id === bowler.id || m.bowler2_id === bowler.id
                    )
                    const final = (bracket.matches[mode] || []).find((m: any) => m.round === 3)
                    const isWinner = final?.winner_id === bowler.id

                    return (
                      <div key={mode}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`badge ${mode === 'handicap' ? 'badge-blue' : 'badge-slate'}`}>
                            {mode === 'handicap' ? 'Handicap' : 'Scratch'}
                          </span>
                          {isWinner && <span className="text-yellow-400 text-sm">🏆 Champion!</span>}
                        </div>
                        <div className="space-y-1">
                          {matches.map((match: any) => {
                            const isB1 = match.bowler1_id === bowler.id
                            const myScore = isB1 ? match.score1 : match.score2
                            const oppScore = isB1 ? match.score2 : match.score1
                            const opp = isB1 ? match.bowler2 : match.bowler1
                            const won = match.winner_id === bowler.id
                            const lost = match.winner_id && match.winner_id !== bowler.id

                            return (
                              <div key={match.id} className={`text-sm p-2 rounded ${won ? 'bg-green-900/20' : lost ? 'bg-red-900/20' : 'bg-slate-700/20'}`}>
                                <div className="flex justify-between items-center">
                                  <span className="text-slate-400">Round {match.round} vs {opp?.name || '?'}</span>
                                  {match.winner_id && (
                                    <span className={`text-xs font-medium ${won ? 'text-green-400' : 'text-red-400'}`}>
                                      {won ? '✓ Win' : '✗ Loss'}
                                    </span>
                                  )}
                                </div>
                                {myScore !== null && myScore !== undefined && (
                                  <div className="text-xs text-slate-400 mt-0.5">
                                    You: {myScore} — {opp?.name}: {oppScore}
                                    {won && oppScore !== null && (
                                      <span className="text-green-400 ml-1">(+{myScore - oppScore} pins)</span>
                                    )}
                                    {lost && myScore !== null && (
                                      <span className="text-red-400 ml-1">(-{oppScore - myScore} pins)</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Eliminator */}
      {contestTypes.includes('eliminator') && contestResults?.eliminator && (
        <div className="card overflow-hidden">
          <button
            className="w-full p-4 flex items-center justify-between text-left"
            onClick={() => setExpanded(expanded === 'eliminator' ? null : 'eliminator')}
          >
            <div>
              <div className="font-semibold text-white">Eliminator</div>
              <div className="text-sm text-slate-400">
                {getEliminatorStatus(bowler.id, contestResults.eliminator)}
              </div>
            </div>
            <span className="text-slate-400">{expanded === 'eliminator' ? '▲' : '▼'}</span>
          </button>

          {expanded === 'eliminator' && (
            <div className="border-t border-slate-700 p-4 space-y-3">
              {/* Payout structure */}
              <div className="flex gap-2">
                {contestResults.eliminator.payouts.map((p: any) => (
                  <span key={p.place} className="badge badge-green">{ordinal(p.place)}: ${p.amount.toFixed(2)}</span>
                ))}
              </div>

              {/* My journey */}
              {[1, 2].map(g => {
                const score = myScores[`game${g}`]
                const eliminated = isEliminatedAfter(bowler.id, g, contestResults.eliminator)
                const survived = !eliminated && score !== undefined
                return (
                  <div key={g} className={`text-sm p-3 rounded ${eliminated ? 'bg-red-900/20' : survived ? 'bg-green-900/20' : 'bg-slate-700/20'}`}>
                    <div className="flex justify-between">
                      <span className="font-medium text-white">Game {g}</span>
                      {eliminated ? (
                        <span className="text-red-400 text-xs">Eliminated</span>
                      ) : survived ? (
                        <span className="text-green-400 text-xs">Survived ✓</span>
                      ) : (
                        <span className="text-slate-500 text-xs">Awaiting</span>
                      )}
                    </div>
                    {score !== undefined && (
                      <div className="text-slate-400 text-xs mt-0.5">Score: {score}</div>
                    )}
                  </div>
                )
              })}

              {/* G3 finalists */}
              {contestResults.eliminator.finalists.length > 0 && (
                <div>
                  <div className="text-xs text-slate-400 mb-2">Game 3 Finalists</div>
                  <div className="space-y-1">
                    {contestResults.eliminator.finalists.map((f: any, i: number) => (
                      <div key={f.bowler_id} className={`flex justify-between text-sm ${f.bowler_id === bowler.id ? 'text-white font-medium' : 'text-slate-400'}`}>
                        <span>{i + 1}. {f.bowler?.name || f.name}</span>
                        <span>{f.g3 ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* High Game */}
      {contestTypes.includes('high_game') && contestResults?.high_game && (
        <div className="card overflow-hidden">
          <button
            className="w-full p-4 flex items-center justify-between text-left"
            onClick={() => setExpanded(expanded === 'high_game' ? null : 'high_game')}
          >
            <div>
              <div className="font-semibold text-white">High Game Pot</div>
              <div className="text-sm text-slate-400">
                ${contestResults.high_game.perGamePot.toFixed(2)} per game
              </div>
            </div>
            <span className="text-slate-400">{expanded === 'high_game' ? '▲' : '▼'}</span>
          </button>

          {expanded === 'high_game' && (
            <div className="border-t border-slate-700 p-4 space-y-2">
              {contestResults.high_game.games.map((game: any) => {
                const myScore = myScores[`game${game.game}`]
                const myRank = myScore !== undefined
                  ? game.scores.findIndex((s: any) => s.bowler.id === bowler.id) + 1
                  : null
                const isWinner = game.leader?.bowler?.id === bowler.id
                const pinsShort = game.leader && myScore !== undefined && !isWinner
                  ? game.leader.score - myScore : null

                return (
                  <div key={game.game} className={`text-sm p-3 rounded ${isWinner ? 'bg-yellow-900/20' : 'bg-slate-700/20'}`}>
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-white">Game {game.game} — ${game.pot.toFixed(2)}</span>
                      {isWinner && <span className="text-yellow-400">🏆 Winner!</span>}
                    </div>
                    {myScore !== undefined ? (
                      <div className="text-slate-400 text-xs mt-1">
                        Your score: <span className="text-white">{myScore}</span>
                        {myRank && <span className="ml-2">Rank: {myRank}/{game.scores.length}</span>}
                        {pinsShort !== null && pinsShort > 0 && (
                          <span className="text-red-400 ml-2">({pinsShort} pins short)</span>
                        )}
                      </div>
                    ) : (
                      <div className="text-slate-500 text-xs mt-1">Awaiting score</div>
                    )}
                    {game.leader && !isWinner && (
                      <div className="text-xs text-slate-500 mt-0.5">
                        Leader: {game.leader.bowler.name} — {game.leader.score}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* High Series */}
      {contestTypes.includes('high_series') && contestResults?.high_series && (
        <div className="card overflow-hidden">
          <button
            className="w-full p-4 flex items-center justify-between text-left"
            onClick={() => setExpanded(expanded === 'high_series' ? null : 'high_series')}
          >
            <div>
              <div className="font-semibold text-white">High Series</div>
              <div className="text-sm text-slate-400">
                My series: {mySeries || '—'}
              </div>
            </div>
            <span className="text-slate-400">{expanded === 'high_series' ? '▲' : '▼'}</span>
          </button>

          {expanded === 'high_series' && (
            <div className="border-t border-slate-700 p-4">
              <div className="flex gap-2 mb-3">
                <span className="badge badge-green">1st: ${contestResults.high_series.first.toFixed(2)}</span>
                <span className="badge badge-blue">2nd: ${contestResults.high_series.second.toFixed(2)}</span>
              </div>
              <div className="space-y-1">
                {contestResults.high_series.leaderboard.map((entry: any, i: number) => {
                  const isMe = entry.bowler?.id === bowler.id
                  return (
                    <div
                      key={entry.bowler?.id}
                      className={`flex items-center gap-2 text-sm py-1 px-2 rounded ${isMe ? 'bg-blue-900/30 border border-blue-700' : ''}`}
                    >
                      <span className="text-slate-400 w-4">{i + 1}.</span>
                      <span className={`flex-1 ${isMe ? 'text-white font-medium' : i < 2 ? 'text-white' : 'text-slate-400'}`}>
                        {entry.bowler?.name} {isMe && '(You)'}
                      </span>
                      <span className={`font-bold ${i === 0 ? 'text-yellow-300' : i === 1 ? 'text-blue-300' : isMe ? 'text-white' : 'text-slate-400'}`}>
                        {entry.series}
                      </span>
                    </div>
                  )
                })}
              </div>
              {mySeries > 0 && (() => {
                const myRank = contestResults.high_series.leaderboard.findIndex((e: any) => e.bowler?.id === bowler.id)
                const paidPos = 2
                if (myRank >= paidPos) {
                  const leader = contestResults.high_series.leaderboard[paidPos - 1]
                  const pinsBack = leader ? leader.series - mySeries : 0
                  if (pinsBack > 0) return (
                    <div className="text-xs text-slate-400 mt-2">
                      You're {pinsBack} pins behind a money position
                    </div>
                  )
                }
                return null
              })()}
            </div>
          )}
        </div>
      )}

      {/* Mystery Doubles */}
      {contestTypes.includes('mystery_doubles') && contestResults?.mystery_doubles && (
        <div className="card overflow-hidden">
          <button
            className="w-full p-4 flex items-center justify-between text-left"
            onClick={() => setExpanded(expanded === 'mystery_doubles' ? null : 'mystery_doubles')}
          >
            <div>
              <div className="font-semibold text-white">Mystery Doubles</div>
              <div className="text-sm text-slate-400">
                {getMyPartner(bowler.id, contestResults.mystery_doubles)}
              </div>
            </div>
            <span className="text-slate-400">{expanded === 'mystery_doubles' ? '▲' : '▼'}</span>
          </button>

          {expanded === 'mystery_doubles' && (
            <div className="border-t border-slate-700 p-4 space-y-3">
              {getMyPair(bowler.id, contestResults.mystery_doubles) ? (() => {
                const pair = getMyPair(bowler.id, contestResults.mystery_doubles)!
                const partner = pair.bowler1?.id === bowler.id ? pair.bowler2 : pair.bowler1
                const partnerScores = pair.bowler1?.id === bowler.id ? pair.scores2 : pair.scores1
                const myScoresInPair = pair.bowler1?.id === bowler.id ? pair.scores1 : pair.scores2
                const isWinner = contestResults.mystery_doubles.pairs[0]?.id === pair.id && pair.combinedSeries > 0

                return (
                  <div>
                    {isWinner && (
                      <div className="badge badge-green mb-3">🏆 Winning Pair! ${contestResults.mystery_doubles.pairPrize.toFixed(2)} each</div>
                    )}
                    <div className="text-sm font-medium text-white mb-2">Partner: {partner?.name}</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="card p-2">
                        <div className="text-xs text-slate-400 mb-1">You</div>
                        {[1, 2, 3].map(g => (
                          <div key={g} className="flex justify-between">
                            <span className="text-slate-400">G{g}:</span>
                            <span className="text-white">{myScoresInPair?.[`game${g}`] ?? '—'}</span>
                          </div>
                        ))}
                        <div className="border-t border-slate-600 mt-1 pt-1 flex justify-between font-medium">
                          <span className="text-slate-400">Total:</span>
                          <span className="text-white">{myScoresInPair?.series || 0}</span>
                        </div>
                      </div>
                      <div className="card p-2">
                        <div className="text-xs text-slate-400 mb-1">{partner?.name}</div>
                        {[1, 2, 3].map(g => (
                          <div key={g} className="flex justify-between">
                            <span className="text-slate-400">G{g}:</span>
                            <span className="text-white">{partnerScores?.[`game${g}`] ?? '—'}</span>
                          </div>
                        ))}
                        <div className="border-t border-slate-600 mt-1 pt-1 flex justify-between font-medium">
                          <span className="text-slate-400">Total:</span>
                          <span className="text-white">{partnerScores?.series || 0}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-center text-white font-bold mt-2">
                      Combined: {pair.combinedSeries}
                    </div>

                    {/* Standings */}
                    <div className="mt-3 space-y-1">
                      {contestResults.mystery_doubles.pairs.map((p: any, i: number) => {
                        const isMyPair = p.id === pair.id
                        return (
                          <div key={p.id} className={`flex justify-between text-xs ${isMyPair ? 'text-white font-medium' : 'text-slate-400'}`}>
                            <span>{i + 1}. {p.bowler1?.name} & {p.bowler2?.name} {isMyPair && '(You)'}</span>
                            <span>{p.combinedSeries}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })() : (
                <div className="text-slate-500 text-sm">Pairs haven't been drawn yet.</div>
              )}
            </div>
          )}
        </div>
      )}

      {contestTypes.length === 0 && myBrackets.length === 0 && (
        <div className="card p-8 text-center text-slate-500">
          You haven't entered any contests for this session.
        </div>
      )}
    </div>
  )
}

function getEliminatorStatus(bowlerId: string, elim: any): string {
  if (!elim) return ''
  const inFinals = elim.finalists.some((f: any) => f.bowler_id === bowlerId)
  const elimAfterG1 = elim.eliminatedAfterG1.some((e: any) => e.bowler_id === bowlerId)
  const elimAfterG2 = elim.eliminatedAfterG2.some((e: any) => e.bowler_id === bowlerId)
  if (inFinals) return '🎯 Game 3 Finalist'
  if (elimAfterG2) return 'Eliminated after Game 2'
  if (elimAfterG1) return 'Eliminated after Game 1'
  return 'Still in — Awaiting scores'
}

function isEliminatedAfter(bowlerId: string, game: number, elim: any): boolean {
  if (game === 1) return elim.eliminatedAfterG1.some((e: any) => e.bowler_id === bowlerId)
  if (game === 2) return elim.eliminatedAfterG2.some((e: any) => e.bowler_id === bowlerId)
  return false
}

function getMyPartner(bowlerId: string, doubles: any): string {
  const pair = getMyPair(bowlerId, doubles)
  if (!pair) return 'Awaiting draw'
  const partner = pair.bowler1?.id === bowlerId ? pair.bowler2 : pair.bowler1
  return `Partner: ${partner?.name}`
}

function getMyPair(bowlerId: string, doubles: any) {
  return doubles.pairs.find((p: any) => p.bowler1_id === bowlerId || p.bowler2_id === bowlerId) || null
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
