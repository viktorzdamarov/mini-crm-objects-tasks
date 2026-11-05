import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { ErrorText } from '../components/ErrorText'
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../lib/demoAccounts'
import { loginSchema, type LoginValues } from '../schemas'

export function LoginPage() {
  const { session, signIn } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  if (session) {
    return <Navigate to="/" replace />
  }

  async function onSubmit(values: LoginValues) {
    setFormError(null)
    const { error } = await signIn(values.email.trim(), values.password)
    if (error) setFormError(error)
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md space-y-5 p-6">
        <div>
          <h1 className="text-xl font-semibold">Вход</h1>
          <p className="mt-1 text-sm text-slate-600">Демо-стенд, регистрация отключена.</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="username" {...register('email')} />
            {errors.email && <ErrorText>{errors.email.message ?? ''}</ErrorText>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Пароль</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register('password')}
            />
            {errors.password && <ErrorText>{errors.password.message ?? ''}</ErrorText>}
          </div>
          {formError && <ErrorText>{formError}</ErrorText>}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Вход…' : 'Войти'}
          </Button>
        </form>
        <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
          <p className="font-medium text-slate-800">Демо-доступы</p>
          <ul className="mt-2 space-y-1">
            {DEMO_ACCOUNTS.map((acc) => (
              <li key={acc.email}>
                <button
                  type="button"
                  className="text-left hover:underline"
                  onClick={() => {
                    setValue('email', acc.email, { shouldDirty: true, shouldValidate: true })
                    setValue('password', DEMO_PASSWORD, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }}
                >
                  {acc.roleLabel}: {acc.email}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2">Пароль: {DEMO_PASSWORD}. Клик по строке заполнит форму.</p>
        </div>
      </Card>
    </div>
  )
}
