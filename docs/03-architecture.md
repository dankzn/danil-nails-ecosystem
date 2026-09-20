# Architecture

## Целевая структура

```text
apps/
  web/              # сайт, CRM, клиентский кабинет, Telegram Mini App UI
  api/              # backend API
  telegram-bot/     # Telegram bot
  whatsapp-webhook/ # WhatsApp webhook worker/API adapter
packages/
  db/               # Prisma schema, migrations, seed
  shared/           # общие типы, схемы, утилиты
  ui/               # общие UI-компоненты
```

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

### Web

Web должен покрывать CRM, кабинет клиента и публичную запись.

### Telegram

Telegram Mini App открывает web-интерфейс внутри Telegram. Backend обязан проверять Telegram init data перед привязкой пользователя.

### WhatsApp

WhatsApp идет через Cloud API. Вне 24-часового окна свободные сообщения запрещены, поэтому подтверждения и напоминания должны быть оформлены как approved templates.
