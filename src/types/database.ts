export type UserRole = 'assigner' | 'executor'

export type TaskStatus =
  | 'new'
  | 'in_progress'
  | 'on_review'
  | 'accepted'
  | 'revision'

export type Profile = {
  id: string
  email: string
  full_name: string
  role: UserRole
  created_at: string
}

export type SiteObject = {
  id: string
  name: string
  address: string
  created_by: string
  created_at: string
}

export type Task = {
  id: string
  object_id: string
  title: string
  description: string
  assignee_id: string
  author_id: string
  status: TaskStatus
  created_at: string
}

export type TaskStatusHistory = {
  id: string
  task_id: string
  from_status: TaskStatus | null
  to_status: TaskStatus
  changed_by: string
  comment: string | null
  changed_at: string
}

type Fk = {
  foreignKeyName: string
  columns: string[]
  isOneToOne: boolean
  referencedRelation: string
  referencedColumns: string[]
}

type Table<TRow, TInsert, TUpdate, TRel extends Fk[] = []> = {
  Row: TRow
  Insert: TInsert
  Update: TUpdate
  Relationships: TRel
}

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        Profile,
        {
          id: string
          email: string
          full_name?: string
          role: UserRole
          created_at?: string
        },
        Partial<Omit<Profile, 'id'>>
      >
      objects: Table<
        SiteObject,
        {
          id?: string
          name: string
          address?: string
          created_by: string
          created_at?: string
        },
        Partial<Omit<SiteObject, 'id'>>,
        [
          {
            foreignKeyName: 'objects_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      >
      tasks: Table<
        Task,
        {
          id?: string
          object_id: string
          title: string
          description?: string
          assignee_id: string
          author_id: string
          status?: TaskStatus
          created_at?: string
        },
        Partial<Omit<Task, 'id'>>,
        [
          {
            foreignKeyName: 'tasks_object_id_fkey'
            columns: ['object_id']
            isOneToOne: false
            referencedRelation: 'objects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tasks_assignee_id_fkey'
            columns: ['assignee_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tasks_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      >
      task_status_history: Table<
        TaskStatusHistory,
        {
          id?: string
          task_id: string
          from_status?: TaskStatus | null
          to_status: TaskStatus
          changed_by: string
          comment?: string | null
          changed_at?: string
        },
        Partial<Omit<TaskStatusHistory, 'id'>>,
        [
          {
            foreignKeyName: 'task_status_history_task_id_fkey'
            columns: ['task_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'task_status_history_changed_by_fkey'
            columns: ['changed_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      >
    }
    Views: Record<string, never>
    Functions: {
      transition_task_status: {
        Args: {
          p_task_id: string
          p_new_status: TaskStatus
          p_comment?: string | null
        }
        Returns: Task
      }
      seed_demo: {
        Args: Record<string, never>
        Returns: string
      }
      current_user_role: {
        Args: Record<string, never>
        Returns: UserRole
      }
    }
    Enums: {
      user_role: UserRole
      task_status: TaskStatus
    }
  }
}
