const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

function get<T>(url: string) { return request<T>(url); }
function post<T>(url: string, body?: unknown) {
  return request<T>(url, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
}
function put<T>(url: string, body?: unknown) {
  return request<T>(url, { method: 'PUT', body: body ? JSON.stringify(body) : undefined });
}
function del<T>(url: string) { return request<T>(url, { method: 'DELETE' }); }

// Sessions
export const api = {
  sessions: {
    list: () => get<any[]>('/sessions'),
    get: (id: string) => get<any>(`/sessions/${id}`),
    create: (data: { name: string; date: string }) => post<any>('/sessions', data),
    update: (id: string, data: any) => put<any>(`/sessions/${id}`, data),
    delete: (id: string) => del<any>(`/sessions/${id}`),
    updateSettings: (id: string, settings: any) => put<any>(`/sessions/${id}/settings`, settings),
    overview: (id: string) => get<any>(`/sessions/${id}/overview`),
  },
  bowlers: {
    list: (sessionId: string) => get<any[]>(`/sessions/${sessionId}/bowlers`),
    create: (sessionId: string, data: any) => post<any>(`/sessions/${sessionId}/bowlers`, data),
    update: (sessionId: string, bowlerId: string, data: any) => put<any>(`/sessions/${sessionId}/bowlers/${bowlerId}`, data),
    delete: (sessionId: string, bowlerId: string) => del<any>(`/sessions/${sessionId}/bowlers/${bowlerId}`),
    payment: (sessionId: string, bowlerId: string, amount: number) =>
      post<any>(`/sessions/${sessionId}/bowlers/${bowlerId}/payment`, { amount }),
    toggleContest: (sessionId: string, bowlerId: string, contest_type: string, enrolled: boolean) =>
      post<any>(`/sessions/${sessionId}/bowlers/${bowlerId}/contest-entry`, { contest_type, enrolled }),
    contestEntries: (sessionId: string) => get<any[]>(`/sessions/${sessionId}/contest-entries`),
  },
  scores: {
    list: (sessionId: string) => get<any[]>(`/sessions/${sessionId}/scores`),
    submit: (sessionId: string, scores: any[]) => post<any>(`/sessions/${sessionId}/scores`, { scores }),
    submissions: (sessionId: string) => get<any[]>(`/sessions/${sessionId}/submissions`),
    approveSubmission: (sessionId: string, sid: string) =>
      post<any>(`/sessions/${sessionId}/submissions/${sid}/approve`),
    rejectSubmission: (sessionId: string, sid: string) =>
      post<any>(`/sessions/${sessionId}/submissions/${sid}/reject`),
  },
  brackets: {
    list: (sessionId: string) => get<any[]>(`/sessions/${sessionId}/brackets`),
    generate: (sessionId: string) => post<any>(`/sessions/${sessionId}/brackets/generate`),
    resolve: (sessionId: string, game: number) => post<any>(`/sessions/${sessionId}/brackets/resolve/${game}`),
  },
  contests: {
    results: (sessionId: string) => get<any>(`/sessions/${sessionId}/contests`),
    drawDoubles: (sessionId: string) => post<any>(`/sessions/${sessionId}/mystery-doubles/draw`),
  },
  payouts: {
    summary: (sessionId: string) => get<any>(`/sessions/${sessionId}/payouts`),
    calculate: (sessionId: string) => post<any>(`/sessions/${sessionId}/payouts/calculate`),
    pay: (sessionId: string, payoutId: string) => post<any>(`/sessions/${sessionId}/payouts/${payoutId}/pay`),
    payAll: (sessionId: string, bowlerId: string) => post<any>(`/sessions/${sessionId}/payouts/bowler/${bowlerId}/pay-all`),
    forward: (sessionId: string, bowlerId: string) => post<any>(`/sessions/${sessionId}/payouts/bowler/${bowlerId}/forward`),
  },
  delegates: {
    list: (sessionId: string) => get<any[]>(`/sessions/${sessionId}/delegates`),
    create: (sessionId: string, data: any) => post<any>(`/sessions/${sessionId}/delegates`, data),
    update: (sessionId: string, delegateId: string, data: any) =>
      put<any>(`/sessions/${sessionId}/delegates/${delegateId}`, data),
    delete: (sessionId: string, delegateId: string) => del<any>(`/sessions/${sessionId}/delegates/${delegateId}`),
    auth: (access_code: string) => post<any>('/delegate/auth', { access_code }),
  },
  bowlerDashboard: (token: string) => get<any>(`/bowler/${token}`),
};

export async function scanScoresheet(sessionId: string, game: number, imageFile: File) {
  const formData = new FormData();
  formData.append('image', imageFile);
  formData.append('game', String(game));

  const res = await fetch(`${BASE}/sessions/${sessionId}/scores/scan`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export function subscribeToSession(sessionId: string, onUpdate: () => void): () => void {
  const es = new EventSource(`${BASE}/sessions/${sessionId}/events`);
  es.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.type === 'update') onUpdate();
  };
  return () => es.close();
}
