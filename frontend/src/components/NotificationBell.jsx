import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { apiGet } from '../api/client.js'
import '../styles/notifications.css'

export default function NotificationBell() {
  const { pathname } = useLocation()
  const [count, setCount] = useState(null)
  useEffect(() => {
    let controller
    let refreshTimer
    let stopped = false
    async function refresh() {
      if (document.hidden || stopped) return
      controller?.abort()
      controller = new AbortController()
      const current = controller
      try {
        const data = await apiGet('/notifications/unread-count/', { signal: current.signal })
        if (!current.signal.aborted && !stopped) setCount(data.count)
      } catch (error) {
        if (error.name !== 'AbortError' && !stopped) setCount(null)
      }
    }
    function scheduleRefresh() {
      clearTimeout(refreshTimer)
      refreshTimer = setTimeout(refresh, 100)
    }
    scheduleRefresh()
    const timer = setInterval(scheduleRefresh, 60000)
    window.addEventListener('focus', scheduleRefresh)
    window.addEventListener('notifications:changed', scheduleRefresh)
    document.addEventListener('visibilitychange', scheduleRefresh)
    return () => {
      stopped = true; controller?.abort(); clearInterval(timer); clearTimeout(refreshTimer)
      window.removeEventListener('focus', scheduleRefresh)
      window.removeEventListener('notifications:changed', scheduleRefresh)
      document.removeEventListener('visibilitychange', scheduleRefresh)
    }
  }, [pathname])
  return <Link className="notification-bell" to="/thong-bao" aria-label={count === null ? 'Thông báo' : `Thông báo, ${count} chưa đọc`}>
    <Bell size={21} aria-hidden="true" />
    {count > 0 && <span className="notification-badge" aria-hidden="true">{count > 99 ? '99+' : count}</span>}
  </Link>
}
