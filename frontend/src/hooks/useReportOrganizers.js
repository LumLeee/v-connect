import { useCallback, useEffect, useState } from 'react'
import { apiGet } from '../api/client.js'

export default function useReportOrganizers(enabled) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ data: [], loading: enabled, error: null })
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    setState({ data: [], loading: true, error: null })
    async function read() {
      const data = []
      for (let page = 1; !controller.signal.aborted; page++) {
        const result = await apiGet(`/reports/organizers/?page_size=100&page=${page}`, { signal: controller.signal })
        data.push(...result.results)
        if (!result.next) break
      }
      if (!controller.signal.aborted) setState({ data, loading: false, error: null })
    }
    read().catch(error => { if (!controller.signal.aborted) setState({ data: [], loading: false, error }) })
    return () => controller.abort()
  }, [enabled, attempt])
  const retry = useCallback(() => setAttempt(value => value + 1), [])
  return { ...state, retry }
}
