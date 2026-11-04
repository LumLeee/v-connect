const controls = 'a, button, input, select, textarea, summary, dialog, [role="button"]'
const primaryAction = row => row.querySelector('[data-row-primary]') || row.querySelector('.om-action-link') || row.querySelector('[data-record-details]') || row.querySelector('a[href]') || row.querySelector('button')

export default function ActionRow({ children, className = '', label = 'Mở chức năng của dòng', ...props }) {
  const rowRef = useRef(null)
  useLayoutEffect(() => {
    const row = rowRef.current
    function updateActions() {
      const actions = [...row.querySelectorAll('a[href], button')].filter(action => !action.closest('dialog'))
      const functions = new Set(actions.map(action => action.matches('a') ? action.href : action))
      const single = functions.size === 1
      for (const action of actions) {
        // Keep title links visible; the row itself provides access to a sole action.
        const redundant = single && !action.closest('h2, h3') && !action.hasAttribute('data-row-keep-action')
        action.classList.toggle('row-redundant-action', redundant)
        const wrapper = action.parentElement
        if (wrapper !== row && wrapper.matches('p, .om-row-actions, .vs-row-actions')) {
          wrapper.classList.toggle('row-empty-actions', single && [...wrapper.children].every(child => child.classList.contains('row-redundant-action')) && ![...wrapper.childNodes].some(node => node.nodeType === 3 && node.textContent.trim()))
        }
      }
      const target = primaryAction(row)
      row.setAttribute('aria-label', single && target ? `${target.textContent.trim()} — ${row.querySelector('h2, h3')?.textContent || ''}` : label)
    }
    updateActions()
    const observer = new MutationObserver(updateActions)
    observer.observe(row, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [children, label])
  function activate(event) {
    if (event.defaultPrevented || (event.type === 'click' && event.button !== 0)) return
    if (event.target !== event.currentTarget && event.target.closest(controls)) return
    if (window.getSelection()?.toString()) return
    const target = primaryAction(event.currentTarget)
    if (target && !target.disabled) target.click()
  }
  return <article {...props} ref={rowRef} className={`${className} action-row`} tabIndex={0} aria-label={label}
    onClick={activate} onKeyDown={event => {
      if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return
      event.preventDefault()
      // The default is prevented for Space scrolling; activation still needs to run.
      const target = primaryAction(event.currentTarget)
      if (target && !target.disabled) target.click()
    }}>{children}</article>
}
import { useLayoutEffect, useRef } from 'react'
import '../styles/action-row.css'
