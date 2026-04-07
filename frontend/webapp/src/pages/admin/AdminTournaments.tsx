import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApi } from '../../hooks/useApi'

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

const TYPE_INFO: Record<string, { label: string; desc: string; icon: string }> = {
  freezeout: { label: 'Freezeout', desc: 'Проиграл — выбыл', icon: '❄️' },
  reentry:   { label: 'Re-entry', desc: 'Можно купить вход заново', icon: '🔄' },
  pko:       { label: 'PKO Bounty', desc: 'Награда за каждого выбитого', icon: '💀' },
}

export default function AdminTournaments() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const api = useApi()

  const load = () => api.get<Tournament[]>('/tournaments/').then(setTournaments).catch(() => {})
  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!form.name || !form.starts_at) { setError('Заполните название и время старта'); return }
    setError('')
    try {
      await api.post('/admin/tournaments', {
        ...form,
        starts_at: new Date(form.starts_at).toISOString(),
        guaranteed_prize: form.guaranteed_prize || 0,
      })
      setShowForm(false); setForm(EMPTY_FORM); load()
    } catch (e: any) { setError(e.message || 'Ошибка') }
  }

  const handleCancel = async (id: number) => {
    if (!confirm('Отменить турнир?')) return
    try { await api.post(`/admin/tournaments/${id}`, { status: 'cancelled' }); load() } catch {}
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить турнир?')) return
    try { await api.del(`/admin/tournaments/${id}`); load() } catch {}
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  const statusColor: Record<string, string> = {
    registering: 'bg-green-900/50 text-green-400',
    running: 'bg-yellow-900/50 text-yellow-400',
    cancelled: 'bg-red-900/50 text-red-400',
    finished: 'bg-gray-800 text-gray-400',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">🏆 Управление турнирами</h2>
        <button onClick={() => { setShowForm(!showForm); setForm(EMPTY_FORM); setError('') }}
          className="btn-gold px-4 py-2 text-sm">
          {showForm ? '✕ Закрыть' : '+ Создать турнир'}
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="card-surface p-4 space-y-4">
              <h3 className="font-bold text-sm text-poker-gold">⚔️ Новая Битва</h3>

              {/* Name */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Название Битвы</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Вечерний Картель"
                  className="w-full bg-poker-darker border border-poker-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none" />
              </div>

              {/* Tournament type */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Формат (Драйв)</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(TYPE_INFO).map(([val, info]) => (
                    <button key={val} onClick={() => setForm(f => ({ ...f, tournament_type: val }))}
                      className="rounded-lg p-2.5 text-left transition-all"
                      style={{ background: form.tournament_type === val ? 'rgba(212,168,67,0.12)' : 'rgba(255,255,255,0.03)', border: `1px solid ${form.tournament_type === val ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.08)'}` }}>
                      <p className="text-sm">{info.icon}</p>
                      <p className="text-[10px] font-bold text-white">{info.label}</p>
                      <p className="text-[9px] text-gray-600">{info.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Finances */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Входные данные (Финансы)</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { k: 'buy_in', l: 'Дань (Бай-ин) RR' },
                    { k: 'fee', l: 'Комиссия платформы RR' },
                    { k: 'starting_stack', l: 'Стартовый стек' },
                    { k: 'guaranteed_prize', l: 'Гарантия призового (0=нет)' },
                  ].map(f => (
                    <div key={f.k}>
                      <label className="text-[10px] text-gray-600 mb-0.5 block">{f.l}</label>
                      <input type="number" value={(form as any)[f.k]}
                        onChange={e => setForm(prev => ({ ...prev, [f.k]: +e.target.value }))}
                        className="w-full bg-poker-darker border border-poker-border rounded-lg px-3 py-2 text-sm text-white outline-none" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Structure */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Структура игры</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-600 mb-0.5 block">Ярость (рост блайндов)</label>
                    <div className="grid grid-cols-3 gap-1">
                      {[5, 10, 15].map(m => (
                        <button key={m} onClick={() => setForm(f => ({ ...f, blind_level_minutes: m }))}
                          className="py-1.5 rounded-lg text-[10px] font-bold transition-all"
                          style={{ background: form.blind_level_minutes === m ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${form.blind_level_minutes === m ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.06)'}`, color: form.blind_level_minutes === m ? '#d4a843' : '#6b7280' }}>
                          {m} мин
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-600 mb-0.5 block">Мест за столом</label>
                    <div className="grid grid-cols-2 gap-1">
                      {[{ n: 6, l: '6-max' }, { n: 9, l: 'Full' }].map(({ n, l }) => (
                        <button key={n} onClick={() => setForm(f => ({ ...f, seats_per_table: n }))}
                          className="py-1.5 rounded-lg text-[10px] font-bold transition-all"
                          style={{ background: form.seats_per_table === n ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${form.seats_per_table === n ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.06)'}`, color: form.seats_per_table === n ? '#d4a843' : '#6b7280' }}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Players + Late reg */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { k: 'min_players', l: 'Мин. игроков' },
                  { k: 'max_players', l: 'Макс. игроков' },
                  { k: 'late_reg_levels', l: 'Поздняя рег. (уровней)' },
                ].map(f => (
                  <div key={f.k}>
                    <label className="text-[10px] text-gray-600 mb-0.5 block">{f.l}</label>
                    <input type="number" value={(form as any)[f.k]}
                      onChange={e => setForm(prev => ({ ...prev, [f.k]: +e.target.value }))}
                      className="w-full bg-poker-darker border border-poker-border rounded-lg px-3 py-2 text-sm text-white outline-none" />
                  </div>
                ))}
              </div>

              {/* Privacy */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Конфиденциальность</label>
                <div className="grid grid-cols-2 gap-2">
                  {[{ val: false, label: '🌐 Открытый' }, { val: true, label: '🔒 Приватный' }].map(opt => (
                    <button key={String(opt.val)} onClick={() => setForm(f => ({ ...f, is_private: opt.val }))}
                      className="py-2 rounded-lg text-xs font-bold transition-all"
                      style={{ background: form.is_private === opt.val ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${form.is_private === opt.val ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.08)'}`, color: form.is_private === opt.val ? '#d4a843' : '#6b7280' }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {form.is_private && (
                  <input type="password" value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Пароль турнира"
                    className="w-full mt-2 bg-poker-darker border border-poker-border rounded-lg px-3 py-2 text-sm text-white outline-none" />
                )}
              </div>

              {/* Start time */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Время старта Битвы</label>
                <input type="datetime-local" value={form.starts_at}
                  onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))}
                  className="w-full bg-poker-darker border border-poker-border rounded-lg px-3 py-2 text-sm text-white outline-none" />
              </div>

              {/* Preview */}
              {form.name && (
                <div className="rounded-xl p-3" style={{ background: 'rgba(212,168,67,0.04)', border: '1px solid rgba(212,168,67,0.15)' }}>
                  <p className="text-[10px] text-gray-500 mb-1">Предпросмотр</p>
                  <p className="text-sm font-bold text-white">{form.name} {TYPE_INFO[form.tournament_type]?.icon}</p>
                  <p className="text-[10px] text-gray-500">
                    Бай-ин: {form.buy_in}+{form.fee} RR · Стек: {form.starting_stack.toLocaleString()} · Блайнды каждые {form.blind_level_minutes} мин
                    {form.guaranteed_prize > 0 && ` · GTD ${form.guaranteed_prize.toLocaleString()} RR`}
                  </p>
                </div>
              )}

              {error && <p className="text-xs text-red-400">{error}</p>}

              <div className="flex gap-2">
                <button onClick={handleCreate} className="btn-gold px-4 py-2 text-sm flex-1">Создать</button>
                <button onClick={() => setShowForm(false)} className="btn-secondary px-4 py-2 text-sm">Отмена</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        {tournaments.map((t) => (
          <div key={t.id} className="card-surface p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold">{t.name}</span>
                <span className="text-sm">{TYPE_INFO[t.tournament_type]?.icon ?? '🏆'}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[t.status] ?? 'bg-gray-800 text-gray-400'}`}>{t.status}</span>
              </div>
              <div className="flex gap-2">
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
              <span>Старт: {formatDate(t.starts_at)}</span>
            </div>
          </div>
        ))}
        {tournaments.length === 0 && <p className="text-gray-500 text-center py-8">Турниров пока нет.</p>}
      </div>
    </div>
  )
}
