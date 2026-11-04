import { useState } from 'react'
import ConfirmationDialog from './ConfirmationDialog.jsx'

export default function RecordDetails({ title, children }) {
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" data-record-details className="button secondary" onClick={() => setOpen(true)}>Xem chi tiết</button>
    {open && <ConfirmationDialog title={title} onClose={() => setOpen(false)}>
      <div className="record-details">{children}</div>
      <button type="button" className="button secondary" onClick={() => setOpen(false)}>Đóng</button>
    </ConfirmationDialog>}
  </>
}
