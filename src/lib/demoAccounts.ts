export const DEMO_PASSWORD = 'DemoPass123'

export const DEMO_ACCOUNTS = [
  {
    roleLabel: 'Постановщик',
    email: 'assigner@demo.local',
    fullName: 'Ирина Постановщик',
    role: 'assigner' as const,
  },
  {
    roleLabel: 'Исполнитель 1',
    email: 'executor1@demo.local',
    fullName: 'Алексей Прораб',
    role: 'executor' as const,
  },
  {
    roleLabel: 'Исполнитель 2',
    email: 'executor2@demo.local',
    fullName: 'Мария Мастер',
    role: 'executor' as const,
  },
]
