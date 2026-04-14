import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useTelegram } from '../hooks/useTelegram'
import { useStore } from '../store/useStore'

// Bot username for deposit/exchange requests
const MANAGER_USERNAME = 'POKER_VIP_1_Bot'
// Your personal Telegram for support — players will write directly to you
const SUPPORT_USERNAME = 'slava202qa'

function tgLink(text: string) {
  return `https://t.me/${MANAGER_USERNAME}?start=${encodeURIComponent(text)}`
}

const FAQ_ITEMS = [
  {
    q: 'Что такое Royal Roll (RR)?',
    a: 'RR — это внутриигровые баллы (виртуальные активы), используемые исключительно внутри мини-приложения Royal Roll для участия в игровых механиках, кастомизации профиля и открытия новых уровней.',
  },
  {
    q: 'Имеют ли RR реальную стоимость?',
    a: 'Нет. Внутриигровые активы RR не являются денежными средствами, ценными бумагами или криптовалютой. Они не имеют реальной рыночной стоимости за пределами приложения и предназначены только для развлекательных целей.',
  },
  {
    q: 'Безопасность и прозрачность',
    a: 'Все операции по приобретению пакетов активов проходят через защищённые протоколы. Мы используем систему клубного членства, где каждый участник добровольно приобретает игровые очки для использования внутри сообщества.',
  },
  {
    q: 'Политика возврата',
    a: 'Согласно правилам цифрового контента, приобретённые игровые активы обмену и возврату не подлежат. В случае возникновения технических сбоев при начислении, пожалуйста, обратитесь в Поддержку (VIP Service).',
  },
  {
    q: 'Ответственная игра',
    a: 'Мы поддерживаем принципы честной и ответственной игры. Мини-приложение создано для развлечения. Пожалуйста, контролируйте своё время и ресурсы, затрачиваемые на игру.',
  },
]

export default function Service() {
  const { user: tgUser } = useTelegram()
  const user = useStore((s) => s.user)
  const navigate = useNavigate()
  const uid = user?.telegram_id ?? tgUser?.id ?? ''

  const actions = [
    {
      icon: '💳',
      title: 'Приобрести Активы (RR)',
      desc: 'Пополнить баланс через TON кошелёк',
      onClick: () => navigate('/deposit?tab=buy'),
      gold: true,
    },
    {
      icon: '🔄',
      title: 'Обменять Награды',
      desc: 'Вывести RR на TON кошелёк',
      onClick: () => navigate('/deposit?tab=exchange'),
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
          <motion.button
            key={a.title}
            onClick={a.onClick}
            initial={{ x: -12, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.07 }}
            className="w-full flex items-center gap-4 p-5 rounded-2xl transition-all active:scale-[0.98]"
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
            <div className="flex-1 min-w-0 text-left">
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
          </motion.button>
        ))}
      </div>

      <div className="divider-gold mb-6" />

      {/* FAQ section */}
      <p className="section-title mb-3">Информация / FAQ</p>
      <div className="space-y-2 mb-6">
        {FAQ_ITEMS.map((item, i) => (
          <motion.details
            key={i}
            initial={{ x: -8, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1 + i * 0.04 }}
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

      {/* Support button — opens direct chat */}
      <motion.a
        href={`https://t.me/${SUPPORT_USERNAME}`}
        target="_blank"
        rel="noreferrer"
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm transition-all active:scale-[0.98]"
        style={{
          background: 'rgba(212,168,67,0.08)',
          border: '1px solid rgba(212,168,67,0.25)',
          color: '#d4a843',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
            stroke="#d4a843" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Поддержка (VIP Service)
      </motion.a>
    </div>
  )
}
