import { Building2 } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { Button } from './ui/button'
import { cn } from '../lib/cn'

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'px-3 py-2 rounded-md text-sm font-medium',
    isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-200',
  )

export function Layout() {
  const { profile, signOut } = useAuth()

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Building2 className="h-5 w-5" />
            Объекты и задачи
          </Link>
          <nav className="flex flex-wrap items-center gap-2">
            <NavLink to="/" end className={navClass}>
              Объекты
            </NavLink>
            {profile?.role === 'executor' && (
              <NavLink to="/my-tasks" className={navClass}>
                Мои задачи
              </NavLink>
            )}
          </nav>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>
              {profile?.full_name || profile?.email}
              {profile?.role === 'assigner' ? ' · Постановщик' : ' · Исполнитель'}
            </span>
            <Button variant="secondary" size="sm" onClick={() => void signOut()}>
              Выйти
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
