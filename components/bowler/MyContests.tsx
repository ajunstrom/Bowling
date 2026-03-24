'use client'

import { useState } from 'react'

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt$(n: number) {
  return '$' + n.toFixed(2)
}

function pct(n: number, total: number) {
  if (!total) return 0
  return Math.round((n / total) * 100)
}

// ─── Expandable Card ────────────────────────────────────────────────────────

function ExpandCard({
  title,
  accent,
  badge,
  children,
  defaultOpen = true,
}: {
  title: string
  accent: string
  badge?: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`rounded-xl border ${accent} bg-slate-800 overflow-hidden`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-white tracking-wide uppercase">
          {title}
          {badge}
        </span>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

// ─── Brackets Section ────────────────────────────────────────────────────────

function BracketsSection({ data }: { data: any }) {
  const bowlerId = data.bowler?.id
  const allScores: any[] = data.allScores ?? []
  const settings = data.session?.settings ?? {}

  if (!settings.brackets_enabled) return null

  // Find brackets where this bowler occupies a slot
  const myBrackets = (data.brackets ?? []).filter((b: any) =>
    (b.slots ?? []).some((s: any) => s.bowler_id === bowlerId)
  )

  if (!myBrackets.length) {
    return (
      <ExpandCard title="Brackets" accent="border-blue-700" defaultOpen>
        <p className="text-xs text-slate-400">Brackets not yet generated.</p>
      </ExpandCard>
    )
  }

  return (
    <ExpandCard title="Brackets" accent="border-blue-700" defaultOpen>
      <div className="space-y-4">
        {myBrackets.map((bracket: any) => {
          // Determine modes present
          const modes: { label: string; matches: any[] }[] = []
          if ((bracket.handicap_matches ?? []).length) {
            modes.push({ label: 'Handicap', matches: bracket.handicap_matches })
          }
          if ((bracket.scratch_matches ?? []).length) {
            modes.push({ label: 'Scratch', matches: bracket.scratch_matches })
          }

          return (
            <div key={bracket.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                  Bracket #{bracket.bracket_number}
                </span>
              </div>

              {modes.map(({ label, matches }) => {
                // Group matches by round
                const rounds: Record<number, any[]> = {}
                for (const m of matches) {
                  if (!rounds[m.round]) rounds[m.round] = []
                  rounds[m.round].push(m)
                }

                // Check champion
                const finalRound = Math.max(...Object.keys(rounds).map(Number))
                const finalMatches = rounds[finalRound] ?? []
                const isChampion = finalMatches.some(
                  (m: any) => m.winner_id === bowlerId
                )

                return (
                  <div key={label} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-medium">{label}</span>
                      {isChampion && <span title="Champion">🏆</span>}
                    </div>

                    {Object.entries(rounds)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([round, rMatches]) => {
                        // Find the match involving this bowler
                        const match = rMatches.find(
                          (m: any) =>
                            m.bowler1_id === bowlerId || m.bowler2_id === bowlerId
                        )
                        if (!match) return null

                        const isB1 = match.bowler1_id === bowlerId
                        const myScore = isB1 ? match.score1 : match.score2
                        const theirScore = isB1 ? match.score2 : match.score1
                        const oppId = isB1 ? match.bowler2_id : match.bowler1_id

                        // Get opponent name from slots or bowlers list
                        const oppSlot = (bracket.slots ?? []).find(
                          (s: any) => s.bowler_id === oppId
                        )
                        const oppBowler =
                          oppSlot?.bowler ??
                          (data.bowlers ?? []).find((b: any) => b.id === oppId)
                        const oppName = oppBowler?.name ?? 'BYE'

                        const hasScores =
                          myScore !== null && theirScore !== null
                        const won =
                          hasScores &&
                          match.winner_id === bowlerId

                        const diff =
                          hasScores
                            ? Math.abs(myScore - theirScore)
                            : null

                        return (
                          <div
                            key={round}
                            className="bg-slate-700/60 rounded-lg px-3 py-2 text-xs"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-slate-400">
                                Round {round}
                              </span>
                              {hasScores ? (
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
                                    won
                                      ? 'bg-emerald-900/60 text-emerald-300'
                                      : 'bg-red-900/60 text-red-300'
                                  }`}
                                >
                                  {won ? 'W' : 'L'}
                                </span>
                              ) : (
                                <span className="text-slate-500 text-xs">Pending</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-slate-200">
                              <span className="text-slate-400">vs</span>
                              <span className="font-medium truncate max-w-[100px]">
                                {oppName}
                              </span>
                              {hasScores && (
                                <>
                                  <span className="ml-auto num">
                                    <span className="text-white font-bold">
                                      {myScore}
                                    </span>
                                    <span className="text-slate-400 mx-1">–</span>
                                    <span className="text-slate-300">{theirScore}</span>
                                  </span>
                                  {diff !== null && (
                                    <span className="text-slate-400 num">
                                      ({diff > 0 ? '+' : ''}
                                      {won ? diff : -diff})
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )
              })}
              <div className="border-t border-slate-700" />
            </div>
          )
        })}
      </div>
    </ExpandCard>
  )
}

// ─── Eliminator Section ──────────────────────────────────────────────────────

function EliminatorSection({ data }: { data: any }) {
  const bowlerId = data.bowler?.id
  const entries: any[] = data.contestEntries ?? []
  const enrolled = entries.some(
    (e) => e.contest_type === 'eliminator' && e.bowler_id === bowlerId
  )
  if (!enrolled) return null

  const elim: any = data.contestResults?.eliminator
  const settings = data.session?.settings ?? {}

  const placesPaid: number = settings.eliminator_places_paid ?? 2
  const splitPct: number = settings.eliminator_split_pct ?? 70
  const thirdFeeBack: boolean = settings.eliminator_third_fee_back ?? false

  const survivorsG1: number[] = elim?.survivorsAfterG1 ?? []
  const survivorsG2: number[] = elim?.survivorsAfterG2 ?? []
  const finalists: any[] = elim?.finalists ?? []
  const payoutStructure: any[] = elim?.payoutStructure ?? []

  const inG1 = true
  const inG2 = survivorsG1.includes(bowlerId)
  const inG3 = survivorsG2.includes(bowlerId)
  const myFinalist = finalists.find((f: any) => f.bowlerId === bowlerId)

  // Rank in G1 survivors
  const allScores: any[] = data.allScores ?? []
  const elimEntries = entries
    .filter((e) => e.contest_type === 'eliminator')
    .map((e) => e.bowler_id)

  const g1Scores = allScores
    .filter((s) => s.game === 1 && elimEntries.includes(s.bowler_id))
    .sort((a, b) => b.raw_score - a.raw_score)
  const myG1 = allScores.find((s) => s.game === 1 && s.bowler_id === bowlerId)
  const g1Rank = myG1
    ? g1Scores.findIndex((s) => s.bowler_id === bowlerId) + 1
    : null

  const g2Scores = allScores
    .filter((s) => s.game === 2 && survivorsG1.includes(s.bowler_id))
    .sort((a, b) => b.raw_score - a.raw_score)
  const myG2 = allScores.find((s) => s.game === 2 && s.bowler_id === bowlerId)
  const g2Rank = myG2
    ? g2Scores.findIndex((s) => s.bowler_id === bowlerId) + 1
    : null

  return (
    <ExpandCard title="Eliminator" accent="border-violet-700" defaultOpen>
      <div className="space-y-4">
        {/* Payout Structure */}
        <div className="bg-slate-700/50 rounded-lg p-3 space-y-1">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Payout Structure
          </p>
          <div className="flex gap-4 text-xs text-slate-300">
            <span>Places paid: <span className="num font-bold text-white">{placesPaid}</span></span>
            {placesPaid >= 2 && (
              <span>Split: <span className="num font-bold text-white">{splitPct}/{100 - splitPct}</span></span>
            )}
            {placesPaid >= 3 && thirdFeeBack && (
              <span className="text-violet-300">3rd fee back</span>
            )}
          </div>
          {payoutStructure.length > 0 && (
            <div className="flex gap-3 mt-1">
              {payoutStructure.map((p: any) => (
                <span key={p.place} className="text-xs">
                  <span className="text-slate-400">{p.place === 1 ? '1st' : p.place === 2 ? '2nd' : '3rd'}:</span>{' '}
                  <span className="num font-bold text-emerald-300">{fmt$(p.amount)}</span>
                </span>
              ))}
            </div>
          )}
          {elim && (
            <p className="text-xs text-slate-400 mt-1">
              Pool: <span className="num text-white">{fmt$(elim.prizePool)}</span>
              {' · '}Entries: <span className="num text-white">{elim.entries}</span>
            </p>
          )}
        </div>

        {/* Survival Path */}
        <div className="space-y-2">
          {/* Game 1 */}
          {myG1 && (
            <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
              inG2
                ? 'bg-emerald-900/40 text-emerald-300'
                : elim
                ? 'bg-red-900/40 text-red-300'
                : 'bg-slate-700/50 text-slate-300'
            }`}>
              <span className="font-bold">G1</span>
              <span className="num">{myG1.raw_score}</span>
              {g1Rank && (
                <span className="text-slate-400">
                  rank <span className="num font-bold">{g1Rank}</span>
                  {' of '}
                  <span className="num">{g1Scores.length}</span>
                </span>
              )}
              {elim && (
                <span className="ml-auto font-semibold">
                  {inG2 ? 'Survived G1' : 'Eliminated after G1'}
                </span>
              )}
            </div>
          )}

          {/* Game 2 */}
          {inG2 && myG2 && (
            <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
              inG3
                ? 'bg-emerald-900/40 text-emerald-300'
                : elim
                ? 'bg-red-900/40 text-red-300'
                : 'bg-slate-700/50 text-slate-300'
            }`}>
              <span className="font-bold">G2</span>
              <span className="num">{myG2.raw_score}</span>
              {g2Rank && (
                <span className="text-slate-400">
                  rank <span className="num font-bold">{g2Rank}</span>
                  {' of '}
                  <span className="num">{g2Scores.length}</span>
                </span>
              )}
              {elim && (
                <span className="ml-auto font-semibold">
                  {inG3 ? 'Survived G2' : 'Eliminated after G2'}
                </span>
              )}
            </div>
          )}

          {/* Game 3 Finalist */}
          {inG3 && (
            <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-violet-900/40 text-violet-300">
              <span className="font-bold">G3</span>
              <span className="font-semibold">Finalist</span>
              {myFinalist?.g3 && (
                <span className="num ml-1">{myFinalist.g3}</span>
              )}
            </div>
          )}
        </div>

        {/* G3 Final Four Grid */}
        {finalists.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Final Four
            </p>
            <div className="space-y-1">
              {finalists
                .sort((a, b) => a.place - b.place)
                .map((f: any) => (
                  <div
                    key={f.bowlerId}
                    className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
                      f.bowlerId === bowlerId
                        ? 'bg-blue-900/50 border border-blue-600'
                        : 'bg-slate-700/50'
                    }`}
                  >
                    <span className="num w-4 text-center font-bold text-slate-400">
                      {f.place}
                    </span>
                    <span className="font-medium text-white flex-1 truncate">
                      {f.name}
                      {f.bowlerId === bowlerId && (
                        <span className="ml-1 text-blue-400">(you)</span>
                      )}
                    </span>
                    <span className="num text-slate-400">
                      {f.g1}/{f.g2}/{f.g3 ?? '—'}
                    </span>
                    {f.prize > 0 && (
                      <span className="num font-bold text-emerald-300">
                        {fmt$(f.prize)}
                      </span>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </ExpandCard>
  )
}

// ─── High Game Section ───────────────────────────────────────────────────────

function HighGameSection({ data }: { data: any }) {
  const bowlerId = data.bowler?.id
  const entries: any[] = data.contestEntries ?? []
  const enrolled = entries.some(
    (e) => e.contest_type === 'high_game' && e.bowler_id === bowlerId
  )
  if (!enrolled) return null

  const hg: any = data.contestResults?.high_game
  if (!hg) {
    return (
      <ExpandCard title="High Game Pot" accent="border-teal-700" defaultOpen>
        <p className="text-xs text-slate-400">Results pending.</p>
      </ExpandCard>
    )
  }

  const myScores: any[] = data.scores ?? []

  return (
    <ExpandCard title="High Game Pot" accent="border-teal-700" defaultOpen>
      <div className="space-y-3">
        <p className="text-xs text-slate-400">
          Pot per game:{' '}
          <span className="num font-bold text-emerald-300">{fmt$(hg.potPerGame)}</span>
          {' · '}Entries: <span className="num text-white">{hg.entries}</span>
        </p>

        {(hg.pots ?? []).map((pot: any) => {
          const myScore = myScores.find((s: any) => s.game === pot.game)
          const winnerScore = pot.winner?.score ?? 0
          const myRawScore = myScore?.raw_score ?? null

          // Rank among top4
          const myRank = pot.top4?.findIndex(
            (t: any) => t.bowlerId === bowlerId
          )
          const displayRank =
            myRank !== undefined && myRank >= 0 ? myRank + 1 : null

          const isWinner = pot.winner?.bowlerId === bowlerId
          const isSecond =
            pot.top4?.[1]?.bowlerId === bowlerId && !isWinner
          const pinsShort =
            isSecond && myRawScore !== null
              ? winnerScore - myRawScore
              : null

          return (
            <div
              key={pot.game}
              className={`rounded-lg px-3 py-2 text-xs space-y-1 ${
                isWinner
                  ? 'bg-teal-900/50 border border-teal-600'
                  : 'bg-slate-700/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-300">
                  Game {pot.game}
                </span>
                {isWinner && (
                  <span className="text-teal-300 font-bold">
                    Won {fmt$(pot.pot)}
                  </span>
                )}
                {!isWinner && pot.winner && (
                  <span className="text-slate-400">
                    Pot: <span className="num text-white">{fmt$(pot.pot)}</span>
                  </span>
                )}
              </div>

              <div className="flex gap-4 text-slate-300">
                {myRawScore !== null && (
                  <span>
                    My score:{' '}
                    <span className="num font-bold text-white">
                      {myRawScore}
                    </span>
                  </span>
                )}
                {displayRank && (
                  <span>
                    Rank: <span className="num font-bold">#{displayRank}</span>
                  </span>
                )}
                {pot.winner && (
                  <span>
                    Winner:{' '}
                    <span className="num font-bold text-teal-300">
                      {pot.winner.score}
                    </span>
                  </span>
                )}
              </div>

              {pinsShort !== null && pinsShort > 0 && (
                <div className="mt-1 text-amber-300 font-semibold">
                  <span className="num">{pinsShort}</span> pins short of the pot
                </div>
              )}
            </div>
          )
        })}
      </div>
    </ExpandCard>
  )
}

// ─── High Series Section ─────────────────────────────────────────────────────

function HighSeriesSection({ data }: { data: any }) {
  const bowlerId = data.bowler?.id
  const entries: any[] = data.contestEntries ?? []
  const enrolled = entries.some(
    (e) => e.contest_type === 'high_series' && e.bowler_id === bowlerId
  )
  if (!enrolled) return null

  const hs: any = data.contestResults?.high_series
  if (!hs) {
    return (
      <ExpandCard title="High Series" accent="border-amber-700" defaultOpen>
        <p className="text-xs text-slate-400">Results pending.</p>
      </ExpandCard>
    )
  }

  const leaderboard: any[] = hs.leaderboard ?? []
  const sorted = [...leaderboard].sort((a, b) => b.series - a.series)
  const myIdx = sorted.findIndex((e: any) => e.bowlerId === bowlerId)
  const myEntry = sorted[myIdx]
  const myRank = myIdx + 1

  const firstAmt = hs.prizePool * ((hs.firstPct ?? 70) / 100)
  const secondAmt = hs.prizePool - firstAmt

  const leader = sorted[0]
  const second = sorted[1]
  const pinsBack1st =
    myEntry && leader && myEntry.bowlerId !== leader.bowlerId
      ? leader.series - myEntry.series
      : 0
  const pinsBack2nd =
    myEntry && second && myRank > 2
      ? second.series - myEntry.series
      : 0

  return (
    <ExpandCard title="High Series" accent="border-amber-700" defaultOpen>
      <div className="space-y-3">
        <div className="flex gap-4 text-xs text-slate-400">
          <span>
            1st: <span className="num font-bold text-emerald-300">{fmt$(firstAmt)}</span>
          </span>
          {hs.prizePool > firstAmt && (
            <span>
              2nd: <span className="num font-bold text-emerald-300">{fmt$(secondAmt)}</span>
            </span>
          )}
          <span>
            Entries: <span className="num text-white">{hs.entries}</span>
          </span>
        </div>

        {myEntry && (
          <div className="flex gap-3 text-xs bg-slate-700/50 rounded-lg px-3 py-2">
            <span className="text-slate-400">
              Your rank:{' '}
              <span className="num font-bold text-white">#{myRank}</span>
            </span>
            {pinsBack1st > 0 && (
              <span className="text-slate-400">
                <span className="num text-amber-300">{pinsBack1st}</span> pins behind 1st
              </span>
            )}
            {pinsBack2nd > 0 && myRank > 2 && (
              <span className="text-slate-400">
                <span className="num text-amber-300">{pinsBack2nd}</span> pins behind 2nd
              </span>
            )}
          </div>
        )}

        {/* Leaderboard */}
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {sorted.map((entry: any, idx: number) => {
            const isMe = entry.bowlerId === bowlerId
            const rank = idx + 1
            return (
              <div
                key={entry.bowlerId}
                className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg ${
                  isMe
                    ? 'bg-blue-900/50 border border-blue-600'
                    : rank <= 2
                    ? 'bg-amber-900/20'
                    : 'bg-slate-700/40'
                }`}
              >
                <span className="num w-5 text-center font-bold text-slate-400">
                  {rank}
                </span>
                <span className={`flex-1 font-medium truncate ${isMe ? 'text-blue-300' : 'text-white'}`}>
                  {entry.name}
                  {isMe && <span className="ml-1 text-blue-400 text-xs">(you)</span>}
                </span>
                <span className="num text-slate-300">
                  {entry.g1}/{entry.g2}/{entry.g3}
                </span>
                <span className="num font-bold text-white w-10 text-right">
                  {entry.series}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </ExpandCard>
  )
}

// ─── Mystery Doubles Section ─────────────────────────────────────────────────

function MysteryDoublesSection({ data }: { data: any }) {
  const bowlerId = data.bowler?.id
  const entries: any[] = data.contestEntries ?? []
  const enrolled = entries.some(
    (e) => e.contest_type === 'mystery_doubles' && e.bowler_id === bowlerId
  )
  if (!enrolled) return null

  const md: any = data.contestResults?.mystery_doubles
  const pairs: any[] = data.pairs ?? []

  // Find my pair from pairs table
  const myPair = pairs.find(
    (p: any) => p.bowler1_id === bowlerId || p.bowler2_id === bowlerId
  )

  const partnerId = myPair
    ? myPair.bowler1_id === bowlerId
      ? myPair.bowler2_id
      : myPair.bowler1_id
    : null
  const partnerBowler = partnerId
    ? (data.bowlers ?? []).find((b: any) => b.id === partnerId)
    : null

  // Find my pair result in contest results
  const myPairResult = md?.pairs?.find(
    (p: any) =>
      p.bowler1.id === bowlerId ||
      p.bowler2.id === bowlerId
  )

  const myScores: any[] = data.scores ?? []
  const partnerScores: any[] = (data.allScores ?? []).filter(
    (s: any) => s.bowler_id === partnerId
  )

  if (!md) {
    return (
      <ExpandCard title="Mystery Doubles" accent="border-pink-700" defaultOpen>
        <div className="space-y-2">
          {partnerBowler && (
            <div className="flex items-center gap-2 text-sm bg-slate-700/50 rounded-lg px-3 py-2">
              <span className="text-slate-400">Partner:</span>
              <span className="font-bold text-pink-300">{partnerBowler.name}</span>
            </div>
          )}
          <p className="text-xs text-slate-400">Results pending.</p>
        </div>
      </ExpandCard>
    )
  }

  const sortedPairs = [...(md.pairs ?? [])].sort(
    (a, b) => b.combinedSeries - a.combinedSeries
  )

  const myPairRank =
    myPairResult
      ? sortedPairs.findIndex(
          (p) =>
            p.bowler1.id === myPairResult.bowler1.id &&
            p.bowler2.id === myPairResult.bowler2.id
        ) + 1
      : null

  return (
    <ExpandCard title="Mystery Doubles" accent="border-pink-700" defaultOpen>
      <div className="space-y-3">
        {/* Partner reveal */}
        {partnerBowler && (
          <div className="flex items-center gap-2 bg-pink-900/30 border border-pink-800 rounded-lg px-3 py-2">
            <span className="text-xs text-slate-400">Partner:</span>
            <span className="font-bold text-pink-300">{partnerBowler.name}</span>
            {myPairRank && (
              <span className="ml-auto text-xs text-slate-400">
                Pair rank:{' '}
                <span className="num font-bold text-white">#{myPairRank}</span>
              </span>
            )}
          </div>
        )}

        {/* Per-game breakdown */}
        {myPairResult && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Combined Scores
            </p>
            {(myPairResult.gameBreakdown ?? []).map((g: any) => {
              const isMe1 = myPairResult.bowler1.id === bowlerId
              const myGameScore = isMe1 ? g.b1 : g.b2
              const partnerGameScore = isMe1 ? g.b2 : g.b1

              return (
                <div
                  key={g.game}
                  className="flex items-center gap-2 text-xs bg-slate-700/50 rounded-lg px-3 py-2"
                >
                  <span className="text-slate-400 w-8">G{g.game}</span>
                  <span className="num text-white font-bold">{myGameScore}</span>
                  <span className="text-slate-500">+</span>
                  <span className="num text-slate-300">{partnerGameScore}</span>
                  <span className="text-slate-500">=</span>
                  <span className="num font-bold text-pink-300">{g.combined}</span>
                </div>
              )
            })}
            <div className="flex items-center gap-2 text-xs bg-pink-900/30 rounded-lg px-3 py-2">
              <span className="text-slate-400 w-8">Total</span>
              <span className="num font-bold text-pink-300 ml-auto">
                {myPairResult.combinedSeries}
              </span>
            </div>
          </div>
        )}

        {/* Full pair standings */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Pair Standings
          </p>
          <div className="space-y-1 max-h-56 overflow-y-auto">
            {sortedPairs.map((pair: any, idx: number) => {
              const isMyPair =
                myPairResult &&
                pair.bowler1.id === myPairResult.bowler1.id &&
                pair.bowler2.id === myPairResult.bowler2.id

              return (
                <div
                  key={pair.pairId}
                  className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg ${
                    isMyPair
                      ? 'bg-blue-900/50 border border-blue-600'
                      : 'bg-slate-700/40'
                  }`}
                >
                  <span className="num w-4 text-center font-bold text-slate-400">
                    {idx + 1}
                  </span>
                  <span
                    className={`flex-1 truncate ${
                      isMyPair ? 'text-blue-300' : 'text-slate-200'
                    }`}
                  >
                    {pair.bowler1.name} &amp; {pair.bowler2.name}
                  </span>
                  <span className="num font-bold text-white">
                    {pair.combinedSeries}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {md.prizePool > 0 && (
          <p className="text-xs text-slate-400">
            Prize pool:{' '}
            <span className="num font-bold text-emerald-300">{fmt$(md.prizePool)}</span>
          </p>
        )}
      </div>
    </ExpandCard>
  )
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export default function MyContests({ data }: { data: any }) {
  if (!data?.bowler) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500 text-sm">
        No contest data available.
      </div>
    )
  }

  return (
    <div className="space-y-3 pb-4">
      <BracketsSection data={data} />
      <EliminatorSection data={data} />
      <HighGameSection data={data} />
      <HighSeriesSection data={data} />
      <MysteryDoublesSection data={data} />
    </div>
  )
}
