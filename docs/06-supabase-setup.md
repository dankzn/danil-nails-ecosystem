# Supabase setup

Эта инструкция выполняется один раз для тестового окружения Danil Nails Studio.

## 1. Создать проект

1. Открыть [Supabase Dashboard](https://supabase.com/dashboard).
2. Создать организацию, если ее еще нет.
3. Нажать **New project**.
4. Название проекта: `danil-nails-staging`.
5. Сгенерировать надежный пароль базы и сохранить его в менеджере паролей.
6. Выбрать ближайший доступный регион к основной аудитории.
7. Оставить бесплатный тариф для закрытого теста.

Пароли, токены и connection string нельзя отправлять в чат или сохранять в GitHub.

## 2. Создать пользователя Prisma

В Supabase открыть **SQL Editor**, создать новый запрос и выполнить его. Вместо
`PRISMA_PASSWORD` использовать отдельный надежный пароль из менеджера паролей.

```sql
create user "prisma" with password 'PRISMA_PASSWORD' bypassrls createdb;
grant "prisma" to "postgres";

grant usage on schema public to prisma;
grant create on schema public to prisma;
grant all on all tables in schema public to prisma;
grant all on all routines in schema public to prisma;
grant all on all sequences in schema public to prisma;

alter default privileges for role postgres in schema public
grant all on tables to prisma;
alter default privileges for role postgres in schema public
grant all on routines to prisma;
alter default privileges for role postgres in schema public
grant all on sequences to prisma;
```

Этот пользователь используется только сервером и миграциями. Его строка
подключения никогда не передается в браузер.

## 3. Получить connection string

1. В проекте Supabase нажать **Connect**.
2. Выбрать **Session pooler** с портом `5432`.
3. Скопировать PostgreSQL connection string.
4. Заменить пользователя на `prisma` и пароль на пароль из предыдущего шага.

Ожидаемый формат:

```text
postgresql://prisma.PROJECT_REF:PRISMA_PASSWORD@REGION.pooler.supabase.com:5432/postgres
```

Если пароль содержит специальные символы, они должны быть URL-encoded. Самый
простой вариант для staging: длинный случайный пароль из букв и цифр.

## 4. Подготовить локальный `.env`

В корне репозитория выполнить:

```bash
cp .env.example .env
```

Затем открыть `.env` и заполнить только локальными значениями:

```dotenv
DATABASE_URL=connection-string-из-Supabase
SEED_OWNER_EMAIL=твой-email
SEED_OWNER_PASSWORD=надежный-пароль-не-короче-12-символов
SEED_OWNER_NAME=Данил Афлиатов
```

Файл `.env` уже исключен из Git и не должен добавляться в коммиты.

## 5. Создать таблицы и owner

После заполнения `.env` выполнить из корня репозитория:

```bash
pnpm db:deploy
pnpm db:seed
```

Первая команда применит SQL-миграцию. Вторая создаст или обновит:

- owner с email и паролем из `.env`;
- профиль мастера Данил;
- статусы лояльности;
- три услуги;
- цены RUB, EUR и USD.

Seed можно запускать повторно: он обновляет стартовые данные и не создает дубли.

## 6. Запустить систему

```bash
pnpm dev
```

- CRM: [http://localhost:3000](http://localhost:3000)
- API health: [http://localhost:4000/health](http://localhost:4000/health)
- Проверка базы: [http://localhost:4000/ready](http://localhost:4000/ready)

После успешной настройки `/ready` вернет `database: connected`, а CRM покажет
экран входа владельца.

## 7. Storage bucket для фото сотрудников

Нужен для загрузки фото в CRM (карточка сотрудника → фото профиля), которое
показывается и в CRM, и на публичном сайте.

1. В Supabase открыть **Storage** → **New bucket**.
2. Название: `staff-photos` (совпадает с `SUPABASE_STAFF_PHOTOS_BUCKET`).
3. Включить **Public bucket** — фото сотрудников публичные по своей природе
   (показываются на сайте всем посетителям), приватным этот бакет быть не
   должен.
4. В **Project Settings → API** скопировать `service_role` ключ (не `anon`!)
   в `SUPABASE_SERVICE_ROLE_KEY`. Он даёт полный доступ к проекту — хранить
   только на сервере (Render), никогда не передавать в браузер и не
   отправлять в чат.
5. `SUPABASE_URL` — это `https://PROJECT_REF.supabase.co` (тот же `PROJECT_REF`,
   что и в connection string базы).

Без этих трёх переменных загрузка фото в CRM отвечает понятной ошибкой
`storage_not_configured` вместо падения — остальной функционал не затронут.

## Ограничения бесплатного окружения

- Это staging для разработки и закрытого теста, а не финальная production-база.
- Перед публичным запуском настраиваются автоматические резервные копии.
- Доступ к Supabase должен быть защищен двухфакторной аутентификацией.
- Фото клиентов загружаются только после настройки приватного Storage bucket и
  правил доступа.
