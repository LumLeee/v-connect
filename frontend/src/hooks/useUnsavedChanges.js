import { useCallback, useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

const warning = 'Bạn có thay đổi chưa lưu. Bạn có muốn rời trang và bỏ các thay đổi này?'
let installed = false
let activePopState = null

// Install before BrowserRouter subscribes: a rejected pop must not update Router.
export function installUnsavedNavigationGuard() {
  if (installed) return
  installed = true
  window.addEventListener('popstate', event => activePopState?.(event), true)
}

export default function useUnsavedChanges(enabled) {
  const location = useLocation()
  const enabledRef = useRef(enabled)
  const indexRef = useRef(window.history.state?.idx)
  const hrefRef = useRef(window.location.href)

  useLayoutEffect(() => {
    enabledRef.current = enabled
    indexRef.current = window.history.state?.idx
    hrefRef.current = window.location.href
  }, [enabled, location.key])

  useLayoutEffect(() => {
    installUnsavedNavigationGuard()
    let restoringIndex = null
    let acceptedLink = false
    let acceptedLinkTimer

    function beforeUnload(event) {
      if (!enabledRef.current || acceptedLink) return
      event.preventDefault()
      event.returnValue = ''
    }

    function linkClick(event) {
      if (!enabledRef.current || event.defaultPrevented || event.button !== 0) return
      const control = event.target instanceof Element
        ? event.target.closest('a[href], [data-unsaved-navigation]') : null
      if (!control) return
      if (!control.matches('a[href]')) {
        if (!window.confirm(warning)) {
          event.preventDefault()
          event.stopImmediatePropagation()
        }
        return
      }
      const link = control
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || link.hasAttribute('download')) return
      const target = link.target || document.querySelector('base[target]')?.target || '_self'
      if (target.toLowerCase() !== '_self') return
      const next = new URL(link.href, window.location.href)
      if (!['http:', 'https:'].includes(next.protocol)) return
      const current = window.location
      if (next.origin === current.origin && next.pathname === current.pathname
        && next.search === current.search && next.href.includes('#')) return

      if (!window.confirm(warning)) {
        event.preventDefault()
        event.stopImmediatePropagation()
        return
      }
      // A normal link can unload the document; do not ask twice for one click.
      acceptedLink = true
      window.clearTimeout(acceptedLinkTimer)
      acceptedLinkTimer = window.setTimeout(() => { acceptedLink = false }, 0)
    }

    function popState(event) {
      const nextIndex = event.state?.idx
      if (restoringIndex !== null) {
        event.stopImmediatePropagation()
        if (nextIndex === restoringIndex) restoringIndex = null
        else if (Number.isInteger(nextIndex)) window.history.go(restoringIndex - nextIndex)
        return
      }
      const currentIndex = indexRef.current
      const previous = new URL(hrefRef.current)
      const next = window.location
      const hashOnly = previous.origin === next.origin && previous.pathname === next.pathname
        && previous.search === next.search && previous.hash !== next.hash
      // Cross-document history is covered by beforeunload; hash changes keep idx.
      if (enabledRef.current && !hashOnly && Number.isInteger(currentIndex) && Number.isInteger(nextIndex)
        && nextIndex !== currentIndex && !window.confirm(warning)) {
        event.stopImmediatePropagation()
        restoringIndex = currentIndex
        window.history.go(currentIndex - nextIndex)
        return
      }
      indexRef.current = nextIndex
      hrefRef.current = window.location.href
    }

    window.addEventListener('beforeunload', beforeUnload)
    window.addEventListener('click', linkClick, true)
    activePopState = popState
    return () => {
      window.clearTimeout(acceptedLinkTimer)
      window.removeEventListener('beforeunload', beforeUnload)
      window.removeEventListener('click', linkClick, true)
      if (activePopState === popState) activePopState = null
    }
  }, [])

  return useCallback(() => { enabledRef.current = false }, [])
}
