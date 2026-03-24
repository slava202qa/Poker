import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApi } from '../../hooks/useApi'

interface ShopItem {
  id: number
  item_key: string
  name: string
  description: string | null
  item_type: string
  rarity: string
  price: number
  icon: string | null
  image_url: string | null
  vip_days: number
  is_active: boolean
  created_at: string
}

const ITEM_TYPES = ['card_skin', 'avatar_frame', 'emote', 'vip']
const RARITIES   = ['common', 'rare', 'epic', 'legendary']

const RARITY_COLOR: Record<string, string> = {
  common: '#9ca3af', rare: '#60a5fa', epic: '#c084fc', legendary: '#d4a843',
}
const TYPE_LABEL: Record<string, string> = {
  card_skin: '🃏 Скин карт', avatar_frame: '🖼 Рамка', emote: '😎 Эмоция', vip: '👑 VIP',
}

const EMPTY = {
  name: '', item_key: '', item_type: 'card_skin', rarity: 'common',
  price: 0, description: '', icon: '🎁', vip_days: 0,
}

export default function AdminShop() {
  const { get } = useApi()
  const [items, setItems] = useState<ShopItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<ShopItem | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const load = async () => {
    setLoading(true)
    try { setItems(await get<ShopItem[]>('/admin/shop/items')) }
    catch { setItems([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

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

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-extrabold">Товары магазина</h2>
        <button onClick={() => { setEditItem(null); setShowForm(true) }}
          className="btn-gold !py-2 !px-4 !text-xs !rounded-xl">
          + Добавить
        </button>
      </div>

      {showForm && (
        <ItemForm
          initial={editItem}
          onClose={() => { setShowForm(false); setEditItem(null) }}
          onSaved={() => { setShowForm(false); setEditItem(null); load(); showToast('Сохранено!', true) }}
          onError={(e) => showToast(e, false)}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 border-2 border-poker-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center text-gray-600 py-12">Нет товаров. Добавьте первый!</div>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => (
            <ItemCard key={item.id} item={item} index={i}
              onEdit={() => { setEditItem(item); setShowForm(true) }}
              onToggle={async () => {
                const fd = new FormData()
                fd.append('is_active', String(!item.is_active))
                await fetch(`/api/admin/shop/items/${item.id}`, { method: 'PUT', body: fd, headers: { 'X-Init-Data': window.Telegram?.WebApp?.initData ?? '' } })
                load()
              }}
              onDelete={async () => {
                if (!confirm(`Удалить "${item.name}"?`)) return
                await fetch(`/api/admin/shop/items/${item.id}`, { method: 'DELETE', headers: { 'X-Init-Data': window.Telegram?.WebApp?.initData ?? '' } })
                showToast('Удалено', true)
                load()
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ItemCard({ item, index, onEdit, onToggle, onDelete }: {
  item: ShopItem; index: number
  onEdit: () => void; onToggle: () => void; onDelete: () => void
}) {
  const rc = RARITY_COLOR[item.rarity] ?? '#9ca3af'
  return (
    <motion.div initial={{ x: -12, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: index * 0.04 }}
      className="rounded-2xl p-3.5 flex items-center gap-3"
      style={{ background: '#1c1c1c', border: `1px solid ${rc}30`, opacity: item.is_active ? 1 : 0.5 }}>

      {/* Image / icon */}
      <div className="w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center text-2xl"
        style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${rc}40` }}>
        {item.image_url
          ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
          : item.icon ?? '🎁'}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm">{item.name}</span>
          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: `${rc}20`, color: rc }}>
            {item.rarity}
          </span>
          <span className="text-[9px] text-gray-600">{TYPE_LABEL[item.item_type] ?? item.item_type}</span>
        </div>
        <div className="text-xs text-gray-500 mt-0.5 truncate">{item.description ?? '—'}</div>
        <div className="text-xs font-bold text-poker-gold mt-0.5">{item.price === 0 ? 'Бесплатно' : `${item.price} RR`}</div>
      </div>

      <div className="flex flex-col gap-1.5 flex-shrink-0">
        <button onClick={onEdit} className="text-[10px] px-2 py-1 rounded-lg font-bold"
          style={{ background: 'rgba(212,168,67,0.1)', color: '#d4a843' }}>Изменить</button>
        <button onClick={onToggle} className="text-[10px] px-2 py-1 rounded-lg font-bold"
          style={{ background: item.is_active ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', color: item.is_active ? '#f87171' : '#4ade80' }}>
          {item.is_active ? 'Скрыть' : 'Показать'}
        </button>
        <button onClick={onDelete} className="text-[10px] px-2 py-1 rounded-lg font-bold"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}>Удалить</button>
      </div>
    </motion.div>
  )
}

function ItemForm({ initial, onClose, onSaved, onError }: {
  initial: ShopItem | null
  onClose: () => void
  onSaved: () => void
  onError: (e: string) => void
}) {
  const [form, setForm] = useState(initial ? {
    name: initial.name, item_key: initial.item_key, item_type: initial.item_type,
    rarity: initial.rarity, price: initial.price, description: initial.description ?? '',
    icon: initial.icon ?? '🎁', vip_days: initial.vip_days,
  } : { ...EMPTY })
  const [preview, setPreview] = useState<string | null>(initial?.image_url ?? null)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.item_key.trim()) { onError('Заполните название и ключ'); return }
    setSaving(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)))
      if (file) fd.append('image', file)

      const url = initial ? `/api/admin/shop/items/${initial.id}` : '/api/admin/shop/items'
      const method = initial ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method, body: fd,
        headers: { 'X-Init-Data': window.Telegram?.WebApp?.initData ?? '' },
      })
      if (!res.ok) { const e = await res.json(); onError(e.detail ?? 'Ошибка'); return }
      onSaved()
    } catch (e: any) { onError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-4 mb-4 space-y-3"
      style={{ background: '#1c1c1c', border: '1px solid rgba(212,168,67,0.2)' }}>

      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm">{initial ? 'Редактировать товар' : 'Новый товар'}</h3>
        <button onClick={onClose} className="text-gray-600 text-lg leading-none">×</button>
      </div>

      {/* Image upload */}
      <div className="flex items-center gap-3">
        <div onClick={() => fileRef.current?.click()}
          className="w-20 h-20 rounded-xl flex items-center justify-center cursor-pointer overflow-hidden flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.04)', border: '2px dashed rgba(212,168,67,0.3)' }}>
          {preview
            ? <img src={preview} alt="" className="w-full h-full object-cover" />
            : <span className="text-3xl">{form.icon}</span>}
        </div>
        <div>
          <button onClick={() => fileRef.current?.click()}
            className="text-xs px-3 py-1.5 rounded-lg font-bold mb-1 block"
            style={{ background: 'rgba(212,168,67,0.1)', color: '#d4a843' }}>
            📁 Загрузить изображение
          </button>
          <p className="text-[10px] text-gray-600">JPG, PNG, GIF, WebP · макс 5MB</p>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </div>
      </div>

      {/* Fields */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Название', key: 'name', type: 'text', full: true },
          { label: 'Ключ (item_key)', key: 'item_key', type: 'text', full: true },
          { label: 'Цена (RR)', key: 'price', type: 'number' },
          { label: 'Иконка (emoji)', key: 'icon', type: 'text' },
        ].map(f => (
          <div key={f.key} className={f.full ? 'col-span-2' : ''}>
            <label className="text-[10px] text-gray-600 uppercase tracking-wider mb-1 block">{f.label}</label>
            <input type={f.type} value={(form as any)[f.key]}
              onChange={e => set(f.key, f.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-sm text-white outline-none"
              style={{ background: '#121212', border: '1px solid rgba(255,255,255,0.1)' }} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-gray-600 uppercase tracking-wider mb-1 block">Тип</label>
          <select value={form.item_type} onChange={e => set('item_type', e.target.value)}
            className="w-full rounded-xl px-3 py-2 text-sm text-white outline-none"
            style={{ background: '#121212', border: '1px solid rgba(255,255,255,0.1)' }}>
            {ITEM_TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t] ?? t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-600 uppercase tracking-wider mb-1 block">Редкость</label>
          <select value={form.rarity} onChange={e => set('rarity', e.target.value)}
            className="w-full rounded-xl px-3 py-2 text-sm text-white outline-none"
            style={{ background: '#121212', border: '1px solid rgba(255,255,255,0.1)' }}>
            {RARITIES.map(r => <option key={r} value={r} style={{ color: RARITY_COLOR[r] }}>{r}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="text-[10px] text-gray-600 uppercase tracking-wider mb-1 block">Описание</label>
        <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
          className="w-full rounded-xl px-3 py-2 text-sm text-white outline-none resize-none"
          style={{ background: '#121212', border: '1px solid rgba(255,255,255,0.1)' }} />
      </div>

      <button onClick={handleSubmit} disabled={saving} className="w-full btn-gold py-2.5 text-sm disabled:opacity-50">
        {saving ? 'Сохранение...' : initial ? 'Сохранить изменения' : 'Создать товар'}
      </button>
    </motion.div>
  )
}
