# FinPlan

Сервис персонального финансового планирования: cash-flow, чистые активы, цели с инфляцией, сценарии «что-если» и Monte Carlo.

## Архитектура (монолит, модульная)

```
src/
  modules/
    auth/          — регистрация
    plan/          — детерминированный cash-flow
    simulation/    — Monte Carlo + очередь jobs
    scenarios/     — шаблоны (базовый, кризис, …)
    reports/       — PDF
  shared/          — db, auth, session
  app/api/         — HTTP API (тонкий слой)
  app/dashboard/   — UI
```

Каждая сущность в БД привязана к `userId` — изменения одного профиля не видны другим.

## Стек

- **Next.js 16** (App Router) — монолит UI + API
- **Upstash Redis** — хранение данных
- **NextAuth** — credentials auth
- **Recharts** — графики
- **jsPDF** — отчёты

## Быстрый старт

1. Создайте базу в [Upstash Redis](https://console.upstash.com/redis/) и скопируйте REST URL и token.

2. Настройте `.env` (см. `.env.example`):

```env
UPSTASH_REDIS_REST_URL="https://your-instance.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-token-here"
AUTH_SECRET="..."   # openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"
```

3. Запуск:

```bash
npm install
npm run dev
```

4. (Опционально) отдельный worker для очереди Monte Carlo:

```bash
npm run worker
```

В MVP расчёт также запускается асинхронно из API после постановки job.

## MVP-функции

- Регистрация / вход
- Активы, доходы, расходы, цели, обязательства
- 3+ предустановленных сценария
- Детерминированный прогноз + Monte Carlo (1k–10k)
- Дашборд, timeline, PDF, CSV import
- Admin API: `/api/admin/jobs` (роль `ADMIN`)

## Регуляторное предупреждение

В UI и PDF: *«Результаты носят информационный характер и не являются индивидуальной инвестиционной рекомендацией.»*

## Редактор IF/ELSE

Вкладка **Сценарии** в дашборде:

- Визуальные карточки правил: **IF** (условие) → **THEN** → **ELSE**
- Вложенные цепочки: действие «↳ Вложенный IF/ELSE»
- Шаблоны: кризис, потеря работы, продажа актива, рыночный шок
- Проверка: неликвидная недвижимость при быстрой продаже → предупреждение
- Сохранение в `Scenario.rules`, применение при пересчёте плана и Monte Carlo

API: `PATCH /api/scenarios/[id]`, `POST /api/scenarios/[id]/validate-rules`

## Дальнейшее развитие

- Shared read-only планы для консультанта
- Исторический bootstrap доходностей
- Redis/BullMQ для production workers
