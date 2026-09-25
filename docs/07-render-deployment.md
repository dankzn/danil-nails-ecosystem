# Render CRM Deployment

CRM разворачивается как один бесплатный Render Web Service: Fastify обслуживает API и статическую production-сборку административного Next.js-приложения с одного origin.

## Ограничение бюджета

- Workspace plan: Hobby.
- Web Service compute: Free, `$0/month`.
- Банковская карта не добавляется.
- Платные instance types и дополнительные сервисы не подключаются.
- При исчерпании бесплатного лимита сервис должен остановиться, а не создавать расходы.

## Настройки Web Service

- Name: `danil-nails-crm`.
- Language: Node.
- Branch: `main`.
- Region: Frankfurt (EU Central).
- Root Directory: пусто.
- Build Command: `pnpm install --frozen-lockfile && pnpm build`.
- Start Command: `pnpm start:deploy`.
- Health Check Path: `/ready`.
- Compute: Free, `$0/month`.

`pnpm start:deploy` сначала выполняет `pnpm db:deploy` (`prisma migrate deploy` — применяет накопленные миграции к боевой Supabase-базе) и только затем запускает API. Миграции применяются при каждом старте процесса, поэтому это работает вне зависимости от того, как настроен Web Service в Render (Blueprint из `render.yaml` или служба, заведённая вручную через дашборд, где правки `render.yaml` не действуют). Если Web Service всё же является Blueprint-сервисом, `render.yaml` дополнительно объявляет `preDeployCommand: pnpm db:deploy` — он избыточен, но не вредит (`migrate deploy` идемпотентен).

Если после пуша в `main` изменения не появляются на проде, в первую очередь проверьте в дашборде Render: (1) действительно ли триггернулся новый deploy, (2) не разошлись ли реальные Build/Start Command сервиса с `render.yaml` — при расхождении реальные значения в дашборде побеждают.

## Environment Variables

| Key | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `APP_PUBLIC_URL` | фактический HTTPS URL сервиса без завершающего `/` |
| `DATABASE_URL` | Supabase pooler URL; вводится только в Render как secret |
| `SESSION_COOKIE_NAME` | `danil_nails_crm_session` |
| `SESSION_TTL_DAYS` | `30` |

`NEXT_PUBLIC_API_URL` в production не задаётся: CRM обращается к API через тот же origin.

## Проверка после deploy

1. `/health` возвращает HTTP 200 и `database: configured`.
2. `/ready` возвращает HTTP 200 и `database: connected`.
3. `/robots.txt` запрещает индексацию всех маршрутов.
4. Страница `/login/` открывается по HTTPS.
5. После входа сессия сохраняется, а owner-only раздел `Сотрудники` доступен.
6. После выхода защищённые экраны снова перенаправляют на login.

Текущая база Supabase используется только для закрытого теста. До внесения данных реальных российских клиентов и сотрудников нужно отдельно решить вопрос локализации основной базы и файлового хранилища.
