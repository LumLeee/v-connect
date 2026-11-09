import { useEffect, useId, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

const mobileQuery = '(max-width: 1050px)'
const focusable = 'a[href], button:not(:disabled), [tabindex="0"]'

function desktopOpen(preferenceKey) {
  try { return !preferenceKey || localStorage.getItem(preferenceKey) !== 'closed' }
  catch { return true }
}

function remember(preferenceKey, expanded) {
  if (preferenceKey) {
    try { localStorage.setItem(preferenceKey, expanded ? 'open' : 'closed') } catch { /* Storage can be unavailable. */ }
  }
}

export default function useWorkspaceMenu(preferenceKey = null) {
  const { key } = useLocation()
  const [narrow, setNarrow] = useState(() => window.matchMedia(mobileQuery).matches)
  const [state, setState] = useState(() => ({ expanded: !window.matchMedia(mobileQuery).matches && desktopOpen(preferenceKey), route: key }))
  const sidebarRef = useRef(null)
  const workspaceRef = useRef(null)
  const toggleRef = useRef(null)
  const closeRef = useRef(null)
  const id = useId()
  const open = state.expanded && (!narrow || state.route === key)

  function toggle() { if (!narrow) remember(preferenceKey, !open); setState({ expanded: !open, route: key }) }
  function close() { if (!narrow) remember(preferenceKey, false); setState({ expanded: false, route: key }) }

  useEffect(() => {
    const media = window.matchMedia(mobileQuery)
    function resize(event) {
      setNarrow(event.matches)
      setState({ expanded: !event.matches && desktopOpen(preferenceKey), route: key })
    }
    media.addEventListener('change', resize)
    return () => media.removeEventListener('change', resize)
  }, [key, preferenceKey])

  useEffect(() => {
    if (!open) return
    const workspace = workspaceRef.current
    const toggleButton = toggleRef.current
    const previousOverflow = document.body.style.overflow
    if (narrow) {
      workspace.inert = true
      document.body.style.overflow = 'hidden'
      closeRef.current?.focus({ preventScroll: true })
    }
    function keyboard(event) {
      if (event.defaultPrevented || document.querySelector('dialog[open]')) return
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!narrow) remember(preferenceKey, false)
        setState(previous => ({ ...previous, expanded: false }))
      }
      if (event.key !== 'Tab' || !narrow) return
      const targets = [...sidebarRef.current.querySelectorAll(focusable)].filter(node => node.getClientRects().length)
      const first = targets[0]
      const last = targets.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', keyboard)
    return () => {
      document.removeEventListener('keydown', keyboard)
      if (narrow) {
        workspace.inert = false
        document.body.style.overflow = previousOverflow
      }
      toggleButton?.focus({ preventScroll: true })
    }
  }, [open, narrow, preferenceKey])

  return { id, open, narrow, toggle, close, sidebarRef, workspaceRef, toggleRef, closeRef }
}
