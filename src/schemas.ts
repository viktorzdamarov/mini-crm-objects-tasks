import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Введите корректный email'),
  password: z.string().min(6, 'Минимум 6 символов'),
})

export const objectSchema = z.object({
  name: z.string().trim().min(1, 'Укажите название'),
  address: z.string().trim().min(1, 'Укажите адрес'),
})

export const taskSchema = z.object({
  title: z.string().trim().min(1, 'Укажите название'),
  description: z.string().trim(),
  assignee_id: z.string().uuid('Выберите исполнителя'),
})

export type LoginValues = z.infer<typeof loginSchema>
export type ObjectValues = z.infer<typeof objectSchema>
export type TaskValues = z.infer<typeof taskSchema>
