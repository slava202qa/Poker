import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApi } from '../../hooks/useApi'
import { useViewportHeight } from '../../hooks/useViewportHeight'

interface Tournament {
  id: number; name: string; buy_in: number; fee: number
  starting_stack: number; max_players: number; min_players: number
  current_players: number; prize_pool: number; status: string
  starts_at: string; tournament_type: string; seats_per_table: number
  blind_level_minutes: number; late_reg_levels: number
  guaranteed_prize: number; is_private: boolean
}

const EMPTY_FORM = {
  name: '', buy_in: 100, fee: 10, starting_stack: 5000,
  max_players: 100, min_players: 10, starts_at: '',
  tournament_type: 'freezeout', seats_per_table: 6,
  blind_level_minutes: 10, late_reg_levels: 3,
  guaranteed_prize: 0, is_private: false, password: '',
}

const TYPES = [
  { val: 'freezeout', icon: '❄️', label: 'Freezeout', desc: 'Проиграл — выбыл' },
  { val: 'reentry',   icon: '🔄', label: 'Re-entry',  desc: 'Можно купить вход заново' },
  { val: 'pko',       icon: '💀', label: 'PKO Bounty', desc: 'Награда за выбитого' },
]

const STATUS_COLOR: Record<string, string> = {
  registering: 'bg-green-900/50 text-green-400',
  running: 'bg-yellow-900/50 text-yellow-400',
  cancelled: 'bg-red-900/50 text-red-400',
  finished: 'bg-gray-800 text-gray-400',
}

