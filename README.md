# Poker Platform — Telegram Mini App + TON

Texas Hold'em poker platform as a Telegram Mini App with CHIP (Jetton) token on TON blockchain.

## Architecture

```
/backend    — FastAPI + SQLAlchemy async + PostgreSQL + Redis
/frontend   — React + Vite + TypeScript + Tailwind CSS
/bot        — aiogram 3 Telegram bot
/docker     — Dockerfiles + nginx config
```

## Quick Start

### 1. Configure environment

```bash
cp .env.example .env
# Edit .env with your values:
# - BOT_TOKEN (Telegram bot token)
# - WEBAPP_URL (your domain)
# - TON keys (optional for dev)
```

### 2. Run with Docker Compose

```bash
docker-compose up --build
```

Services:
- **Frontend**: http://localhost (nginx)
- **Backend API**: http://localhost:8000
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

### 3. Development (without Docker)

Backend:
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Frontend:
```bash
cd frontend/webapp
npm install
npm run dev
```

Bot:
```bash
cd bot
pip install -r requirements.txt
python poker_bot.py
```

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11, FastAPI, SQLAlchemy async, PostgreSQL, Redis |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Framer Motion |
| Bot | aiogram 3 |
| Blockchain | TON, Jetton CHIP, TON Connect 2.0 |
| Deploy | Docker Compose, nginx |

## Features

- Telegram WebApp authentication (initData validation)
- TON Connect wallet linking
- CHIP token deposits/withdrawals (Jetton)
- Texas Hold'em with full game cycle (preflop → showdown)
- Side pots, all-in support
- 3% rake to system account
- Tournament system (registration, prize pools)
- Real-time game via WebSocket
- Dark premium UI with animations

## Hosting

Designed for deployment on a VPS with domain from NIC.UA.
Configure SSL via Let's Encrypt and point your domain to the server.

```bash
# Example nginx + certbot setup
sudo certbot --nginx -d your-domain.com.ua
```

Set `WEBAPP_URL=https://your-domain.com.ua` in `.env` and configure the bot's WebApp URL via @BotFather.