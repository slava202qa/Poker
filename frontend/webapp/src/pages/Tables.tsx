import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useViewportHeight } from '../hooks/useViewportHeight'
import { useApi } from '../hooks/useApi'
import { useStore } from '../store/useStore'

type Currency = 'chip' | 'fun'

interface Table {
  id: number
  name: string
  currency: string
  poker_type: string
  max_players: number
  small_blind: number
  big_blind: number
  min_buy_in: number
  max_buy_in: number
  action_timer: number
  is_private: boolean
  invite_token: string | null
  status: string
  current_players: number
}

interface CreateForm {
  name: string
  poker_type: string
  max_players: number
  small_blind: number
  big_blind: number
  min_buy_in: number
  max_buy_in: number
  action_timer: number
  is_private: boolean
  password: string
}

const BLIND_PRESETS = [
  { label: '1/2', sb: 1, bb: 2 },
  { label: '5/10', sb: 5, bb: 10 },
  { label: '25/50', sb: 25, bb: 50 },
  { label: '100/200', sb: 100, bb: 200 },
]

const EMPTY_FORM: CreateForm = {
  name: '',
  poker_type: 'holdem',
  max_players: 6,
  small_blind: 5,
  big_blind: 10,
  min_buy_in: 200,
  max_buy_in: 1000,
  action_timer: 30,
  is_private: false,
  password: '',
}

