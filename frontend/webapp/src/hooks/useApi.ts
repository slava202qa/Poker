const BASE_URL = '/api'

function getInitData(): string {
  // Always read fresh from window at call time — never from stale closure
  return window.Telegram?.WebApp?.initData ?? ''
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const initData = getInitData()
  if (initData) headers['X-Init-Data'] = initData
  return headers
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(BASE_URL + path, { headers: getHeaders() })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE_URL + path, {
    method: 'POST',
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function postForm<T>(path: string, form: FormData): Promise<T> {
  const headers: Record<string, string> = {}
  const initData = getInitData()
  if (initData) headers['X-Init-Data'] = initData
  const res = await fetch(BASE_URL + path, { method: 'POST', headers, body: form })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(BASE_URL + path, { method: 'DELETE', headers: getHeaders() })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// Stable object — never changes, no hook needed
const api = { get, post, postForm, del }

export function useApi() {
  return api
}
