import type { TaskStatus } from '../types/database'
import { STATUS_LABELS } from '../lib/taskStatus'
import { cn } from '../lib/cn'

const colors: Record<TaskStatus, string> = {
  new: 'bg-slate-200 text-slate-800',
  in_progress: 'bg-blue-100 text-blue-900',
  on_review: 'bg-amber-100 text-amber-900',
  accepted: 'bg-green-100 text-green-900',
  revision: 'bg-red-100 text-red-900',
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
        colors[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
