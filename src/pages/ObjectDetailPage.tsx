import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { ErrorText } from '../components/ErrorText'
import { Loading } from '../components/Loading'
import { StatusBadge } from '../components/StatusBadge'
import { getErrorMessage } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { objectSchema, taskSchema, type ObjectValues, type TaskValues } from '../schemas'

export function ObjectDetailPage() {
  const { objectId } = useParams()
  const navigate = useNavigate()
  const { profile, session } = useAuth()
  const qc = useQueryClient()
  const isAssigner = profile?.role === 'assigner'
  const [editing, setEditing] = useState(false)

  const objectForm = useForm<ObjectValues>({
    resolver: zodResolver(objectSchema),
  })
  const taskForm = useForm<TaskValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: { title: '', description: '', assignee_id: '' },
  })

  const objectQuery = useQuery({
    queryKey: ['object', objectId, session?.user.id],
    enabled: !!objectId && !!session?.user.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('objects').select('*').eq('id', objectId!).single()
      if (error) throw error
      return data
    },
  })

  const tasksQuery = useQuery({
    queryKey: ['tasks', objectId, session?.user.id],
    enabled: !!objectId && !!session?.user.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('object_id', objectId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const executorsQuery = useQuery({
    queryKey: ['executors'],
    enabled: isAssigner,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'executor')
        .order('full_name')
      if (error) throw error
      return data
    },
  })

  const createTask = useMutation({
    mutationFn: async (values: TaskValues) => {
      const { error } = await supabase.from('tasks').insert({
        object_id: objectId!,
        title: values.title.trim(),
        description: values.description.trim(),
        assignee_id: values.assignee_id,
        author_id: session!.user.id,
        status: 'new',
      })
      if (error) throw error
    },
    onSuccess: () => {
      taskForm.reset()
      void qc.invalidateQueries({ queryKey: ['tasks', objectId] })
      void qc.invalidateQueries({ queryKey: ['objects'] })
    },
  })

  const saveObject = useMutation({
    mutationFn: async (values: ObjectValues) => {
      const { error } = await supabase
        .from('objects')
        .update({ name: values.name.trim(), address: values.address.trim() })
        .eq('id', objectId!)
      if (error) throw error
    },
    onSuccess: () => {
      setEditing(false)
      void qc.invalidateQueries({ queryKey: ['object', objectId] })
      void qc.invalidateQueries({ queryKey: ['objects'] })
    },
  })

  const deleteObject = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('objects').delete().eq('id', objectId!)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['objects'] })
      navigate('/')
    },
  })

  if (objectQuery.isLoading) return <Loading />
  if (objectQuery.isError || !objectQuery.data) {
    return <ErrorText>Объект не найден или нет доступа</ErrorText>
  }

  const obj = objectQuery.data

  function startEdit() {
    objectForm.reset({ name: obj.name, address: obj.address })
    setEditing(true)
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-sm text-slate-600 hover:underline">
          ← К списку объектов
        </Link>
        {!editing ? (
          <>
            <h1 className="mt-2 text-2xl font-semibold">{obj.name}</h1>
            <p className="text-slate-600">{obj.address || 'Адрес не указан'}</p>
            {isAssigner && (
              <div className="mt-2 flex gap-2">
                <Button variant="secondary" size="sm" onClick={startEdit}>
                  Редактировать
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600"
                  onClick={() => {
                    if (confirm('Удалить объект и все его задачи?')) deleteObject.mutate()
                  }}
                >
                  Удалить объект
                </Button>
              </div>
            )}
          </>
        ) : (
          <form
            className="mt-3 max-w-lg space-y-3"
            onSubmit={objectForm.handleSubmit((values) => saveObject.mutate(values))}
          >
            <Input {...objectForm.register('name')} />
            <Input {...objectForm.register('address')} />
            {saveObject.isError && <ErrorText>{getErrorMessage(saveObject.error)}</ErrorText>}
            <div className="flex gap-2">
              <Button type="submit">Сохранить</Button>
              <Button variant="secondary" onClick={() => setEditing(false)}>
                Отмена
              </Button>
            </div>
          </form>
        )}
      </div>

      {isAssigner && (
        <Card>
          <h2 className="font-medium">Новая задача</h2>
          <form
            className="mt-3 space-y-3"
            onSubmit={taskForm.handleSubmit((values) => createTask.mutate(values))}
          >
            <div className="space-y-1">
              <Label htmlFor="title">Название</Label>
              <Input id="title" {...taskForm.register('title')} />
              {taskForm.formState.errors.title && (
                <ErrorText>{taskForm.formState.errors.title.message ?? ''}</ErrorText>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="description">Описание</Label>
              <Textarea id="description" rows={3} {...taskForm.register('description')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="assignee">Исполнитель</Label>
              <select
                id="assignee"
                className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                {...taskForm.register('assignee_id')}
              >
                <option value="">Выберите исполнителя</option>
                {(executorsQuery.data ?? []).map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.full_name || ex.email}
                  </option>
                ))}
              </select>
              {taskForm.formState.errors.assignee_id && (
                <ErrorText>{taskForm.formState.errors.assignee_id.message ?? ''}</ErrorText>
              )}
            </div>
            {createTask.isError && <ErrorText>{getErrorMessage(createTask.error)}</ErrorText>}
            <Button type="submit" disabled={createTask.isPending}>
              Создать задачу
            </Button>
          </form>
        </Card>
      )}

      <section>
        <h2 className="mb-3 font-medium">Задачи объекта</h2>
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {(tasksQuery.data ?? []).map((task) => (
            <li key={task.id}>
              <Link
                to={`/tasks/${task.id}`}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50"
              >
                <span>{task.title}</span>
                <StatusBadge status={task.status} />
              </Link>
            </li>
          ))}
          {tasksQuery.data?.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-slate-500">Задач пока нет</li>
          )}
        </ul>
      </section>
    </div>
  )
}
