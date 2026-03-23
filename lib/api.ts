'use client'

// Client-side API helpers — all calls go through Next.js API routes

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

// ─── Sessions ───────────────────────────────────────────────────────────────

export const sessions = {
  list: () => req<any[]>('/sessions'),
  create: (data: { name: string; date: string }) =>
    req<any>('/sessions', { method: 'POST', body: JSON.stringify(data) }),
  get: (id: number) => req<any>(`/sessions/${id}`),
  update: (id: number, data: object) =>
    req<any>(`/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  close: (id: number) =>
    req<any>(`/sessions/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'closed' }) }),
}

// ─── Bowlers ────────────────────────────────────────────────────────────────

export const bowlers = {
  list: (sessionId: number) => req<any[]>(`/sessions/${sessionId}/bowlers`),
  add: (sessionId: number, data: { name: string; handicap: number; num_entries: number }) =>
    req<any>(`/sessions/${sessionId}/bowlers`, { method: 'POST', body: JSON.stringify(data) }),
  update: (sessionId: number, bowlerId: number, data: object) =>
    req<any>(`/sessions/${sessionId}/bowlers/${bowlerId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (sessionId: number, bowlerId: number) =>
    req<any>(`/sessions/${sessionId}/bowlers/${bowlerId}`, { method: 'DELETE' }),
  recordPayment: (sessionId: number, bowlerId: number, amount: number) =>
    req<any>(`/sessions/${sessionId}/bowlers/${bowlerId}`, {
      method: 'PATCH',
      body: JSON.stringify({ payment: amount }),
    }),
  applyCredit: (sessionId: number, bowlerId: number, creditAmount: number) =>
    req<any>(`/sessions/${sessionId}/bowlers/${bowlerId}`, {
      method: 'PATCH',
      body: JSON.stringify({ apply_credit: creditAmount }),
    }),
}

// ─── Scores ─────────────────────────────────────────────────────────────────

export const scores = {
  list: (sessionId: number) => req<any[]>(`/sessions/${sessionId}/scores`),
  upsert: (sessionId: number, data: { bowler_id: number; game: number; raw_score: number }[]) =>
    req<any>(`/sessions/${sessionId}/scores`, { method: 'POST', body: JSON.stringify({ scores: data }) }),
}

// ─── AI Scoresheet Scan ─────────────────────────────────────────────────────

export async function scanScoresheet(
  sessionId: number,
  game: number,
  imageFile: File,
): Promise<any> {
  // Resize client-side before upload
  const resized = await resizeImage(imageFile, 1280)
  const form = new FormData()
  form.append('image', resized, imageFile.name)
  form.append('game', String(game))

  const res = await fetch(`/api/sessions/${sessionId}/scores/scan`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) throw new Error((await res.json()).error ?? 'Scan failed')
  return res.json()
}

async function resizeImage(file: File, maxPx: number): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => resolve(new File([blob!], file.name, { type: 'image/jpeg' })),
        'image/jpeg',
        0.88,
      )
    }
    img.src = url
  })
}

// ─── Score Submissions ──────────────────────────────────────────────────────

export const submissions = {
  list: (sessionId: number) => req<any[]>(`/sessions/${sessionId}/scores/submissions`),
  approve: (sessionId: number, subId: number) =>
    req<any>(`/sessions/${sessionId}/scores/submissions/${subId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'approved' }),
    }),
  reject: (sessionId: number, subId: number) =>
    req<any>(`/sessions/${sessionId}/scores/submissions/${subId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'rejected' }),
    }),
  approveAll: (sessionId: number) =>
    req<any>(`/sessions/${sessionId}/scores/submissions`, {
      method: 'PATCH',
      body: JSON.stringify({ approve_all: true }),
    }),
}

export async function submitBowlerScoresheet(
  sessionId: number,
  bowlerToken: string,
  game: number,
  imageFile: File,
): Promise<any> {
  const resized = await resizeImage(imageFile, 1280)
  const form = new FormData()
  form.append('image', resized, imageFile.name)
  form.append('game', String(game))
  form.append('bowler_token', bowlerToken)

  const res = await fetch(`/api/sessions/${sessionId}/scores/submissions`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) throw new Error((await res.json()).error ?? 'Upload failed')
  return res.json()
}

// ─── Brackets ───────────────────────────────────────────────────────────────

export const brackets = {
  generate: (sessionId: number) =>
    req<any>(`/sessions/${sessionId}/brackets`, { method: 'POST' }),
  get: (sessionId: number) => req<any>(`/sessions/${sessionId}/brackets`),
}

// ─── Contests ───────────────────────────────────────────────────────────────

export const contests = {
  results: (sessionId: number) => req<any>(`/sessions/${sessionId}/contests`),
  drawDoubles: (sessionId: number) =>
    req<any>(`/sessions/${sessionId}/contests`, {
      method: 'POST',
      body: JSON.stringify({ action: 'draw_doubles' }),
    }),
  updateEntry: (sessionId: number, contestType: string, bowlerId: number, enrolled: boolean) =>
    req<any>(`/sessions/${sessionId}/contests`, {
      method: 'PATCH',
      body: JSON.stringify({ contest_type: contestType, bowler_id: bowlerId, enrolled }),
    }),
}

// ─── Payouts ────────────────────────────────────────────────────────────────

export const payouts = {
  summary: (sessionId: number) => req<any>(`/sessions/${sessionId}/payouts`),
  calculate: (sessionId: number) =>
    req<any>(`/sessions/${sessionId}/payouts`, { method: 'POST' }),
  markPaid: (sessionId: number, payoutId: number) =>
    req<any>(`/sessions/${sessionId}/payouts`, {
      method: 'PATCH',
      body: JSON.stringify({ payout_id: payoutId, is_paid: true }),
    }),
  markAllPaid: (sessionId: number, bowlerId: number) =>
    req<any>(`/sessions/${sessionId}/payouts`, {
      method: 'PATCH',
      body: JSON.stringify({ bowler_id: bowlerId, pay_all: true }),
    }),
  forward: (sessionId: number, bowlerId: number) =>
    req<any>(`/sessions/${sessionId}/payouts`, {
      method: 'PATCH',
      body: JSON.stringify({ bowler_id: bowlerId, forward: true }),
    }),
}

// ─── Delegates ──────────────────────────────────────────────────────────────

export const delegates = {
  list: (sessionId: number) => req<any[]>(`/sessions/${sessionId}/delegates`),
  add: (sessionId: number, data: { name: string; can_manage_entries: boolean; can_enter_scores: boolean; can_record_payments: boolean }) =>
    req<any>(`/sessions/${sessionId}/delegates`, { method: 'POST', body: JSON.stringify(data) }),
  update: (sessionId: number, delegateId: number, data: object) =>
    req<any>(`/sessions/${sessionId}/delegates/${delegateId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  remove: (sessionId: number, delegateId: number) =>
    req<any>(`/sessions/${sessionId}/delegates/${delegateId}`, { method: 'DELETE' }),
  verify: (code: string) =>
    req<any>('/sessions/delegate-login', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
}

// ─── Overview ───────────────────────────────────────────────────────────────

export const overview = {
  get: (sessionId: number) => req<any>(`/sessions/${sessionId}/overview`),
}

// ─── Bowler Dashboard ───────────────────────────────────────────────────────

export const bowlerDashboard = {
  get: (token: string) => req<any>(`/bowler/${token}`),
}
