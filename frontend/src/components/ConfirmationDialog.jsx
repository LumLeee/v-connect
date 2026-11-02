import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import '../styles/confirmation-dialog.css'

export default function ConfirmationDialog({ title, busy = false, onClose, children }) {
  const ref = useRef(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    return () => {
      dialog.close()
      document.body.style.overflow = overflow
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [])
  return createPortal(<dialog ref={ref} className="confirmation-dialog" aria-labelledby={titleId} aria-busy={busy}
    onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <header className="confirmation-dialog-heading"><h2 id={titleId}>{title}</h2>
      <button type="button" className="confirmation-dialog-close" aria-label="Đóng hộp thoại" disabled={busy} onClick={onClose}>×</button>
    </header>
    {children}
  </dialog>, document.body)
}
