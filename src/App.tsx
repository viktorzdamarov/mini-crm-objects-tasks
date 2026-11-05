import { type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { Layout } from './components/Layout'
import { Loading } from './components/Loading'
import { isSupabaseConfigured } from './lib/config'
import { LoginPage } from './pages/LoginPage'
import { ObjectsPage } from './pages/ObjectsPage'
import { ObjectDetailPage } from './pages/ObjectDetailPage'
import { TaskDetailPage } from './pages/TaskDetailPage'
import { MyTasksPage } from './pages/MyTasksPage'

function ConfigScreen() {
  return (
    <div className="mx-auto max-w-lg p-8 text-slate-700">
      <h1 className="text-xl font-semibold text-slate-900">Нет настроек Supabase</h1>
      <p className="mt-3 text-sm">
        Скопируйте <code className="rounded bg-slate-100 px-1">.env.example</code> в{' '}
        <code className="rounded bg-slate-100 px-1">.env</code> и пропишите URL и ключ Supabase.
      </p>
    </div>
  )
}

function Protected({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth()
  if (loading) return <Loading />
  if (!session) return <Navigate to="/login" replace />
  if (!profile) {
    return (
      <p className="p-8 text-center text-sm text-red-600">
        Профиль не найден — скорее всего, не применена миграция или нет строки в profiles.
      </p>
    )
  }
  return <>{children}</>
}

export default function App() {
  if (!isSupabaseConfigured) {
    return <ConfigScreen />
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<ObjectsPage />} />
        <Route path="objects/:objectId" element={<ObjectDetailPage />} />
        <Route path="tasks/:taskId" element={<TaskDetailPage />} />
        <Route path="my-tasks" element={<MyTasksPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
