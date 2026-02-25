import { useEffect, useMemo } from 'react'

export function useTelegram() {
  const tg = useMemo(() => window.Telegram?.WebApp, [])

  useEffect(() => {
    tg?.ready()
    tg?.expand()
  }, [tg])

  return {
    tg,
    user: tg?.initDataUnsafe?.user ?? null,
    initData: tg?.initData ?? '',
  }
}
