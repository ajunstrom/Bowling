'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

import SessionSetup from '@/components/operator/SessionSetup'
import EnterScores from '@/components/operator/EnterScores'
import Contests from '@/components/operator/Contests'
import Payouts from '@/components/operator/Payouts'
import Delegates from '@/components/operator/Delegates'
import Overview from '@/components/operator/Overview'
import PastSessions from '@/components/operator/PastSessions'
import * as api from '@/lib/api'
import { getBrowserClient } from '@/lib/supabase'

// ─── Tab definitions ──────────────────────────────────────────────────────────

type TabId = 'setup' | 'scores' | 'contests' | 'payouts' | 'delegates' | 'overview' | 'history'

interface TabDef {
  id: TabId
  label: string
  icon: React.ReactNode
  mobileLabel: string
}

function IconSetup() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function IconScores() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
    </svg>
  )
}

function IconContests() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
    </svg>
  )
}

function IconPayouts() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  )
}

function IconDelegates() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  )
}

function IconOverview() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  )
}

function IconHistory() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function IconMenu() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  )
}

function IconClose() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

const TABS: TabDef[] = [
  { id: 'setup',     label: 'Setup',     mobileLabel: 'Setup',    icon: <IconSetup /> },
  { id: 'scores',   label: 'Scores',    mobileLabel: 'Scores',   icon: <IconScores /> },
  { id: 'contests', label: 'Contests',  mobileLabel: 'Contests', icon: <IconContests /> },
  { id: 'payouts',  label: 'Payouts',   mobileLabel: 'Payouts',  icon: <IconPayouts /> },
  { id: 'delegates',label: 'Delegates', mobileLabel: 'Delegates',icon: <IconDelegates /> },
  { id: 'overview', label: 'Overview',  mobileLabel: 'Overview', icon: <IconOverview /> },
  { id: 'history',  label: 'History',   mobileLabel: 'History',  icon: <IconHistory /> },
]

