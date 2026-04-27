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
import AdminSyndicates from './pages/admin/AdminSyndicates'
import AdminHandHistory from './pages/admin/AdminHandHistory'
import Terms from './pages/Terms'
import Info from './pages/Info'
import Service from './pages/Service'
import Referral from './pages/Referral'
import Friends from './pages/Friends'
import Syndicates from './pages/Syndicates'
import Deposit from './pages/Deposit'

export default function App() {
  const { tg, user: tgUser } = useTelegram()
  const api = useApi()
  const setUser = useStore((s) => s.setUser)
  const setLoading = useStore((s) => s.setLoading)
  const setEquippedCardSkin = useStore((s) => s.setEquippedCardSkin)

  useEffect(() => {
    // Authenticate with backend
    async function init() {
      try {
        await api.post<any>('/auth/login')
        // Fetch full profile (includes avatar_url, bio, vip_status)
        const userData = await api.get<any>('/profile/me')
        setUser(userData)
        // Load equipped card skin
        try {
          const equipped = await api.get<Record<string, any>>('/shop/equipped')
          if (equipped?.card_skin?.image_url) {
            setEquippedCardSkin(equipped.card_skin.image_url)
          }
        } catch {}
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
            avatar_url: null,
            bio: null,
            vip_status: 'none',
            vip_expires_at: null,
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
        <Route path="/referral" element={<Referral />} />
        <Route path="/friends" element={<Friends />} />
        <Route path="/syndicates" element={<Syndicates />} />
        <Route path="/deposit" element={<Deposit />} />
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
          <Route path="syndicates"   element={<AdminSyndicates />} />
          <Route path="hand-history" element={<AdminHandHistory />} />
        </Route>
      </Routes>
      <BottomNav />
    </div>
  )
}
