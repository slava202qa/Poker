# PokerVault Smart Contract

TON FunC контракт для Royal Roll. Принимает взносы, удерживает 10% комиссии платформы, распределяет призы победителям турниров.

## Файлы

- `poker_vault.fc` — исходный код контракта (FunC)

## Op-коды

| Op   | Hex  | Кто вызывает | Описание |
|------|------|--------------|----------|
| deposit | 0x01 | Игрок | Пополнение баланса. Бэкенд зачисляет RR после подтверждения |
| tournament_entry | 0x02 | Игрок | Взнос за турнир. Средства заморожены до финала |
| finalize_tourney | 0x03 | Владелец | Финал турнира: 10% комиссия → платформа, остаток → победители |
| player_withdraw | 0x04 | Владелец | Выплата игроку по запросу вывода |
| owner_withdraw | 0xFF | Владелец | Вывод накопленных комиссий на кошелёк владельца |

## Деплой

### 1. Установить инструменты

```bash
# Установить func компилятор
npm install -g @ton-community/func-js

# Или через toncli
pip install toncli
```

### 2. Скомпилировать

```bash
cd contracts/
func -o poker_vault.fif -SPA poker_vault.fc
fift -s poker_vault.fif
```

### 3. Задеплоить через toncli

```bash
toncli deploy --net mainnet
```

Или через [TON Blueprint](https://github.com/ton-org/blueprint):

```bash
npx blueprint build
npx blueprint deploy
```

### 4. Записать адрес контракта в .env

```env
CONTRACT_ADDRESS=EQA...ваш_адрес_контракта
OWNER_MNEMONIC=word1 word2 ... word24
```

## Начальное состояние (init data)

При деплое передать в storage:
- `owner_address` — адрес кошелька владельца (UQ...)
- `platform_balance` = 0
- `last_tournament_id` = 0

## Безопасность

- Только `owner_address` может вызывать `finalize_tourney`, `player_withdraw`, `owner_withdraw`
- Контракт всегда держит минимум 0.05 TON для оплаты газа
- Все выплаты идут напрямую на кошельки — без промежуточного хранения