// Bottom nav shows 4 primary tabs + more drawer
const BOTTOM_TABS: TabId[] = ['setup', 'scores', 'payouts', 'overview']

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="flex flex-col h-screen bg-slate-50 animate-pulse">
      <div className="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3">
        <div className="h-5 w-36 bg-slate-200 rounded" />
        <div className="ml-auto h-4 w-4 bg-slate-200 rounded-full" />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="hidden md:flex flex-col w-52 border-r border-slate-200 bg-white py-4 gap-1 px-2">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-9 rounded-lg bg-slate-100" />
          ))}
        </div>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="space-y-4 max-w-3xl">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-white rounded-xl border border-slate-200" />
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OperatorDashboard() {
  const params = useParams()
  const searchParams = useSearchParams()

  const sessionId = Number(params?.sessionId)
  const delegateCode = searchParams?.get('delegate')

  // ── State ──────────────────────────────────────────────────────────────────

  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [drawerOpen, setDrawerOpen] = useState(false)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [realtimeConnected, setRealtimeConnected] = useState(false)

  const [session, setSession] = useState<any>(null)
  const [bowlers, setBowlers] = useState<any[]>([])
  const [scores, setScores] = useState<any[]>([])
  const [brackets, setBrackets] = useState<any>(null)
  const [contestResults, setContestResults] = useState<any>(null)
  const [payoutSummary, setPayoutSummary] = useState<any>(null)
  const [overviewData, setOverviewData] = useState<any>(null)
  const [delegates, setDelegates] = useState<any[]>([])
  const [delegatePerms, setDelegatePerms] = useState<any>(null)

  const channelRef = useRef<ReturnType<ReturnType<typeof getBrowserClient>['channel']> | null>(null)

  // ── Data Fetching ──────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    if (!sessionId) return
    try {
      const [
        sessionData,
        bowlersData,
        scoresData,
        bracketsData,
        contestData,
        payoutData,
        overviewResp,
        delegatesData,
      ] = await Promise.allSettled([
        api.sessions.get(sessionId),
        api.bowlers.list(sessionId),
        api.scores.list(sessionId),
        api.brackets.get(sessionId),
        api.contests.results(sessionId),
        api.payouts.summary(sessionId),
        api.overview.get(sessionId),
        api.delegates.list(sessionId),
      ])

      if (sessionData.status === 'fulfilled') setSession(sessionData.value)
      if (bowlersData.status === 'fulfilled') setBowlers(bowlersData.value)
      if (scoresData.status === 'fulfilled') setScores(scoresData.value)
      if (bracketsData.status === 'fulfilled') setBrackets(bracketsData.value)
      if (contestData.status === 'fulfilled') setContestResults(contestData.value)
      if (payoutData.status === 'fulfilled') setPayoutSummary(payoutData.value)
      if (overviewResp.status === 'fulfilled') setOverviewData(overviewResp.value)
      if (delegatesData.status === 'fulfilled') setDelegates(delegatesData.value)
    } catch (e: any) {
      setError(e.message ?? 'Failed to load session data')
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  // ── Delegate mode ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!delegateCode) return
    api.delegates.verify(delegateCode).then((d) => {
      if (d) setDelegatePerms(d)
    }).catch(() => {})
  }, [delegateCode])

  // ── Initial load ───────────────────────────────────────────────────────────

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ── Realtime subscription ──────────────────────────────────────────────────

  useEffect(() => {
    if (!sessionId) return
    const supabase = getBrowserClient()

    const channel = supabase
      .channel(`operator-session-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scores',
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          fetchAll()
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED')
      })

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      setRealtimeConnected(false)
    }
  }, [sessionId, fetchAll])

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <LoadingSkeleton />

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center space-y-3">
          <p className="text-red-600 font-medium">{error}</p>
          <button onClick={() => { setError(null); setLoading(true); fetchAll() }} className="btn btn-primary">
            Retry
          </button>
        </div>
      </div>
    )
  }

  const sessionName = session?.name ?? `Session ${sessionId}`

  function renderTab() {
    switch (activeTab) {
      case 'setup':
        return (
          <SessionSetup
            session={session}
            bowlers={bowlers}
            onRefresh={fetchAll}
            delegatePerms={delegatePerms}
          />
        )
      case 'scores':
        return (
          <EnterScores
            session={session}
            bowlers={bowlers}
            scores={scores}
            onRefresh={fetchAll}
            delegatePerms={delegatePerms}
          />
        )
      case 'contests':
        return (
          <Contests
            session={session}
            contestResults={contestResults}
            bowlers={bowlers}
            brackets={brackets}
            onRefresh={fetchAll}
            delegatePerms={delegatePerms}
          />
        )
      case 'payouts':
        return (
          <Payouts
            session={session}
            payoutSummary={payoutSummary}
            onRefresh={fetchAll}
            delegatePerms={delegatePerms}
          />
        )
      case 'delegates':
        return (
          <Delegates
            session={session}
            delegates={delegates}
            onRefresh={fetchAll}
          />
        )
      case 'overview':
        return (
          <Overview
            session={session}
            overviewData={overviewData}
            bowlers={bowlers}
          />
        )
      case 'history':
        return (
          <PastSessions currentSessionId={sessionId} />
        )
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">

      {/* ── Header ── */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3 shrink-0 z-30">
        {/* Mobile hamburger */}
        <button
          className="md:hidden p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
        >
          <IconMenu />
        </button>

        <h1 className="font-semibold text-slate-800 text-base truncate">
          {sessionName}
        </h1>

        <div className="ml-auto flex items-center gap-2">
          {delegatePerms && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
              Delegate: {delegatePerms.name}
            </span>
          )}
          {realtimeConnected && (
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <span className="live-dot" />
              <span className="hidden sm:inline">Live</span>
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Desktop Sidebar ── */}
        <aside className="hidden md:flex flex-col w-52 border-r border-slate-200 bg-white py-3 gap-0.5 px-2 shrink-0 overflow-y-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full text-left ${
                activeTab === tab.id
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <span className={activeTab === tab.id ? 'text-blue-600' : 'text-slate-400'}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          ))}
        </aside>

        {/* ── Mobile Drawer ── */}
        {drawerOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => setDrawerOpen(false)}
            />
            <div className="fixed top-0 left-0 h-full w-64 bg-white z-50 shadow-xl flex flex-col md:hidden">
              <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200">
                <span className="font-semibold text-slate-800">{sessionName}</span>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1 rounded-lg text-slate-500 hover:bg-slate-100"
                >
                  <IconClose />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id); setDrawerOpen(false) }}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full text-left ${
                      activeTab === tab.id
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className={activeTab === tab.id ? 'text-blue-600' : 'text-slate-400'}>
                      {tab.icon}
                    </span>
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>
          </>
        )}

        {/* ── Main Content ── */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
          <div className="max-w-4xl">
            {renderTab()}
          </div>
        </main>
      </div>

      {/* ── Mobile Bottom Navigation ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-30 flex">
        {BOTTOM_TABS.map((tabId) => {
          const tab = TABS.find((t) => t.id === tabId)!
          const isActive = activeTab === tabId
          return (
            <button
              key={tabId}
              onClick={() => setActiveTab(tabId)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors ${
                isActive ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <span className={isActive ? 'text-blue-600' : 'text-slate-400'}>
                {tab.icon}
              </span>
              {tab.mobileLabel}
            </button>
          )
        })}
        {/* More button to open drawer for overflow tabs */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-2 text-xs font-medium text-slate-400 hover:text-slate-600"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
          </svg>
          More
        </button>
      </nav>
    </div>
  )
}
