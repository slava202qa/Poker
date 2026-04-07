import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useApi } from '../../hooks/useApi'

interface Stats {
  total_users: number
  active_today: number
  total_tables: number
  active_tables: number
  total_tournaments: number
  total_rake: number
  rake_today: number
  rake_week: number
  rake_month: number
  total_deposited: number
  total_withdrawn: number
  system_balance: number
}

interface RefSettings { bonus_rr: number; total_referrals: number; total_bonus_paid: number }

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [refSettings, setRefSettings] = useState<RefSettings | null>(null)
  const [bonusInput, setBonusInput] = useState('')
  const [bonusSaved, setBonusSaved] = useState(false)
  const api = useApi()

  useEffect(() => {
    api.get<Stats>('/admin/stats').then(setStats).catch(() => {})
    api.get<RefSettings>('/admin/referral/settings').then(s => { setRefSettings(s); setBonusInput(String(s.bonus_rr)) }).catch(() => {})
  }, [])

  if (!stats) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-poker-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const cards = [
    { label: 'Всего игроков', value: stats.total_users, icon: '👥', color: 'text-blue-400' },
    { label: 'Активных сегодня', value: stats.active_today, icon: '🟢', color: 'text-green-400' },
    { label: 'Столов', value: `${stats.active_tables}/${stats.total_tables}`, icon: '🃏', color: 'text-purple-400' },
    { label: 'Турниров', value: stats.total_tournaments, icon: '🏆', color: 'text-yellow-400' },
  ]

  const rakeCards = [
    { label: 'Рейк сегодня', value: stats.rake_today },
    { label: 'Рейк за неделю', value: stats.rake_week },
    { label: 'Рейк за месяц', value: stats.rake_month },
    { label: 'Рейк всего', value: stats.total_rake },
  ]

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">📊 Обзор</h2>

      {/* Main stats */}
      <div className="grid grid-cols-2 gap-3">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.05 }}
            className="card-surface p-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <span>{card.icon}</span>
              <span className="text-xs text-gray-500">{card.label}</span>
            </div>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Rake stats */}
      <div>
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Рейк (RR)</h3>
        <div className="grid grid-cols-2 gap-3">
          {rakeCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 + i * 0.05 }}
              className="card-surface p-4"
            >
              <p className="text-xs text-gray-500 mb-1">{card.label}</p>
              <p className="text-lg font-bold text-poker-gold">{card.value.toFixed(2)}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Financial overview */}
      <div>
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Финансы</h3>
        <div className="card-surface p-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-400">Всего депозитов</span>
            <span className="text-green-400 font-bold">{stats.total_deposited.toFixed(2)} RR</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Всего выводов</span>
            <span className="text-red-400 font-bold">{stats.total_withdrawn.toFixed(2)} RR</span>
          </div>
          <div className="border-t border-poker-border pt-3 flex justify-between">
            <span className="text-gray-400">Балансы игроков</span>
            <span className="text-poker-gold font-bold">{stats.system_balance.toFixed(2)} RR</span>
          </div>
        </div>
      </div>
      {/* Contract balance */}
      <ContractPanel />

      {/* Syndicate settings */}
      <div>
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Синдикат</h3>
        <div className="card-surface p-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-400">Всего агентов завербовано</span>
            <span className="text-white font-bold">{refSettings?.total_referrals ?? 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Выплачено бонусов Синдиката</span>
            <span className="text-poker-gold font-bold">{refSettings?.total_bonus_paid ?? 0} RR</span>
          </div>
          <div className="border-t border-poker-border pt-3">
            <p className="text-xs text-gray-500 mb-2">Бонус за вербовку агента (RR)</p>
            <div className="flex gap-2">
              <input
                type="number"
                value={bonusInput}
                onChange={e => setBonusInput(e.target.value)}
                className="flex-1 rounded-xl px-3 py-2 text-sm bg-black/40 border border-poker-border text-white"
              />
              <button
                onClick={() => {
                  api.post('/admin/referral/settings', { bonus_rr: parseInt(bonusInput) })
                    .then(() => { setBonusSaved(true); setTimeout(() => setBonusSaved(false), 2000) })
                    .catch(() => {})
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold"
                style={{ background: bonusSaved ? 'rgba(34,197,94,0.15)' : 'rgba(212,168,67,0.1)', border: bonusSaved ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(212,168,67,0.25)', color: bonusSaved ? '#4ade80' : '#d4a843' }}
              >
                {bonusSaved ? 'Сохранено' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ContractPanel() {
  const api = useApi()
  const [balance, setBalance] = useState<{ balance_ton: number | null; contract_address: string } | null>(null)
  const [withdrawing, setWithdrawing] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    api.get<any>('/admin/contract/balance').then(setBalance).catch(() => {})
  }, [])

  const handleWithdraw = async () => {
    setWithdrawing(true)
    setMsg('')
    try {
      const res = await api.post<any>('/admin/contract/withdraw_fees', { amount_rr: 0 })
      setMsg(res.status === 'sent' ? `✅ Отправлено tx: ${res.tx_hash}` : `⚠️ ${res.detail || res.status}`)
    } catch (e: any) {
      setMsg(`❌ ${e.message}`)
    } finally {
      setWithdrawing(false)
    }
  }

  return (
    <div>
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">PokerVault Контракт</h3>
      <div className="card-surface p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">Баланс контракта</span>
          <span className="text-white font-bold">
            {balance?.balance_ton != null ? `${balance.balance_ton} TON` : '—'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-xs truncate flex-1 mr-2">Адрес</span>
          <span className="text-[10px] text-gray-600 font-mono truncate max-w-[160px]">
            {balance?.contract_address || 'не настроен'}
          </span>
        </div>
        <div className="border-t border-poker-border pt-3">
          <p className="text-xs text-gray-500 mb-2">Вывести накопленные комиссии платформы на кошелёк владельца</p>
          <button
            onClick={handleWithdraw}
            disabled={withdrawing || !balance?.contract_address || balance.contract_address === 'not configured'}
            className="w-full py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
            style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.25)', color: '#d4a843' }}
          >
            {withdrawing ? 'Отправляем...' : '💰 Вывести комиссии'}
          </button>
          {msg && <p className="text-xs mt-2" style={{ color: msg.startsWith('✅') ? '#4ade80' : '#f87171' }}>{msg}</p>}
        </div>
      </div>
    </div>
  )
}
