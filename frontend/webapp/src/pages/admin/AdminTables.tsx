import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApi } from '../../hooks/useApi'

interface Table {
  id: number; name: string; max_players: number; small_blind: number
  big_blind: number; min_buy_in: number; max_buy_in: number
  poker_type: string; action_timer: number; is_private: boolean
  status: string; current_players: number
}

const EMPTY_FORM = {
  name: '', poker_type: 'holdem', max_players: 6,
  small_blind: 5, big_blind: 10, min_buy_in: 200, max_buy_in: 1000,
  action_timer: 30, is_private: false, password: '',
}

const BLIND_PRESETS = [
  { label: '1/2', sb: 1, bb: 2 }, { label: '5/10', sb: 5, bb: 10 },
  { label: '25/50', sb: 25, bb: 50 }, { label: '100/200', sb: 100, bb: 200 },
]

export default function AdminTables() {
  const [tables, setTables] = useState<Table[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const api = useApi()

  const load = () => api.get<Table[]>('/tables/').then(setTables).catch(() => {})
  useEffect(() => { load() }, [])

  const applyPreset = (sb: number, bb: number) =>
    setForm(f => ({ ...f, small_blind: sb, big_blind: bb, min_buy_in: bb * 40, max_buy_in: bb * 100 }))

  const handleSubmit = async () => {
    setError('')
    try {
      const payload: any = { ...form }
      if (!form.is_private) delete payload.password
      if (editId) {
        await api.post(`/admin/tables/${editId}`, payload)
      } else {
        await api.post('/admin/tables', payload)
      }
      setShowForm(false); setForm(EMPTY_FORM); setEditId(null); load()
    } catch (e: any) { setError(e.message || 'Ошибка') }
  }

  const handleEdit = (t: Table) => {
    setForm({ name: t.name, poker_type: t.poker_type || 'holdem', max_players: t.max_players,
      small_blind: t.small_blind, big_blind: t.big_blind, min_buy_in: t.min_buy_in,
      max_buy_in: t.max_buy_in, action_timer: t.action_timer || 30,
      is_private: t.is_private, password: '' })
    setEditId(t.id); setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить стол?')) return
    try { await api.del(`/admin/tables/${id}`); load() } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">🃏 Управление столами</h2>
        <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm(EMPTY_FORM); setError('') }}
          className="btn-gold px-4 py-2 text-sm">
          {showForm ? '✕ Закрыть' : '+ Создать стол'}
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="card-surface p-4 space-y-3">
              <h3 className="font-bold text-sm">{editId ? 'Редактировать' : 'Новый стол'}</h3>

              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Название стола"
                className="w-full bg-poker-darker border border-poker-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none" />

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Тип покера</label>
                <div className="grid grid-cols-2 gap-2">
                  {[{ val: 'holdem', label: '♠ Холдем' }, { val: 'omaha', label: '♦ Омаха' }].map(opt => (
                    <button key={opt.val} onClick={() => setForm(f => ({ ...f, poker_type: opt.val }))}
                      className="py-2 rounded-lg text-xs font-bold transition-all"
                      style={{ background: form.poker_type === opt.val ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${form.poker_type === opt.val ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.08)'}`, color: form.poker_type === opt.val ? '#d4a843' : '#6b7280' }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Блайнды (пресеты)</label>
                <div className="grid grid-cols-4 gap-1 mb-2">
                  {BLIND_PRESETS.map(p => (
                    <button key={p.label} onClick={() => applyPreset(p.sb, p.bb)}
                      className="py-1.5 rounded-lg text-xs font-bold transition-all"
                      style={{ background: form.big_blind === p.bb ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${form.big_blind === p.bb ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.06)'}`, color: form.big_blind === p.bb ? '#d4a843' : '#6b7280' }}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[{ k: 'small_blind', l: 'Small Blind' }, { k: 'big_blind', l: 'Big Blind' }].map(f => (
                    <div key={f.k}>
                      <label className="text-xs text-gray-500">{f.l}</label>
                      <input type="number" value={(form as any)[f.k]}
                        onChange={e => setForm(prev => ({ ...prev, [f.k]: +e.target.value }))}
                        className="w-full bg-poker-darker border border-poker-border rounded-lg px-3 py-2 text-sm text-white outline-none" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[{ k: 'min_buy_in', l: 'Мин. бай-ин' }, { k: 'max_buy_in', l: 'Макс. бай-ин' }].map(f => (
                  <div key={f.k}>
                    <label className="text-xs text-gray-500">{f.l}</label>
                    <input type="number" value={(form as any)[f.k]}
                      onChange={e => setForm(prev => ({ ...prev, [f.k]: +e.target.value }))}
                      className="w-full bg-poker-darker border border-poker-border rounded-lg px-3 py-2 text-sm text-white outline-none" />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Мест за столом</label>
                  <div className="grid grid-cols-3 gap-1">
                    {[{ n: 2, l: 'Дуэль' }, { n: 6, l: '6-max' }, { n: 9, l: 'Full' }].map(({ n, l }) => (
                      <button key={n} onClick={() => setForm(f => ({ ...f, max_players: n }))}
                        className="py-1.5 rounded-lg text-[10px] font-bold transition-all"
                        style={{ background: form.max_players === n ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${form.max_players === n ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.06)'}`, color: form.max_players === n ? '#d4a843' : '#6b7280' }}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Таймер хода</label>
                  <div className="grid grid-cols-2 gap-1">
                    {[{ v: 30, l: '30с' }, { v: 15, l: '15с ⚡' }].map(t => (
                      <button key={t.v} onClick={() => setForm(f => ({ ...f, action_timer: t.v }))}
                        className="py-1.5 rounded-lg text-[10px] font-bold transition-all"
                        style={{ background: form.action_timer === t.v ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${form.action_timer === t.v ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.06)'}`, color: form.action_timer === t.v ? '#d4a843' : '#6b7280' }}>
                        {t.l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Тип стола</label>
                <div className="grid grid-cols-2 gap-2">
                  {[{ val: false, label: '🌐 Публичный' }, { val: true, label: '🔒 Приватный' }].map(opt => (
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
                    placeholder="Пароль стола"
                    className="w-full mt-2 bg-poker-darker border border-poker-border rounded-lg px-3 py-2 text-sm text-white outline-none" />
                )}
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <div className="flex gap-2">
                <button onClick={handleSubmit} className="btn-gold px-4 py-2 text-sm flex-1">
                  {editId ? 'Сохранить' : 'Создать'}
                </button>
                <button onClick={() => setShowForm(false)} className="btn-secondary px-4 py-2 text-sm">Отмена</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        {tables.map((t) => (
          <div key={t.id} className="card-surface p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold">{t.name}</span>
                {t.is_private && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>🔒</span>}
                <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === 'playing' ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-400'}`}>{t.status}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(t)} className="text-xs text-blue-400 hover:text-blue-300">Изменить</button>
                <button onClick={() => handleDelete(t.id)} className="text-xs text-red-400 hover:text-red-300">Удалить</button>
              </div>
            </div>
            <div className="text-xs text-gray-500 flex flex-wrap gap-3">
              <span>{t.poker_type === 'omaha' ? 'Омаха' : 'Холдем'}</span>
              <span>Блайнды: {t.small_blind}/{t.big_blind}</span>
              <span>Бай-ин: {t.min_buy_in}–{t.max_buy_in}</span>
              <span>Игроки: {t.current_players}/{t.max_players}</span>
              {t.action_timer === 15 && <span>⚡ Турбо</span>}
            </div>
          </div>
        ))}
        {tables.length === 0 && <p className="text-gray-500 text-center py-8">Столов пока нет.</p>}
      </div>
    </div>
  )
}
