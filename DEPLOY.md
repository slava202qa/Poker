# Деплой Royal Roll на VPS

## Требования к серверу

- Ubuntu 22.04 LTS (минимум 2 CPU, 2 GB RAM, 20 GB SSD)
- Домен, направленный A-записью на IP сервера
- Открытые порты: 22 (SSH), 80 (HTTP), 443 (HTTPS)

---

## Шаг 1 — Подготовка сервера

```bash
# Подключиться к серверу
ssh root@YOUR_SERVER_IP

# Обновить систему
apt update && apt upgrade -y

# Установить Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker && systemctl start docker

# Установить Docker Compose plugin
apt install -y docker-compose-plugin

# Проверить
docker --version
docker compose version
```

---

## Шаг 2 — Загрузить проект

```bash
# Установить git
apt install -y git

# Клонировать репозиторий
git clone https://github.com/slava202qa/Poker.git /opt/poker
cd /opt/poker
```

---

## Шаг 3 — Настроить переменные окружения

```bash
cp .env.example .env
nano .env
```

Заполнить все значения:

```env
# Telegram — получить у @BotFather
BOT_TOKEN=1234567890:AAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Ваш домен (без слеша в конце)
WEBAPP_URL=https://your-domain.com

# База данных (оставить как есть для Docker)
DATABASE_URL=postgresql+asyncpg://poker:poker@db:5432/poker
REDIS_URL=redis://redis:6379/0

# TON — получить на toncenter.com
TON_API_URL=https://toncenter.com/api/v2
TON_API_KEY=ваш_ключ_toncenter
JETTON_MASTER_ADDRESS=EQ...адрес_контракта_CHIP
SYSTEM_WALLET_ADDRESS=UQ...ваш_кошелёк_для_приёма
TON_MNEMONICS=слово1 слово2 слово3 ... (24 слова)

# Безопасность — сгенерировать случайную строку
SECRET_KEY=$(openssl rand -hex 32)

# Настройки игры
RAKE_PERCENT=3
DEBUG=false

# Ваш Telegram ID (для доступа к /admin)
ADMIN_IDS=ваш_telegram_id
```

---

## Шаг 4 — Настроить домен в nginx

Отредактировать `docker/nginx-ssl.conf` — заменить `royal-roll.space` на ваш домен:

```bash
sed -i 's/royal-roll.space/your-domain.com/g' docker/nginx-ssl.conf
```

---

## Шаг 5 — Получить SSL-сертификат (Let's Encrypt)

```bash
# Установить certbot
apt install -y certbot

# Временно остановить nginx если запущен
# Получить сертификат
certbot certonly --standalone -d your-domain.com -d www.your-domain.com \
  --email your@email.com --agree-tos --non-interactive

# Сертификаты будут в /etc/letsencrypt/live/your-domain.com/
```

Смонтировать сертификаты в docker-compose.yml (уже настроено через volume `certs`):

```bash
# Скопировать сертификаты в volume
docker volume create poker_certs
docker run --rm -v /etc/letsencrypt:/src -v poker_certs:/dst alpine \
  cp -r /src/. /dst/
```

---

## Шаг 6 — Запустить проект

```bash
cd /opt/poker

# Собрать и запустить все сервисы
docker compose up --build -d

# Проверить статус
docker compose ps

# Посмотреть логи
docker compose logs -f backend
docker compose logs -f bot
```

---

## Шаг 7 — Применить миграции базы данных

```bash
# Войти в контейнер backend
docker compose exec backend bash

# Применить миграции
cd /app
alembic upgrade head

# Выйти
exit
```

---

## Шаг 8 — Привязать бота к Telegram

### 8.1 Установить WebApp URL через @BotFather

1. Открыть Telegram → @BotFather
2. Написать `/mybots` → выбрать вашего бота
3. `Bot Settings` → `Menu Button` → `Configure menu button`
4. Ввести URL: `https://your-domain.com`
5. Ввести текст кнопки: `Играть`

