import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApi } from '../hooks/useApi'

interface Syndicate {
  id: number
  name: string
  tag: string
  description: string | null
  icon: string | null
  owner_id: number
  member_count: number
  total_xp: number
  my_role: string | null
}

interface Member {
  telegram_id: number
  username: string | null
  first_name: string
  role: string
  contribution_xp: number
  is_online: boolean
}

interface ChatMessage {
  id: number
  user_id: number
  first_name: string
  username: string | null
  text: string
  created_at: string
}

interface LeaderboardEntry {
  rank: number
  clan_id: number
  name: string
  tag: string
  icon: string | null
  total_winnings: number
  hands_played: number
  member_count: number
}

type Tab = 'my' | 'list' | 'leaderboard'

export default function Syndicates() {
  const api = useApi()
  const [tab, setTab] = useState<Tab>('my')
  const [mySyndicate, setMySyndicate] = useState<Syndicate | null | undefined>(undefined)
  const [syndicates, setSyndicates] = useState<Syndicate[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [chat, setChat] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [innerTab, setInnerTab] = useState<'info' | 'members' | 'chat'>('info')
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', tag: '', description: '', icon: '♠️' })
  const [msg, setMsg] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(''), 2500) }

  function loadMy() {
    api.get<Syndicate | null>('/syndicates/my').then(s => setMySyndicate(s)).catch(() => setMySyndicate(null))
  }

  useEffect(() => {
    loadMy()
    api.get<Syndicate[]>('/syndicates/list').then(setSyndicates).catch(() => {})
    api.get<LeaderboardEntry[]>('/syndicates/leaderboard/weekly').then(setLeaderboard).catch(() => {})
  }, [])

  useEffect(() => {
    if (mySyndicate && innerTab === 'members') {
      api.get<Member[]>(`/syndicates/${mySyndicate.id}/members`).then(setMembers).catch(() => {})
    }
    if (mySyndicate && innerTab === 'chat') {
      api.get<ChatMessage[]>(`/syndicates/${mySyndicate.id}/chat`).then(msgs => {
        setChat(msgs)
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      }).catch(() => {})
    }
  }, [mySyndicate, innerTab])

  async function sendChat() {
    if (!chatInput.trim() || !mySyndicate) return
    try {
      await api.post(`/syndicates/${mySyndicate.id}/chat`, { text: chatInput.trim() })
      setChatInput('')
      const msgs = await api.get<ChatMessage[]>(`/syndicates/${mySyndicate.id}/chat`)
      setChat(msgs)
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch { flash('Ошибка отправки') }
  }

  async function joinSyndicate(id: number) {
    try {
      await api.post(`/syndicates/join/${id}`)
      flash('Вступил в картель!')
      loadMy()
      api.get<Syndicate[]>('/syndicates/list').then(setSyndicates)
      setTab('my')
    } catch (e: any) { flash(e.message || 'Ошибка') }
  }

  async function leaveSyndicate() {
    try {
      await api.post('/syndicates/leave')
      flash('Вышел из картеля')
      setMySyndicate(null)
      api.get<Syndicate[]>('/syndicates/list').then(setSyndicates)
    } catch (e: any) { flash(e.message || 'Ошибка') }
  }

  async function createSyndicate() {
    try {
      const s = await api.post<Syndicate>('/syndicates/create', createForm)
      setMySyndicate(s)
      setShowCreate(false)
      flash('Картель создан!')
      setTab('my')
    } catch (e: any) { flash(e.message || 'Ошибка') }
  }

  const ICONS = ['♠️', '♦️', '♣️', '♥️', '🃏', '👑', '🐉', '🔱', '⚡']

  return (
    <div className="min-h-screen pb-24 px-4 pt-5">

      {/* Header */}
      <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-5">
        <h1 className="text-xl font-extrabold text-white">⚔️ Картели</h1>
        <p className="text-xs text-gray-500 mt-0.5">Объединяйся, играй, побеждай вместе</p>
      </motion.div>

      {/* Flash */}
      <AnimatePresence>
        {msg && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-4 rounded-xl px-4 py-2.5 text-sm text-center font-medium"
            style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.2)', color: '#d4a843' }}>
            {msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-5">
        {([['my', 'Мой'], ['list', 'Все'], ['leaderboard', 'Рейтинг']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
            style={{ color: tab === t ? '#d4a843' : '#6b7280', background: tab === t ? 'rgba(212,168,67,0.08)' : 'transparent', border: tab === t ? '1px solid rgba(212,168,67,0.2)' : '1px solid transparent' }}>
            {label}
          </button>
        ))}
      </div>

      {/* MY SYNDICATE */}
      {tab === 'my' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {mySyndicate === undefined && (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-poker-gold border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {mySyndicate === null && (
            <div className="text-center py-10">
              <p className="text-5xl mb-4">🔱</p>
              <p className="text-white font-bold text-lg mb-1">Ты не в картеле</p>
              <p className="text-gray-500 text-sm mb-6">Вступи в существующий или создай свой за 500 RR</p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => setTab('list')} className="btn-gold px-6 py-3 text-sm rounded-xl font-bold">
                  Найти картель
                </button>
                <button onClick={() => setShowCreate(true)}
                  className="px-6 py-3 text-sm rounded-xl font-bold"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}>
                  Создать
                </button>
              </div>
            </div>
          )}

          {mySyndicate && (
            <div>
              {/* Syndicate card */}
              <div className="card-surface rounded-2xl p-5 mb-4">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
                    style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.2)' }}>
                    {mySyndicate.icon || '♠️'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-extrabold text-lg text-white truncate">{mySyndicate.name}</h2>
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold flex-shrink-0"
                        style={{ background: 'rgba(212,168,67,0.15)', color: '#d4a843', border: '1px solid rgba(212,168,67,0.3)' }}>
                        [{mySyndicate.tag}]
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{mySyndicate.description || 'Нет описания'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Участников', value: mySyndicate.member_count },
                    { label: 'XP картеля', value: mySyndicate.total_xp.toLocaleString() },
                    { label: 'Роль', value: mySyndicate.my_role === 'owner' ? '👑 Лидер' : mySyndicate.my_role === 'officer' ? '⭐ Офицер' : '👤 Участник' },
                  ].map(s => (
                    <div key={s.label} className="text-center rounded-xl py-2.5"
                      style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <div className="text-sm font-bold text-white">{s.value}</div>
                      <div className="text-[10px] text-gray-600 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Inner tabs */}
              <div className="flex gap-1.5 mb-4">
                {([['info', 'Инфо'], ['members', 'Участники'], ['chat', '💬 Чат']] as const).map(([t, label]) => (
                  <button key={t} onClick={() => setInnerTab(t)}
                    className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                    style={{ color: innerTab === t ? '#d4a843' : '#6b7280', background: innerTab === t ? 'rgba(212,168,67,0.08)' : 'transparent', border: innerTab === t ? '1px solid rgba(212,168,67,0.2)' : '1px solid transparent' }}>
                    {label}
                  </button>
                ))}
              </div>

              {innerTab === 'info' && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">Создай стол и пригласи участников картеля для совместной игры.</p>
                  {mySyndicate.my_role !== 'owner' && (
                    <button onClick={leaveSyndicate}
                      className="w-full py-3 rounded-xl text-sm font-bold"
                      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                      Покинуть картель
                    </button>
                  )}
                </div>
              )}

              {innerTab === 'members' && (
                <div className="space-y-2">
                  {members.map(m => (
                    <div key={m.telegram_id} className="card-surface rounded-2xl p-3 flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                          style={{ background: 'rgba(212,168,67,0.1)', color: '#d4a843' }}>
                          {m.first_name[0]?.toUpperCase()}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-black ${m.is_online ? 'bg-green-400' : 'bg-gray-600'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{m.first_name}</p>
                        <p className="text-[10px] text-gray-600">
                          {m.role === 'owner' ? '👑 Лидер' : m.role === 'officer' ? '⭐ Офицер' : '👤 Участник'}
                          {' · '}{m.contribution_xp} XP
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {innerTab === 'chat' && (
                <div>
                  <div className="rounded-2xl p-3 mb-3 space-y-3 overflow-y-auto" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', maxHeight: '320px' }}>
                    {chat.length === 0 && (
                      <p className="text-center text-gray-600 text-xs py-4">Нет сообщений. Начни общение!</p>
                    )}
                    {chat.map(m => (
                      <div key={m.id} className="flex gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: 'rgba(212,168,67,0.1)', color: '#d4a843' }}>
                          {m.first_name[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 mb-0.5">
                            {m.first_name}{m.username ? ` @${m.username}` : ''}
                          </p>
                          <p className="text-sm text-white">{m.text}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="flex gap-2">
                    <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendChat()}
                      placeholder="Сообщение..."
                      className="flex-1 rounded-xl px-4 py-3 text-sm"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
                    <button onClick={sendChat} className="btn-gold px-4 py-3 rounded-xl text-sm font-bold">
                      ➤
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}

      {/* ALL SYNDICATES */}
      {tab === 'list' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {!mySyndicate && (
            <button onClick={() => setShowCreate(true)}
              className="w-full py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
              style={{ background: 'rgba(212,168,67,0.08)', border: '1px dashed rgba(212,168,67,0.3)', color: '#d4a843' }}>
              + Создать картель (500 RR)
            </button>
          )}
          {syndicates.map(s => (
            <div key={s.id} className="card-surface rounded-2xl p-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: 'rgba(212,168,67,0.08)' }}>
                {s.icon || '♠️'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-sm truncate">{s.name}</p>
                  <span className="text-[10px] text-poker-gold">[{s.tag}]</span>
                </div>
                <p className="text-[10px] text-gray-500">{s.member_count} участников · {s.total_xp.toLocaleString()} XP</p>
              </div>
              {!mySyndicate && (
                <button onClick={() => joinSyndicate(s.id)}
                  className="text-xs font-bold px-3 py-2 rounded-xl flex-shrink-0"
                  style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.25)', color: '#d4a843' }}>
                  Вступить
                </button>
              )}
              {s.my_role && (
                <span className="text-[10px] text-green-400 flex-shrink-0">✓ Мой</span>
              )}
            </div>
          ))}
          {syndicates.length === 0 && (
            <p className="text-center text-gray-600 text-sm py-8">Картелей пока нет</p>
          )}
        </motion.div>
      )}

      {/* LEADERBOARD */}
      {tab === 'leaderboard' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <p className="text-xs text-gray-500 mb-4">Рейтинг картелей за текущую неделю</p>
          <div className="space-y-2">
            {leaderboard.map(e => (
              <div key={e.clan_id} className="card-surface rounded-2xl p-4 flex items-center gap-3">
                <div className="w-8 text-center font-extrabold flex-shrink-0"
                  style={{ color: e.rank === 1 ? '#fbbf24' : e.rank === 2 ? '#9ca3af' : e.rank === 3 ? '#cd7f32' : '#6b7280' }}>
                  #{e.rank}
                </div>
                <div className="text-xl flex-shrink-0">{e.icon || '♠️'}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{e.name} <span className="text-poker-gold text-[10px]">[{e.tag}]</span></p>
                  <p className="text-[10px] text-gray-500">{e.member_count} участников · {e.hands_played} раздач</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-poker-gold">{e.total_winnings.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-600">RR</p>
                </div>
              </div>
            ))}
            {leaderboard.length === 0 && (
              <p className="text-center text-gray-600 text-sm py-8">Данных за эту неделю пока нет</p>
            )}
          </div>
        </motion.div>
      )}

      {/* CREATE MODAL — fullscreen with scroll */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed z-50 flex flex-col"
            style={{ background: '#0d0d0d', top: 0, left: 0, right: 0, bottom: 0, height: '100dvh' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-5 pb-3 flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="text-lg font-extrabold text-white">⚔️ Создать картель</h3>
              <button onClick={() => setShowCreate(false)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 text-xl"
                style={{ background: 'rgba(255,255,255,0.06)' }}>✕</button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ WebkitOverflowScrolling: 'touch' }}>
              <input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Название картеля"
                className="w-full rounded-xl px-4 py-3.5 text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
              <input value={createForm.tag} onChange={e => setCreateForm(f => ({ ...f, tag: e.target.value.toUpperCase().slice(0, 5) }))}
                placeholder="Тег [2-5 букв], например ROYAL"
                className="w-full rounded-xl px-4 py-3.5 text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
              <input value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Описание (необязательно)"
                className="w-full rounded-xl px-4 py-3.5 text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
              <div>
                <p className="text-xs text-gray-500 mb-3">Иконка картеля</p>
                <div className="grid grid-cols-6 gap-2">
                  {ICONS.map(icon => (
                    <button key={icon} onClick={() => setCreateForm(f => ({ ...f, icon }))}
                      className="h-12 rounded-xl text-2xl flex items-center justify-center transition-all"
                      style={{
                        background: createForm.icon === icon ? 'rgba(212,168,67,0.2)' : 'rgba(255,255,255,0.05)',
                        border: createForm.icon === icon ? '2px solid rgba(212,168,67,0.6)' : '1px solid rgba(255,255,255,0.06)',
                      }}>
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'rgba(212,168,67,0.06)', border: '1px solid rgba(212,168,67,0.15)' }}>
                <p className="text-xs text-gray-400">Стоимость создания: <span className="text-poker-gold font-bold">500 RR</span></p>
              </div>
            </div>

            {/* Fixed bottom buttons — always visible */}
            <div className="flex-shrink-0 px-4 pt-3 flex gap-3"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: '#0d0d0d', paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}>
              <button onClick={() => setShowCreate(false)}
                className="flex-1 py-4 rounded-xl text-sm font-bold text-gray-400"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                Отмена
              </button>
              <button onClick={createSyndicate}
                disabled={!createForm.name || !createForm.tag}
                className="flex-1 btn-gold py-4 rounded-xl text-sm font-bold disabled:opacity-40">
                Создать картель
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
