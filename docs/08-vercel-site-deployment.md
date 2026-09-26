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

Не требуются — сайт полностью статический (`output: "export"`), не обращается
ни к API, ни к базе данных.

## Структура сайта

- `app/[lang]/...` — статический i18n-роутинг Next.js (без middleware, что
  обязательно при `output: "export"`): `ru`, `en`, `es`, `fr` через
  `generateStaticParams`.
- `app/page.tsx` — редирект с `/` на `/ru/` (дефолтная локаль).
- Страницы: главная, `/[lang]/services`, `/[lang]/gallery`, `/[lang]/master`,
  `/[lang]/contact`.

## Проверка после deploy

1. `/ru/`, `/en/`, `/es/`, `/fr/` открываются и показывают переведённый контент.
2. `/` редиректит на `/ru/`.
3. Переключатель языка в шапке сохраняет текущую страницу при смене локали.
4. На мобильной ширине анимации и hero не перекрывают контент.

## Ограничения текущей версии

- Кнопка записи ведёт на страницу контактов с честной пометкой "скоро" —
  реальная онлайн-запись появится после запуска Telegram-бота.
- Галерея использует цветовые заглушки вместо реальных фото работ.
- URL-слаги страниц (`services`, `gallery`, `master`, `contact`) одинаковы во
  всех языковых версиях — переводятся только заголовки и контент, не сами
  адреса.
