# FinPlan (ФИНКОН)

Сервис персонального финансового планирования: cash-flow, чистые активы, цели с инфляцией, сценарии «что-если» и Monte Carlo.

> Результаты носят информационный характер и не являются индивидуальной инвестиционной рекомендацией.

## Документация

| Документ | Для кого |
|----------|----------|
| [docs/PRODUCT.md](docs/PRODUCT.md) | Менеджер / продукт: возможности, роли, обзор API |
| [docs/DEVELOPER.md](docs/DEVELOPER.md) | Разработчик: архитектура, каталог API, env, security |

## Быстрый старт

1. Создайте базу в [Upstash Redis](https://console.upstash.com/redis/) и скопируйте REST URL и token.

2. Настройте `.env` (см. `.env.example`):

```env
UPSTASH_REDIS_REST_URL="https://your-instance.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-token-here"
AUTH_SECRET="..."   # openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"
ADMIN_LOGIN="..."
ADMIN_PASSWORD="..."
```

3. Запуск:

```bash
npm install
npm run dev
```

4. (Опционально) worker для очереди Monte Carlo:

```bash
npm run worker
```

## Стек (кратко)

Next.js 16 · React 19 · NextAuth · Upstash Redis · Zod · Recharts · jsPDF

Подробности — в [DEVELOPER.md](docs/DEVELOPER.md).