export default function Tables() {
  const vh = useViewportHeight()
  const [tables, setTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Currency>('chip')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createdTable, setCreatedTable] = useState<Table | null>(null)
  const navigate = useNavigate()
  const api = useApi()
  const user = useStore((s) => s.user)
  const setHideNav = useStore((s) => s.setHideNav)

  const loadTables = () => {
    setLoading(true)
    api.get<Table[]>(`/tables/?currency=${tab}`)
      .then(setTables)
      .catch(() => setTables([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadTables() }, [tab])

  const isVip = tab === 'chip'
  const balance = isVip ? (user?.balance ?? 0) : (user?.fun_balance ?? 0)

  const applyBlindPreset = (sb: number, bb: number) => {
    setForm(f => ({ ...f, small_blind: sb, big_blind: bb, min_buy_in: bb * 40, max_buy_in: bb * 100 }))
  }

  const handleCreate = async () => {
    if (!form.name.trim()) { setCreateError('Введите название стола'); return }
    if (form.is_private && !form.password.trim()) { setCreateError('Введите пароль для приватного стола'); return }
    setCreating(true)
    setCreateError('')
    try {
      const payload: any = {
        name: form.name, currency: tab, poker_type: form.poker_type,
        max_players: form.max_players, small_blind: form.small_blind,
        big_blind: form.big_blind, min_buy_in: form.min_buy_in,
        max_buy_in: form.max_buy_in, action_timer: form.action_timer,
        is_private: form.is_private,
      }
      if (form.is_private && form.password) payload.password = form.password
      const t = await api.post<Table>('/tables/', payload)
      setCreatedTable(t)
      setShowCreate(false)
      setHideNav(false)
      setForm(EMPTY_FORM)
      loadTables()
    } catch (e: any) {
      setCreateError(e?.detail || 'Ошибка создания стола')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen pb-20 px-4 pt-5 relative z-10">

      <div className="flex gap-2 mb-5">
        {(['chip', 'fun'] as Currency[]).map((c) => (
          <button key={c} onClick={() => setTab(c)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${tab === c ? 'tab-pill-active' : 'tab-pill-inactive'}`}>
            {c === 'chip' ? '♠ VIP Клуб' : '♣ Public Hall'}
          </button>
        ))}
      </div>

      <div className="rounded-xl px-4 py-2.5 mb-4 flex items-center justify-between"
        style={{ background: isVip ? 'rgba(212,168,67,0.06)' : 'rgba(99,102,241,0.06)', border: `1px solid ${isVip ? 'rgba(212,168,67,0.15)' : 'rgba(99,102,241,0.15)'}` }}>
        <span className="text-xs text-gray-500">Ваши активы</span>
        <span className={`font-bold text-sm ${isVip ? 'text-poker-gold' : 'text-indigo-400'}`}>
          {balance.toLocaleString()} {isVip ? 'RR' : 'BR'}
        </span>
      </div>

      <div className="flex items-center justify-between mb-4">
        <motion.h2 key={tab} initial={{ x: -16, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
          className="text-lg font-extrabold tracking-tight">
          {isVip ? '♠ VIP Столы' : '♣ Открытые Столы'}
        </motion.h2>
        <button onClick={() => { setShowCreate(true); setCreateError(''); setCreatedTable(null); setHideNav(true) }}
          className="text-xs font-bold px-3 py-2 rounded-xl transition-all"
          style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.25)', color: '#d4a843' }}>
          + Создать стол
        </button>
      </div>

      <AnimatePresence>
        {createdTable && createdTable.is_private && createdTable.invite_token && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl p-4 mb-4"
            style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <p className="text-xs font-bold text-green-400 mb-1">Стол создан! Приватная ссылка:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[10px] text-gray-400 truncate font-mono">
                {window.location.origin}/table/{createdTable.id}?invite={createdTable.invite_token}
              </code>
              <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/table/${createdTable.id}?invite=${createdTable.invite_token}`)}
                className="text-[10px] px-2 py-1 rounded-lg font-bold flex-shrink-0"
                style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80' }}>
                Копировать
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create table — fullscreen modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed z-[70] flex flex-col"
            style={{ background: '#0d0d0d', top: 0, left: 0, right: 0, bottom: 0 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-5 pb-3 flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="text-lg font-extrabold text-poker-gold">♠ Создать стол</h3>
              <button onClick={() => { setShowCreate(false); setCreateError(''); setHideNav(false) }}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 text-xl"
                style={{ background: 'rgba(255,255,255,0.06)' }}>✕</button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Название стола</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Например: Ночной Картель"
                  className="w-full rounded-xl px-3 py-3 text-sm text-white outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>

              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Тип покера</label>
                <div className="grid grid-cols-2 gap-2">
                  {[{ val: 'holdem', label: '♠ Техасский Холдем', desc: 'Стандарт' }, { val: 'omaha', label: '♦ Омаха', desc: 'Агрессивный' }].map(opt => (
                    <button key={opt.val} onClick={() => setForm(f => ({ ...f, poker_type: opt.val }))}
                      className="rounded-xl p-3 text-left transition-all"
                      style={{ background: form.poker_type === opt.val ? 'rgba(212,168,67,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${form.poker_type === opt.val ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.08)'}` }}>
                      <p className="text-xs font-bold text-white">{opt.label}</p>
                      <p className="text-[10px] text-gray-600">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Блайнды</label>
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {BLIND_PRESETS.map(p => (
                    <button key={p.label} onClick={() => applyBlindPreset(p.sb, p.bb)}
                      className="py-2.5 rounded-xl text-xs font-bold transition-all"
                      style={{ background: form.big_blind === p.bb ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${form.big_blind === p.bb ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.06)'}`, color: form.big_blind === p.bb ? '#d4a843' : '#6b7280' }}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[{ key: 'small_blind', label: 'Малый блайнд' }, { key: 'big_blind', label: 'Большой блайнд' }].map(f => (
                    <div key={f.key}>
                      <label className="text-[10px] text-gray-600 mb-1 block">{f.label}</label>
                      <input type="number" value={(form as any)[f.key]}
                        onChange={e => setForm(prev => ({ ...prev, [f.key]: +e.target.value }))}
                        className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[{ key: 'min_buy_in', label: 'Мин. вход' }, { key: 'max_buy_in', label: 'Макс. вход' }].map(f => (
                  <div key={f.key}>
                    <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">{f.label}</label>
                    <input type="number" value={(form as any)[f.key]}
                      onChange={e => setForm(prev => ({ ...prev, [f.key]: +e.target.value }))}
                      className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Мест за столом</label>
                  <div className="grid grid-cols-3 gap-1">
                    {[{ n: 2, l: 'Дуэль' }, { n: 6, l: '6-max' }, { n: 9, l: 'Full' }].map(({ n, l }) => (
                      <button key={n} onClick={() => setForm(f => ({ ...f, max_players: n }))}
                        className="py-2.5 rounded-xl text-[10px] font-bold transition-all"
                        style={{ background: form.max_players === n ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${form.max_players === n ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.06)'}`, color: form.max_players === n ? '#d4a843' : '#6b7280' }}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Таймер хода</label>
                  <div className="grid grid-cols-2 gap-1">
                    {[{ val: 30, label: 'Норма 30с' }, { val: 15, label: 'Турбо 15с' }].map(t => (
                      <button key={t.val} onClick={() => setForm(f => ({ ...f, action_timer: t.val }))}
                        className="py-2.5 rounded-xl text-[10px] font-bold transition-all"
                        style={{ background: form.action_timer === t.val ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${form.action_timer === t.val ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.06)'}`, color: form.action_timer === t.val ? '#d4a843' : '#6b7280' }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 block">Конфиденциальность</label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {[{ val: false, label: '🌐 Публичный', desc: 'Виден всем' }, { val: true, label: '🔒 Приватный', desc: 'По паролю' }].map(opt => (
                    <button key={String(opt.val)} onClick={() => setForm(f => ({ ...f, is_private: opt.val }))}
                      className="rounded-xl p-3 text-left transition-all"
                      style={{ background: form.is_private === opt.val ? 'rgba(212,168,67,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${form.is_private === opt.val ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.08)'}` }}>
                      <p className="text-xs font-bold text-white">{opt.label}</p>
                      <p className="text-[10px] text-gray-600">{opt.desc}</p>
                    </button>
                  ))}
                </div>
                {form.is_private && (
                  <input type="password" value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Пароль для входа"
                    className="w-full rounded-xl px-3 py-3 text-sm text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(212,168,67,0.3)' }} />
                )}
              </div>

              {createError && <p className="text-sm text-red-400 text-center">{createError}</p>}
            </div>

            {/* Fixed bottom — always visible, above BottomNav */}
            <div className="flex-shrink-0 px-4 pt-3 pb-6"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: '#0d0d0d' }}>
              <button onClick={handleCreate} disabled={creating}
                className="w-full btn-gold py-4 text-sm font-bold rounded-xl disabled:opacity-50">
                {creating ? 'Создаём...' : '⚔️ Создать стол'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-7 h-7 border-2 border-poker-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-3">
            {tables.length === 0 && (
              <p className="text-center text-gray-600 py-12 text-sm">Столов пока нет. Создайте первый!</p>
            )}
            {tables.map((table, i) => (
              <TableCard key={table.id} table={table} index={i} isVip={isVip} onClick={() => navigate(`/table/${table.id}`)} />
            ))}
          </motion.div>
        </AnimatePresence>
      )}

      {!isVip && <FunRefillButton balance={balance} />}
    </div>
  )
}

function TableCard({ table, index, isVip, onClick }: { table: Table; index: number; isVip: boolean; onClick: () => void }) {
  const isPlaying = table.status === 'playing'
  return (
    <motion.div initial={{ x: -16, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: index * 0.06 }}
      onClick={onClick} className="cursor-pointer active:scale-[0.98] transition-transform"
      style={{ background: isVip ? 'linear-gradient(135deg, #1e1a0e 0%, #1c1c1c 100%)' : 'linear-gradient(135deg, #111 0%, #1c1c1c 100%)', border: `1px solid ${isVip ? 'rgba(212,168,67,0.18)' : 'rgba(99,102,241,0.15)'}`, borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-base tracking-tight">{table.name}</h3>
              {table.is_private && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>🔒 ПРИВАТ</span>}
              {isVip && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider" style={{ background: 'rgba(212,168,67,0.12)', color: '#d4a843' }}>VIP</span>}
              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280' }}>
                {table.poker_type === 'omaha' ? 'Омаха' : 'Холдем'}
              </span>
            </div>
            <p className="text-[11px] text-gray-600 mt-0.5">
              Блайнды {table.small_blind}/{table.big_blind} · Вход {table.min_buy_in}–{table.max_buy_in}
              {table.action_timer === 15 && ' · ⚡ Турбо'}
            </p>
          </div>
          <span className="text-[10px] px-2 py-1 rounded-full font-semibold flex-shrink-0"
            style={{ background: isPlaying ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)', color: isPlaying ? '#4ade80' : '#6b7280', border: `1px solid ${isPlaying ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)'}` }}>
            {isPlaying ? '● Идёт игра' : '○ Ожидание'}
          </span>
        </div>
        <div className="divider-gold mb-3" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: table.max_players }).map((_, j) => (
              <div key={j} className="w-2 h-2 rounded-full transition-colors"
                style={{ background: j < table.current_players ? isVip ? '#d4a843' : '#818cf8' : 'rgba(255,255,255,0.08)' }} />
            ))}
          </div>
          <span className="text-[11px] text-gray-600">{table.current_players}/{table.max_players} игроков</span>
        </div>
      </div>
    </motion.div>
  )
}

function FunRefillButton({ balance }: { balance: number }) {
  const api = useApi()
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const setUser = useStore((s) => s.setUser)
  const user = useStore((s) => s.user)

  const handleRefill = async () => {
    setLoading(true)
    setMsg('')
    try {
      const res = await api.post<{ fun_balance: number }>('/economy/fun/refill')
      if (user) setUser({ ...user, fun_balance: res.fun_balance })
      setMsg('✅ +10 000 BR зачислено!')
    } catch (e: any) {
      setMsg(`❌ ${e?.detail || e?.message || 'Ошибка'}`)
    } finally {
      setLoading(false)
    }
  }

  if (balance >= 1000) return null

  return (
    <div className="fixed bottom-20 left-0 right-0 px-4">
      <button onClick={handleRefill} disabled={loading}
        className="w-full max-w-lg mx-auto block py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
        style={{ background: 'rgba(99,102,241,0.8)', color: 'white' }}>
        {loading ? 'Пополняем...' : '🎁 Бесплатное пополнение BR'}
      </button>
      {msg && <p className="text-center text-sm mt-2 text-gray-400">{msg}</p>}
    </div>
  )
}
