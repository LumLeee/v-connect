import { useCallback, useEffect, useState } from 'react'
import { apiGet } from '../api/client.js'

export default function useApi(path) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ data: null, loading: true, error: null })
  useEffect(() => {
    const controller = new AbortController()
    setState({ data: null, loading: true, error: null })
    apiGet(path, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setState({ data, loading: false, error: null }) })
      .catch((error) => { if (!controller.signal.aborted) setState({ data: null, loading: false, error }) })
    return () => controller.abort()
  }, [path, attempt])
  const retry = useCallback(() => setAttempt((value) => value + 1), [])
  return { ...state, retry }
}