export default function AdminTournaments() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const api = useApi()
  const vh = useViewportHeight()

  const load = () => api.get<Tournament[]>('/admin/tournaments').then(setTournaments).catch(() => {})
  useEffect(() => { load() }, [])

  const F = (k: keyof typeof form, v: any) => setForm(f => ({ ...f, [k]: v }))

  const handleCreate = async () => {
    if (!form.name.trim()) { setError('Введите название'); return }
    if (!form.starts_at) { setError('Укажите время старта'); return }
    setSaving(true); setError('')
    try {
      await api.post('/admin/tournaments', {
        ...form,
        starts_at: new Date(form.starts_at).toISOString(),
        guaranteed_prize: form.guaranteed_prize || 0,
      })
      setShowForm(false); setForm(EMPTY_FORM); load()
    } catch (e: any) { setError(e.message || 'Ошибка') }
    finally { setSaving(false) }
  }

  const handleCancel = async (id: number) => {
    if (!confirm('Отменить турнир?')) return
    try { await api.post(`/admin/tournaments/${id}`, { status: 'cancelled' }); load() } catch {}
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить турнир?')) return
    try { await api.del(`/admin/tournaments/${id}`); load() } catch {}
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  // Default datetime-local value = now + 1 hour
  const defaultStart = () => {
    const d = new Date(Date.now() + 3600_000)
    return d.toISOString().slice(0, 16)
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">🏆 Турниры</h2>
        <button onClick={() => { setForm({ ...EMPTY_FORM, starts_at: defaultStart() }); setError(''); setShowForm(true) }}
          className="btn-gold px-4 py-2 text-sm">
          + Создать турнир
        </button>
      </div>

      {/* Fullscreen modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
            className="fixed z-[60] flex flex-col"
            style={{ top: 0, left: 0, right: 0, height: vh, background: '#0d0d0d' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-5 pb-3 flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <h3 className="text-base font-extrabold text-poker-gold">🏆 Новый турнир</h3>
              <button onClick={() => setShowForm(false)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400"
                style={{ background: 'rgba(255,255,255,0.06)' }}>✕</button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5" style={{ WebkitOverflowScrolling: 'touch' }}>

              {/* Name */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Название</label>
                <input value={form.name} onChange={e => F('name', e.target.value)}
                  placeholder="Вечерний турнир"
                  className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>

              {/* Type */}
              <div>
                <label className="text-xs text-gray-500 mb-2 block">Формат</label>
                <div className="grid grid-cols-3 gap-2">
                  {TYPES.map(t => (
                    <button key={t.val} onClick={() => F('tournament_type', t.val)}
                      className="rounded-xl p-3 text-left transition-all"
                      style={{ background: form.tournament_type === t.val ? 'rgba(212,168,67,0.12)' : 'rgba(255,255,255,0.03)', border: `1px solid ${form.tournament_type === t.val ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.08)'}` }}>
                      <p className="text-lg mb-1">{t.icon}</p>
                      <p className="text-[11px] font-bold text-white">{t.label}</p>
                      <p className="text-[9px] text-gray-600 mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Finances */}
              <div>
                <label className="text-xs text-gray-500 mb-2 block">Финансы</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { k: 'buy_in' as const, l: 'Бай-ин (RR)' },
                    { k: 'fee' as const, l: 'Комиссия (RR)' },
                    { k: 'starting_stack' as const, l: 'Стартовый стек' },
                    { k: 'guaranteed_prize' as const, l: 'Гарантия призового (0 = нет)' },
                  ].map(f => (
                    <div key={f.k}>
                      <label className="text-[10px] text-gray-600 mb-1 block">{f.l}</label>
                      <input type="number" value={form[f.k]}
                        onChange={e => F(f.k, +e.target.value)}
                        className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
                    </div>
                  ))}
                </div>
                {/* Prize preview */}
                <div className="mt-2 rounded-xl px-3 py-2 flex items-center justify-between"
                  style={{ background: 'rgba(212,168,67,0.05)', border: '1px solid rgba(212,168,67,0.12)' }}>
                  <span className="text-[10px] text-gray-500">Призовой = бай-ин × кол-во игроков</span>
                  {form.guaranteed_prize > 0 && (
                    <span className="text-[10px] text-poker-gold font-bold">GTD {form.guaranteed_prize.toLocaleString()} RR</span>
                  )}
                </div>
              </div>

              {/* Structure */}
              <div>
                <label className="text-xs text-gray-500 mb-2 block">Структура</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-600 mb-1.5 block">Рост блайндов (мин)</label>
                    <div className="grid grid-cols-3 gap-1">
                      {[5, 10, 15, 20, 30, 60].map(m => (
                        <button key={m} onClick={() => F('blind_level_minutes', m)}
                          className="py-2 rounded-xl text-[10px] font-bold transition-all"
                          style={{ background: form.blind_level_minutes === m ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${form.blind_level_minutes === m ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.06)'}`, color: form.blind_level_minutes === m ? '#d4a843' : '#6b7280' }}>
                          {m}м
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-600 mb-1.5 block">Мест за столом</label>
                    <div className="grid grid-cols-2 gap-1">
                      {[{ n: 6, l: '6-max' }, { n: 9, l: 'Full 9' }].map(({ n, l }) => (
                        <button key={n} onClick={() => F('seats_per_table', n)}
                          className="py-2 rounded-xl text-[10px] font-bold transition-all"
                          style={{ background: form.seats_per_table === n ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${form.seats_per_table === n ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.06)'}`, color: form.seats_per_table === n ? '#d4a843' : '#6b7280' }}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Players */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { k: 'min_players' as const, l: 'Мин. игроков' },
                  { k: 'max_players' as const, l: 'Макс. игроков' },
                  { k: 'late_reg_levels' as const, l: 'Поздняя рег. (уровней)' },
                ].map(f => (
                  <div key={f.k}>
                    <label className="text-[10px] text-gray-600 mb-1 block">{f.l}</label>
                    <input type="number" value={form[f.k]}
                      onChange={e => F(f.k, +e.target.value)}
                      className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
                  </div>
                ))}
              </div>

              {/* Start time */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Дата и время старта</label>
                <input type="datetime-local" value={form.starts_at}
                  onChange={e => F('starts_at', e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', colorScheme: 'dark' }} />
              </div>

              {/* Privacy */}
              <div>
                <label className="text-xs text-gray-500 mb-2 block">Доступ</label>
                <div className="grid grid-cols-2 gap-2">
                  {[{ val: false, label: '🌐 Открытый' }, { val: true, label: '🔒 Приватный' }].map(opt => (
                    <button key={String(opt.val)} onClick={() => F('is_private', opt.val)}
                      className="py-2.5 rounded-xl text-sm font-bold transition-all"
                      style={{ background: form.is_private === opt.val ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${form.is_private === opt.val ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.08)'}`, color: form.is_private === opt.val ? '#d4a843' : '#6b7280' }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {form.is_private && (
                  <input type="password" value={form.password}
                    onChange={e => F('password', e.target.value)}
                    placeholder="Пароль турнира"
                    className="w-full mt-2 rounded-xl px-4 py-3 text-sm text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
                )}
              </div>

              {/* Preview */}
              {form.name && (
                <div className="rounded-xl p-3" style={{ background: 'rgba(212,168,67,0.04)', border: '1px solid rgba(212,168,67,0.15)' }}>
                  <p className="text-[10px] text-gray-500 mb-1">Предпросмотр</p>
                  <p className="text-sm font-bold">{form.name} {TYPES.find(t => t.val === form.tournament_type)?.icon}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Бай-ин: {form.buy_in}+{form.fee} RR · Стек: {form.starting_stack.toLocaleString()}
                    {' · '}Блайнды каждые {form.blind_level_minutes} мин
                    {form.guaranteed_prize > 0 && ` · GTD ${form.guaranteed_prize.toLocaleString()} RR`}
                    {form.starts_at && ` · Старт: ${fmtDate(form.starts_at)}`}
                  </p>
                </div>
              )}

              {error && <p className="text-xs text-red-400 text-center">{error}</p>}
            </div>

            {/* Fixed bottom */}
            <div className="flex-shrink-0 px-4 pt-3 flex gap-2"
              style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: '#0d0d0d', paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}>
              <button onClick={() => setShowForm(false)}
                className="px-4 py-3.5 rounded-xl text-sm font-bold"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280' }}>
                Отмена
              </button>
              <button onClick={handleCreate} disabled={saving}
                className="flex-1 btn-gold py-3.5 rounded-xl text-sm font-bold disabled:opacity-50">
                {saving ? 'Создаём...' : '🏆 Создать турнир'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tournament list */}
      <div className="space-y-2">
        {tournaments.map(t => (
          <div key={t.id} className="card-surface p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm">{t.name}</span>
                <span>{TYPES.find(x => x.val === t.tournament_type)?.icon ?? '🏆'}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[t.status] ?? 'bg-gray-800 text-gray-400'}`}>{t.status}</span>
              </div>
              <div className="flex gap-3">
                {t.status === 'registering' && (
                  <button onClick={() => handleCancel(t.id)} className="text-xs text-yellow-400">Отменить</button>
                )}
                <button onClick={() => handleDelete(t.id)} className="text-xs text-red-400">Удалить</button>
              </div>
            </div>
            <div className="text-xs text-gray-500 flex flex-wrap gap-3">
              <span>Бай-ин: {t.buy_in}+{t.fee}</span>
              <span>Призовой: {t.prize_pool} RR{t.guaranteed_prize > 0 ? ` (GTD ${t.guaranteed_prize})` : ''}</span>
              <span>Игроки: {t.current_players}/{t.max_players}</span>
              {t.starts_at && <span>Старт: {fmtDate(t.starts_at)}</span>}
              <span>Блайнды: {t.blind_level_minutes} мин</span>
            </div>
          </div>
        ))}
        {tournaments.length === 0 && <p className="text-gray-500 text-center py-8 text-sm">Турниров пока нет</p>}
      </div>
    </div>
  )
}
