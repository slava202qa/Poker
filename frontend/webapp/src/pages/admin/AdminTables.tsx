import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApi } from '../../hooks/useApi'

interface Table {
  id: number
  name: string
  max_players: number
  small_blind: number
  big_blind: number
  min_buy_in: number
  max_buy_in: number
  status: string
  current_players: number
}

const EMPTY_FORM = {
  name: '', max_players: 9, small_blind: 1, big_blind: 2,
  min_buy_in: 40, max_buy_in: 200,
}

export default function AdminTables() {
  const [tables, setTables] = useState<Table[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState<number | null>(null)
  const api = useApi()

  const load = () => {
    api.get<Table[]>('/tables/').then(setTables).catch(() => {})
  }

  useEffect(() => { load() }, [])

  const handleSubmit = async () => {
    try {
      if (editId) {
        await api.post(`/admin/tables/${editId}`, form)
      } else {
        await api.post('/admin/tables', form)
      }
      setShowForm(false)
      setForm(EMPTY_FORM)
      setEditId(null)
      load()
    } catch (e: any) {
      alert(e.message)
    }
  }

  const handleEdit = (t: Table) => {
    setForm({
      name: t.name, max_players: t.max_players,
      small_blind: t.small_blind, big_blind: t.big_blind,
      min_buy_in: t.min_buy_in, max_buy_in: t.max_buy_in,
    })
    setEditId(t.id)
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить стол?')) return
    try {
      await api.post(`/admin/tables/${id}`, {})
      load()
    } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">🃏 Управление столами</h2>
        <button
          onClick={() => { setShowForm(!showForm); setEditId(null); setForm(EMPTY_FORM) }}
          className="btn-gold px-4 py-2 text-sm"
        >
          + Создать стол
        </button>
      </div>

      {/* Create/Edit form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="card-surface p-4 space-y-3">
              <h3 className="font-bold text-sm">{editId ? 'Редактировать' : 'Новый стол'}</h3>

              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Название стола"
                className="w-full bg-poker-darker border border-poker-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-poker-gold/50"
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Макс. игроков</label>
                  <input type="number" value={form.max_players}
                    onChange={(e) => setForm({ ...form, max_players: +e.target.value })}
                    className="w-full bg-poker-darker border border-poker-border rounded-lg px-3 py-2 text-sm text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Small Blind</label>
                  <input type="number" value={form.small_blind}
                    onChange={(e) => setForm({ ...form, small_blind: +e.target.value })}
                    className="w-full bg-poker-darker border border-poker-border rounded-lg px-3 py-2 text-sm text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Big Blind</label>
                  <input type="number" value={form.big_blind}
                    onChange={(e) => setForm({ ...form, big_blind: +e.target.value })}
                    className="w-full bg-poker-darker border border-poker-border rounded-lg px-3 py-2 text-sm text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Мин. бай-ин</label>
                  <input type="number" value={form.min_buy_in}
                    onChange={(e) => setForm({ ...form, min_buy_in: +e.target.value })}
                    className="w-full bg-poker-darker border border-poker-border rounded-lg px-3 py-2 text-sm text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Макс. бай-ин</label>
                  <input type="number" value={form.max_buy_in}
                    onChange={(e) => setForm({ ...form, max_buy_in: +e.target.value })}
                    className="w-full bg-poker-darker border border-poker-border rounded-lg px-3 py-2 text-sm text-white outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={handleSubmit} className="btn-gold px-4 py-2 text-sm flex-1">
                  {editId ? 'Сохранить' : 'Создать'}
                </button>
                <button onClick={() => setShowForm(false)} className="btn-secondary px-4 py-2 text-sm">
                  Отмена
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tables list */}
      <div className="space-y-2">
        {tables.map((t) => (
          <div key={t.id} className="card-surface p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="font-bold">{t.name}</span>
                <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                  t.status === 'playing' ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-400'
                }`}>
                  {t.status}
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(t)} className="text-xs text-blue-400 hover:text-blue-300">
                  Изменить
                </button>
                <button onClick={() => handleDelete(t.id)} className="text-xs text-red-400 hover:text-red-300">
                  Удалить
                </button>
              </div>
            </div>
            <div className="text-xs text-gray-500 flex gap-4">
              <span>Блайнды: {t.small_blind}/{t.big_blind}</span>
              <span>Бай-ин: {t.min_buy_in}-{t.max_buy_in}</span>
              <span>Игроки: {t.current_players}/{t.max_players}</span>
            </div>
          </div>
        ))}
        {tables.length === 0 && (
          <p className="text-gray-500 text-center py-8">Столов пока нет. Создайте первый.</p>
        )}
      </div>
    </div>
  )
}
