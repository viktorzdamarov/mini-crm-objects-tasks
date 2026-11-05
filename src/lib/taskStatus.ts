import type { TaskStatus, UserRole } from '../types/database'

export const STATUS_LABELS: Record<TaskStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  on_review: 'На проверке',
  accepted: 'Принята',
  revision: 'На доработке',
}

export type TaskAction = {
  label: string
  nextStatus: TaskStatus
  needsComment?: boolean
  variant?: 'default' | 'secondary' | 'destructive'
}

export function availableActions(
  status: TaskStatus,
  role: UserRole,
  isAssignee: boolean,
): TaskAction[] {
  if (role === 'executor' && isAssignee) {
    if (status === 'new') {
      return [{ label: 'Взять в работу', nextStatus: 'in_progress' }]
    }
    if (status === 'in_progress') {
      return [{ label: 'Отправить на проверку', nextStatus: 'on_review' }]
    }
    if (status === 'revision') {
      return [{ label: 'Вернуть в работу', nextStatus: 'in_progress' }]
    }
  }

  if (role === 'assigner' && status === 'on_review') {
    return [
      { label: 'Принять', nextStatus: 'accepted' },
      {
        label: 'На доработку',
        nextStatus: 'revision',
        needsComment: true,
        variant: 'destructive',
      },
    ]
  }

  return []
}
