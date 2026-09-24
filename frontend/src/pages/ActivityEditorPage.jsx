import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import { apiMutation } from '../api/client.js'
import '../styles/activities.css'

const vietnamInput = value => value ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)).replace(' ', 'T') : ''

function Editor({ initial }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({ title: initial?.title || '', description: initial?.description || '', address: initial?.address || '',
    starts_at: vietnamInput(initial?.starts_at), ends_at: vietnamInput(initial?.ends_at), capacity: initial?.capacity || 1 })
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(''); setErrors({})
    try {
      const payload = { ...form, capacity: Number(form.capacity), starts_at: new Date(`${form.starts_at}:00+07:00`).toISOString(), ends_at: new Date(`${form.ends_at}:00+07:00`).toISOString() }
      if (initial) {
        // Omit unchanged dates so editing text after the start remains possible.
        if (form.starts_at === vietnamInput(initial.starts_at)) delete payload.starts_at
        if (form.ends_at === vietnamInput(initial.ends_at)) delete payload.ends_at
      }
      const activity = await apiMutation(`/organizer/activities/${initial ? `${initial.id}/` : ''}`, payload, initial ? 'PATCH' : 'POST')
      navigate(`/nha-to-chuc/hoat-dong/${activity.id}`)
    } catch (failure) { setErrors(failure.details?.error?.details || {}); setError(failure.message) }
    finally { setBusy(false) }
  }
  if (initial && !['draft', 'published'].includes(initial.status)) return <p>Không thể sửa hoạt động đã hoàn thành hoặc đã hủy. <Link to={`/nha-to-chuc/hoat-dong/${initial.id}`}>Xem hoạt động</Link></p>
  const fields = [['title', 'Tên hoạt động', 'text', 200], ['description', 'Mô tả hoạt động', 'textarea', 10000], ['address', 'Địa chỉ hoạt động', 'text', 500],
    ['starts_at', 'Thời gian bắt đầu', 'datetime-local'], ['ends_at', 'Thời gian kết thúc', 'datetime-local'], ['capacity', 'Số lượng người cần tuyển', 'number']]
  return <form className="activity-editor" onSubmit={save}>
    <p>Nhập thời gian theo giờ Việt Nam (UTC+7). Hoạt động mới được lưu ở trạng thái Nháp.</p>
    <fieldset disabled={busy}>
      <legend className="sr-only">Thông tin hoạt động</legend>
      {fields.map(([name, label, type, maxLength]) => { const Control = type === 'textarea' ? 'textarea' : 'input'; return <div className="activity-field" key={name}>
        <label htmlFor={name}>{label}</label><Control id={name} name={name} type={type === 'textarea' ? undefined : type} rows={type === 'textarea' ? 8 : undefined}
          value={form[name]} required maxLength={maxLength} min={type === 'number' ? 1 : undefined} max={type === 'number' ? 100000 : undefined} step={type === 'number' ? 1 : undefined}
          aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${name}-error` : undefined}
          onChange={event => setForm(previous => ({ ...previous, [name]: event.target.value }))} />
        {errors[name] && <p id={`${name}-error`} className="field-error">{[].concat(errors[name]).join(' ')}</p>}
      </div> })}
    </fieldset>
    {error && <p role="alert" className="request-error">{error}</p>}
    <div className="activity-actions"><button className="button primary" disabled={busy}>{busy ? 'Đang lưu…' : initial ? 'Lưu thay đổi' : 'Lưu bản nháp'}</button>
      <Link className="button secondary" to={initial ? `/nha-to-chuc/hoat-dong/${initial.id}` : '/nha-to-chuc/hoat-dong'}>Quay lại</Link></div>
  </form>
}

function ExistingEditor({ id }) {
  const { data, loading, error, retry } = useApi(`/organizer/activities/${id}/`)
  return <><RequestState loading={loading} error={error} retry={retry} />{data && <Editor key={data.id} initial={data} />}</>
}

export default function ActivityEditorPage() {
  const { id } = useParams()
  return <section className="page-width section interior activity-page"><h1>{id ? 'Chỉnh sửa hoạt động' : 'Tạo hoạt động'}</h1>{id ? <ExistingEditor key={id} id={id} /> : <Editor />}</section>
}
