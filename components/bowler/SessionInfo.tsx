'use client'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt$(n: number) {
  return '$' + n.toFixed(2)
}

function fmtDate(dateStr: string) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

// ─── Contest ledger row definition ───────────────────────────────────────────

interface LedgerRow {
  name: string
  fee: number
  prize: number
  balance: number
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export default function SessionInfo({ data }: { data: any }) {
  const bowler = data?.bowler
  const session = data?.session
  const settings = session?.settings ?? {}
  const entries: any[] = data?.contestEntries ?? []
  const payoutSummary: any = data?.payoutSummary
  const bowlers: any[] = data?.bowlers ?? []

  if (!bowler || !session) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500 text-sm">
        No session info available.
      </div>
    )
  }

  const myEntries = entries.filter((e: any) => e.bowler_id === bowler.id)
  const myContestTypes = new Set(myEntries.map((e: any) => e.contest_type))

  // Payout lookup for this bowler
  const myPayouts: any[] = payoutSummary?.bowlerPayouts?.find(
    (bp: any) => bp.bowlerId === bowler.id
  )?.payouts ?? []

  const prizeByContest: Record<string, number> = {}
  for (const p of myPayouts) {
    prizeByContest[p.contest_type] = (prizeByContest[p.contest_type] ?? 0) + p.amount
  }

  // Build ledger rows
  const CONTEST_DEFS: { type: string; label: string; feeKey: string }[] = [
    { type: 'eliminator',      label: 'Eliminator',     feeKey: 'eliminator_fee' },
    { type: 'high_game',       label: 'High Game Pot',  feeKey: 'high_game_fee' },
    { type: 'high_series',     label: 'High Series',    feeKey: 'high_series_fee' },
    { type: 'mystery_doubles', label: 'Mystery Doubles', feeKey: 'mystery_doubles_fee' },
  ]

  // Brackets: one row per entry seat
  const bracketFee: number = settings.bracket_entry_fee ?? 1
  const bracketEntries = myEntries.filter((e: any) => e.contest_type === 'bracket').length
  const bracketPrize = prizeByContest['bracket'] ?? 0

  const ledgerRows: LedgerRow[] = []

  if (bracketEntries > 0) {
    const fee = bracketFee * bracketEntries
    ledgerRows.push({
      name: `Brackets (${bracketEntries} seat${bracketEntries > 1 ? 's' : ''})`,
      fee,
      prize: bracketPrize,
      balance: bracketPrize - fee,
    })
  }

  for (const def of CONTEST_DEFS) {
    if (myContestTypes.has(def.type)) {
      const fee: number = settings[def.feeKey] ?? 0
      const prize = prizeByContest[def.type] ?? 0
      ledgerRows.push({
        name: def.label,
        fee,
        prize,
        balance: prize - fee,
      })
    }
  }

  const totalFees = ledgerRows.reduce((s, r) => s + r.fee, 0)
  const totalPrizes = ledgerRows.reduce((s, r) => s + r.prize, 0)
  const netPosition = totalPrizes - totalFees
  const isPaidUp = Math.abs(bowler.amount_owed - bowler.amount_paid) < 0.01

  // All contests available in this session
  const CONTEST_FLAGS: { key: string; label: string; icon: string }[] = [
    { key: 'brackets_enabled',        label: 'Brackets',       icon: '🎳' },
    { key: 'eliminator_enabled',      label: 'Eliminator',     icon: '⚡' },
    { key: 'high_game_enabled',       label: 'High Game Pot',  icon: '🎯' },
    { key: 'high_series_enabled',     label: 'High Series',    icon: '📈' },
    { key: 'mystery_doubles_enabled', label: 'Mystery Doubles',icon: '🎲' },
  ]

  // Winners list (from payoutSummary, sorted by total)
  const winnersList: any[] = payoutSummary?.bowlerPayouts
    ? [...payoutSummary.bowlerPayouts]
        .filter((bp: any) => bp.total > 0)
        .sort((a: any, b: any) => b.total - a.total)
    : []

  const statusColors: Record<string, string> = {
    setup: 'bg-yellow-900/40 text-yellow-300 border-yellow-800',
    active: 'bg-emerald-900/40 text-emerald-300 border-emerald-800',
    closed: 'bg-slate-700/60 text-slate-400 border-slate-600',
  }

  return (
    <div className="space-y-4 pb-4">
      {/* ── All paid up banner ── */}
      {isPaidUp && bowler.amount_paid > 0 && (
        <div className="flex items-center gap-2 bg-emerald-900/40 border border-emerald-700 rounded-xl px-4 py-3">
          <span className="text-emerald-400 font-semibold text-sm">
            All paid up ✓
          </span>
          <span className="ml-auto num text-emerald-300 font-bold">
            {fmt$(bowler.amount_paid)} paid
          </span>
        </div>
      )}

      {/* ── Session Details ── */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <h3 className="text-sm font-semibold text-white tracking-wide uppercase">
            Session Details
          </h3>
        </div>
        <div className="px-4 py-3 space-y-2 text-sm">
          <div className="flex items-start justify-between gap-2">
            <span className="text-slate-400 shrink-0">Name</span>
            <span className="text-white font-medium text-right">{session.name}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400">Date</span>
            <span className="text-slate-200">{fmtDate(session.date)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400">Status</span>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                statusColors[session.status] ?? statusColors.setup
              }`}
            >
              {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400">Handicap</span>
            <span className="num font-bold text-blue-300">+{bowler.handicap} / game</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400">Entries</span>
            <span className="num text-white">{bowler.num_entries}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400">Bowlers</span>
            <span className="num text-white">{bowlers.length}</span>
          </div>
        </div>
      </div>

      {/* ── Active Contests ── */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <h3 className="text-sm font-semibold text-white tracking-wide uppercase">
            Active Contests
          </h3>
        </div>
        <div className="px-4 py-3 space-y-2">
          {CONTEST_FLAGS.map(({ key, label, icon }) => {
            const isActive = settings[key] === true
            return (
              <div key={key} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">
                  {icon} {label}
                </span>
                <span
                  className={`num text-xs font-semibold px-2 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-emerald-900/50 text-emerald-400'
                      : 'bg-slate-700 text-slate-500'
                  }`}
                >
                  {isActive ? 'ON' : 'OFF'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Contest Ledger ── */}
      {ledgerRows.length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-white tracking-wide uppercase">
              My Contest Ledger
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="px-4 py-2 text-left text-slate-400 font-medium">
                    Contest
                  </th>
                  <th className="px-3 py-2 text-right text-slate-400 font-medium">
                    Fee
                  </th>
                  <th className="px-3 py-2 text-right text-slate-400 font-medium">
                    Prize
                  </th>
                  <th className="px-3 py-2 text-right text-slate-400 font-medium pr-4">
                    Net
                  </th>
                </tr>
              </thead>
              <tbody>
                {ledgerRows.map((row) => (
                  <tr
                    key={row.name}
                    className="border-b border-slate-700/40 last:border-0"
                  >
                    <td className="px-4 py-2.5 text-slate-300 font-medium">
                      {row.name}
                    </td>
                    <td className="px-3 py-2.5 text-right num text-slate-400">
                      {fmt$(row.fee)}
                    </td>
                    <td className="px-3 py-2.5 text-right num">
                      {row.prize > 0 ? (
                        <span className="text-emerald-300 font-bold">
                          {fmt$(row.prize)}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right pr-4 num font-bold">
                      {row.balance > 0 ? (
                        <span className="text-emerald-300">+{fmt$(row.balance)}</span>
                      ) : row.balance < 0 ? (
                        <span className="text-red-400">{fmt$(row.balance)}</span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-600 bg-slate-700/40">
                  <td className="px-4 py-2.5 text-slate-300 font-semibold text-xs uppercase">
                    Total
                  </td>
                  <td className="px-3 py-2.5 text-right num font-bold text-slate-300">
                    {fmt$(totalFees)}
                  </td>
                  <td className="px-3 py-2.5 text-right num font-bold text-emerald-300">
                    {totalPrizes > 0 ? fmt$(totalPrizes) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right pr-4 num font-bold text-sm">
                    {netPosition > 0 ? (
                      <span className="text-emerald-300">+{fmt$(netPosition)}</span>
                    ) : netPosition < 0 ? (
                      <span className="text-red-400">{fmt$(netPosition)}</span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Payment status */}
          <div className="px-4 py-3 border-t border-slate-700/50 flex flex-wrap gap-3 text-xs">
            <span className="text-slate-400">
              Owed:{' '}
              <span className="num font-bold text-white">{fmt$(bowler.amount_owed)}</span>
            </span>
            <span className="text-slate-400">
              Paid:{' '}
              <span className="num font-bold text-emerald-300">
                {fmt$(bowler.amount_paid)}
              </span>
            </span>
            {bowler.credit_balance > 0 && (
              <span className="text-slate-400">
                Credit:{' '}
                <span className="num font-bold text-blue-300">
                  {fmt$(bowler.credit_balance)}
                </span>
              </span>
            )}
            {bowler.amount_owed - bowler.amount_paid > 0.005 && (
              <span className="ml-auto text-red-400 font-semibold">
                Balance due:{' '}
                <span className="num">
                  {fmt$(bowler.amount_owed - bowler.amount_paid)}
                </span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Winners List ── */}
      {winnersList.length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-white tracking-wide uppercase">
              Prize Winners
            </h3>
          </div>
          <div className="divide-y divide-slate-700/40 max-h-72 overflow-y-auto">
            {winnersList.map((bp: any, idx: number) => {
              const isMe = bp.bowlerId === bowler.id
              return (
                <div
                  key={bp.bowlerId}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs ${
                    isMe ? 'bg-blue-900/40 border-l-2 border-blue-500' : ''
                  }`}
                >
                  <span className="num w-4 text-center text-slate-500 font-bold">
                    {idx + 1}
                  </span>
                  <span
                    className={`flex-1 font-medium truncate ${
                      isMe ? 'text-blue-300' : 'text-slate-200'
                    }`}
                  >
                    {bp.name}
                    {isMe && (
                      <span className="ml-1 text-blue-400 font-normal text-xs">
                        (you)
                      </span>
                    )}
                  </span>
                  <span className="num font-bold text-emerald-300">
                    {fmt$(bp.total)}
                  </span>
                  {bp.totalOutstanding > 0 && (
                    <span className="num text-xs text-slate-500">
                      ({fmt$(bp.totalOutstanding)} pending)
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          <div className="px-4 py-2.5 border-t border-slate-700 bg-slate-700/30 text-xs text-slate-400 flex justify-between">
            <span>Total prizes distributed</span>
            <span className="num font-bold text-emerald-300">
              {fmt$(payoutSummary.totalPrizePool ?? 0)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
