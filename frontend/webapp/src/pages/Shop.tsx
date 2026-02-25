import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTonConnectUI, useTonAddress } from '@tonconnect/ui-react'
import { useStore } from '../store/useStore'
import { ChipBalance } from '../components/ChipBalance'

export default function Shop() {
  const [tonConnectUI] = useTonConnectUI()
  const walletAddress = useTonAddress()
  const user = useStore((s) => s.user)
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit')
  const [amount, setAmount] = useState('')

  const handleDeposit = async () => {
    if (!walletAddress) {
      tonConnectUI.openModal()
      return
    }

    // In production: send Jetton transfer transaction via TON Connect
    // The TON listener on backend will detect the deposit
    alert(
      `Для пополнения отправьте ${amount || '...'} CHIP на адрес системного кошелька.\n\n` +
      'Баланс будет зачислен автоматически после подтверждения транзакции.'
    )
  }

  const handleWithdraw = async () => {
    if (!amount || Number(amount) <= 0) return
    alert('Вывод будет обработан в течение нескольких минут.')
  }

  const presets = [100, 500, 1000, 5000]

  return (
    <div className="min-h-screen pb-20 px-4 pt-6">
      <motion.h1
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="text-2xl font-bold mb-6"
      >
        💎 Магазин CHIP
      </motion.h1>

      {/* Balance */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="card-surface p-5 mb-6 text-center"
      >
        <p className="text-gray-400 text-sm mb-2">Ваш баланс</p>
        <ChipBalance amount={user?.balance ?? 0} size="lg" />
        {walletAddress && (
          <p className="text-xs text-gray-600 mt-2 truncate">
            {walletAddress}
          </p>
        )}
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('deposit')}
          className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-all ${
            tab === 'deposit' ? 'btn-gold' : 'btn-secondary'
          }`}
        >
          Пополнить
        </button>
        <button
          onClick={() => setTab('withdraw')}
          className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-all ${
            tab === 'withdraw' ? 'btn-gold' : 'btn-secondary'
          }`}
        >
          Вывести
        </button>
      </div>

      <motion.div
        key={tab}
        initial={{ x: tab === 'deposit' ? -20 : 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="card-surface p-5"
      >
        {tab === 'deposit' ? (
          <>
            <p className="text-sm text-gray-400 mb-4">
              Отправьте CHIP токены на системный кошелёк для пополнения баланса.
            </p>

            {!walletAddress && (
              <button
                onClick={() => tonConnectUI.openModal()}
                className="w-full btn-gold py-3 mb-4"
              >
                Подключить кошелёк
              </button>
            )}

            <div className="grid grid-cols-2 gap-2 mb-4">
              {presets.map((p) => (
                <button
                  key={p}
                  onClick={() => setAmount(String(p))}
                  className={`py-3 rounded-xl text-sm font-bold transition-all ${
                    amount === String(p)
                      ? 'bg-poker-gold/20 border-2 border-poker-gold text-poker-gold'
                      : 'bg-poker-darker border border-poker-border text-gray-400'
                  }`}
                >
                  {p.toLocaleString()} CHIP
                </button>
              ))}
            </div>

            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Или введите сумму..."
              className="w-full bg-poker-darker border border-poker-border rounded-xl px-4 py-3 text-white placeholder-gray-600 mb-4 focus:border-poker-gold/50 outline-none"
            />

            <button onClick={handleDeposit} className="w-full btn-gold py-3">
              Пополнить {amount ? `${amount} CHIP` : ''}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-400 mb-4">
              Выведите CHIP токены на ваш TON кошелёк.
            </p>

            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Сумма вывода..."
              className="w-full bg-poker-darker border border-poker-border rounded-xl px-4 py-3 text-white placeholder-gray-600 mb-4 focus:border-poker-gold/50 outline-none"
            />

            <button onClick={handleWithdraw} className="w-full btn-gold py-3">
              Вывести {amount ? `${amount} CHIP` : ''}
            </button>
          </>
        )}
      </motion.div>
    </div>
  )
}
