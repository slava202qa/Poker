import { useEffect, useState } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useApi } from '../../hooks/useApi'

const tabs = [
  { path: '/admin', label: 'Обзор', icon: '📊' },
  { path: '/admin/tables', label: 'Столы', icon: '🃏' },
  { path: '/admin/tournaments', label: 'Турниры', icon: '🏆' },
  { path: '/admin/users', label: 'Игроки', icon: '👥' },
]

export default function AdminLayout() {
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const api = useApi()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    api.get<any>('/admin/check')
      .then(() => setAuthorized(true))
      .catch(() => setAuthorized(false))
  }, [])

  if (authorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-poker-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="card-surface p-8 text-center max-w-sm">
          <span className="text-4xl mb-4 block">🔒</span>
          <h2 className="text-xl font-bold mb-2">Доступ запрещён</h2>
          <p className="text-gray-400 text-sm mb-4">
            Админ-панель доступна только для администраторов.
          </p>
          <button onClick={() => navigate('/')} className="btn-gold px-6 py-2">
            На главную
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Admin header */}
      <div className="bg-poker-dark border-b border-poker-border px-4 py-3">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-2">
            <span className="text-poker-gold font-bold">ADMIN</span>
            <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded-full">Panel</span>
          </div>
          <button onClick={() => navigate('/')} className="text-gray-500 text-sm">
            ← Выход
          </button>
        </div>
      </div>

      {/* Admin tabs */}
      <div className="bg-poker-darker border-b border-poker-border sticky top-0 z-10">
        <div className="flex max-w-4xl mx-auto">
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.path
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={`flex-1 py-3 text-center text-sm font-medium relative transition-colors ${
                  isActive ? 'text-poker-gold' : 'text-gray-500'
                }`}
              >
                <span className="mr-1">{tab.icon}</span>
                {tab.label}
                {isActive && (
                  <motion.div
                    layoutId="admin-tab"
                    className="absolute bottom-0 left-2 right-2 h-0.5 bg-poker-gold rounded-full"
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <Outlet />
      </div>
    </div>
  )
}
