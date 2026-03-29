import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApi } from '../hooks/useApi'

interface Friend {
  friendship_id: number
  telegram_id: number
  username: string | null
  first_name: string
  is_online: boolean
  status: 'accepted' | 'pending' | 'incoming'
}

interface SearchResult {
  telegram_id: number
  username: string | null
  first_name: string
  is_online: boolean
}

export default function Friends() {
  const api = useApi()
  const [friends, setFriends] = useState<Friend[]>([])
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [tab, setTab] = useState<'friends' | 'search'>('friends')
  const [actionMsg, setActionMsg] = useState('')

  function loadFriends() {
    api.get<Friend[]>('/friends/list').then(setFriends).catch(() => {})
  }

  useEffect(() => { loadFriends() }, [])

  function flash(msg: string) {
    setActionMsg(msg)
    setTimeout(() => setActionMsg(''), 2500)
  }

  async function doSearch() {
    if (search.length < 2) return
    setSearching(true)
    try {
      const res = await api.get<SearchResult[]>(`/friends/search?q=${encodeURIComponent(search)}`)
      setSearchResults(res)
    } catch { setSearchResults([]) }
    setSearching(false)
  }

  async function sendRequest(tgId: number) {
    try {
      await api.post(`/friends/request/${tgId}`)
      flash('Запрос отправлен!')
      loadFriends()
    } catch (e: any) {
      flash(e.message?.includes('409') ? 'Уже отправлено' : 'Ошибка')
    }
  }

  async function accept(fid: number) {
    await api.post(`/friends/accept/${fid}`)
    flash('Друг добавлен!')
    loadFriends()
  }

  async function decline(fid: number) {
    await api.post(`/friends/decline/${fid}`)
    loadFriends()
  }

  async function remove(tgId: number) {
    await api.del(`/friends/remove/${tgId}`)
    flash('Удалён из друзей')
    loadFriends()
  }

  async function inviteToTable(tgId: number) {
    // For now open tables page — full invite needs table selection
    flash('Выбери стол и пригласи друга!')
  }

  const accepted = friends.filter(f => f.status === 'accepted')
  const incoming = friends.filter(f => f.status === 'incoming')
  const pending  = friends.filter(f => f.status === 'pending')
  const onlineCount = accepted.filter(f => f.is_online).length

  return (
    <div className="min-h-screen pb-24 px-4 pt-5">

      {/* Header */}
      <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-white">Друзья</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {accepted.length} друзей · <span className="text-green-400">{onlineCount} онлайн</span>
            </p>
          </div>
          {incoming.length > 0 && (
            <div className="px-2.5 py-1 rounded-full text-xs font-bold"
              style={{ background: 'rgba(212,168,67,0.15)', color: '#d4a843', border: '1px solid rgba(212,168,67,0.3)' }}>
              +{incoming.length} запрос{incoming.length > 1 ? 'а' : ''}
            </div>
          )}
        </div>
      </motion.div>

      {/* Flash message */}
      <AnimatePresence>
        {actionMsg && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-4 rounded-xl px-4 py-2.5 text-sm text-center font-medium"
            style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.2)', color: '#d4a843' }}>
            {actionMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {(['friends', 'search'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all relative"
            style={{ color: tab === t ? '#d4a843' : '#6b7280', background: tab === t ? 'rgba(212,168,67,0.08)' : 'transparent', border: tab === t ? '1px solid rgba(212,168,67,0.2)' : '1px solid transparent' }}>
            {t === 'friends' ? `👥 Мои друзья` : '🔍 Найти игрока'}
          </button>
        ))}
      </div>

      {tab === 'search' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex gap-2 mb-4">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="ID или @username"
              className="flex-1 rounded-xl px-4 py-3 text-sm"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
            />
            <button onClick={doSearch} disabled={searching}
              className="btn-gold px-5 py-3 text-sm rounded-xl font-bold">
              {searching ? '...' : 'Найти'}
            </button>
          </div>

          <div className="space-y-2">
            {searchResults.map(u => (
              <div key={u.telegram_id} className="card-surface rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                  style={{ background: 'rgba(212,168,67,0.15)', color: '#d4a843' }}>
                  {u.first_name[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{u.first_name}</p>
                  <p className="text-xs text-gray-500">
                    {u.username ? `@${u.username}` : `#${u.telegram_id}`}
                    {' · '}
                    <span className={u.is_online ? 'text-green-400' : 'text-gray-600'}>
                      {u.is_online ? 'онлайн' : 'офлайн'}
                    </span>
                  </p>
                </div>
                <button onClick={() => sendRequest(u.telegram_id)}
                  className="text-xs font-bold px-3 py-2 rounded-xl flex-shrink-0"
                  style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.25)', color: '#d4a843' }}>
                  + Добавить
                </button>
              </div>
            ))}
            {searchResults.length === 0 && search.length >= 2 && !searching && (
              <p className="text-center text-gray-600 text-sm py-6">Игрок не найден</p>
            )}
          </div>
        </motion.div>
      )}

      {tab === 'friends' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

          {/* Incoming requests */}
          {incoming.length > 0 && (
            <div>
              <p className="text-xs font-bold text-poker-gold uppercase tracking-wider mb-2">Входящие запросы</p>
              <div className="space-y-2">
                {incoming.map(f => (
                  <div key={f.friendship_id} className="card-surface rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                      style={{ background: 'rgba(212,168,67,0.15)', color: '#d4a843' }}>
                      {f.first_name[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{f.first_name}</p>
                      <p className="text-xs text-gray-500">{f.username ? `@${f.username}` : `#${f.telegram_id}`}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => accept(f.friendship_id)}
                        className="text-xs font-bold px-3 py-2 rounded-xl"
                        style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80' }}>
                        ✓
                      </button>
                      <button onClick={() => decline(f.friendship_id)}
                        className="text-xs font-bold px-3 py-2 rounded-xl"
                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending sent */}
          {pending.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Ожидают ответа</p>
              <div className="space-y-2">
                {pending.map(f => (
                  <div key={f.friendship_id} className="card-surface rounded-2xl p-4 flex items-center gap-3 opacity-60">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                      style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280' }}>
                      {f.first_name[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{f.first_name}</p>
                      <p className="text-xs text-gray-600">Запрос отправлен</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Friends list */}
          {accepted.length > 0 ? (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Друзья</p>
              <div className="space-y-2">
                {accepted.map(f => (
                  <div key={f.friendship_id} className="card-surface rounded-2xl p-4 flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
                        style={{ background: 'rgba(212,168,67,0.15)', color: '#d4a843' }}>
                        {f.first_name[0]?.toUpperCase() || '?'}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-black ${f.is_online ? 'bg-green-400' : 'bg-gray-600'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{f.first_name}</p>
                      <p className="text-xs" style={{ color: f.is_online ? '#4ade80' : '#6b7280' }}>
                        {f.is_online ? 'Онлайн' : 'Офлайн'}
                        {f.username ? ` · @${f.username}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {f.is_online && (
                        <button onClick={() => inviteToTable(f.telegram_id)}
                          className="text-xs font-bold px-3 py-2 rounded-xl"
                          style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.25)', color: '#d4a843' }}>
                          🃏 Играть
                        </button>
                      )}
                      <button onClick={() => remove(f.telegram_id)}
                        className="text-xs px-2 py-2 rounded-xl text-gray-600 hover:text-red-400 transition-colors">
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            incoming.length === 0 && pending.length === 0 && (
              <div className="text-center py-12">
                <p className="text-4xl mb-3">👥</p>
                <p className="text-gray-500 text-sm">Пока нет друзей</p>
                <p className="text-gray-600 text-xs mt-1">Найди игроков по ID или username</p>
                <button onClick={() => setTab('search')}
                  className="btn-gold mt-4 px-6 py-2.5 text-sm rounded-xl">
                  Найти игроков
                </button>
              </div>
            )
          )}
        </motion.div>
      )}
    </div>
  )
}
