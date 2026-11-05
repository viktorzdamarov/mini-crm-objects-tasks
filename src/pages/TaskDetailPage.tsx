import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { ErrorText } from '../components/ErrorText'
import { Loading } from '../components/Loading'
import { StatusBadge } from '../components/StatusBadge'
import { formatDateTime } from '../lib/format'
import { getErrorMessage } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { STATUS_LABELS, availableActions } from '../lib/taskStatus'
import type { TaskStatus } from '../types/database'

const editSchema = z.object({
  title: z.string().trim().min(1, 'Укажите название'),
  description: z.string(),
  assignee_id: z.string().uuid(),
})

type EditValues = z.infer<typeof editSchema>

export function TaskDetailPage() {
  const { taskId } = useParams()
  const navigate = useNavigate()
  const { profile, session } = useAuth()
  const qc = useQueryClient()
  const [comment, setComment] = useState('')
  const [editing, setEditing] = useState(false)

  const editForm = useForm<EditValues>({
    resolver: zodResolver(editSchema),
  })

  const taskQuery = useQuery({
    queryKey: ['task', taskId, session?.user.id],
    enabled: !!taskId && !!session?.user.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('tasks').select('*').eq('id', taskId!).single()
      if (error) throw error
      return data
    },
  })

  const historyQuery = useQuery({
    queryKey: ['task-history', taskId, session?.user.id],
    enabled: !!taskId && !!session?.user.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_status_history')
        .select('id, from_status, to_status, comment, changed_at, changed_by')
        .eq('task_id', taskId!)
        .order('changed_at', { ascending: true })
      if (error) throw error
      return data
    },
  })

  const profilesQuery = useQuery({
    queryKey: ['profiles-map', session?.user.id],
    enabled: !!session?.user.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
      if (error) throw error
      return data
    },
  })

  const transition = useMutation({
    mutationFn: async ({
      nextStatus,
      actionComment,
    }: {
      nextStatus: TaskStatus
      actionComment?: string
    }) => {
      const { error } = await supabase.rpc('transition_task_status', {
        p_task_id: taskId!,
        p_new_status: nextStatus,
        p_comment: actionComment ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setComment('')
      void qc.invalidateQueries({ queryKey: ['task', taskId] })
      void qc.invalidateQueries({ queryKey: ['task-history', taskId] })
      void qc.invalidateQueries({ queryKey: ['tasks'] })
      void qc.invalidateQueries({ queryKey: ['my-tasks'] })
      void qc.invalidateQueries({ queryKey: ['objects'] })
    },
  })

  const deleteTask = useMutation({
    mutationFn: async () => {
      const objectId = taskQuery.data?.object_id
      const { error } = await supabase.from('tasks').delete().eq('id', taskId!)
      if (error) throw error
      return objectId
    },
    onSuccess: (objectId) => {
      if (objectId) navigate(`/objects/${objectId}`)
      else navigate('/')
    },
  })

  const saveEdit = useMutation({
    mutationFn: async (values: EditValues) => {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: values.title.trim(),
          description: values.description.trim(),
          assignee_id: values.assignee_id,
        })
        .eq('id', taskId!)
      if (error) throw error
    },
    onSuccess: () => {
      setEditing(false)
      void qc.invalidateQueries({ queryKey: ['task', taskId] })
      void qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  if (taskQuery.isLoading) return <Loading />
  if (taskQuery.isError || !taskQuery.data || !profile) {
    return <ErrorText>Задача недоступна</ErrorText>
  }

  const task = taskQuery.data
  const isAssignee = task.assignee_id === session?.user.id
  const actions = availableActions(task.status, profile.role, isAssignee)
  const profileName = (id: string) => {
    const row = profilesQuery.data?.find((p) => p.id === id)
    return row?.full_name || row?.email || '—'
  }
  const executors = (profilesQuery.data ?? []).filter((p) => p.role === 'executor')

  function startEdit() {
    editForm.reset({
      title: task.title,
      description: task.description,
      assignee_id: task.assignee_id,
    })
    setEditing(true)
  }

  function onAction(nextStatus: TaskStatus, needsComment?: boolean) {
    if (needsComment && !comment.trim()) return
    transition.mutate({
      nextStatus,
      actionComment: needsComment ? comment.trim() : undefined,
    })
  }

  return (
    <div className="space-y-6">
      <Link to={`/objects/${task.object_id}`} className="text-sm text-slate-600 hover:underline">
        ← К объекту
      </Link>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">{task.title}</h1>
            <StatusBadge status={task.status} />
          </div>
          {profile.role === 'assigner' && !editing && (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={startEdit}>
                Редактировать
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600"
                onClick={() => {
                  if (confirm('Удалить задачу?')) deleteTask.mutate()
                }}
              >
                Удалить
              </Button>
            </div>
          )}
        </div>

        {editing ? (
          <form
            className="mt-4 space-y-3"
            onSubmit={editForm.handleSubmit((values) => saveEdit.mutate(values))}
          >
            <Input {...editForm.register('title')} />
            <Textarea rows={4} {...editForm.register('description')} />
            <select
              className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              {...editForm.register('assignee_id')}
            >
              {executors.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.full_name || ex.email}
                </option>
              ))}
            </select>
            {saveEdit.isError && <ErrorText>{getErrorMessage(saveEdit.error)}</ErrorText>}
            <div className="flex gap-2">
              <Button type="submit">Сохранить</Button>
              <Button variant="secondary" onClick={() => setEditing(false)}>
                Отмена
              </Button>
            </div>
          </form>
        ) : (
          <p className="mt-4 whitespace-pre-wrap text-slate-700">{task.description || '—'}</p>
        )}

        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Исполнитель</dt>
            <dd>{profileName(task.assignee_id)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Автор</dt>
            <dd>{profileName(task.author_id)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Создана</dt>
            <dd>{formatDateTime(task.created_at)}</dd>
          </div>
        </dl>
      </Card>

      {actions.length > 0 && (
        <Card>
          <h2 className="font-medium">Действия</h2>
          <div className="mt-3 space-y-3">
            {actions.some((a) => a.needsComment) && (
              <Textarea
                placeholder="Комментарий (обязателен для возврата на доработку)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
              />
            )}
            <div className="flex flex-wrap gap-2">
              {actions.map((action) => (
                <Button
                  key={action.nextStatus}
                  disabled={
                    transition.isPending || (action.needsComment && !comment.trim())
                  }
                  variant={action.variant ?? 'default'}
                  onClick={() => onAction(action.nextStatus, action.needsComment)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
            {transition.isError && <ErrorText>{getErrorMessage(transition.error)}</ErrorText>}
          </div>
        </Card>
      )}

      <section>
        <h2 className="mb-3 font-medium">История статусов</h2>
        <ol className="space-y-2">
          {(historyQuery.data ?? []).map((row) => (
            <li key={row.id} className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm">
              <div className="text-slate-600">
                {formatDateTime(row.changed_at)} · {profileName(row.changed_by)}
              </div>
              <div>
                {row.from_status ? STATUS_LABELS[row.from_status] : '—'} →{' '}
                {STATUS_LABELS[row.to_status]}
              </div>
              {row.comment && <p className="mt-1 text-slate-700">Комментарий: {row.comment}</p>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
