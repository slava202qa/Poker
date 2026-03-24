import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useTelegram } from './hooks/useTelegram'
import { useApi } from './hooks/useApi'
import { useStore } from './store/useStore'
import { BottomNav } from './components/BottomNav'
import Home from './pages/Home'
import Tables from './pages/Tables'
import Tournaments from './pages/Tournaments'
import TableRoom from './pages/TableRoom'
import Shop from './pages/Shop'
import Profile from './pages/Profile'
import AdminLayout from './pages/admin/AdminLayout'
import AdminShop from './pages/admin/AdminShop'
import AdminTransactions from './pages/admin/AdminTransactions'
import AdminPlayers from './pages/admin/AdminPlayers'
import Dashboard from './pages/admin/Dashboard'
import AdminTables from './pages/admin/AdminTables'
import AdminTournaments from './pages/admin/AdminTournaments'
import AdminUsers from './pages/admin/AdminUsers'
import AdminWithdrawals from './pages/admin/AdminWithdrawals'
import Terms from './pages/Terms'
import Info from './pages/Info'
import Service from './pages/Service'

export default function App() {
  const { tg, user: tgUser } = useTelegram()
  const api = useApi()
  const setUser = useStore((s) => s.setUser)
  const setLoading = useStore((s) => s.setLoading)

  useEffect(() => {
    // Authenticate with backend
    async function init() {
      try {
        const userData = await api.post<any>('/auth/login')
        setUser(userData)
      } catch {
        // Offline / dev mode — set demo user
        if (tgUser) {
          setUser({
            id: 0,
            telegram_id: tgUser.id,
            username: tgUser.username ?? null,
            first_name: tgUser.first_name,
            ton_wallet: null,
            balance: 0,
            fun_balance: 10000,
          })
        }
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  return (
    <div className="max-w-lg mx-auto min-h-screen">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tables" element={<Tables />} />
        <Route path="/tournaments" element={<Tournaments />} />
        <Route path="/table/:tableId" element={<TableRoom />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/info" element={<Info />} />
        <Route path="/service" element={<Service />} />
        {/* Admin panel */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="tables" element={<AdminTables />} />
          <Route path="tournaments" element={<AdminTournaments />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="withdrawals"  element={<AdminWithdrawals />} />
          <Route path="shop"         element={<AdminShop />} />
          <Route path="transactions" element={<AdminTransactions />} />
          <Route path="players"      element={<AdminPlayers />} />
        </Route>
      </Routes>
      <BottomNav />
    </div>
  )
}
