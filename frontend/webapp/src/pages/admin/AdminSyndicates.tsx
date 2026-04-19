import { useEffect, useState } from 'react'
import { useApi } from '../../hooks/useApi'

interface Syndicate {
  id: number
  name: string
  description: string | null
  member_count: number
  total_rake: number
  created_at: string
  owner_name: string
}

export default function AdminSyndicates() {
  const [syndicates, setSyndicates] = useState<Syndicate[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const api = useApi()

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.get<Syndicate[]>('/admin/syndicates')
      setSyndicates(data)
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleDisband = async (id: number, name: string) => {
    if (!confirm(`Расформировать картель «${name}»? Это действие необратимо.`)) return
    try {
      await api.del(`/admin/syndicates/${id}`)
      setMsg(`✅ Картель «${name}» расформирован`)
      load()
    } catch (e: any) {
      setMsg(`❌ ${e.detail || e.message}`)
    }
    setTimeout(() => setMsg(''), 4000)
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">⚔️ Картели</h2>
        <span className="text-xs text-gray-500">{syndicates.length} картелей</span>
      </div>

      {msg && (
        <div className="rounded-xl px-4 py-3 text-sm font-bold"
          style={{ background: msg.startsWith('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: msg.startsWith('✅') ? '#4ade80' : '#f87171' }}>
          {msg}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-center py-8">Загрузка...</p>
      ) : (
        <div className="space-y-2">
          {syndicates.map(s => (
            <div key={s.id} className="card-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">{s.name}</p>
                  {s.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{s.description}</p>}
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                    <span>👤 Глава: {s.owner_name}</span>
                    <span>👥 {s.member_count} участников</span>
                    <span>💰 Рейк: {s.total_rake.toFixed(0)} RR</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDisband(s.id, s.name)}
                  className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
                >
                  Расформировать
                </button>
              </div>
            </div>
          ))}
          {syndicates.length === 0 && (
            <p className="text-gray-500 text-center py-8 text-sm">Картелей пока нет</p>
          )}
        </div>
      )}
    </div>
  )
}
