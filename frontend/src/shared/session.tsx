import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError } from './api/client'
import { login as loginRequest, loginGoogle as loginGoogleRequest, logout as logoutRequest, me as meRequest, register as registerRequest } from './api/endpoints'
import type { SessionUser } from './api/types'

type SessionValue = {
  user: SessionUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<SessionUser>
  loginGoogle: (credential: string) => Promise<SessionUser>
  register: (input: { name: string; email: string; password: string }) => Promise<SessionUser>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setUser(await meRequest())
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        setUser(null)
        return
      }
      setUser(null)
    }
  }, [])

  useEffect(() => {
    let active = true
    meRequest()
      .then((value) => active && setUser(value))
      .catch(() => active && setUser(null))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const value = await loginRequest({ email, password })
    setUser(value)
    return value
  }, [])

  const loginGoogle = useCallback(async (credential: string) => {
    const value = await loginGoogleRequest(credential)
    setUser(value)
    return value
  }, [])

  const register = useCallback(async (input: { name: string; email: string; password: string }) => {
    return registerRequest(input)
  }, [])

  const logout = useCallback(async () => {
    try {
      await logoutRequest()
    } finally {
      setUser(null)
    }
  }, [])

  const value = useMemo<SessionValue>(
    () => ({ user, loading, login, loginGoogle, register, logout, refresh }),
    [user, loading, login, loginGoogle, register, logout, refresh],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) throw new Error('useSession must be used inside SessionProvider')
  return context
}
