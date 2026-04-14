/**
 * Returns the stable viewport height for fullscreen modals inside Telegram WebApp.
 * Uses viewportStableHeight from Telegram SDK when available, falls back to 100dvh.
 */
import { useState, useEffect } from 'react'

export function useViewportHeight(): string {
  const [height, setHeight] = useState<string>('100dvh')

  useEffect(() => {
    function update() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tg = (window as any).Telegram?.WebApp
      const stable = tg?.viewportStableHeight
      if (stable && stable > 100) {
        setHeight(`${stable}px`)
      } else {
        setHeight('100dvh')
      }
    }

    update()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tg = (window as any).Telegram?.WebApp
    tg?.onEvent?.('viewportChanged', update)
    return () => {
      tg?.offEvent?.('viewportChanged', update)
    }
  }, [])

  return height
}
