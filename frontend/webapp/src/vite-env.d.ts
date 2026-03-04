/// <reference types="vite/client" />

interface TelegramWebApp {
  initData: string
  initDataUnsafe: {
    user?: {
      id: number
      first_name: string
      last_name?: string
      username?: string
      photo_url?: string
    }
  }
  ready: () => void
  expand: () => void
  close: () => void
  MainButton: {
    text: string
    show: () => void
    hide: () => void
    onClick: (cb: () => void) => void
  }
  BackButton: {
    show: () => void
    hide: () => void
    onClick: (cb: () => void) => void
  }
  HapticFeedback?: {
    impactOccurred?: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
    notificationOccurred?: (type: 'error' | 'success' | 'warning') => void
    selectionChanged?: () => void
  }
  themeParams: {
    bg_color?: string
    text_color?: string
    hint_color?: string
    button_color?: string
    button_text_color?: string
  }
}

interface Window {
  Telegram?: {
    WebApp: TelegramWebApp
  }
}
