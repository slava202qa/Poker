import { motion } from 'framer-motion'
import { useTelegram } from '../hooks/useTelegram'
import { useStore } from '../store/useStore'

// Admin Telegram username — change here if needed
const MANAGER_USERNAME = 'POKER_VIP_1_Bot'

function tgLink(text: string) {
  return `https://t.me/${MANAGER_USERNAME}?start=${encodeURIComponent(text)}`
}

export default function Service() {
  const { user: tgUser } = useTelegram()
  const user = useStore((s) => s.user)
  const uid = user?.telegram_id ?? tgUser?.id ?? ''

  const actions = [
    {
      icon: '💳',
      title: 'Пополнить Активы (RR)',
      desc: 'Связаться с менеджером для пополнения клубных активов',
      link: tgLink(`Заявка на пополнение RR | ID: ${uid}`),
      gold: true,
    },
    {
      icon: '🔄',
      title: 'Обменять Награды',
      desc: 'Заявка на обмен клубных наград',
      link: tgLink(`Заявка на обмен клубных наград | ID: ${uid}`),
      gold: false,
    },
  ]

  return (
    <div className="min-h-screen pb-24 px-4 pt-5 relative z-10">

      {/* Header */}
      <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-6">
        <h1 className="text-xl font-extrabold tracking-tight">Клубный Сервис</h1>
        <p className="text-xs text-gray-600 mt-1">Управление клубными активами</p>
      </motion.div>

      {/* Main action buttons */}
      <div className="space-y-3 mb-6">
        {actions.map((a, i) => (
          <motion.a
            key={a.title}
            href={a.link}
            target="_blank"
            rel="noreferrer"
            initial={{ x: -12, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.07 }}
            className="flex items-center gap-4 p-5 rounded-2xl transition-all active:scale-[0.98] block"
            style={a.gold ? {
              background: 'linear-gradient(135deg, #1e1a0e 0%, #1c1c1c 100%)',
              border: '1px solid rgba(212,168,67,0.3)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4), 0 0 20px rgba(212,168,67,0.06)',
            } : {
              background: '#1c1c1c',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
              style={a.gold
                ? { background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.2)' }
                : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }
              }>
              {a.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm" style={{ color: a.gold ? '#d4a843' : 'white' }}>
                {a.title}
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">{a.desc}</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke={a.gold ? '#d4a843' : '#6b7280'} strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </motion.a>
        ))}
      </div>

      <div className="divider-gold mb-6" />

      {/* FAQ section */}
      <p className="section-title">Информация</p>
      <div className="space-y-2 mb-6">
        {[
          { q: 'Как пополнить активы?',    a: 'Нажмите «Пополнить Активы» — менеджер клуба свяжется с вами в Telegram и предоставит реквизиты.' },
          { q: 'Как обменять награды?',    a: 'Нажмите «Обменять Награды» и укажите сумму. Заявка обрабатывается в течение 24 часов.' },
          { q: 'Безопасно ли это?',        a: 'Все операции проводятся через верифицированного менеджера клуба. Ваш ID фиксируется в каждой заявке.' },
          { q: 'Минимальная сумма?',       a: 'Минимальная сумма для пополнения и обмена — 10 RR.' },
        ].map((item, i) => (
          <motion.details
            key={i}
            initial={{ x: -8, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.15 + i * 0.04 }}
            className="group rounded-2xl overflow-hidden"
            style={{ background: '#1c1c1c', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <summary className="flex items-center justify-between px-4 py-3.5 cursor-pointer list-none select-none">
              <span className="text-sm font-semibold pr-4">{item.q}</span>
              <span className="text-poker-gold text-lg flex-shrink-0 transition-transform group-open:rotate-45">+</span>
            </summary>
            <div className="px-4 pb-3.5">
              <div className="divider-gold mb-3" />
              <p className="text-xs text-gray-400 leading-relaxed">{item.a}</p>
            </div>
          </motion.details>
        ))}
      </div>

      {/* Contact */}
      <motion.a
        href={`https://t.me/${MANAGER_USERNAME}`}
        target="_blank"
        rel="noreferrer"
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm transition-all"
        style={{
          background: 'rgba(212,168,67,0.06)',
          border: '1px solid rgba(212,168,67,0.2)',
          color: '#d4a843',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
            stroke="#d4a843" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Связаться с Хостом
      </motion.a>
    </div>
  )
}
