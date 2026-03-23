'use client'

interface Props {
  session: any
  contestResults: any
  bowlers: any[]
  brackets: any
  contestEntries?: any[]
  pairs?: any[]
  onRefresh: () => void
  delegatePerms?: { can_manage_entries: boolean } | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt$(n: number) {
  return '$' + Number(n ?? 0).toFixed(2)
}

function SectionCard({
  title,
  children,
  accent = 'border-slate-700',
}: {
  title: string
  children: React.ReactNode
  accent?: string
}) {
  return (
    <div className={`card rounded-xl border ${accent} overflow-hidden`}>
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
          {title}
        </h3>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  )
}

// ─── Eliminator Summary ───────────────────────────────────────────────────────

function EliminatorSummary({ elim }: { elim: any }) {
  if (!elim) return <p className="text-sm text-slate-400">No results yet.</p>

  return (
    <div className="space-y-3 text-sm">
      <div className="flex gap-6">
        <span className="text-slate-500">
          Entries: <span className="num font-bold text-slate-800">{elim.entries}</span>
        </span>
        <span className="text-slate-500">
          Pool: <span className="num font-bold text-emerald-700">{fmt$(elim.prizePool)}</span>
        </span>
        <span className="text-slate-500">
          Rake: <span className="num font-bold text-blue-700">{fmt$(elim.rake)}</span>
        </span>
      </div>

      {elim.finalists?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Final Results
          </p>
          <div className="space-y-1">
            {[...elim.finalists]
              .sort((a: any, b: any) => a.place - b.place)
              .map((f: any) => (
                <div
                  key={f.bowlerId}
                  className="flex items-center gap-3 text-xs bg-slate-50 rounded-lg px-3 py-2"
                >
                  <span className="num w-4 text-center text-slate-400 font-bold">
                    {f.place}
                  </span>
                  <span className="flex-1 font-medium text-slate-800 truncate">
                    {f.name}
                  </span>
                  <span className="num text-slate-500">
                    {f.g1}/{f.g2}/{f.g3 ?? '—'}
                  </span>
                  {f.prize > 0 && (
                    <span className="num font-bold text-emerald-700">
                      {fmt$(f.prize)}
                    </span>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {elim.survivorsAfterG1?.length > 0 && (
        <p className="text-xs text-slate-400">
          After G1: <span className="num font-medium text-slate-700">{elim.survivorsAfterG1.length}</span> survivors ·
          After G2: <span className="num font-medium text-slate-700">{elim.survivorsAfterG2?.length ?? 0}</span> finalists
        </p>
      )}
    </div>
  )
}

// ─── High Game Summary ────────────────────────────────────────────────────────

function HighGameSummary({ hg }: { hg: any }) {
  if (!hg) return <p className="text-sm text-slate-400">No results yet.</p>

  return (
    <div className="space-y-3 text-sm">
      <div className="flex gap-6">
        <span className="text-slate-500">
          Entries: <span className="num font-bold text-slate-800">{hg.entries}</span>
        </span>
        <span className="text-slate-500">
          Per game: <span className="num font-bold text-emerald-700">{fmt$(hg.potPerGame)}</span>
        </span>
        <span className="text-slate-500">
          Rake: <span className="num font-bold text-blue-700">{fmt$(hg.rake)}</span>
        </span>
      </div>

      <div className="space-y-1">
        {(hg.pots ?? []).map((pot: any) => (
          <div
            key={pot.game}
            className="flex items-center gap-3 text-xs bg-slate-50 rounded-lg px-3 py-2"
          >
            <span className="text-slate-400 w-12">Game {pot.game}</span>
            <span className="flex-1 font-medium text-slate-800 truncate">
              {pot.winner?.name ?? 'TBD'}
            </span>
            {pot.winner && (
              <span className="num text-slate-500">{pot.winner.score}</span>
            )}
            <span className="num font-bold text-emerald-700">{fmt$(pot.pot)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── High Series Summary ──────────────────────────────────────────────────────

function HighSeriesSummary({ hs }: { hs: any }) {
  if (!hs) return <p className="text-sm text-slate-400">No results yet.</p>

  const sorted = [...(hs.leaderboard ?? [])].sort(
    (a: any, b: any) => b.series - a.series
  )
  const firstAmt = hs.prizePool * ((hs.firstPct ?? 70) / 100)
  const secondAmt = hs.prizePool - firstAmt

  return (
    <div className="space-y-3 text-sm">
      <div className="flex gap-6">
        <span className="text-slate-500">
          Entries: <span className="num font-bold text-slate-800">{hs.entries}</span>
        </span>
        <span className="text-slate-500">
          1st: <span className="num font-bold text-emerald-700">{fmt$(firstAmt)}</span>
        </span>
        <span className="text-slate-500">
          2nd: <span className="num font-bold text-amber-700">{fmt$(secondAmt)}</span>
        </span>
      </div>

      <div className="space-y-1 max-h-48 overflow-y-auto">
        {sorted.slice(0, 10).map((entry: any, idx: number) => (
          <div
            key={entry.bowlerId}
            className="flex items-center gap-3 text-xs bg-slate-50 rounded-lg px-3 py-1.5"
          >
            <span className="num w-4 text-center text-slate-400 font-bold">
              {idx + 1}
            </span>
            <span className="flex-1 font-medium text-slate-800 truncate">
              {entry.name}
            </span>
            <span className="num text-slate-500">
              {entry.g1}/{entry.g2}/{entry.g3}
            </span>
            <span className="num font-bold text-slate-800">{entry.series}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Mystery Doubles Summary ──────────────────────────────────────────────────

function MysteryDoublesSummary({ md }: { md: any }) {
  if (!md) return <p className="text-sm text-slate-400">No results yet.</p>

  const sorted = [...(md.pairs ?? [])].sort(
    (a: any, b: any) => b.combinedSeries - a.combinedSeries
  )

  return (
    <div className="space-y-3 text-sm">
      <div className="flex gap-6">
        <span className="text-slate-500">
          Pairs: <span className="num font-bold text-slate-800">{md.pairs?.length ?? 0}</span>
        </span>
        <span className="text-slate-500">
          Pool: <span className="num font-bold text-emerald-700">{fmt$(md.prizePool)}</span>
        </span>
        {md.unpaired?.length > 0 && (
          <span className="text-amber-600">
            {md.unpaired.length} unpaired
          </span>
        )}
      </div>

      <div className="space-y-1 max-h-48 overflow-y-auto">
        {sorted.slice(0, 10).map((pair: any, idx: number) => (
          <div
            key={pair.pairId}
            className="flex items-center gap-3 text-xs bg-slate-50 rounded-lg px-3 py-1.5"
          >
            <span className="num w-4 text-center text-slate-400 font-bold">
              {idx + 1}
            </span>
            <span className="flex-1 font-medium text-slate-800 truncate">
              {pair.bowler1.name} &amp; {pair.bowler2.name}
            </span>
            <span className="num font-bold text-slate-800">
              {pair.combinedSeries}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Brackets Summary ─────────────────────────────────────────────────────────

function BracketsSummary({ brackets }: { brackets: any }) {
  const bracketList: any[] = brackets?.brackets ?? []
  if (!bracketList.length) {
    return <p className="text-sm text-slate-400">No brackets generated yet.</p>
  }

  return (
    <div className="space-y-2 text-sm">
      <p className="text-slate-500">
        <span className="num font-bold text-slate-800">{bracketList.length}</span> brackets generated
      </p>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {bracketList.map((b: any) => {
          const handicapChamp = (b.handicap_matches ?? []).find(
            (m: any) => m.round === 3 && m.winner_id
          )
          const scratchChamp = (b.scratch_matches ?? []).find(
            (m: any) => m.round === 3 && m.winner_id
          )
          return (
            <div
              key={b.id}
              className="flex items-center gap-3 text-xs bg-slate-50 rounded-lg px-3 py-1.5"
            >
              <span className="num text-slate-400 w-16">
                #{b.bracket_number}
              </span>
              <span className="text-slate-500">
                Hdcp:{' '}
                <span className="font-medium text-slate-800">
                  {handicapChamp?.winner?.name ?? '—'}
                </span>
              </span>
              <span className="text-slate-500">
                Scratch:{' '}
                <span className="font-medium text-slate-800">
                  {scratchChamp?.winner?.name ?? '—'}
                </span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function Contests({
  session,
  contestResults,
  bowlers,
  brackets,
  onRefresh,
}: Props) {
  const settings = session?.settings ?? {}

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Contest Results</h2>
        <button onClick={onRefresh} className="btn btn-secondary btn-sm">
          Refresh
        </button>
      </div>

      {settings.brackets_enabled && (
        <SectionCard title="Brackets" accent="border-blue-200">
          <BracketsSummary brackets={brackets} />
        </SectionCard>
      )}

      {settings.eliminator_enabled && (
        <SectionCard title="Eliminator" accent="border-violet-200">
          <EliminatorSummary elim={contestResults?.eliminator} />
        </SectionCard>
      )}

      {settings.high_game_enabled && (
        <SectionCard title="High Game Pot" accent="border-teal-200">
          <HighGameSummary hg={contestResults?.high_game} />
        </SectionCard>
      )}

      {settings.high_series_enabled && (
        <SectionCard title="High Series" accent="border-amber-200">
          <HighSeriesSummary hs={contestResults?.high_series} />
        </SectionCard>
      )}

      {settings.mystery_doubles_enabled && (
        <SectionCard title="Mystery Doubles" accent="border-pink-200">
          <MysteryDoublesSummary md={contestResults?.mystery_doubles} />
        </SectionCard>
      )}
    </div>
  )
}
