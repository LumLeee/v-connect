import { useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { apiMutation } from '../api/client.js'
import ActivityVisual from './ActivityVisual.jsx'
import ImagePasteInput from './ImagePasteInput.jsx'

export default function ActivityCoverEditor({ activity, refresh }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileInput = useRef(null)
  const editable = ['draft', 'published'].includes(activity.status)
  async function save(body, method) {
    setBusy(true); setError('')
    try { await apiMutation(`/activities/${activity.id}/cover/`, body, method); refresh() }
    catch (failure) { const detail = failure.details?.error?.details?.cover; setError(Array.isArray(detail) ? detail.join(' ') : detail || failure.message) }
    finally { setBusy(false) }
  }
  function select(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    upload(file)
  }
  async function upload(file) {
    if (busy || !editable) return
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('Ảnh không được vượt quá 5 MB.'); return }
    const body = new FormData(); body.append('cover', file)
    await save(body, 'POST')
  }
  return <section className="activity-cover-editor" aria-label="Ảnh bìa hoạt động">
    <ActivityVisual id={activity.id} coverUrl={activity.cover_url} large />
    {editable && <>
      <input ref={fileInput} id="activity-cover" type="file" accept="image/jpeg,image/png,image/webp" onChange={select} disabled={busy} hidden />
      <ImagePasteInput compact label="Dán ảnh" onImage={upload} disabled={busy}
        actions={activity.cover_url && <button className="image-cover-remove" type="button" disabled={busy} onClick={() => save(undefined, 'DELETE')}><Trash2 size={16} aria-hidden="true" />Xóa ảnh</button>}>
        <button className="button secondary image-paste-button" type="button" disabled={busy} onClick={() => fileInput.current?.click()}><ImagePlus size={17} aria-hidden="true" />Chọn ảnh</button>
      </ImagePasteInput>
    </>}
    {busy && <p role="status">Đang cập nhật ảnh bìa…</p>}
    {error && <p className="field-error" role="alert">{error}</p>}
  </section>
}
