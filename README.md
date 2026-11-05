# Объекты и задачи

React + TypeScript + Supabase.

## Запуск

1. Создать проект на [supabase.com](https://supabase.com).
2. В **Authentication** отключить регистрацию, оставить вход по email.
3. **SQL Editor** — выполнить `supabase/migrations/20260305120000_init.sql`.
4. **API Keys** — URL и publishable key в `.env` (см. `.env.example`). Для `npm run setup:demo` нужен secret key, в репозиторий не коммитить.

```bash
npm install
cp .env.example .env
npm run setup:demo
npm run dev
```

`setup:demo` создаёт трёх пользователей и заливает тестовые объекты/задачи:

| | email | пароль |
|---|--------|--------|
| постановщик | assigner@demo.local | DemoPass123 |
| исполнитель | executor1@demo.local | DemoPass123 |
| исполнитель | executor2@demo.local | DemoPass123 |

Через Docker: `npx supabase start`, в `.env` взять URL и ключи из `npx supabase status`, затем те же команды.

Демо: https://viktorzdamarov.github.io/mini-crm-objects-tasks/
