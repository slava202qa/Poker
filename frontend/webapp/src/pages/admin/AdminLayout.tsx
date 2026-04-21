import { useEffect, useState, useRef } from "react"
import { useNavigate, useLocation, Outlet } from "react-router-dom"
import { motion } from "framer-motion"
import { useApi } from "../../hooks/useApi"

// Cache admin auth result for the session — avoids re-checking on every tab switch
let _adminAuthCache: { state: "ok" | "forbidden" | "no_init_data"; msg: string } | null = null

const tabs = [
  { path: "/admin",              label: "Обзор",      icon: "📊" },
  { path: "/admin/tables",       label: "Столы",      icon: "🃏" },
  { path: "/admin/tournaments",  label: "Турниры",    icon: "🏆" },
  { path: "/admin/shop",         label: "Магазин",    icon: "🛍" },
  { path: "/admin/players",      label: "Игроки",     icon: "👥" },
  { path: "/admin/syndicates",   label: "Картели",    icon: "⚔️" },
  { path: "/admin/transactions", label: "Транзакции", icon: "💳" },
  { path: "/admin/withdrawals",  label: "Переводы",   icon: "💸" },
]

type AuthState = "loading" | "ok" | "forbidden" | "no_init_data"

export default function AdminLayout() {
  const [authState, setAuthState] = useState<AuthState>("loading")
  const [errorMsg, setErrorMsg] = useState("")
  const api = useApi()
  const navigate = useNavigate()
  const location = useLocation()

  async function checkAccess(force = false) {
    // Use cached result if available and not forcing re-check
    if (!force && _adminAuthCache) {
      setAuthState(_adminAuthCache.state)
      setErrorMsg(_adminAuthCache.msg)
      return
    }

    setAuthState("loading")
    setErrorMsg("")

    // Wait up to 4s for Telegram WebApp to populate initData
    let initData = ""
    for (let i = 0; i < 20; i++) {
      initData = (window as any).Telegram?.WebApp?.initData ?? ""
      if (initData) break
      await new Promise(r => setTimeout(r, 200))
    }

    if (!initData) {
      _adminAuthCache = { state: "no_init_data", msg: "" }
      setAuthState("no_init_data")
      return
    }

    try {
      const res = await fetch("/api/admin/check", {
        headers: { "X-Init-Data": initData, "Content-Type": "application/json" },
      })
      if (res.ok) {
        _adminAuthCache = { state: "ok", msg: "" }
        setAuthState("ok")
      } else {
        let detail = "Нет доступа"
        try { const j = await res.json(); detail = j.detail ?? detail } catch {}
        const msg = `${detail} (HTTP ${res.status})`
        _adminAuthCache = { state: "forbidden", msg }
        setErrorMsg(msg)
        setAuthState("forbidden")
      }
    } catch (e: any) {
      const msg = `Сеть: ${e?.message ?? "ошибка соединения"}`
      setErrorMsg(msg)
      setAuthState("forbidden")
      // Don't cache network errors — allow retry
    }
  }

  useEffect(() => { checkAccess() }, [])

  if (authState === "loading") return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 border-2 border-poker-gold border-t-transparent rounded-full animate-spin" />
      <p className="text-xs text-gray-500">Проверка доступа...</p>
    </div>
  )

  if (authState === "no_init_data") return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="card-surface p-8 text-center max-w-sm">
        <span className="text-4xl mb-4 block">📱</span>
        <h2 className="text-lg font-bold mb-2">Откройте через Telegram</h2>
        <p className="text-gray-500 text-sm mb-5">Нажмите <b className="text-white">⚙️ Админ панель</b> в боте.</p>
        <a href="https://t.me/POKER_VIP_1_Bot" className="btn-gold px-6 py-2.5 text-sm inline-block">Открыть бота</a>
      </div>
    </div>
  )

  if (authState === "forbidden") return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="card-surface p-8 text-center max-w-sm">
        <span className="text-4xl mb-4 block">🔒</span>
        <h2 className="text-xl font-bold mb-2">Ошибка доступа</h2>
        {errorMsg && (
          <p className="text-red-400 text-xs mb-3 font-mono break-all">{errorMsg}</p>
        )}
        <div className="flex gap-3 justify-center">
          <button onClick={() => { _adminAuthCache = null; checkAccess(true) }} className="btn-gold px-5 py-2.5 text-sm">Повторить</button>
          <button onClick={() => navigate("/")} className="px-5 py-2.5 text-sm text-gray-400 border border-gray-700 rounded-xl">На главную</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen pb-24" style={{ background: "#0a0a0a" }}>
      <div className="px-4 py-3 flex items-center justify-between sticky top-0 z-20"
        style={{ background: "#0a0a0a", borderBottom: "1px solid rgba(212,168,67,0.15)" }}>
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-poker-gold tracking-wider text-sm">ROYAL ROLL</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
            style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
            ADMIN
          </span>
        </div>
        <button onClick={() => navigate("/")} className="text-gray-600 text-xs hover:text-white transition-colors">
          ← Выход
        </button>
      </div>

      <div className="sticky top-[49px] z-10 px-2 py-2 overflow-x-auto"
        style={{ background: "#0a0a0a", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="flex gap-1 min-w-max">
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.path
            return (
              <button key={tab.path} onClick={() => navigate(tab.path)}
                className="flex-shrink-0 px-3 py-2 text-center text-[11px] font-bold relative transition-colors rounded-xl"
                style={{ color: isActive ? "#d4a843" : "#6b7280" }}>
                {isActive && (
                  <motion.div layoutId="admin-tab" className="absolute inset-0 rounded-xl"
                    style={{ background: "rgba(212,168,67,0.08)", border: "1px solid rgba(212,168,67,0.2)" }} />
                )}
                <span className="relative z-10 flex flex-col items-center gap-0.5">
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        <Outlet />
      </div>
    </div>
  )
}
