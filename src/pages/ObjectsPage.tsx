import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { ErrorText } from '../components/ErrorText'
import { Loading } from '../components/Loading'
import { StatusBadge } from '../components/StatusBadge'
import { getErrorMessage } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { objectSchema, type ObjectValues } from '../schemas'
import type { TaskStatus } from '../types/database'

type ObjectRow = {
  id: string
  name: string
  address: string
  tasks: { id: string; status: TaskStatus }[] | null
}

export function ObjectsPage() {
  const { profile, session } = useAuth()
  const qc = useQueryClient()
  const isAssigner = profile?.role === 'assigner'

  const form = useForm<ObjectValues>({
    resolver: zodResolver(objectSchema),
    defaultValues: { name: '', address: '' },
  })

  const objectsQuery = useQuery({
    queryKey: ['objects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('objects')
        .select('id, name, address, tasks(id, status)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as ObjectRow[]
    },
  })

  const createMutation = useMutation({
    mutationFn: async (values: ObjectValues) => {
      const { error } = await supabase.from('objects').insert({
        name: values.name.trim(),
        address: values.address.trim(),
        created_by: session!.user.id,
      })
      if (error) throw error
    },
    onSuccess: () => {
      form.reset()
      void qc.invalidateQueries({ queryKey: ['objects'] })
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Объекты</h1>
        <p className="text-sm text-slate-600">Объекты и задачи по ним.</p>
      </div>

      {isAssigner && (
        <Card>
          <h2 className="font-medium">Новый объект</h2>
          <form
            className="mt-3 grid gap-3 sm:grid-cols-2"
            onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
          >
            <div className="space-y-1">
              <Label htmlFor="name">Название</Label>
              <Input id="name" placeholder="ЖК «Северный»" {...form.register('name')} />
              {form.formState.errors.name && (
                <ErrorText>{form.formState.errors.name.message ?? ''}</ErrorText>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="address">Адрес</Label>
              <Input id="address" placeholder="ул. Строителей, 1" {...form.register('address')} />
              {form.formState.errors.address && (
                <ErrorText>{form.formState.errors.address.message ?? ''}</ErrorText>
              )}
            </div>
            <div className="sm:col-span-2">
              {createMutation.isError && (
                <ErrorText>{getErrorMessage(createMutation.error)}</ErrorText>
              )}
              <Button type="submit" disabled={createMutation.isPending}>
                Создать объект
              </Button>
            </div>
          </form>
        </Card>
      )}

      {objectsQuery.isLoading && <Loading />}
      {objectsQuery.isError && <ErrorText>{getErrorMessage(objectsQuery.error)}</ErrorText>}

      <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {(objectsQuery.data ?? []).map((obj) => (
          <li key={obj.id}>
            <Link
              to={`/objects/${obj.id}`}
              className="flex flex-col gap-2 px-4 py-3 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="font-medium">{obj.name}</div>
                <div className="text-sm text-slate-600">{obj.address || '—'}</div>
              </div>
              <div className="flex flex-wrap gap-1">
                {(obj.tasks ?? []).length === 0 && (
                  <span className="text-xs text-slate-500">Нет задач</span>
                )}
                {(obj.tasks ?? []).slice(0, 4).map((task) => (
                  <StatusBadge key={task.id} status={task.status} />
                ))}
              </div>
            </Link>
          </li>
        ))}
        {objectsQuery.data?.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-slate-500">
            {isAssigner
              ? 'Объектов пока нет — создайте первый.'
              : 'Нет объектов, в которых вам назначены задачи.'}
          </li>
        )}
      </ul>
    </div>
  )
}
