import { useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store/useStore'
import { useTelegram } from './useTelegram'

const RECONNECT_DELAY_MS = 3000
const MAX_RECONNECT_ATTEMPTS = 5

export function useWebSocket(tableId: number | null) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttempts = useRef(0)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setGameState = useStore((s) => s.setGameState)
  const { initData } = useTelegram()

  const connect = useCallback(() => {
    if (!tableId || !initData) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    // initData passed as query param — validated server-side via HMAC
    const url = `${protocol}//${window.location.host}/ws/table/${tableId}?initData=${encodeURIComponent(initData)}`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      reconnectAttempts.current = 0
      ws.send(JSON.stringify({ type: 'get_state' }))
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.table_id !== undefined) {
          setGameState(data)
        }
      } catch {}
    }

    ws.onclose = (e) => {
      wsRef.current = null
      // Don't reconnect on auth failure (4001/4002/4003)
      if (e.code >= 4001 && e.code <= 4003) return
      if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts.current++
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS)
      }
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [tableId, initData, setGameState])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [connect])

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  return { send }
}
