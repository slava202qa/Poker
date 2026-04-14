import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApi } from '../../hooks/useApi'
import { useViewportHeight } from '../../hooks/useViewportHeight'

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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const api = useApi()
  const vh = useViewportHeight()

  const load = () => api.get<Table[]>('/admin/tables').then(setTables).catch(() => {})
  useEffect(() => { load() }, [])

  const applyPreset = (sb: number, bb: number) =>
    setForm(f => ({ ...f, small_blind: sb, big_blind: bb, min_buy_in: bb * 40, max_buy_in: bb * 100 }))

  const openCreate = () => { setForm(EMPTY_FORM); setEditId(null); setError(''); setShowForm(true) }
  const openEdit = (t: Table) => {
    setForm({ name: t.name, poker_type: t.poker_type || 'holdem', max_players: t.max_players,
      small_blind: t.small_blind, big_blind: t.big_blind, min_buy_in: t.min_buy_in,
      max_buy_in: t.max_buy_in, action_timer: t.action_timer || 30,
      is_private: t.is_private, password: '' })
    setEditId(t.id); setError(''); setShowForm(true)
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Введите название'); return }
    setSaving(true); setError('')
    try {
      const payload: any = { ...form }
      if (!form.is_private) delete payload.password
      if (editId) await api.post(`/admin/tables/${editId}`, payload)
      else await api.post('/admin/tables', payload)
      setShowForm(false); load()
    } catch (e: any) { setError(e.message || 'Ошибка') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить стол?')) return
    try { await api.del(`/admin/tables/${id}`); load() } catch {}
  }

  const F = (k: keyof typeof form, v: any) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">🃏 Столы</h2>
        <button onClick={openCreate} className="btn-gold px-4 py-2 text-sm">+ Создать стол</button>
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
              <h3 className="text-base font-extrabold text-poker-gold">
                {editId ? '✏️ Редактировать стол' : '🃏 Новый стол'}
              </h3>
              <button onClick={() => setShowForm(false)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400"
                style={{ background: 'rgba(255,255,255,0.06)' }}>✕</button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ WebkitOverflowScrolling: 'touch' }}>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Название стола</label>
                <input value={form.name} onChange={e => F('name', e.target.value)}
                  placeholder="VIP Стол #1"
                  className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-2 block">Тип покера</label>
                <div className="grid grid-cols-2 gap-2">
                  {[{ val: 'holdem', label: '♠ Холдем' }, { val: 'omaha', label: '♦ Омаха' }].map(opt => (
                    <button key={opt.val} onClick={() => F('poker_type', opt.val)}
                      className="py-2.5 rounded-xl text-sm font-bold transition-all"
                      style={{ background: form.poker_type === opt.val ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${form.poker_type === opt.val ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.08)'}`, color: form.poker_type === opt.val ? '#d4a843' : '#6b7280' }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-2 block">Блайнды</label>
                <div className="grid grid-cols-4 gap-1.5 mb-3">
                  {BLIND_PRESETS.map(p => (
                    <button key={p.label} onClick={() => applyPreset(p.sb, p.bb)}
                      className="py-2 rounded-xl text-xs font-bold transition-all"
                      style={{ background: form.big_blind === p.bb ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${form.big_blind === p.bb ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.06)'}`, color: form.big_blind === p.bb ? '#d4a843' : '#6b7280' }}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[{ k: 'small_blind' as const, l: 'Small Blind' }, { k: 'big_blind' as const, l: 'Big Blind' }].map(f => (
                    <div key={f.k}>
                      <label className="text-xs text-gray-500 mb-1 block">{f.l}</label>
                      <input type="number" value={form[f.k]}
                        onChange={e => F(f.k, +e.target.value)}
                        className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[{ k: 'min_buy_in' as const, l: 'Мин. бай-ин' }, { k: 'max_buy_in' as const, l: 'Макс. бай-ин' }].map(f => (
                  <div key={f.k}>
                    <label className="text-xs text-gray-500 mb-1 block">{f.l}</label>
                    <input type="number" value={form[f.k]}
                      onChange={e => F(f.k, +e.target.value)}
                      className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-2 block">Мест за столом</label>
                  <div className="grid grid-cols-3 gap-1">
                    {[{ n: 2, l: '2' }, { n: 6, l: '6' }, { n: 9, l: '9' }].map(({ n, l }) => (
                      <button key={n} onClick={() => F('max_players', n)}
                        className="py-2 rounded-xl text-xs font-bold transition-all"
                        style={{ background: form.max_players === n ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${form.max_players === n ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.06)'}`, color: form.max_players === n ? '#d4a843' : '#6b7280' }}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-2 block">Таймер хода</label>
                  <div className="grid grid-cols-3 gap-1">
                    {[{ v: 15, l: '15с' }, { v: 30, l: '30с' }, { v: 60, l: '60с' }].map(t => (
                      <button key={t.v} onClick={() => F('action_timer', t.v)}
                        className="py-2 rounded-xl text-xs font-bold transition-all"
                        style={{ background: form.action_timer === t.v ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${form.action_timer === t.v ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.06)'}`, color: form.action_timer === t.v ? '#d4a843' : '#6b7280' }}>
                        {t.l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-2 block">Доступ</label>
                <div className="grid grid-cols-2 gap-2">
                  {[{ val: false, label: '🌐 Публичный' }, { val: true, label: '🔒 Приватный' }].map(opt => (
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
                    placeholder="Пароль стола"
                    className="w-full mt-2 rounded-xl px-4 py-3 text-sm text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
                )}
              </div>

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
              <button onClick={handleSubmit} disabled={saving}
                className="flex-1 btn-gold py-3.5 rounded-xl text-sm font-bold disabled:opacity-50">
                {saving ? 'Сохраняем...' : editId ? '💾 Сохранить' : '🃏 Создать стол'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table list */}
      <div className="space-y-2">
        {tables.map(t => (
          <div key={t.id} className="card-surface p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm">{t.name}</span>
                {t.is_private && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>🔒</span>}
                <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === 'playing' ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-400'}`}>{t.status}</span>
              </div>
              <div className="flex gap-3">
                <button onClick={() => openEdit(t)} className="text-xs text-blue-400">Изменить</button>
                <button onClick={() => handleDelete(t.id)} className="text-xs text-red-400">Удалить</button>
              </div>
            </div>
            <div className="text-xs text-gray-500 flex flex-wrap gap-3">
              <span>{t.poker_type === 'omaha' ? 'Омаха' : 'Холдем'}</span>
              <span>Блайнды: {t.small_blind}/{t.big_blind}</span>
              <span>Бай-ин: {t.min_buy_in}–{t.max_buy_in}</span>
              <span>Игроки: {t.current_players}/{t.max_players}</span>
              <span>Таймер: {t.action_timer}с</span>
            </div>
          </div>
        ))}
        {tables.length === 0 && <p className="text-gray-500 text-center py-8 text-sm">Столов пока нет</p>}
      </div>
    </div>
  )
}
