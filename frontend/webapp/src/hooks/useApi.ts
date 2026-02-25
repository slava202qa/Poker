import { useTelegram } from './useTelegram'

const BASE_URL = '/api'

export function useApi() {
  const { initData } = useTelegram()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (initData) {
    headers['X-Init-Data'] = initData
  }

  async function get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, { headers })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }

  async function post<T>(path: string, body?: any): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }

  return { get, post }
}
