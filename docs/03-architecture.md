# Architecture

## Целевая структура

```text
apps/
  crm/              # закрытая CRM для owner, admin и master
  site/             # публичный сайт, запись, кабинет и Telegram Mini App UI
  api/              # backend API
  telegram-bot/     # Telegram bot
  whatsapp-webhook/ # WhatsApp webhook worker/API adapter
packages/
  db/               # Prisma schema, migrations, seed
  shared/           # общие типы, схемы, утилиты
  ui/               # общие UI-компоненты
```

Текущая административная реализация временно находится в `apps/web`. До начала разработки публичного сайта она выделяется в `apps/crm`, после чего клиентское приложение создаётся отдельно в `apps/site`.

## Базовый стек

- Language: TypeScript.
- Frontend: Next.js.
- Backend: NestJS или Fastify.
- Database: PostgreSQL.
- ORM: Prisma.
- Queue: Redis + BullMQ.
- Telegram: grammY или Telegraf.
- WhatsApp: Meta Cloud API.
- Local infra: Docker Compose.

## Основные домены

- Identity and access: пользователи, роли, сессии.
- Clients: контактные данные, каналы связи, согласия, публичные статусы лояльности, приватные внутренние метки, заметки.
- Services: услуги, цены, длительность, категории.
- Staff: мастера, график, услуги, исключения.
- Scheduling: слоты, записи, переносы, отмены, блокировки.
- Notifications: события, шаблоны, каналы, история доставки.
- Payments: статусы оплат, предоплаты, возвраты.
- Analytics: загрузка, выручка, повторные визиты, no-show.
- Localization: русский, английский, испанский.

## Минимальная схема данных

- users
- clients
- client_contacts
- client_loyalty_statuses
- client_private_tags
- client_private_tag_assignments
- staff_profiles
- services
- service_prices
- staff_services
- working_hours
- schedule_exceptions
- appointments
- appointment_events
- visit_notes
- visit_materials
- nail_photos
- notification_templates
- notification_jobs
- message_channels
- payments
- reviews
- consent_records

## Права доступа

- Owner/superuser видит все: CRM, аналитику, настройки, клиентов, мастеров, внутренние статусы.
- Admin видит операционную CRM, подтверждает записи, связывается с клиентами и управляет расписанием в рамках прав.
- Master видит только свои записи, карточки клиентов в объеме, необходимом для оказания услуги, и историю своих визитов.
- Client видит только свои записи, публичный статус лояльности и разрешенные данные профиля.
- Private client tags не должны попадать в клиентские API, Telegram Mini App или публичный web.

## Каналы

### CRM

CRM — отдельное закрытое приложение и отдельный deployment. Оно размещается по собственному адресу, требует авторизацию для всех рабочих экранов и не содержит публичный маркетинговый сайт. Для production предпочтителен адрес вида `crm.<domain>`; на staging допускается самостоятельная техническая ссылка хостинга.

CRM не импортирует клиентские анимации и тяжёлые медиаресурсы. Поисковая индексация административного приложения запрещается. Маршруты сотрудников, зарплаты, аналитики и приватных меток доступны только внутренним ролям и отсутствуют в публичном API-контракте.

### Client Site

Публичный сайт, клиентская запись, кабинет и Telegram Mini App UI — второе самостоятельное приложение и deployment с отдельным адресом. Оно не включает административные страницы, компоненты или данные CRM.

Публичная часть проектируется как визуально насыщенный premium experience. Её статические страницы и ассеты должны доставляться через CDN независимо от API. Анимационный слой загружается по маршрутам и не должен увеличивать основной JavaScript CRM или блокировать сценарий записи.

Целевая схема размещения:

- CRM — отдельный frontend hosting и отдельный URL;
- публичный сайт, кабинет и booking UI — отдельный CDN/edge hosting, URL и deploy preview;
- Fastify API — отдельный контейнерный web service;
- PostgreSQL — Supabase;
- фото, видео и будущие 3D-ассеты — объектное хранилище с CDN;
- каждый frontend проксирует `/api` к общему backend, чтобы cookies оставались first-party даже при полностью разных адресах CRM и клиентского сайта;
- административные и клиентские сессии имеют разные cookie names и независимый жизненный цикл.

Для анимаций используются зрелые браузерные библиотеки и нативные CSS/Web Animations API. Тяжёлые сцены подключаются лениво, имеют облегчённый мобильный режим и полностью функциональную альтернативу при `prefers-reduced-motion`.

Frontend разрабатывается mobile-first. Компоненты не должны полагаться на hover, фиксированные элементы учитывают `env(safe-area-inset-*)` и появление экранной клавиатуры, а интерактивные области соответствуют сенсорному управлению. Перед выпуском ключевые сценарии проверяются на ширинах 320, 375, 390, 768, 1024 и 1440 px, а также в Safari iOS, Chrome Android и Telegram WebView.

### Telegram

Telegram Mini App открывает web-интерфейс внутри Telegram. Backend обязан проверять Telegram init data перед привязкой пользователя.

### WhatsApp

WhatsApp идет через Cloud API. Вне 24-часового окна свободные сообщения запрещены, поэтому подтверждения и напоминания должны быть оформлены как approved templates.
