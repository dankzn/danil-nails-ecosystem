# Vercel deployment CRM и API

CRM и API работают как два отдельных Vercel-проекта из одного репозитория.
База данных размещена в Supabase.

Очередь уведомлений (2026-10-31) сделана без Redis/BullMQ — именно потому,
что `apps/api` работает как Vercel serverless-функция без собственного
постоянного процесса. Telegram-бот работает через webhook (а не
long-polling), а отправка накопившихся `NotificationJob` запускается внешним
планировщиком, который дёргает защищённый эндпоинт
`POST /v1/internal/notifications/dispatch` — сейчас это GitHub Actions
(`.github/workflows/dispatch-notifications.yml`, каждые 5 минут; на Hobby-плане
Vercel Cron Jobs ограничен запуском раз в сутки, поэтому использовать его
напрямую нельзя). Подробности — в `docs/05-requirements.md` → «Уведомления».

Это два отдельных Vercel-проекта из одного репозитория (как уже сделано для
`apps/site`): `apps/api` (Fastify как serverless-функция) и `apps/web` (CRM,
статическая сборка). Они больше не на одном origin — работает cross-origin,
по той же схеме, что уже используется между сайтом и API.

## 1. Проект API (`apps/api`)

- Repository: тот же GitHub-репозиторий, branch `main`.
- Root Directory: `apps/api`.
- Framework Preset: Other.
- Build Command: `pnpm install --frozen-lockfile && pnpm --filter @danil-nails/shared build && pnpm --filter @danil-nails/db build`
  (Prisma Client нужно сгенерировать — сама Vercel-функция собирается
  автоматически из `api/index.ts` через `vercel.json`).
- Output Directory: оставить пустым (не применимо для serverless-функций).

### Environment Variables (API проект)

| Key | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Supabase Session pooler URL |
| `DB_POOL_MAX` | `2` для ограничения суммарного числа соединений serverless-инстансов |
| `DB_CONNECTION_TIMEOUT_MS` | `5000` |
| `API_SLOW_REQUEST_MS` | `750` |
| `APP_PUBLIC_URL` | фактический HTTPS URL этого Vercel-проекта (например `https://danil-nails-api.vercel.app`) |
| `CRM_PUBLIC_URL` | фактический HTTPS URL проекта CRM (см. ниже) — без него CORS отклонит запросы из CRM |
| `SITE_PUBLIC_URL` | фактический HTTPS URL `apps/site` на Vercel (уже используется) |
| `SESSION_COOKIE_NAME` | `danil_nails_session` |
| `SESSION_TTL_DAYS` | `30` |
| `TELEGRAM_BOT_TOKEN` | токен бота от @BotFather — без него Telegram-канал выключен |
| `TELEGRAM_WEBHOOK_SECRET` | произвольная случайная строка — Telegram возвращает её в заголовке каждого webhook-запроса, так эндпоинт проверяет, что запрос действительно от Telegram |
| `NOTIFICATIONS_DISPATCH_SECRET` | произвольная случайная строка — тот же секрет нужно положить в GitHub Actions как `NOTIFICATIONS_DISPATCH_SECRET` |
| `WHATSAPP_ACCESS_TOKEN` | пока не задавать — появится, когда будет зарегистрирован испанский номер в WhatsApp Cloud API |
| `WHATSAPP_PHONE_NUMBER_ID` | пока не задавать — см. выше |

После деплоя проверить: `https://<api-домен>/health` → `{"ok":true,...}`,
`https://<api-домен>/ready` → `{"ok":true,"database":"connected"}`.

### Включение Telegram-уведомлений (разовая настройка после первого деплоя)

1. Задать `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `APP_PUBLIC_URL`
   (реальный домен этого проекта) в переменных окружения и передеплоить.
2. Войти в CRM под владельцем и один раз вызвать
   `POST https://<api-домен>/v1/admin/telegram/webhook/register` (с
   сессионной cookie — например через `fetch` в консоли браузера на CRM-домене,
   либо через `curl` с предварительно полученной cookie). Это регистрирует
   webhook в Telegram; повторный вызов безопасен и просто перезаписывает URL.
3. В GitHub репозитория добавить секреты `NOTIFICATIONS_DISPATCH_URL`
   (`https://<api-домен>/v1/internal/notifications/dispatch`) и
   `NOTIFICATIONS_DISPATCH_SECRET` (тот же, что в переменных API) — Settings →
   Secrets and variables → Actions. Без них
   `.github/workflows/dispatch-notifications.yml` не сможет вызывать эндпоинт
   и очередь уведомлений не будет разгребаться.

## 2. Проект CRM (`apps/web`)

- Root Directory: `apps/web`.
- Framework Preset: Next.js (как у `apps/site` — Vercel сам разберётся с
  `output: "export"`, Output Directory не переопределять вручную).

### Environment Variables (CRM проект)

| Key | Value |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | фактический HTTPS URL проекта API (шаг 1), без завершающего `/` |

Это `NEXT_PUBLIC_*`-переменная — вшивается в сборку во время `build`, не
читается в рантайме. После первого деплоя API нужно узнать его настоящий
адрес и только затем задать эту переменную в CRM-проекте и передеплоить CRM
(один раз, в правильном порядке: сначала API, потом CRM).

## 3. Связь проектов

1. `NEXT_PUBLIC_API_URL` в проектах `apps/web` и `apps/site` должен указывать
   на один production-домен Vercel-проекта API.
2. `APP_PUBLIC_URL` в API должен совпадать с production-доменом самого API.
3. `CRM_PUBLIC_URL` и `SITE_PUBLIC_URL` в API должны совпадать с production-
   доменами CRM и публичного сайта. Preview-домены отдельно не разрешаются.
4. После изменения любой `NEXT_PUBLIC_*` переменной требуется redeploy
   соответствующего frontend-проекта.

Production-сборки CRM и сайта намеренно падают без `NEXT_PUBLIC_API_URL`, чтобы
не выпускать интерфейс, который обращается к неверному или устаревшему API.

## Ограничения этого варианта

- **Загрузка фото сотрудника**: сейчас лимит `@fastify/multipart` — 5 МБ на
  файл. У serverless-функций Vercel есть свой лимит на размер тела запроса
  (обычно хватает с запасом на Hobby/Pro для фото, но при переносе стоит
  один раз проверить реальной загрузкой).
- **Регион API** зафиксирован в `apps/api/vercel.json` как `lhr1`, рядом с
  Supabase в `eu-west-2`. Это сокращает сетевую задержку каждого запроса к БД.
- **Rate limiting** (`@fastify/rate-limit`) хранит счётчики в памяти процесса.
  На serverless это означает: у каждого "холодного" экземпляра функции —
  свой счётчик, а не общий на все запросы. Ограничение продолжает работать,
  но менее строго, чем в общем внешнем хранилище. Для текущего масштаба
  закрытого теста это не критично.
- Если/когда понадобятся очереди уведомлений (Redis/BullMQ по плану в
  `AGENTS.md`) — для них нужен будет процесс, который живёт постоянно
  (воркер); это нужно проектировать отдельно, например через Vercel Cron и
  внешнюю очередь типа Upstash/QStash.
