import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from './AuthProvider'

export function AuthQueryReset() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const prevUserId = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    const userId = session?.user.id ?? null
    if (prevUserId.current === undefined) {
      prevUserId.current = userId
      return
    }
    if (prevUserId.current !== userId) {
      qc.clear()
      prevUserId.current = userId
    }
  }, [session?.user.id, qc])

  return null
}
