# Vercel Site Deployment

Публичный маркетинговый сайт (`apps/site`) разворачивается на Vercel отдельно от
CRM. CRM (`apps/api` + `apps/web`) остаётся на Render — см.
`docs/07-render-deployment.md`. Это два независимых deployment с разными
адресами: `render.yaml` описывает только CRM и никак не влияет на сайт.

## Настройки Vercel Project

- Repository: тот же GitHub-репозиторий, branch `main`.
- Root Directory: `apps/site`.
- Framework Preset: Next.js.
- Build/Output/Install Command: дефолтные значения Next.js preset (toggle
  переопределений выключен). Vercel сам корректно собирает `output: "export"`
  из `next.config.mjs` и подключает `pnpm-workspace.yaml` в корне монорепо для
  зависимости `@danil-nails/shared`.

Важно: если Output Directory переопределить вручную на `out`, сборка падает с
ошибкой `routes-manifest.json couldn't be found` — при Framework Preset =
Next.js Vercel обрабатывает статический экспорт сам и ручное указание Output
Directory конфликтует с его внутренней логикой.

## Environment Variables

| Key | Value |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | фактический HTTPS URL API на Render (см. `docs/07-render-deployment.md`), без завершающего `/` |

Обязательна для формы регистрации (`/[lang]/register`), входа
(`/[lang]/login`) и личного кабинета (`/[lang]/account`) — без неё `apiUrl`
(`app/lib/api-url.ts`) падает на дефолт `https://danil-nails-crm.onrender.com`,
который может не совпадать с реальным адресом сервиса. `NEXT_PUBLIC_*`
переменные вшиваются в статическую сборку во время `build`, а не читаются в
рантайме — после смены значения нужен redeploy на Vercel, простого сохранения
переменной недостаточно.

На стороне API (Render) также нужно выставить `SITE_PUBLIC_URL` = адрес этого
Vercel-деплоя — иначе CORS отклонит запрос с сайта. См.
`docs/07-render-deployment.md`.

## Структура сайта

- `app/[lang]/...` — статический i18n-роутинг Next.js (без middleware, что
  обязательно при `output: "export"`): `ru`, `en`, `es`, `fr` через
  `generateStaticParams`.
- `app/page.tsx` — редирект с `/` на `/ru/` (дефолтная локаль).
- Страницы: главная (hero — видео-карусель, автопрокрутка), `/[lang]/services`,
  `/[lang]/gallery`, `/[lang]/master`, `/[lang]/contact`, `/[lang]/register`
  (реальная регистрация аккаунта через API), `/[lang]/login` (вход по email +
  паролю), `/[lang]/account` (личный кабинет: имя, email, телефон, выход).
- Шапка сайта (`SiteHeader.tsx`) проверяет статус авторизации через
  `GET /v1/auth/me` при загрузке и показывает "Войти" или "Личный кабинет"
  вместо статичной кнопки регистрации.

## Проверка после deploy

1. `/ru/`, `/en/`, `/es/`, `/fr/` открываются и показывают переведённый контент.
2. `/` редиректит на `/ru/`.
3. Переключатель языка в шапке сохраняет текущую страницу при смене локали.
4. На мобильной ширине анимации и hero не перекрывают контент.

## Ограничения текущей версии

- Кнопка записи ведёт на страницу контактов с честной пометкой "скоро" —
  реальная онлайн-запись появится после запуска Telegram-бота.
- Регистрация (`/[lang]/register`), вход (`/[lang]/login`) и личный кабинет
  (`/[lang]/account`) реальны и работают через API. В кабинете пока только
  профиль (имя, email, телефон) и честная заглушка "здесь появится список
  записей" — сам список записей подключится следующим шагом.
- Галерея использует цветовые заглушки вместо реальных фото работ; второе
  видео в hero-карусели — стоковое, не съёмка студии.
- URL-слаги страниц (`services`, `gallery`, `master`, `contact`, `register`)
  одинаковы во всех языковых версиях — переводятся только заголовки и
  контент, не сами адреса.
