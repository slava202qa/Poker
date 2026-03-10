import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApi } from '../../hooks/useApi'

interface Tournament {
  id: number
  name: string
  buy_in: number
  fee: number
  starting_stack: number
  max_players: number
  current_players: number
  prize_pool: number
  status: string
  starts_at: string
}

const EMPTY_FORM = {
  name: '', buy_in: 100, fee: 10, starting_stack: 3000,
  max_players: 50, starts_at: '',
}

export default function AdminTournaments() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const api = useApi()

  const load = () => {
    api.get<Tournament[]>('/tournaments/').then(setTournaments).catch(() => {})
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!form.name || !form.starts_at) {
      alert('Заполните название и время старта')
      return
    }
    try {
      await api.post('/admin/tournaments', {
        ...form,
        starts_at: new Date(form.starts_at).toISOString(),
      })
      setShowForm(false)
      setForm(EMPTY_FORM)
      load()
    } catch (e: any) {
      alert(e.message)
    }
  }

  const handleCancel = async (id: number) => {
    if (!confirm('Отменить турнир?')) return
    try {
      await api.post(`/admin/tournaments/${id}`, { status: 'cancelled' })
      load()
    } catch {}
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить турнир?')) return
    try {
      await api.post(`/admin/tournaments/${id}`, {})
      load()
    } catch {}
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">🏆 Управление турнирами</h2>
        <button
          onClick={() => { setShowForm(!showForm); setForm(EMPTY_FORM) }}
          className="btn-gold px-4 py-2 text-sm"
        >
          + Создать турнир
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="card-surface p-4 space-y-3">
              <h3 className="font-bold text-sm">Новый турнир</h3>

              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Название турнира"
                className="w-full bg-poker-darker border border-poker-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-poker-gold/50"
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Бай-ин (RR)</label>
                  <input type="number" value={form.buy_in}
                    onChange={(e) => setForm({ ...form, buy_in: +e.target.value })}
                    className="w-full bg-poker-darker border border-poker-border rounded-lg px-3 py-2 text-sm text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Комиссия (RR)</label>
                  <input type="number" value={form.fee}
                    onChange={(e) => setForm({ ...form, fee: +e.target.value })}
                    className="w-full bg-poker-darker border border-poker-border rounded-lg px-3 py-2 text-sm text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Стартовый стек</label>
                  <input type="number" value={form.starting_stack}
                    onChange={(e) => setForm({ ...form, starting_stack: +e.target.value })}
                    className="w-full bg-poker-darker border border-poker-border rounded-lg px-3 py-2 text-sm text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Макс. игроков</label>
                  <input type="number" value={form.max_players}
                    onChange={(e) => setForm({ ...form, max_players: +e.target.value })}
                    className="w-full bg-poker-darker border border-poker-border rounded-lg px-3 py-2 text-sm text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500">Дата и время старта</label>
                <input type="datetime-local" value={form.starts_at}
                  onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                  className="w-full bg-poker-darker border border-poker-border rounded-lg px-3 py-2 text-sm text-white outline-none"
                />
              </div>

              <div className="flex gap-2">
                <button onClick={handleCreate} className="btn-gold px-4 py-2 text-sm flex-1">
                  Создать
                </button>
                <button onClick={() => setShowForm(false)} className="btn-secondary px-4 py-2 text-sm">
                  Отмена
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tournaments list */}
      <div className="space-y-2">
        {tournaments.map((t) => (
          <div key={t.id} className="card-surface p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="font-bold">{t.name}</span>
                <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                  t.status === 'registering' ? 'bg-green-900/50 text-green-400'
                  : t.status === 'running' ? 'bg-yellow-900/50 text-yellow-400'
                  : t.status === 'cancelled' ? 'bg-red-900/50 text-red-400'
                  : 'bg-gray-800 text-gray-400'
                }`}>
                  {t.status}
                </span>
              </div>
              <div className="flex gap-2">
                {t.status === 'registering' && (
                  <button onClick={() => handleCancel(t.id)} className="text-xs text-yellow-400">
                    Отменить
                  </button>
                )}
                <button onClick={() => handleDelete(t.id)} className="text-xs text-red-400">
                  Удалить
                </button>
              </div>
            </div>
            <div className="text-xs text-gray-500 flex flex-wrap gap-3">
              <span>Бай-ин: {t.buy_in}+{t.fee}</span>
              <span>Призовой: {t.prize_pool} RR</span>
              <span>Игроки: {t.current_players}/{t.max_players}</span>
              <span>Старт: {formatDate(t.starts_at)}</span>
            </div>
          </div>
        ))}
        {tournaments.length === 0 && (
          <p className="text-gray-500 text-center py-8">Турниров пока нет. Создайте первый.</p>
        )}
      </div>
    </div>
  )
}
