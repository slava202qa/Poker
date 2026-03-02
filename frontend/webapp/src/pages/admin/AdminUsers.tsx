import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApi } from '../../hooks/useApi'

interface UserInfo {
  id: number
  telegram_id: number
  username: string | null
  first_name: string
  ton_wallet: string | null
  balance: number
  is_banned: boolean
  created_at: string
  last_seen: string
}

interface TxInfo {
  id: number
  type: string
  amount: number
  balance_after: number
  reference: string | null
  ton_tx_hash: string | null
  created_at: string
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserInfo[]>([])
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserInfo | null>(null)
  const [transactions, setTransactions] = useState<TxInfo[]>([])
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const api = useApi()

  const load = () => {
    api.get<UserInfo[]>(`/admin/users?search=${search}&limit=100`).then(setUsers).catch(() => {})
  }

  useEffect(() => { load() }, [search])

  const handleSelectUser = async (user: UserInfo) => {
    setSelectedUser(user)
    try {
      const txs = await api.get<TxInfo[]>(`/admin/users/${user.id}/transactions?limit=20`)
      setTransactions(txs)
    } catch { setTransactions([]) }
  }

  const handleBan = async (userId: number, ban: boolean) => {
    try {
      await api.post(`/admin/users/${userId}/ban`, { banned: ban })
      load()
      if (selectedUser?.id === userId) {
        setSelectedUser({ ...selectedUser, is_banned: ban })
      }
    } catch {}
  }

  const handleAdjust = async () => {
    if (!selectedUser || !adjustAmount) return
    try {
      const result = await api.post<any>(`/admin/users/${selectedUser.id}/adjust-balance`, {
        amount: Number(adjustAmount),
        reason: adjustReason || 'admin adjustment',
      })
      setSelectedUser({ ...selectedUser, balance: result.new_balance })
      setAdjustAmount('')
      setAdjustReason('')
      load()
      // Reload transactions
      const txs = await api.get<TxInfo[]>(`/admin/users/${selectedUser.id}/transactions?limit=20`)
      setTransactions(txs)
    } catch (e: any) {
      alert(e.message)
    }
  }

  const TX_LABELS: Record<string, { label: string; color: string }> = {
    deposit: { label: 'Депозит', color: 'text-green-400' },
    withdraw: { label: 'Вывод', color: 'text-red-400' },
    buy_in: { label: 'Бай-ин', color: 'text-orange-400' },
    cash_out: { label: 'Кэш-аут', color: 'text-blue-400' },
    rake: { label: 'Рейк', color: 'text-gray-400' },
    tournament_entry: { label: 'Турнир', color: 'text-purple-400' },
    tournament_prize: { label: 'Приз', color: 'text-yellow-400' },
    bonus: { label: 'Бонус', color: 'text-poker-gold' },
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">👥 Игроки</h2>

      {/* Search */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Поиск по имени или username..."
        className="w-full bg-poker-darker border border-poker-border rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-poker-gold/50"
      />

      <div className="flex gap-4">
        {/* Users list */}
        <div className="flex-1 space-y-1 max-h-[60vh] overflow-y-auto">
          {users.map((u) => (
            <div
              key={u.id}
              onClick={() => handleSelectUser(u)}
              className={`card-surface p-3 cursor-pointer transition-all ${
                selectedUser?.id === u.id ? 'border-poker-gold/50' : 'hover:border-poker-border'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-sm">{u.first_name}</span>
                  {u.username && <span className="text-gray-500 text-xs ml-1">@{u.username}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-poker-gold text-xs font-bold">{u.balance.toFixed(0)}</span>
                  {u.is_banned && <span className="text-red-400 text-[10px]">BAN</span>}
                </div>
              </div>
            </div>
          ))}
          {users.length === 0 && (
            <p className="text-gray-500 text-center py-8 text-sm">Нет игроков</p>
          )}
        </div>

        {/* User detail panel */}
        <AnimatePresence>
          {selectedUser && (
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              className="w-72 space-y-3 flex-shrink-0"
            >
              {/* User info */}
              <div className="card-surface p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-poker-gold to-yellow-600 flex items-center justify-center font-bold text-poker-darker">
                    {selectedUser.first_name[0]}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{selectedUser.first_name}</p>
                    <p className="text-xs text-gray-500">ID: {selectedUser.telegram_id}</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Баланс</span>
                    <span className="text-poker-gold font-bold">{selectedUser.balance.toFixed(2)} CHIP</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Кошелёк</span>
                    <span className="text-gray-300 truncate max-w-[120px]">{selectedUser.ton_wallet || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Регистрация</span>
                    <span className="text-gray-300">{new Date(selectedUser.created_at).toLocaleDateString('ru-RU')}</span>
                  </div>
                </div>

                {/* Ban/Unban */}
                <button
                  onClick={() => handleBan(selectedUser.id, !selectedUser.is_banned)}
                  className={`w-full mt-3 py-2 rounded-lg text-xs font-bold ${
                    selectedUser.is_banned
                      ? 'bg-green-900/30 text-green-400 border border-green-700/30'
                      : 'bg-red-900/30 text-red-400 border border-red-700/30'
                  }`}
                >
                  {selectedUser.is_banned ? 'Разбанить' : 'Забанить'}
                </button>
              </div>

              {/* Adjust balance */}
              <div className="card-surface p-4">
                <p className="text-xs font-bold text-gray-400 mb-2">Изменить баланс</p>
                <input
                  type="number"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="Сумма (+/-)"
                  className="w-full bg-poker-darker border border-poker-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none mb-2"
                />
                <input
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Причина"
                  className="w-full bg-poker-darker border border-poker-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none mb-2"
                />
                <button onClick={handleAdjust} className="w-full btn-gold py-2 text-xs">
                  Применить
                </button>
              </div>

              {/* Transactions */}
              <div className="card-surface p-4">
                <p className="text-xs font-bold text-gray-400 mb-2">Последние транзакции</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {transactions.map((tx) => {
                    const info = TX_LABELS[tx.type] || { label: tx.type, color: 'text-gray-400' }
                    return (
                      <div key={tx.id} className="flex items-center justify-between text-[11px] py-1 border-b border-poker-border/30">
                        <div>
                          <span className={info.color}>{info.label}</span>
                          <span className="text-gray-600 ml-1">
                            {new Date(tx.created_at).toLocaleDateString('ru-RU')}
                          </span>
                        </div>
                        <span className={tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {tx.amount >= 0 ? '+' : ''}{tx.amount.toFixed(2)}
                        </span>
                      </div>
                    )
                  })}
                  {transactions.length === 0 && (
                    <p className="text-gray-600 text-[11px]">Нет транзакций</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
