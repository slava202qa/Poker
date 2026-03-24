#!/bin/bash
# Royal Roll — автоматическая установка на Ubuntu 22.04 VPS
# Использование: bash setup_vps.sh your-domain.com your@email.com

set -e

DOMAIN=${1:?"Укажите домен: bash setup_vps.sh your-domain.com your@email.com"}
EMAIL=${2:?"Укажите email: bash setup_vps.sh your-domain.com your@email.com"}
PROJECT_DIR="/opt/poker"

echo "=== Royal Roll Setup ==="
echo "Домен: $DOMAIN"
echo "Email: $EMAIL"
echo "Директория: $PROJECT_DIR"
echo ""

# ── 1. Системные зависимости ──────────────────────────────────────────────────
echo "[1/7] Установка зависимостей..."
apt-get update -qq
apt-get install -y -qq git curl certbot

# Docker
if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

# Docker Compose plugin
if ! docker compose version &>/dev/null; then
    apt-get install -y -qq docker-compose-plugin
fi

echo "    Docker $(docker --version)"
echo "    Docker Compose $(docker compose version --short)"

# ── 2. Клонировать / обновить репозиторий ─────────────────────────────────────
echo "[2/7] Загрузка проекта..."
if [ -d "$PROJECT_DIR/.git" ]; then
    git -C "$PROJECT_DIR" pull --ff-only
else
    git clone https://github.com/slava202qa/Poker.git "$PROJECT_DIR"
fi
cd "$PROJECT_DIR"

# ── 3. Настроить домен в nginx ────────────────────────────────────────────────
echo "[3/7] Настройка nginx для домена $DOMAIN..."
sed -i "s/royal-roll\.space/$DOMAIN/g" docker/nginx-ssl.conf
sed -i "s/royal-roll\.space/$DOMAIN/g" docker/nginx.conf 2>/dev/null || true

# ── 4. Создать .env если не существует ───────────────────────────────────────
echo "[4/7] Настройка .env..."
if [ ! -f .env ]; then
    cp .env.example .env
    SECRET_KEY=$(openssl rand -hex 32)
    sed -i "s|https://your-domain.com.ua|https://$DOMAIN|g" .env
    sed -i "s|change-me-to-random-string|$SECRET_KEY|g" .env
    echo ""
    echo "    ⚠️  Файл .env создан. Заполните обязательные поля:"
    echo "       BOT_TOKEN, TON_API_KEY, SYSTEM_WALLET_ADDRESS, TON_MNEMONICS, ADMIN_IDS"
    echo "    Редактировать: nano $PROJECT_DIR/.env"
    echo ""
    read -p "    Нажмите Enter после заполнения .env..." _
fi

# ── 5. SSL сертификат ─────────────────────────────────────────────────────────
echo "[5/7] Получение SSL сертификата..."
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    # Временно запустить standalone certbot (порт 80 должен быть свободен)
    certbot certonly --standalone \
        -d "$DOMAIN" -d "www.$DOMAIN" \
        --email "$EMAIL" \
        --agree-tos \
        --non-interactive \
        --preferred-challenges http
    echo "    Сертификат получен"
else
    echo "    Сертификат уже существует, пропускаем"
fi

# Скопировать сертификаты в Docker volume
docker volume create poker_certs 2>/dev/null || true
docker run --rm \
    -v /etc/letsencrypt:/src:ro \
    -v poker_certs:/dst \
    alpine sh -c "cp -r /src/. /dst/"

# ── 6. Запустить сервисы ──────────────────────────────────────────────────────
echo "[6/7] Запуск Docker Compose..."
docker compose up --build -d

# Ждём пока backend поднимется
echo "    Ожидание запуска backend..."
for i in $(seq 1 30); do
    if docker compose exec -T backend curl -sf http://localhost:8000/health &>/dev/null; then
        echo "    Backend готов"
        break
    fi
    sleep 2
done

# ── 7. Применить миграции ─────────────────────────────────────────────────────
echo "[7/7] Применение миграций базы данных..."
docker compose exec -T backend alembic upgrade head
echo "    Миграции применены"

# ── Настройка автообновления SSL ──────────────────────────────────────────────
CRON_JOB="0 3 * * * certbot renew --quiet && docker compose -f $PROJECT_DIR/docker-compose.yml restart frontend"
(crontab -l 2>/dev/null | grep -v "certbot renew"; echo "$CRON_JOB") | crontab -
echo "    Автообновление SSL настроено (cron 3:00)"

# ── Итог ──────────────────────────────────────────────────────────────────────
echo ""
echo "=== Установка завершена ==="
echo ""
echo "  Сайт:    https://$DOMAIN"
echo "  API:     https://$DOMAIN/api/health"
echo "  Статус:  docker compose -f $PROJECT_DIR/docker-compose.yml ps"
echo "  Логи:    docker compose -f $PROJECT_DIR/docker-compose.yml logs -f"
echo ""
echo "  Следующий шаг — привязать бота:"
echo "  1. @BotFather → /mybots → ваш бот"
echo "  2. Bot Settings → Menu Button → https://$DOMAIN"
echo ""
