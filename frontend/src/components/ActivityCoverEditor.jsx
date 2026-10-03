import { useState } from 'react'
import { apiMutation } from '../api/client.js'
import ActivityVisual from './ActivityVisual.jsx'

export default function ActivityCoverEditor({ activity, refresh }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
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
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('Ảnh không được vượt quá 5 MB.'); return }
    const body = new FormData(); body.append('cover', file)
    save(body, 'POST')
  }
  return <section className="activity-cover-editor" aria-label="Ảnh bìa hoạt động">
    <ActivityVisual id={activity.id} coverUrl={activity.cover_url} large />
    {editable && <><label htmlFor="activity-cover">Chọn ảnh bìa hoạt động</label>
      <input id="activity-cover" type="file" accept="image/jpeg,image/png,image/webp" onChange={select} disabled={busy} />
      <p className="muted">JPEG, PNG hoặc WebP, tối đa 5 MB và 16 triệu điểm ảnh. Ảnh được lưu ngay khi chọn; ảnh bản nháp chỉ chủ hoạt động xem được.</p>
      {activity.cover_url && <button className="button secondary" type="button" disabled={busy} onClick={() => save(undefined, 'DELETE')}>Xóa ảnh bìa</button>}</>}
    {busy && <p role="status">Đang cập nhật ảnh bìa…</p>}
    {error && <p className="field-error" role="alert">{error}</p>}
  </section>
}
