interface Props {
  data: any
}

export default function SessionInfo({ data }: Props) {
  const { bowler, session, scores, payouts, contestEntries } = data
  const settings = session.settings

  const myScores = scores.filter((s: any) => s.bowler_id === bowler.id)
  const gamesPlayed = myScores.length

  // Build line items for financial ledger
  const lineItems: { description: string; amount: number; type: 'charge' | 'payout' }[] = []

  // Bracket entries
  if (settings.brackets_enabled) {
    const bracketEntries = contestEntries?.filter((e: any) => e.contest_type === 'bracket') ?? []
    if (bracketEntries.length > 0) {
      lineItems.push({
        description: `Brackets (${bracketEntries.length} × $${settings.bracket_fee.toFixed(2)})`,
        amount: bracketEntries.length * settings.bracket_fee,
        type: 'charge',
      })
    }
  }

  // Eliminator entry
  if (settings.eliminator_enabled) {
    const entered = contestEntries?.some((e: any) => e.contest_type === 'eliminator') ?? false
    if (entered) {
      lineItems.push({
        description: `Eliminator`,
        amount: settings.eliminator_fee,
        type: 'charge',
      })
    }
  }

  // High Game entry
  if (settings.high_game_enabled) {
    const entered = contestEntries?.some((e: any) => e.contest_type === 'high_game') ?? false
    if (entered) {
      lineItems.push({
        description: `High Game Pot`,
        amount: settings.high_game_fee,
        type: 'charge',
      })
    }
  }

  // High Series entry
  if (settings.high_series_enabled) {
    const entered = contestEntries?.some((e: any) => e.contest_type === 'high_series') ?? false
    if (entered) {
      lineItems.push({
        description: `High Series`,
        amount: settings.high_series_fee,
        type: 'charge',
      })
    }
  }

  // Mystery Doubles entry
  if (settings.mystery_doubles_enabled) {
    const entered = contestEntries?.some((e: any) => e.contest_type === 'mystery_doubles') ?? false
    if (entered) {
      lineItems.push({
        description: `Mystery Doubles`,
        amount: settings.mystery_doubles_fee,
        type: 'charge',
      })
    }
  }

  // Payouts won
  const myPayouts = payouts?.bowlerPayouts?.find((bp: any) => bp.bowlerId === bowler.id)
  if (myPayouts?.payouts?.length > 0) {
    myPayouts.payouts.forEach((p: any) => {
      lineItems.push({
        description: `${p.description}${p.placement ? ` (${ordinal(p.placement)} place)` : ''}`,
        amount: p.amount,
        type: 'payout',
      })
    })
  }

  const totalCharged = lineItems.filter(l => l.type === 'charge').reduce((s, l) => s + l.amount, 0)
  const totalWon = lineItems.filter(l => l.type === 'payout').reduce((s, l) => s + l.amount, 0)
  const amountPaid = bowler.amount_paid
  const balance = bowler.amount_owed - amountPaid

  return (
    <div className="space-y-5">
      {/* Financial ledger */}
      <div className="card p-4">
        <h2 className="text-base font-semibold text-white mb-3">My Ledger</h2>
        <div className="space-y-1 mb-3">
          {lineItems.length === 0 ? (
            <div className="text-sm text-slate-500 py-2">No entries recorded.</div>
          ) : (
            lineItems.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm py-1 border-b border-slate-700/50 last:border-0">
                <span className="text-slate-300">{item.description}</span>
                <span className={item.type === 'payout' ? 'text-green-400 font-medium' : 'text-slate-300'}>
                  {item.type === 'payout' ? '+' : '−'}${item.amount.toFixed(2)}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-slate-600 pt-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Total Entries</span>
            <span className="text-white">${totalCharged.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Amount Paid</span>
            <span className="text-green-400">${amountPaid.toFixed(2)}</span>
          </div>
          {balance > 0 && (
            <div className="flex justify-between text-sm font-medium">
              <span className="text-red-400">Balance Due</span>
              <span className="text-red-400">${balance.toFixed(2)}</span>
            </div>
          )}
          {balance <= 0 && amountPaid > 0 && (
            <div className="flex justify-between text-sm font-medium">
              <span className="text-green-400">Paid in Full</span>
              <span className="text-green-400">✓</span>
            </div>
          )}
          {totalWon > 0 && (
            <div className="flex justify-between text-sm font-medium border-t border-slate-600 pt-2 mt-2">
              <span className="text-yellow-400">Prize Winnings</span>
              <span className="text-yellow-400">+${totalWon.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Session details */}
      <div className="card p-4">
        <h2 className="text-base font-semibold text-white mb-3">Session Details</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Session</span>
            <span className="text-white">{session.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Date</span>
            <span className="text-white">{new Date(session.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Status</span>
            <span className="text-white capitalize">{session.status}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Games Bowled</span>
            <span className="text-white">{gamesPlayed} / 3</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Handicap</span>
            <span className="text-white">{bowler.handicap} pins/game</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Entries</span>
            <span className="text-white">{bowler.num_entries}</span>
          </div>
        </div>
      </div>

      {/* Active contests */}
      <div className="card p-4">
        <h2 className="text-base font-semibold text-white mb-3">Active Contests</h2>
        <div className="space-y-2 text-sm">
          {[
            { key: 'brackets_enabled', label: 'Brackets', fee: settings.bracket_fee },
            { key: 'eliminator_enabled', label: 'Eliminator', fee: settings.eliminator_fee },
            { key: 'high_game_enabled', label: 'High Game Pot', fee: settings.high_game_fee },
            { key: 'high_series_enabled', label: 'High Series', fee: settings.high_series_fee },
            { key: 'mystery_doubles_enabled', label: 'Mystery Doubles', fee: settings.mystery_doubles_fee },
          ].map(({ key, label, fee }) => {
            const enabled = settings[key as keyof typeof settings]
            return (
              <div key={key} className="flex items-center justify-between py-1 border-b border-slate-700/30 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${enabled ? 'bg-green-500' : 'bg-slate-600'}`} />
                  <span className={enabled ? 'text-white' : 'text-slate-500'}>{label}</span>
                </div>
                <span className={enabled ? 'text-slate-300' : 'text-slate-600'}>
                  {enabled ? `$${fee.toFixed(2)}/entry` : 'Off'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Session winners (if payouts exist) */}
      {payouts?.bowlerPayouts?.length > 0 && (
        <div className="card p-4">
          <h2 className="text-base font-semibold text-white mb-3">Prize Winners</h2>
          <div className="space-y-1">
            {payouts.bowlerPayouts
              .sort((a: any, b: any) => b.total - a.total)
              .map((bp: any) => (
                <div
                  key={bp.bowlerId}
                  className={`flex justify-between text-sm py-1 px-2 rounded ${
                    bp.bowlerId === bowler.id ? 'bg-blue-900/30 ring-1 ring-blue-600/40' : ''
                  }`}
                >
                  <span className={bp.bowlerId === bowler.id ? 'text-white font-medium' : 'text-slate-300'}>
                    {bp.name}
                    {bp.bowlerId === bowler.id && <span className="text-xs text-blue-400 ml-1">(you)</span>}
                  </span>
                  <span className="text-green-400 font-medium">${bp.total.toFixed(2)}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}
