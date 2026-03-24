import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

const FAQ = [
  {
    q: 'Что такое Royal Roll?',
    a: 'Royal Roll — симулятор спортивного покера. Все внутриигровые баллы являются виртуальными активами сообщества и не имеют денежного эквивалента.',
  },
  {
    q: 'Что такое Клубные Активы (RR)?',
    a: 'RR — внутренняя расчётная единица клуба. Используется для участия в играх, турнирах и обмена на клубные привилегии.',
  },
  {
    q: 'Что такое Бонусные Баллы (BR)?',
    a: 'BR начисляются за активность: ежедневный вход, выполнение квестов, участие в турнирах. Используются в Public Hall.',
  },
  {
    q: 'Как пополнить баланс?',
    a: 'Перейдите в раздел «Инвентарь» или воспользуйтесь командами бота. Поддерживаются TON и USDT.',
  },
  {
    q: 'Как вывести активы?',
    a: 'Заявки на обмен подаются через раздел «Сервис». Обработка — в течение 24 часов.',
  },
  {
    q: 'Безопасно ли приложение?',
    a: 'Авторизация выполняется через Telegram WebApp initData с HMAC-SHA256 подписью. Ваши данные не передаются третьим лицам.',
  },
]

export default function Info() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen pb-24 px-4 pt-5 relative z-10">

      {/* Header */}
      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-6"
      >
        <h1 className="text-xl font-extrabold tracking-tight">Информационный центр</h1>
        <p className="text-xs text-gray-600 mt-1">Royal Roll Club · Справка и правила</p>
      </motion.div>

      {/* Legal notice card */}
      <motion.div
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="card-ticket p-4 mb-5"
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl flex-shrink-0">♠️</span>
          <div>
            <p className="text-sm font-bold text-poker-gold mb-1">О платформе</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              Royal Roll — это симулятор спортивного покера. Все внутриигровые баллы
              являются <b className="text-white">виртуальными активами сообщества</b> и
              не являются денежными средствами, ценными бумагами или иными финансовыми
              инструментами.
            </p>
          </div>
        </div>
      </motion.div>

      {/* FAQ */}
      <p className="section-title">Часто задаваемые вопросы</p>
      <div className="space-y-2 mb-6">
        {FAQ.map((item, i) => (
          <FaqItem key={i} index={i} q={item.q} a={item.a} />
        ))}
      </div>

      {/* Contact button */}
      <motion.div
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <a
          href="https://t.me/POKER_VIP_1_Bot"
          target="_blank"
          rel="noreferrer"
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm transition-all"
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
          Связаться с Хостом
        </a>
      </motion.div>

      {/* Terms link */}
      <p className="text-center text-[10px] text-gray-700 mt-4">
        <button onClick={() => navigate('/terms')} className="underline underline-offset-2 text-gray-600">
          Условия использования
        </button>
        {' · '}
        <span>Все активы виртуальны</span>
      </p>
    </div>
  )
}

function FaqItem({ q, a, index }: { q: string; a: string; index: number }) {
  return (
    <motion.details
      initial={{ x: -10, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 0.08 + index * 0.04 }}
      className="group rounded-2xl overflow-hidden"
      style={{ background: '#1c1c1c', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <summary className="flex items-center justify-between px-4 py-3.5 cursor-pointer list-none select-none">
        <span className="text-sm font-semibold pr-4">{q}</span>
        <span className="text-poker-gold text-lg flex-shrink-0 transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="px-4 pb-3.5">
        <div className="divider-gold mb-3" />
        <p className="text-xs text-gray-400 leading-relaxed">{a}</p>
      </div>
    </motion.details>
  )
}
