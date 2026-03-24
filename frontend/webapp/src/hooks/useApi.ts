import { useTelegram } from './useTelegram'

const BASE_URL = '/api'

export function useApi() {
  const { tg } = useTelegram()

  function getHeaders(): Record<string, string> {
    const initData = tg?.initData ?? ''
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (initData) headers['X-Init-Data'] = initData
    return headers
  }

  async function get<T>(path: string): Promise<T> {
    const res = await fetch(BASE_URL + path, { headers: getHeaders() })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }

  async function post<T>(path: string, body?: any): Promise<T> {
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
    const initData = tg?.initData ?? ''
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

  return { get, post, postForm, del }
}
