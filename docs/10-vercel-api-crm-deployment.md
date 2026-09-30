# Перенос CRM + API с Render на Vercel

Цель: убрать холодный старт/засыпание бесплатного Render-плана. База данных
уже на Supabase (не на Render) — переносить данные никуда не нужно, меняется
только то, где крутится код CRM и API.

Очередей уведомлений (Redis/BullMQ) в коде пока нет — они только в
списке стека на будущее (`AGENTS.md`), поэтому сейчас ничего не мешает
перенести API на Vercel serverless-функции. Если очереди появятся
позже, для них нужен будет отдельный процесс (Vercel Cron + внешняя
очередь, либо снова что-то вроде Render) — сама CRM/API это не заденет.

Это два отдельных Vercel-проекта из одного репозитория (как уже сделано для
`apps/site`): `apps/api` (Fastify как serverless-функция) и `apps/web` (CRM,
статическая сборка). Они больше не на одном origin — работает cross-origin,
по той же схеме, что уже используется между сайтом и API.

## 1. Проект API (`apps/api`)

- Repository: тот же GitHub-репозиторий, branch `main`.
- Root Directory: `apps/api`.
- Framework Preset: Other.
- Build Command: `pnpm install --frozen-lockfile && pnpm --filter @danil-nails/db build && pnpm --filter @danil-nails/shared build`
  (Prisma Client нужно сгенерировать — сама Vercel-функция собирается
  автоматически из `api/index.ts` через `vercel.json`).
- Output Directory: оставить пустым (не применимо для serverless-функций).

### Environment Variables (API проект)

| Key | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | тот же Supabase pooler URL, что сейчас в Render |
| `APP_PUBLIC_URL` | фактический HTTPS URL этого Vercel-проекта (например `https://danil-nails-api.vercel.app`) |
| `CRM_PUBLIC_URL` | фактический HTTPS URL проекта CRM (см. ниже) — без него CORS отклонит запросы из CRM |
| `SITE_PUBLIC_URL` | фактический HTTPS URL `apps/site` на Vercel (уже используется) |
| `SESSION_COOKIE_NAME` | `danil_nails_session` |
| `SESSION_TTL_DAYS` | `30` |

После деплоя проверить: `https://<api-домен>/health` → `{"ok":true,...}`,
`https://<api-домен>/ready` → `{"ok":true,"database":"connected"}`.

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

## 3. Финальное переключение

Пока это не сделано, старый Render-сервис можно не трогать — он продолжит
работать как есть, а Vercel-версии будут жить параллельно на своих `*.vercel.app`
адресах для проверки.

Когда обе Vercel-версии проверены и работают:

1. Проверить, что `NEXT_PUBLIC_API_URL` у проекта `apps/site` указывает на
   новый API-домен на Vercel (см. `docs/08-vercel-site-deployment.md`) —
   сайт должен обращаться к тому же API, что и CRM.
2. Дать пользователям новый адрес CRM (или подключить кастомный домен в
   Vercel на оба проекта — тогда адрес не меняется для пользователей).
3. Остановить/удалить Render-сервис `danil-nails-crm`.
4. Убрать `render.yaml` из репозитория (или оставить как задокументированную
   историю — на работу ничего не влияет, раз сервис остановлен).

## Ограничения этого варианта

- **Загрузка фото сотрудника**: сейчас лимит `@fastify/multipart` — 5 МБ на
  файл. У serverless-функций Vercel есть свой лимит на размер тела запроса
  (обычно хватает с запасом на Hobby/Pro для фото, но при переносе стоит
  один раз проверить реальной загрузкой).
- **Rate limiting** (`@fastify/rate-limit`) хранит счётчики в памяти процесса.
  На serverless это означает: у каждого "холодного" экземпляра функции —
  свой счётчик, а не общий на все запросы. Ограничение продолжает работать,
  но менее строго, чем на одном постоянном процессе Render. Для текущего
  масштаба (закрытый тест) это не критично.
- Если/когда понадобятся очереди уведомлений (Redis/BullMQ по плану в
  `AGENTS.md`) — для них нужен будет процесс, который живёт постоянно
  (воркер), Vercel serverless для этого не подходит; решать отдельно в тот
  момент (например Vercel Cron + внешняя очередь типа Upstash/QStash,
  либо один лёгкий постоянный воркер на другом хостинге).
