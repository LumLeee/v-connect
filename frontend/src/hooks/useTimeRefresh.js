import { useEffect, useReducer } from 'react'

export default function useTimeRefresh() {
  const [, refresh] = useReducer(value => value + 1, 0)

  useEffect(() => {
    function refreshVisible() {
      if (!document.hidden) refresh()
    }
    const timer = setInterval(refreshVisible, 60000)
    window.addEventListener('focus', refreshVisible)
    document.addEventListener('visibilitychange', refreshVisible)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', refreshVisible)
      document.removeEventListener('visibilitychange', refreshVisible)
    }
  }, [])
}
