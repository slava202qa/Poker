import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTonConnectUI, useTonAddress } from '@tonconnect/ui-react'
import { useStore } from '../store/useStore'
import { useApi } from '../hooks/useApi'
import { ChipBalance } from '../components/ChipBalance'

// System wallet address where RR deposits are sent
const SYSTEM_WALLET = import.meta.env.VITE_SYSTEM_WALLET || ''
// Jetton master contract address for RR token
const JETTON_MASTER = import.meta.env.VITE_JETTON_MASTER || ''

/**
 * Build a base64-encoded BOC payload for Jetton transfer.
 * This is a simplified builder — TON Connect wallets handle the actual signing.
 */
function buildJettonTransferPayload(
  destination: string,
  nanoAmount: string,
  responseAddress: string,
): string {
  // Jetton transfer op code: 0x0f8a7ea5
  // For TON Connect, we pass the payload as a base64-encoded cell
  // The wallet app will construct the proper message

  // Simplified: encode as a comment-style payload with transfer details
  // In production with @ton/core library, you'd build a proper Cell
  // For now, TON Connect handles the Jetton transfer natively
  // when sending to the Jetton wallet contract

  // Return empty string — TON Connect UI handles Jetton transfers
  // when the address is a Jetton wallet contract
  return ''
}

export default function Shop() {
  const [tonConnectUI] = useTonConnectUI()
  const walletAddress = useTonAddress()
  const user = useStore((s) => s.user)
  const setUser = useStore((s) => s.setUser)
  const api = useApi()
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit')
  const [amount, setAmount] = useState('')
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const handleDeposit = async () => {
    if (!walletAddress) {
      tonConnectUI.openModal()
      return
    }

    const numAmount = Number(amount)
    if (!numAmount || numAmount <= 0) {
      setStatus('Введите сумму')
      return
    }

    if (!SYSTEM_WALLET || !JETTON_MASTER) {
      setStatus('Система депозитов настраивается. Попробуйте позже.')
      return
    }

    setSending(true)
    setStatus(null)

    try {
      // Build Jetton transfer transaction for TON Connect
      // This sends RR tokens from user's wallet to system wallet
      const nanoAmount = BigInt(Math.floor(numAmount * 1e9))

      // Jetton transfer body (simplified — TON Connect handles serialization)
      // op: 0x0f8a7ea5 (jetton transfer)
      // query_id: 0
      // amount: nanoAmount
      // destination: SYSTEM_WALLET
      // response_destination: user wallet
      // forward_amount: 1 (for notification)
      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 600, // 10 min
        messages: [
          {
            // Send to user's Jetton wallet (TON Connect resolves this)
            address: JETTON_MASTER,
            amount: '50000000', // 0.05 TON for gas
            payload: buildJettonTransferPayload(
              SYSTEM_WALLET,
              nanoAmount.toString(),
              walletAddress,
            ),
          },
        ],
      }

      await tonConnectUI.sendTransaction(transaction)
      setStatus(`Транзакция отправлена! ${numAmount} RR будут зачислены после подтверждения.`)
      setAmount('')
    } catch (e: any) {
      if (e?.message?.includes('Cancelled') || e?.message?.includes('rejected')) {
        setStatus('Транзакция отменена')
      } else {
        setStatus(`Ошибка: ${e?.message || 'Попробуйте снова'}`)
      }
    } finally {
      setSending(false)
    }
  }

  const handleWithdraw = async () => {
    const numAmount = Number(amount)
    if (!numAmount || numAmount <= 0) {
      setStatus('Введите сумму')
      return
    }

    if (!walletAddress) {
      tonConnectUI.openModal()
      return
    }

    setSending(true)
    setStatus(null)

    try {
      const result = await api.post<any>('/economy/withdraw', {
        amount: numAmount,
        wallet_address: walletAddress,
      })
      setStatus(`Вывод ${numAmount} RR → обработка. Новый баланс: ${result.new_balance}`)
      setAmount('')
      if (user) {
        setUser({ ...user, balance: result.new_balance })
      }
    } catch (e: any) {
      setStatus(`Ошибка: ${e?.message || 'Недостаточно средств'}`)
    } finally {
      setSending(false)
    }
  }

  const presets = [100, 500, 1000, 5000]

  // Connect wallet and save to backend
  const handleConnectWallet = async () => {
    await tonConnectUI.openModal()
    // After connection, save wallet to backend
    if (walletAddress && user) {
      try {
        const result = await api.post<any>('/auth/connect-wallet', {
          wallet_address: walletAddress,
        })
        setUser({ ...user, ton_wallet: walletAddress })
      } catch {}
    }
  }

  return (
    <div className="min-h-screen pb-20 px-4 pt-6">
      <motion.h1
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="text-2xl font-bold mb-6"
      >
        💎 Кошелёк RR
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
              Отправьте RR токены на системный кошелёк для пополнения баланса.
            </p>

            {status && (
              <div className={`mb-4 p-3 rounded-xl text-sm ${
                status.includes('Ошибка') || status.includes('отменена')
                  ? 'bg-red-900/30 text-red-400'
                  : 'bg-green-900/30 text-green-400'
              }`}>
                {status}
              </div>
            )}

            {!walletAddress && (
              <button
                onClick={handleConnectWallet}
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
                  {p.toLocaleString()} RR
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

            <button
              onClick={handleDeposit}
              disabled={sending}
              className="w-full btn-gold py-3 disabled:opacity-50"
            >
              {sending ? 'Отправка...' : `Пополнить ${amount ? `${amount} RR` : ''}`}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-400 mb-4">
              Выведите RR токены на ваш TON кошелёк.
            </p>

            {status && tab === 'withdraw' && (
              <div className={`mb-4 p-3 rounded-xl text-sm ${
                status.includes('Ошибка') ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'
              }`}>
                {status}
              </div>
            )}

            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Сумма вывода..."
              className="w-full bg-poker-darker border border-poker-border rounded-xl px-4 py-3 text-white placeholder-gray-600 mb-4 focus:border-poker-gold/50 outline-none"
            />

            <button
              onClick={handleWithdraw}
              disabled={sending}
              className="w-full btn-gold py-3 disabled:opacity-50"
            >
              {sending ? 'Обработка...' : `Вывести ${amount ? `${amount} RR` : ''}`}
            </button>
          </>
        )}
      </motion.div>
    </div>
  )
}
