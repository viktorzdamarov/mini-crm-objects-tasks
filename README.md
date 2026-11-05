# Объекты и задачи

Тестовое для 2B Studio: React + TypeScript + Supabase.

Постановщик заводит объекты и задачи, исполнитель видит только своё. Статусы и права — в Postgres (RLS, функция `transition_task_status`).

## Запуск

1. Проект на [supabase.com](https://supabase.com), в Auth выключить sign-up, включить вход по email.
2. SQL Editor → файл `supabase/migrations/20260305120000_init.sql` целиком.
3. Settings → API Keys: URL и publishable key в `.env` (см. `.env.example`). Secret key — только для скрипта демо, в git не класть.

```bash
npm install
cp .env.example .env
npm run setup:demo
npm run dev
```

Демо-логины создаёт `npm run setup:demo`:

| | email | пароль |
|---|--------|--------|
| постановщик | assigner@demo.local | DemoPass123 |
| исполнитель | executor1@demo.local | DemoPass123 |
| исполнитель | executor2@demo.local | DemoPass123 |

Локально с Docker: `npx supabase start`, в `.env` URL/ключи из `npx supabase status`, дальше как выше.

## Демо онлайн

https://viktorzdamarov.github.io/mini-crm-objects-tasks/

Сборка под GitHub Pages (из корня репо):

```powershell
$env:VITE_BASE='/mini-crm-objects-tasks/'
npm run build
Copy-Item dist/index.html dist/404.html -Force
npx gh-pages -d dist -t
```

На Vercel/Netlify — `npm run build`, каталог `dist`, в env только `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`, без `VITE_BASE`.

## Файлы

- `src/pages` — экраны
- `supabase/migrations` — схема и RLS
- `scripts/setup-demo.mjs` — пользователи + `seed_demo()`
