import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import { Loading } from '../components/Loading'
import { StatusBadge } from '../components/StatusBadge'
import { ErrorText } from '../components/ErrorText'
import { getErrorMessage } from '../lib/errors'
import { supabase } from '../lib/supabase'
import type { TaskStatus } from '../types/database'

export function MyTasksPage() {
  const { session, profile } = useAuth()

  const tasksQuery = useQuery({
    queryKey: ['my-tasks', session?.user.id],
    enabled: profile?.role === 'executor' && !!session?.user.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, status, objects(name)')
        .eq('assignee_id', session!.user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Array<{
        id: string
        title: string
        status: TaskStatus
        objects: { name: string } | null
      }>
    },
  })

  if (profile?.role !== 'executor') {
    return <p className="text-slate-600">Раздел только для исполнителей.</p>
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Мои задачи</h1>
        <p className="text-sm text-slate-600">Задачи, где вы исполнитель.</p>
      </div>
      {tasksQuery.isLoading && <Loading />}
      {tasksQuery.isError && <ErrorText>{getErrorMessage(tasksQuery.error)}</ErrorText>}
      <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {(tasksQuery.data ?? []).map((task) => (
          <li key={task.id}>
            <Link
              to={`/tasks/${task.id}`}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50"
            >
              <div>
                <div className="font-medium">{task.title}</div>
                <div className="text-sm text-slate-600">{task.objects?.name ?? 'Объект'}</div>
              </div>
              <StatusBadge status={task.status} />
            </Link>
          </li>
        ))}
        {tasksQuery.data?.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-slate-500">Назначенных задач нет</li>
        )}
      </ul>
    </div>
  )
}
