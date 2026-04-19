const BASE_URL = '/api'

function getInitData(): string {
  return (window as any).Telegram?.WebApp?.initData ?? ''
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const initData = getInitData()
  if (initData) headers['X-Init-Data'] = initData
  return headers
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.ok) return res.json()
  // Parse error detail from FastAPI response
  let detail = `HTTP ${res.status}`
  try {
    const body = await res.json()
    detail = body?.detail ?? body?.message ?? JSON.stringify(body)
  } catch {
    try { detail = await res.text() } catch {}
  }
  const err: any = new Error(detail)
  err.detail = detail
  err.status = res.status
  throw err
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(BASE_URL + path, { headers: getHeaders() })
  return handleResponse<T>(res)
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE_URL + path, {
    method: 'POST',
    headers: getHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(res)
}

async function postForm<T>(path: string, form: FormData): Promise<T> {
  const headers: Record<string, string> = {}
  const initData = getInitData()
  if (initData) headers['X-Init-Data'] = initData
  const res = await fetch(BASE_URL + path, { method: 'POST', headers, body: form })
  return handleResponse<T>(res)
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(BASE_URL + path, { method: 'DELETE', headers: getHeaders() })
  return handleResponse<T>(res)
}

async function put<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE_URL + path, {
    method: 'PUT',
    headers: getHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(res)
}

async function patch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE_URL + path, {
    method: 'PATCH',
    headers: getHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(res)
}

const api = { get, post, postForm, del, put, patch }

export function useApi() {
  return api
}
