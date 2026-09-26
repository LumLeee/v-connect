import { useCallback, useEffect, useState } from 'react'
import { apiGet } from '../api/client.js'

export default function useApi(path) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ path, attempt, data: null, loading: true, error: null })
  useEffect(() => {
    const controller = new AbortController()
    setState({ path, attempt, data: null, loading: true, error: null })
    apiGet(path, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setState({ path, attempt, data, loading: false, error: null }) })
      .catch((error) => { if (!controller.signal.aborted) setState({ path, attempt, data: null, loading: false, error }) })
    return () => controller.abort()
  }, [path, attempt])
  const retry = useCallback(() => setAttempt((value) => value + 1), [])
  // A changed URL/retry must not briefly expose the preceding response before the effect runs.
  const current = state.path === path && state.attempt === attempt ? state : { data: null, loading: true, error: null }
  return { ...current, retry }
}
