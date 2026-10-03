import { useEffect, useState, useCallback } from 'react'
import { apiGet } from '../api/client.js'

export default function useSkillCatalog() {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ data: [], loading: true, error: null })
  useEffect(() => {
    const controller = new AbortController()
    setState({ data: [], loading: true, error: null })
    async function read() {
      const skills = []
      let page = 1
      while (!controller.signal.aborted) {
        const result = await apiGet(`/skills/?page_size=100&page=${page}`, { signal: controller.signal })
        skills.push(...result.results)
        if (!result.next) break
        page++
      }
      if (!controller.signal.aborted) setState({ data: skills, loading: false, error: null })
    }
    read().catch(error => { if (!controller.signal.aborted) setState({ data: [], loading: false, error }) })
    return () => controller.abort()
  }, [attempt])
  const retry = useCallback(() => setAttempt(value => value + 1), [])
  return { ...state, retry }
}
