import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApi } from '../../hooks/useApi'

interface Withdrawal {
  id: number
  user_id: number
  username: string | null
  first_name: string
  ton_wallet: string | null
  amount: number
  status: string
  ton_tx_hash: string | null
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  pending:         'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  approved:        'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  approved_manual: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  rejected:        'bg-red-500/20 text-red-400 border-red-500/30',
}

const STATUS_LABELS: Record<string, string> = {
  pending:         'Ожидает',
  approved:        'Отправлено',
  approved_manual: 'Вручную',
  rejected:        'Отклонено',
}

export default function AdminWithdrawals() {
  const { get, post } = useApi()
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [items, setItems] = useState<Withdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [processing, setProcessing] = useState<Set<number>>(new Set())
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await get<Withdrawal[]>(`/admin/withdrawals?status=${filter}&limit=100`)
      setItems(data)
      setSelected(new Set())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [filter, get])

  useEffect(() => { load() }, [load])

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const handleApprove = async (id: number) => {
    setProcessing(p => new Set(p).add(id))
    try {
      const r = await post<any>(`/admin/withdrawals/${id}/approve`)
      showToast(`#${id} — ${r.tx_hash ? 'Отправлено ✓' : 'Одобрено (вручную)'}`, true)
      await load()
    } catch (e: any) {
      showToast(`Ошибка: ${e.message}`, false)
    } finally {
      setProcessing(p => { const s = new Set(p); s.delete(id); return s })
    }
  }

  const handleReject = async (id: number) => {
    if (!confirm('Отклонить и вернуть баланс?')) return
    setProcessing(p => new Set(p).add(id))
    try {
      await post(`/admin/withdrawals/${id}/reject`)
      showToast(`#${id} — Отклонено, баланс возвращён`, true)
      await load()
    } catch (e: any) {
      showToast(`Ошибка: ${e.message}`, false)
    } finally {
      setProcessing(p => { const s = new Set(p); s.delete(id); return s })
    }
  }

  const handleBulkApprove = async () => {
    if (selected.size === 0) return
    if (!confirm(`Одобрить ${selected.size} заявок?`)) return
    try {
      const r = await post<any>('/admin/withdrawals/bulk-approve', { tx_ids: [...selected] })
      const ok = r.results.filter((x: any) => x.status !== 'error').length
      showToast(`Обработано ${ok}/${selected.size}`, true)
      await load()
    } catch (e: any) {
      showToast(`Ошибка: ${e.message}`, false)
    }
  }

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const toggleAll = () => {
    const pending = items.filter(i => i.status === 'pending')
    if (selected.size === pending.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(pending.map(i => i.id)))
    }
  }

  const pendingItems = items.filter(i => i.status === 'pending')
  const totalPending = pendingItems.reduce((s, i) => s + i.amount, 0)

  return (
    <div className="space-y-4">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-bold shadow-xl ${
              toast.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
            }`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Заявки на обмен</h2>
          {filter === 'pending' && pendingItems.length > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">
              {pendingItems.length} заявок · {totalPending.toFixed(0)} RR
            </p>
          )}
        </div>
        <button onClick={load} className="text-xs text-gray-500 hover:text-white transition-colors">
          ↻ Обновить
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 bg-black/30 rounded-xl p-1">
        {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filter === f ? 'bg-poker-card text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {f === 'pending' ? 'Ожидают' : f === 'approved' ? 'Отправлены' : f === 'rejected' ? 'Отклонены' : 'Все'}
          </button>
        ))}
      </div>

      {/* Bulk actions (only for pending) */}
      {filter === 'pending' && pendingItems.length > 0 && (
        <div className="flex items-center gap-2">
          <button
            onClick={toggleAll}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            {selected.size === pendingItems.length ? 'Снять всё' : 'Выбрать все'}
          </button>
          {selected.size > 0 && (
            <motion.button
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={handleBulkApprove}
              className="ml-auto btn-gold !py-1.5 !px-4 !text-xs !rounded-lg"
            >
              ✓ Одобрить {selected.size} заявок
            </motion.button>
          )}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="text-center text-gray-500 py-12">Загрузка...</div>
      ) : items.length === 0 ? (
        <div className="text-center text-gray-600 py-12">
          {filter === 'pending' ? 'Нет заявок на обмен' : 'Нет записей'}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ x: -8, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              className={`card-surface p-4 border transition-all ${
                selected.has(item.id) ? 'border-poker-gold/40' : 'border-transparent'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox (only for pending) */}
                {item.status === 'pending' && (
                  <button
                    onClick={() => toggleSelect(item.id)}
                    className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all ${
                      selected.has(item.id)
                        ? 'bg-poker-gold border-poker-gold'
                        : 'border-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {selected.has(item.id) && <span className="text-black text-[10px] font-black">✓</span>}
                  </button>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm">
                      {item.first_name}
                      {item.username && <span className="text-gray-500 font-normal"> @{item.username}</span>}
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[item.status] ?? STATUS_COLORS.pending}`}>
                      {STATUS_LABELS[item.status] ?? item.status}
                    </span>
                  </div>

                  <div className="text-lg font-extrabold text-poker-gold mb-1">
                    {item.amount.toLocaleString()} RR
                  </div>

                  {item.ton_wallet && (
                    <div className="text-[10px] text-gray-500 font-mono truncate mb-1">
                      → {item.ton_wallet}
                    </div>
                  )}

                  {item.ton_tx_hash && (
                    <div className="text-[10px] text-emerald-500 font-mono truncate">
                      TX: {item.ton_tx_hash}
                    </div>
                  )}

                  <div className="text-[10px] text-gray-600 mt-1">
                    {new Date(item.created_at).toLocaleString('ru')} · #{item.id}
                  </div>
                </div>

                {/* Actions */}
                {item.status === 'pending' && (
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleApprove(item.id)}
                      disabled={processing.has(item.id)}
                      className="btn-gold !py-1 !px-3 !text-xs !rounded-lg disabled:opacity-50 min-w-[72px]"
                    >
                      {processing.has(item.id) ? '...' : '✓ Отправить'}
                    </button>
                    <button
                      onClick={() => handleReject(item.id)}
                      disabled={processing.has(item.id)}
                      className="bg-red-900/30 border border-red-500/30 text-red-400 text-xs py-1 px-3 rounded-lg font-bold hover:bg-red-900/50 transition-colors disabled:opacity-50"
                    >
                      ✕ Отклонить
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
