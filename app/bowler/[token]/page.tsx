'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'

import SessionInfo from '@/components/bowler/SessionInfo'
import MyScores from '@/components/bowler/MyScores'
import MyContests from '@/components/bowler/MyContests'
import * as api from '@/lib/api'

// ─── Tab definitions ──────────────────────────────────────────────────────────

type TabId = 'info' | 'scores' | 'contests'

interface TabDef {
  id: TabId
  label: string
  icon: React.ReactNode
}

function IconInfo() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
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

const TABS: TabDef[] = [
  { id: 'info',     label: 'Session Info', icon: <IconInfo /> },
  { id: 'scores',   label: 'My Scores',    icon: <IconScores /> },
  { id: 'contests', label: 'My Contests',  icon: <IconContests /> },
]

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="flex flex-col h-screen bg-slate-900 animate-pulse">
      <div className="h-14 bg-slate-800 border-b border-slate-700 flex items-center px-4 gap-3">
        <div className="h-5 w-40 bg-slate-700 rounded" />
        <div className="ml-auto h-4 w-20 bg-slate-700 rounded" />
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-slate-800 border border-slate-700" />
        ))}
      </div>
      <div className="h-16 bg-slate-800 border-t border-slate-700 flex items-center justify-around px-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="h-5 w-5 rounded bg-slate-700" />
            <div className="h-3 w-12 rounded bg-slate-700" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BowlerDashboard() {
  const params = useParams()
  const token = params?.token as string

  const [activeTab, setActiveTab] = useState<TabId>('info')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<any>(null)

  const fetchData = useCallback(async () => {
    if (!token) return
    try {
      setError(null)
      const result = await api.bowlerDashboard.get(token)
      setData(result)
    } catch (e: any) {
      setError(e.message ?? 'Failed to load your bowling info')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) return <LoadingSkeleton />

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="text-center space-y-4 px-6">
          <p className="text-red-400 font-medium">{error}</p>
          <button
            onClick={() => { setLoading(true); fetchData() }}
            className="btn btn-primary"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <p className="text-slate-400 text-sm">No data found for this link.</p>
      </div>
    )
  }

  const bowlerName = data?.bowler?.name ?? 'Bowler'
  const sessionName = data?.session?.name ?? 'Session'

  function renderTab() {
    switch (activeTab) {
      case 'info':
        return <SessionInfo data={data} />
      case 'scores':
        return <MyScores data={data} />
      case 'contests':
        return <MyContests data={data} />
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white">

      {/* ── Header ── */}
      <header className="h-14 bg-slate-800 border-b border-slate-700 flex items-center px-4 gap-3 shrink-0 z-20">
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold text-white truncate">{bowlerName}</span>
          <span className="text-xs text-slate-400 truncate">{sessionName}</span>
        </div>
        <button
          onClick={() => { setLoading(true); fetchData() }}
          className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          aria-label="Refresh"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </button>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 overflow-y-auto p-4 pb-20">
        {renderTab()}
      </main>

      {/* ── Bottom Tab Bar ── */}
      <nav className="fixed bottom-0 inset-x-0 bg-slate-800 border-t border-slate-700 z-20 flex">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors ${
                isActive
                  ? 'text-blue-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className={isActive ? 'text-blue-400' : 'text-slate-500'}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
