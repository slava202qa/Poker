import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

const tabs = [
  { path: '/', label: 'Главная', icon: '🏠' },
  { path: '/tables', label: 'Столы', icon: '🃏' },
  { path: '/tournaments', label: 'Турниры', icon: '🏆' },
  { path: '/shop', label: 'Магазин', icon: '💎' },
  { path: '/profile', label: 'Профиль', icon: '👤' },
]

export function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  // Hide nav on table room
  if (location.pathname.startsWith('/table/')) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-poker-darker/95 backdrop-blur-md border-t border-poker-border z-50">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="flex flex-col items-center gap-0.5 px-3 py-1 relative"
            >
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute -top-px left-2 right-2 h-0.5 bg-poker-gold rounded-full"
                />
              )}
              <span className="text-lg">{tab.icon}</span>
              <span className={`text-[10px] font-medium ${isActive ? 'text-poker-gold' : 'text-gray-500'}`}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
