import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApi } from '../../hooks/useApi'

interface Transfer {
  id: number
  user_id: number
  username: string | null
  first_name: string
  amount_rr: number
  amount_crypto: number
  currency: string
  wallet_address: string
  review_type: string   // auto | manual
  status: string        // pending | approved | rejected
  ton_tx_hash: string | null
  created_at: string
}

type Filter = 'pending' | 'approved' | 'rejected' | 'all'

export default function AdminWithdrawals() {
  const { get, post } = useApi()
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('pending')
  const [processing, setProcessing] = useState<number | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await get<Transfer[]>(`/admin/withdrawals?status=${filter}&limit=100`)
      setTransfers(data)
    } catch { setTransfers([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [filter])

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const approve = async (id: number) => {
    setProcessing(id)
    try {
      const r = await post<any>(`/admin/withdrawals/${id}/approve`)
      showToast(r.status === 'approved' ? `✅ Выплачено (${r.tx_hash?.slice(0,12) ?? 'manual'})` : '✅ Одобрено (ручная отправка)', true)
      await load()
    } catch (e: any) { showToast(`❌ ${e?.message || 'Ошибка'}`, false) }
    finally { setProcessing(null) }
  }

  const reject = async (id: number) => {
    setProcessing(id)
    try {
      await post<any>(`/admin/withdrawals/${id}/reject`)
      showToast('Отклонено, баланс возвращён', true)
      await load()
    } catch (e: any) { showToast(`❌ ${e?.message || 'Ошибка'}`, false) }
    finally { setProcessing(null) }
  }

  const bulkApprove = async () => {
    if (selected.size === 0) return
    setProcessing(-1)
    try {
      const r = await post<any>('/admin/withdrawals/bulk-approve', { tx_ids: Array.from(selected) })
      const ok = r.results?.filter((x: any) => x.status !== 'error').length ?? 0
      showToast(`✅ Одобрено ${ok}/${selected.size}`, true)
      setSelected(new Set())
      await load()
    } catch (e: any) { showToast(`❌ ${e?.message || 'Ошибка'}`, false) }
    finally { setProcessing(null) }
  }

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const pendingCount = transfers.filter(t => t.status === 'pending').length

  return (
    <div className="p-4 relative z-10">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-bold shadow-xl"
            style={{ background: toast.ok ? '#16a34a' : '#dc2626', color: 'white', minWidth: 220, textAlign: 'center' }}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-extrabold">Pending Transfers</h2>
          {pendingCount > 0 && (
            <span className="text-xs text-amber-400">{pendingCount} ожидают обработки</span>
          )}
        </div>
        {selected.size > 0 && (
          <button onClick={bulkApprove} disabled={processing === -1}
            className="btn-gold !py-2 !px-4 !text-xs !rounded-xl disabled:opacity-50">
            {processing === -1 ? '...' : `✅ Одобрить ${selected.size}`}
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 mb-4 rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.03)' }}>
        {(['pending', 'approved', 'rejected', 'all'] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className="flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all"
            style={filter === f
              ? { background: '#1c1c1c', color: 'white', border: '1px solid rgba(255,255,255,0.08)' }
              : { color: '#6b7280' }}>
            {f === 'pending' ? 'Ожидание' : f === 'approved' ? 'Выплачено' : f === 'rejected' ? 'Отклонено' : 'Все'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 border-2 border-poker-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : transfers.length === 0 ? (
        <div className="text-center text-gray-600 py-12">Нет заявок</div>
      ) : (
        <div className="space-y-3">
          {transfers.map((t, i) => (
            <TransferCard
              key={t.id}
              transfer={t}
              index={i}
              isSelected={selected.has(t.id)}
              processing={processing === t.id}
              onToggle={() => toggleSelect(t.id)}
              onApprove={() => approve(t.id)}
              onReject={() => reject(t.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TransferCard({ transfer: t, index, isSelected, processing, onToggle, onApprove, onReject }: {
  transfer: Transfer
  index: number
  isSelected: boolean
  processing: boolean
  onToggle: () => void
  onApprove: () => void
  onReject: () => void
}) {
  const isPending = t.status === 'pending'
  const isManual = t.review_type === 'manual'

  return (
    <motion.div
      initial={{ x: -12, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: index * 0.04 }}
      className="rounded-2xl p-4"
      style={{
        background: '#1c1c1c',
        border: `1px solid ${isSelected ? 'rgba(212,168,67,0.4)' : isManual && isPending ? 'rgba(234,179,8,0.2)' : 'rgba(255,255,255,0.07)'}`,
      }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {isPending && (
            <input type="checkbox" checked={isSelected} onChange={onToggle}
              className="w-4 h-4 rounded accent-yellow-500 cursor-pointer" />
          )}
          <div>
            <div className="font-bold text-sm">{t.first_name} {t.username ? `@${t.username}` : ''}</div>
            <div className="text-[10px] text-gray-600">ID {t.user_id} · #{t.id}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isManual && isPending && (
            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold"
              style={{ background: 'rgba(234,179,8,0.12)', color: '#eab308', border: '1px solid rgba(234,179,8,0.2)' }}>
              MANUAL
            </span>
          )}
          <span className="text-[10px] px-2 py-1 rounded-full font-semibold"
            style={{
              background: t.status === 'approved' ? 'rgba(34,197,94,0.1)' : t.status === 'rejected' ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)',
              color: t.status === 'approved' ? '#4ade80' : t.status === 'rejected' ? '#f87171' : '#eab308',
            }}>
            {t.status === 'approved' ? '✓ Выплачено' : t.status === 'rejected' ? '✗ Отклонено' : '⏳ Ожидание'}
          </span>
        </div>
      </div>

      {/* Amount */}
      <div className="rounded-xl p-3 mb-3 flex items-center justify-between"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div>
          <div className="text-lg font-extrabold text-poker-gold">{t.amount_rr.toLocaleString()} RR</div>
          <div className="text-xs text-gray-500">= {t.amount_crypto} {t.currency}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-gray-600">Кошелёк</div>
          <div className="text-xs font-mono text-gray-400 max-w-[120px] truncate">{t.wallet_address || '—'}</div>
        </div>
      </div>

      {t.ton_tx_hash && (
        <div className="text-[10px] text-emerald-400 mb-2 font-mono truncate">
          TX: {t.ton_tx_hash}
        </div>
      )}

      <div className="text-[10px] text-gray-700 mb-3">
        {new Date(t.created_at).toLocaleString('ru-RU')}
      </div>

      {/* Actions */}
      {isPending && (
        <div className="flex gap-2">
          <button onClick={onApprove} disabled={processing}
            className="flex-1 btn-gold !py-2 !text-xs !rounded-xl disabled:opacity-50">
            {processing ? '...' : isManual ? '✅ Одобрить (ручная)' : '✅ Выплатить'}
          </button>
          <button onClick={onReject} disabled={processing}
            className="px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
            ✗ Отклонить
          </button>
        </div>
      )}
    </motion.div>
  )
}