### 8.2 Установить команды бота

Написать @BotFather:
```
/setcommands
```
Выбрать бота, вставить:
```
start - Открыть игру
help - Помощь
balance - Мой баланс
buy - Купить фишки
sell - Вывести фишки
profile - Мой профиль
rates - Курсы обмена
```

### 8.3 Проверить работу

1. Открыть бота в Telegram
2. Нажать `/start` — должна появиться кнопка "Играть"
3. Нажать кнопку — откроется Web App

---

## Шаг 9 — Автообновление SSL (cron)

```bash
# Добавить задачу обновления сертификата
crontab -e

# Добавить строку:
0 3 * * * certbot renew --quiet && docker compose -f /opt/poker/docker-compose.yml restart frontend
```

---

## Управление сервисами

```bash
cd /opt/poker

# Остановить всё
docker compose down

# Перезапустить один сервис
docker compose restart backend
docker compose restart bot

# Обновить код и пересобрать
git pull
docker compose up --build -d

# Посмотреть логи в реальном времени
docker compose logs -f

# Войти в контейнер для отладки
docker compose exec backend bash
docker compose exec db psql -U poker -d poker
```

---

## Структура проекта

```
/opt/poker/
├── backend/          FastAPI + SQLAlchemy
│   ├── app/
│   │   ├── api/      REST endpoints
│   │   ├── game/     Texas Hold'em engine
│   │   ├── models/   DB models
│   │   └── ton/      TON blockchain integration
│   └── alembic/      DB migrations
├── frontend/webapp/  React + Vite + Tailwind
├── bot/              aiogram 3 Telegram bot
├── docker/           Dockerfiles + nginx config
├── docker-compose.yml
└── .env              ← НЕ коммитить в git!
```

---

## Переменные окружения — полный список

| Переменная | Описание | Где взять |
|---|---|---|
| `BOT_TOKEN` | Токен Telegram бота | @BotFather → /newbot |
| `WEBAPP_URL` | URL вашего домена с https:// | Ваш домен |
| `DATABASE_URL` | Строка подключения к PostgreSQL | Оставить дефолт |
| `REDIS_URL` | Строка подключения к Redis | Оставить дефолт |
| `TON_API_KEY` | Ключ TonCenter API | toncenter.com |
| `JETTON_MASTER_ADDRESS` | Адрес смарт-контракта CHIP | Ваш контракт |
| `SYSTEM_WALLET_ADDRESS` | Кошелёк для приёма платежей | Ваш TON кошелёк |
| `TON_MNEMONICS` | 24 слова seed-фразы кошелька | Ваш TON кошелёк |
| `SECRET_KEY` | Случайная строка для JWT | `openssl rand -hex 32` |
| `RAKE_PERCENT` | Процент рейка (рекомендуется 3) | 3 |
| `ADMIN_IDS` | Telegram ID администраторов | Ваш ID из @userinfobot |

---

## Проверка работоспособности

```bash
# Health check backend
curl https://your-domain.com/api/health
# Ожидаемый ответ: {"status":"ok"}

# Проверить WebSocket (wscat нужно установить: npm i -g wscat)
wscat -c "wss://your-domain.com/ws/table/1?initData=test"
# Ожидаемый ответ: {"code":4001} (Unauthorized — значит WS работает)
```

---

## Частые проблемы

**Backend не стартует:**
```bash
docker compose logs backend
# Обычно: неверный DATABASE_URL или не запустилась БД
```

**Бот не отвечает:**
```bash
docker compose logs bot
# Обычно: неверный BOT_TOKEN
```

**SSL не работает:**
```bash
# Проверить что сертификаты на месте
ls /etc/letsencrypt/live/your-domain.com/
# Должны быть: fullchain.pem, privkey.pem
```

**Web App не открывается в Telegram:**
- Убедиться что WEBAPP_URL в .env совпадает с URL в BotFather
- URL должен быть HTTPS (не HTTP)
- Домен должен быть доступен извне
