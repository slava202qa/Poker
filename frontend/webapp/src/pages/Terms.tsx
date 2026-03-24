import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function Terms() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen pb-24 px-4 pt-6">
      <motion.div initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <button onClick={() => navigate(-1)} className="text-gray-400 text-sm mb-4 block">← Назад</button>
        <h1 className="text-xl font-extrabold mb-4">Условия использования</h1>
        <div className="card-surface p-5 space-y-4 text-sm text-gray-300 leading-relaxed">
          <p>Данное приложение является развлекательной игрой. Все игровые фишки (Royal Roll / RR) являются виртуальными и не имеют реальной денежной стоимости. Они не подлежат обмену на реальные деньги.</p>
          <p>Приложение предназначено исключительно для развлечения. Никакие реальные денежные ставки не принимаются и не выплачиваются.</p>
          <p>Используя приложение, вы подтверждаете, что вам исполнилось 18 лет, и соглашаетесь с настоящими условиями.</p>
          <p>Администрация оставляет за собой право изменять правила, баланс и условия в любое время без предварительного уведомления.</p>
        </div>
      </motion.div>
    </div>
  )
}
