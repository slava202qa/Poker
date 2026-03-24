import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApi } from '../../hooks/useApi'

interface Player {
  id: number
  telegram_id: number
  username: string | null
  first_name: string
  balance: number
  fun_balance: number
  is_banned: boolean
  created_at: string
}

interface PlayerDetail {
  user_id: number
  telegram_id: number
  username: string | null
  first_name: string
  balance: number
  fun_balance: number
  is_banned: boolean
  hands_played: number
  hands_won: number
  win_rate: number
  total_chips_won: number
  tournaments_played: number
  xp: number
  level: number
  login_streak: number
  tx_count: number
  total_deposited: number
  total_withdrawn: number
  joined_at: string
}

export default function AdminPlayers() {
  const { get, post } = useApi()
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<PlayerDetail | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [adjusting, setAdjusting] = useState<{ id: number; name: string } | null>(null)
  const [adjAmount, setAdjAmount] = useState('')
  const [adjNote, setAdjNote] = useState('')

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const load = async () => {
    setLoading(true)
    try { setPlayers(await get<Player[]>('/admin/users?limit=200')) }
    catch { setPlayers([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openDetail = async (id: number) => {
    try {
      const d = await get<PlayerDetail>(`/admin/players/${id}/detail`)
      setSelected(d)
    } catch { showToast('Ошибка загрузки', false) }
  }

  const toggleBan = async (id: number, banned: boolean) => {
    try {
      await post(`/admin/users/${id}/${banned ? 'unban' : 'ban'}`)
      showToast(banned ? 'Разбанен' : 'Забанен', true)
      load()
      if (selected?.user_id === id) setSelected(s => s ? { ...s, is_banned: !banned } : s)
    } catch { showToast('Ошибка', false) }
  }

  const adjustBalance = async () => {
    if (!adjusting) return
    const amount = parseFloat(adjAmount)
    if (isNaN(amount)) { showToast('Введите число', false); return }
    try {
      await post('/admin/users/' + adjusting.id + '/adjust-balance', {
        amount, reference: adjNote || 'admin_adjust'
      })
      showToast(`Баланс изменён на ${amount} RR`, true)
      setAdjusting(null); setAdjAmount(''); setAdjNote('')
      load()
    } catch (e: any) { showToast(e?.message || 'Ошибка', false) }
  }

  const filtered = players.filter(p =>
    !search || p.first_name.toLowerCase().includes(search.toLowerCase()) ||
    (p.username ?? '').toLowerCase().includes(search.toLowerCase()) ||
    String(p.telegram_id).includes(search)
  )

  return (
    <div className="p-4 relative z-10">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-bold shadow-xl"
            style={{ background: toast.ok ? '#16a34a' : '#dc2626', color: 'white', minWidth: 220, textAlign: 'center' }}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Player detail modal */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-end justify-center"
            style={{ background: 'rgba(0,0,0,0.7)' }}
            onClick={() => setSelected(null)}>
            <motion.div initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg rounded-t-3xl p-5 pb-8 overflow-y-auto max-h-[85vh]"
              style={{ background: '#121212', border: '1px solid rgba(212,168,67,0.2)' }}>

              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-extrabold text-base">{selected.first_name}</h3>
                  <p className="text-xs text-gray-600">
                    {selected.username ? `@${selected.username} · ` : ''}ID {selected.telegram_id}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setAdjusting({ id: selected.user_id, name: selected.first_name })}
                    className="text-xs px-3 py-1.5 rounded-xl font-bold"
                    style={{ background: 'rgba(212,168,67,0.1)', color: '#d4a843' }}>
                    ± Баланс
                  </button>
                  <button onClick={() => toggleBan(selected.user_id, selected.is_banned)}
                    className="text-xs px-3 py-1.5 rounded-xl font-bold"
                    style={selected.is_banned
                      ? { background: 'rgba(34,197,94,0.1)', color: '#4ade80' }
                      : { background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                    {selected.is_banned ? 'Разбанить' : 'Бан'}
                  </button>
                </div>
              </div>

              <div className="divider-gold mb-4" />

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: 'RR Баланс',    value: selected.balance.toLocaleString(),         color: '#d4a843' },
                  { label: 'BR Баланс',    value: selected.fun_balance.toLocaleString(),      color: '#818cf8' },
                  { label: 'Уровень',      value: `${selected.level} (${selected.xp} XP)`,   color: 'white'   },
                  { label: 'Раздач',       value: selected.hands_played,                      color: 'white'   },
                  { label: 'Побед',        value: selected.hands_won,                         color: '#4ade80' },
                  { label: 'Винрейт',      value: `${selected.win_rate}%`,                    color: '#4ade80' },
                  { label: 'Турниров',     value: selected.tournaments_played,                color: 'white'   },
                  { label: 'Депозиты',     value: `+${selected.total_deposited.toLocaleString()}`, color: '#4ade80' },
                  { label: 'Выводы',       value: `-${selected.total_withdrawn.toLocaleString()}`, color: '#f87171' },
                  { label: 'Транзакций',   value: selected.tx_count,                          color: 'white'   },
                  { label: 'Серия входов', value: `${selected.login_streak} дн.`,             color: 'white'   },
                  { label: 'Регистрация',  value: new Date(selected.joined_at).toLocaleDateString('ru-RU'), color: '#6b7280' },
                ].map(s => (
                  <div key={s.label} className="rounded-xl p-2.5 text-center"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="font-bold text-sm" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-[9px] text-gray-600 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>

              <button onClick={() => setSelected(null)} className="w-full btn-secondary py-2.5 text-sm">
                Закрыть
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Adjust balance modal */}
      <AnimatePresence>
        {adjusting && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: 'rgba(0,0,0,0.8)' }}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="w-full max-w-sm rounded-2xl p-5 space-y-3"
              style={{ background: '#1c1c1c', border: '1px solid rgba(212,168,67,0.2)' }}>
              <h3 className="font-bold">Изменить баланс — {adjusting.name}</h3>
              <div>
                <label className="text-[10px] text-gray-600 uppercase tracking-wider mb-1 block">
                  Сумма RR (+ пополнить, − списать)
                </label>
                <input type="number" value={adjAmount} onChange={e => setAdjAmount(e.target.value)}
                  placeholder="например: 500 или -200"
                  className="w-full rounded-xl px-3 py-2.5 text-white outline-none"
                  style={{ background: '#121212', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
              <div>
                <label className="text-[10px] text-gray-600 uppercase tracking-wider mb-1 block">Причина</label>
                <input type="text" value={adjNote} onChange={e => setAdjNote(e.target.value)}
                  placeholder="admin_bonus / correction / ..."
                  className="w-full rounded-xl px-3 py-2.5 text-white outline-none"
                  style={{ background: '#121212', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
              <div className="flex gap-2">
                <button onClick={adjustBalance} className="flex-1 btn-gold py-2.5 text-sm">Применить</button>
                <button onClick={() => { setAdjusting(null); setAdjAmount(''); setAdjNote('') }}
                  className="flex-1 btn-secondary py-2.5 text-sm">Отмена</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-extrabold">Игроки ({players.length})</h2>
      </div>

      {/* Search */}
      <input type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Поиск по имени, @username, ID..."
        className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none mb-4"
        style={{ background: '#1c1c1c', border: '1px solid rgba(255,255,255,0.1)' }} />

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 border-2 border-poker-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p, i) => (
            <motion.div key={p.id}
              initial={{ x: -8, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.02 }}
              className="rounded-xl p-3 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform"
              style={{ background: '#1c1c1c', border: `1px solid ${p.is_banned ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}` }}
              onClick={() => openDetail(p.id)}>

              <div className="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm flex-shrink-0"
                style={{ background: 'rgba(212,168,67,0.08)', color: '#d4a843', border: '1px solid rgba(212,168,67,0.15)' }}>
                {p.first_name[0]?.toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm truncate">{p.first_name}</span>
                  {p.username && <span className="text-[10px] text-gray-600">@{p.username}</span>}
                  {p.is_banned && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                    style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>БАН</span>}
                </div>
                <div className="text-[10px] text-gray-600">ID {p.telegram_id}</div>
              </div>

              <div className="text-right flex-shrink-0">
                <div className="text-sm font-bold text-poker-gold">{p.balance.toLocaleString()}</div>
                <div className="text-[10px] text-gray-600">RR</div>
              </div>

              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
