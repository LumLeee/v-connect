import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet, apiPost } from '../api/client.js'
import { AuthContext } from './context.js'

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const generation = useRef(0)
  const acceptUser = useCallback((value) => {
    generation.current += 1
    setUser(value); setError(null); setLoading(false)
  }, [])
  const refresh = useCallback(async () => {
    const current = ++generation.current
    setLoading(true)
    try {
      const data = await apiGet('/auth/me/', { notifyUnauthorized: false })
      if (current === generation.current) { setUser(data.user); setError(null) }
    } catch (failure) {
      if (current === generation.current) {
        setUser(null); setError(failure.status === 401 ? null : failure)
      }
    } finally {
      if (current === generation.current) setLoading(false)
    }
  }, [])
  useEffect(() => {
    refresh()
    const expired = () => acceptUser(null)
    window.addEventListener('auth:expired', expired)
    window.addEventListener('focus', refresh)
    return () => {
      generation.current += 1
      window.removeEventListener('auth:expired', expired)
      window.removeEventListener('focus', refresh)
    }
  }, [refresh, acceptUser])
  const signOut = async () => { await apiPost('/auth/logout/', {}); acceptUser(null) }
  return <AuthContext.Provider value={{ user, loading, error, refresh, acceptUser, signOut }}>{children}</AuthContext.Provider>
}
