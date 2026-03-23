import { useState, useEffect } from 'react'
import { api } from '../../lib/api'

interface Props {
  session: any
  bowlers: any[]
  scores: any[]
  sessionId: string
  onRefresh: () => void
}

function BracketTree({ bracket, mode }: { bracket: any; mode: 'handicap' | 'scratch' }) {
  const matches = bracket.matches[mode] || []
  const r1 = matches.filter((m: any) => m.round === 1).sort((a: any, b: any) => a.match_position - b.match_position)
  const r2 = matches.filter((m: any) => m.round === 2).sort((a: any, b: any) => a.match_position - b.match_position)
  const r3 = matches.filter((m: any) => m.round === 3)

  const MatchBox = ({ match }: { match: any }) => (
    <div className="border border-slate-700 rounded-lg overflow-hidden text-xs w-44">
      {[{ bowler: match.bowler1, id: match.bowler1_id, score: match.score1 },
        { bowler: match.bowler2, id: match.bowler2_id, score: match.score2 }].map((side, i) => (
        <div
          key={i}
          className={`px-2 py-1 flex justify-between ${
            match.winner_id && match.winner_id === side.id ? 'bg-green-900/40 text-green-300' :
            match.winner_id && match.winner_id !== side.id ? 'text-slate-500' :
            'text-slate-300'
          } ${i === 0 ? 'border-b border-slate-700' : ''}`}
        >
          <span className="truncate">{side.bowler?.name || '—'}</span>
          <span className="font-medium ml-1">{side.score ?? ''}</span>
        </div>
      ))}
    </div>
  )

  return (
    <div className="overflow-x-auto">
      <div className="flex items-center gap-6 p-4 min-w-max">
        {/* Round 1 */}
        <div className="flex flex-col gap-6">
          <div className="text-xs text-slate-500 text-center mb-1">Round 1 (G1)</div>
          {r1.map((m: any) => <MatchBox key={m.id} match={m} />)}
        </div>
        <div className="text-slate-600">›</div>
        {/* Round 2 */}
        <div className="flex flex-col gap-6 mt-8">
          <div className="text-xs text-slate-500 text-center mb-1">Semis (G2)</div>
          {r2.map((m: any) => <MatchBox key={m.id} match={m} />)}
        </div>
        <div className="text-slate-600">›</div>
        {/* Final */}
        <div className="mt-14">
          <div className="text-xs text-slate-500 text-center mb-1">Final (G3)</div>
          {r3.map((m: any) => <MatchBox key={m.id} match={m} />)}
        </div>
        {/* Champion */}
        {r3[0]?.winner && (
          <div className="flex flex-col items-center ml-2">
            <div className="text-yellow-400 text-lg">🏆</div>
            <div className="text-yellow-300 text-xs font-medium text-center">{r3[0].winner.name}</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Contests({ session, sessionId, scores, onRefresh }: Props) {
  const [contests, setContests] = useState<any>(null)
  const [brackets, setBrackets] = useState<any[]>([])
  const [expandedBracket, setExpandedBracket] = useState<string | null>(null)
  const [expandedContest, setExpandedContest] = useState<string | null>(null)
  const [drawingDoubles, setDrawingDoubles] = useState(false)

  useEffect(() => {
    load()
  }, [scores, sessionId])

  async function load() {
    const [c, b] = await Promise.all([
      api.contests.results(sessionId),
      api.brackets.list(sessionId),
    ])
    setContests(c)
    setBrackets(b)
  }

  async function drawDoubles() {
    if (!confirm('This will randomly re-pair all Mystery Doubles entrants. Continue?')) return
    setDrawingDoubles(true)
    try {
      await api.contests.drawDoubles(sessionId)
      await load()
    } finally {
      setDrawingDoubles(false)
    }
  }

  const s = session.settings

  return (
    <div className="space-y-4">
      {/* Brackets */}
      <div className="card overflow-hidden">
        <button
          className="w-full p-4 flex items-center justify-between text-left"
          onClick={() => setExpandedContest(expandedContest === 'brackets' ? null : 'brackets')}
        >
          <div>
            <div className="font-semibold text-white">Brackets</div>
            <div className="text-sm text-slate-400">{brackets.length} bracket{brackets.length !== 1 ? 's' : ''} — Handicap & Scratch</div>
          </div>
          <span className="text-slate-400">{expandedContest === 'brackets' ? '▲' : '▼'}</span>
        </button>

        {expandedContest === 'brackets' && (
          <div className="border-t border-slate-700">
            {brackets.length === 0 ? (
              <div className="p-6 text-center text-slate-500">
                No brackets yet. Generate brackets in the Setup tab.
              </div>
            ) : (
              brackets.map(bracket => (
                <div key={bracket.id} className="border-b border-slate-700/50">
                  <button
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-700/30"
                    onClick={() => setExpandedBracket(expandedBracket === bracket.id ? null : bracket.id)}
                  >
                    <div className="font-medium text-white">Bracket #{bracket.bracket_number}</div>
                    <div className="flex items-center gap-3">
                      {bracket.matches.scratch.find((m: any) => m.round === 3 && m.winner) && (
                        <span className="text-xs text-yellow-400">🏆 {bracket.matches.scratch.find((m: any) => m.round === 3 && m.winner)?.winner?.name}</span>
                      )}
                      <span className="text-slate-400">{expandedBracket === bracket.id ? '▲' : '▼'}</span>
                    </div>
                  </button>

                  {expandedBracket === bracket.id && (
                    <div className="border-t border-slate-700/50">
                      {/* Participants */}
                      <div className="p-4 flex flex-wrap gap-2 border-b border-slate-700/50">
                        {bracket.slots.map((slot: any) => (
                          <span key={slot.id} className="badge badge-slate">{slot.bowler?.name}</span>
                        ))}
                      </div>

                      {/* Bracket trees */}
                      {(['handicap', 'scratch'] as const).map(mode => (
                        <div key={mode}>
                          <div className="px-4 pt-3 pb-1">
                            <span className={`badge ${mode === 'handicap' ? 'badge-blue' : 'badge-slate'}`}>
                              {mode === 'handicap' ? 'Handicap' : 'Scratch'}
                            </span>
                            {bracket.matches[mode].find((m: any) => m.round === 3 && m.winner) && (
                              <span className="ml-2 text-yellow-400 text-sm">
                                🏆 {bracket.matches[mode].find((m: any) => m.round === 3 && m.winner)?.winner?.name}
                                {' '}— Prize: ${(8 * (s.bracket_fee || 5) * (1 - (s.bracket_op_pct || 0.1))).toFixed(2)}
                              </span>
                            )}
                          </div>
                          <BracketTree bracket={bracket} mode={mode} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Eliminator */}
      {s.has_eliminator && (
        <div className="card overflow-hidden">
          <button
            className="w-full p-4 flex items-center justify-between text-left"
            onClick={() => setExpandedContest(expandedContest === 'eliminator' ? null : 'eliminator')}
          >
            <div>
              <div className="font-semibold text-white">Eliminator</div>
              <div className="text-sm text-slate-400">
                {contests?.eliminator?.entries || 0} entries · Prize pool: ${contests?.eliminator?.pool?.toFixed(2) || '0.00'}
              </div>
            </div>
            <span className="text-slate-400">{expandedContest === 'eliminator' ? '▲' : '▼'}</span>
          </button>

          {expandedContest === 'eliminator' && contests?.eliminator && (
            <div className="border-t border-slate-700 p-4 space-y-4">
              {/* Payout preview */}
              <div>
                <div className="text-xs text-slate-400 mb-2">Payout Structure</div>
                <div className="flex gap-3">
                  {contests.eliminator.payouts.map((p: any) => (
                    <div key={p.place} className="badge badge-green">
                      {ordinal(p.place)}: ${p.amount.toFixed(2)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Finalists */}
              {contests.eliminator.finalists.length > 0 && (
                <div>
                  <div className="text-xs text-slate-400 mb-2">Game 3 Finalists</div>
                  <div className="space-y-1">
                    {contests.eliminator.finalists.map((f: any, i: number) => (
                      <div key={f.bowler_id} className="flex items-center gap-3 text-sm">
                        <span className="text-slate-400 w-4">{i + 1}.</span>
                        <span className={i === 0 ? 'text-yellow-300 font-medium' : 'text-white'}>{f.bowler?.name || f.name}</span>
                        {f.g3 !== undefined && <span className="text-slate-400">G3: {f.g3}</span>}
                        {i < (contests.eliminator.payouts?.length || 0) && (
                          <span className="badge badge-green">${contests.eliminator.payouts[i]?.amount?.toFixed(2)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Eliminated */}
              {contests.eliminator.eliminatedAfterG1.length > 0 && (
                <div>
                  <div className="text-xs text-slate-400 mb-2">Eliminated after Game 1</div>
                  <div className="flex flex-wrap gap-1">
                    {contests.eliminator.eliminatedAfterG1.map((e: any) => (
                      <span key={e.bowler_id} className="badge badge-red">{e.bowler?.name || e.name}</span>
                    ))}
                  </div>
                </div>
              )}

              {contests.eliminator.eliminatedAfterG2.length > 0 && (
                <div>
                  <div className="text-xs text-slate-400 mb-2">Eliminated after Game 2</div>
                  <div className="flex flex-wrap gap-1">
                    {contests.eliminator.eliminatedAfterG2.map((e: any) => (
                      <span key={e.bowler_id} className="badge badge-red">{e.bowler?.name || e.name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* High Game Pot */}
      {s.has_high_game && (
        <div className="card overflow-hidden">
          <button
            className="w-full p-4 flex items-center justify-between text-left"
            onClick={() => setExpandedContest(expandedContest === 'high_game' ? null : 'high_game')}
          >
            <div>
              <div className="font-semibold text-white">High Game Pot</div>
              <div className="text-sm text-slate-400">
                {contests?.high_game?.entries || 0} entries · ${contests?.high_game?.perGamePot?.toFixed(2) || '0.00'} per game
              </div>
            </div>
            <span className="text-slate-400">{expandedContest === 'high_game' ? '▲' : '▼'}</span>
          </button>

          {expandedContest === 'high_game' && contests?.high_game && (
            <div className="border-t border-slate-700 p-4">
              <div className="grid grid-cols-3 gap-4">
                {contests.high_game.games.map((game: any) => (
                  <div key={game.game} className="card p-3">
                    <div className="text-xs text-slate-400 mb-1">Game {game.game} — ${game.pot.toFixed(2)}</div>
                    {game.leader ? (
                      <div>
                        <div className="font-medium text-white">{game.leader.bowler.name}</div>
                        <div className="text-2xl font-bold text-green-400">{game.leader.score}</div>
                      </div>
                    ) : (
                      <div className="text-slate-600">Awaiting scores</div>
                    )}
                    {game.scores.slice(0, 3).map((s: any, i: number) => (
                      <div key={i} className="text-xs text-slate-400 mt-0.5">
                        {i + 1}. {s.bowler.name} — {s.score}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* High Series */}
      {s.has_high_series && (
        <div className="card overflow-hidden">
          <button
            className="w-full p-4 flex items-center justify-between text-left"
            onClick={() => setExpandedContest(expandedContest === 'high_series' ? null : 'high_series')}
          >
            <div>
              <div className="font-semibold text-white">High Series</div>
              <div className="text-sm text-slate-400">
                {contests?.high_series?.entries || 0} entries · 70/30 split
              </div>
            </div>
            <span className="text-slate-400">{expandedContest === 'high_series' ? '▲' : '▼'}</span>
          </button>

          {expandedContest === 'high_series' && contests?.high_series && (
            <div className="border-t border-slate-700 p-4">
              <div className="flex gap-3 mb-4">
                <div className="badge badge-green">1st: ${contests.high_series.first.toFixed(2)}</div>
                <div className="badge badge-blue">2nd: ${contests.high_series.second.toFixed(2)}</div>
              </div>
              <div className="space-y-1">
                {contests.high_series.leaderboard.map((entry: any, i: number) => (
                  <div key={entry.bowler?.id} className={`flex items-center gap-3 text-sm py-1 px-2 rounded ${i === 0 ? 'bg-yellow-900/20' : i === 1 ? 'bg-blue-900/20' : ''}`}>
                    <span className="text-slate-400 w-4">{i + 1}.</span>
                    <span className={`flex-1 ${i < 2 ? 'font-medium text-white' : 'text-slate-300'}`}>{entry.bowler?.name}</span>
                    <span className="text-slate-400 text-xs">{entry.game1 ?? '—'} / {entry.game2 ?? '—'} / {entry.game3 ?? '—'}</span>
                    <span className={`font-bold ${i === 0 ? 'text-yellow-300' : i === 1 ? 'text-blue-300' : 'text-white'}`}>
                      {entry.series}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mystery Doubles */}
      {s.has_mystery_doubles && (
        <div className="card overflow-hidden">
          <button
            className="w-full p-4 flex items-center justify-between text-left"
            onClick={() => setExpandedContest(expandedContest === 'mystery_doubles' ? null : 'mystery_doubles')}
          >
            <div>
              <div className="font-semibold text-white">Mystery Doubles</div>
              <div className="text-sm text-slate-400">
                {contests?.mystery_doubles?.entries || 0} entries · ${contests?.mystery_doubles?.pairPrize?.toFixed(2) || '0.00'} per partner
              </div>
            </div>
            <span className="text-slate-400">{expandedContest === 'mystery_doubles' ? '▲' : '▼'}</span>
          </button>

          {expandedContest === 'mystery_doubles' && contests?.mystery_doubles && (
            <div className="border-t border-slate-700 p-4 space-y-4">
              <div className="flex items-center gap-3">
                <button
                  className="btn-secondary btn-sm"
                  onClick={drawDoubles}
                  disabled={drawingDoubles}
                >
                  🎲 {drawingDoubles ? 'Drawing...' : 'Random Draw'}
                </button>
                {contests.mystery_doubles.unpaired.length > 0 && (
                  <span className="text-amber-400 text-sm">
                    {contests.mystery_doubles.unpaired.length} unpaired bowler{contests.mystery_doubles.unpaired.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {contests.mystery_doubles.pairs.length === 0 ? (
                <div className="text-slate-500 text-sm">No pairs drawn yet. Use Random Draw to pair bowlers.</div>
              ) : (
                <div className="space-y-2">
                  {contests.mystery_doubles.pairs.map((pair: any, i: number) => (
                    <div key={pair.id} className={`card p-3 ${i === 0 && pair.combinedSeries > 0 ? 'border-yellow-700' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {i === 0 && pair.combinedSeries > 0 && <span>🏆</span>}
                          <span className="font-medium text-white">
                            {pair.bowler1?.name} & {pair.bowler2?.name}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-white">{pair.combinedSeries || '—'}</div>
                          <div className="text-xs text-slate-400">combined</div>
                        </div>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {pair.bowler1?.name}: {pair.scores1?.game1 ?? '—'} / {pair.scores1?.game2 ?? '—'} / {pair.scores1?.game3 ?? '—'} = {pair.scores1?.series || 0} &nbsp;|&nbsp;
                        {pair.bowler2?.name}: {pair.scores2?.game1 ?? '—'} / {pair.scores2?.game2 ?? '—'} / {pair.scores2?.game3 ?? '—'} = {pair.scores2?.series || 0}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
