import { useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store/useStore'

export function useWebSocket(tableId: number | null, userId: number | null) {
  const wsRef = useRef<WebSocket | null>(null)
  const setGameState = useStore((s) => s.setGameState)

  useEffect(() => {
    if (!tableId || !userId) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${protocol}//${window.location.host}/ws/table/${tableId}?user_id=${userId}`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
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

    ws.onclose = () => {
      wsRef.current = null
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [tableId, userId, setGameState])

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  return { send }
}
