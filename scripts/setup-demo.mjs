import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

function loadEnvFile(file) {
  const path = resolve(process.cwd(), file)
  if (!existsSync(path)) return
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env')

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error(
    'Задайте в .env: VITE_SUPABASE_URL и SUPABASE_SECRET_KEY (или SUPABASE_SERVICE_ROLE_KEY)',
  )
  process.exit(1)
}

if (serviceKey.startsWith('sb_publishable_')) {
  console.error(
    'В SUPABASE_SECRET_KEY попал publishable-ключ. Нужен secret (sb_secret_...) или service_role.',
  )
  process.exit(1)
}

const DEMO_PASSWORD = 'DemoPass123'
const ACCOUNTS = [
  {
    email: 'assigner@demo.local',
    fullName: 'Ирина Постановщик',
    role: 'assigner',
  },
  {
    email: 'executor1@demo.local',
    fullName: 'Алексей Прораб',
    role: 'executor',
  },
  {
    email: 'executor2@demo.local',
    fullName: 'Мария Мастер',
    role: 'executor',
  },
]

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function ensureUser(account) {
  const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 200 })
  if (listError) throw listError
  const existing = list.users.find((u) => u.email === account.email)

  if (!existing) {
    const { data, error } = await admin.auth.admin.createUser({
      email: account.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { role: account.role, full_name: account.fullName },
    })
    if (error) throw error
    return data.user
  }

  const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { role: account.role, full_name: account.fullName },
  })
  if (error) throw error
  return data.user
}

async function ensureProfile(user, account) {
  const { error } = await admin.from('profiles').upsert({
    id: user.id,
    email: account.email,
    full_name: account.fullName,
    role: account.role,
  })
  if (error) throw error
}

async function main() {
  for (const account of ACCOUNTS) {
    const user = await ensureUser(account)
    if (!user) throw new Error(`Не создан пользователь ${account.email}`)
    await ensureProfile(user, account)
    console.log(`OK ${account.role}: ${account.email}`)
  }

  const { data, error } = await admin.rpc('seed_demo')
  if (error) {
    console.warn('RPC seed_demo недоступен, пробую SQL:', error.message)
    execSync('npx supabase db query "select public.seed_demo();"', {
      stdio: 'inherit',
      cwd: process.cwd(),
    })
  } else {
    console.log(data)
  }
  console.log(`Пароль всех демо-учёток: ${DEMO_PASSWORD}`)
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
