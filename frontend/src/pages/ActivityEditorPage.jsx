import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import { apiMutation } from '../api/client.js'
import '../styles/activities.css'
import { SkillPicker } from '../components/VolunteerProfileFields.jsx'
import '../styles/profile.css'
import { TimelineFields } from '../components/ActivityTimeline.jsx'
import { timelineError } from '../api/timelineValidation.js'

const vietnamInput = value => value ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)).replace(' ', 'T') : ''
const errorText = value => typeof value === 'string' ? value : Object.values(value || {}).map(errorText).join(' ')

function Editor({ initial }) {
  const navigate = useNavigate()
  const [sameDay, setSameDay] = useState(!initial || vietnamInput(initial.starts_at).slice(0, 10) === vietnamInput(initial.ends_at).slice(0, 10))
  const [activityDate, setActivityDate] = useState(vietnamInput(initial?.starts_at).slice(0, 10))
  const [form, setForm] = useState({ title: initial?.title || '', description: initial?.description || '', address: initial?.address || '',
    starts_at: vietnamInput(initial?.starts_at), ends_at: vietnamInput(initial?.ends_at), capacity: initial?.capacity || 1, required_skills: initial?.required_skills || [] })
  const [busy, setBusy] = useState(false)
  const [timeline, setTimeline] = useState((initial?.timeline || []).map(item => ({ ...item, starts_at: vietnamInput(item.starts_at), ends_at: vietnamInput(item.ends_at) })))
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  function changeDate(date) {
    setActivityDate(date)
    setForm(previous => ({ ...previous, starts_at: `${date}T${previous.starts_at.split('T')[1] || ''}`, ends_at: `${date}T${previous.ends_at.split('T')[1] || ''}` }))
    setTimeline(previous => previous.map(item => ({ ...item, starts_at: `${date}T${item.starts_at.split('T')[1] || ''}`, ends_at: `${date}T${item.ends_at.split('T')[1] || ''}` })))
  }
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(''); setErrors({})
    try {
      const invalidIndex = timeline.findIndex(item => timelineError(item, form.starts_at, form.ends_at))
      if (invalidIndex !== -1) {
        setErrors({ timeline: `Mốc ${invalidIndex + 1}: ${timelineError(timeline[invalidIndex], form.starts_at, form.ends_at)}` })
        return
      }
      const payload = { ...form, capacity: Number(form.capacity), starts_at: new Date(`${form.starts_at}:00+07:00`).toISOString(), ends_at: new Date(`${form.ends_at}:00+07:00`).toISOString() }
      payload.timeline = timeline.map(item => ({ ...item, starts_at: new Date(`${item.starts_at}:00+07:00`).toISOString(), ends_at: new Date(`${item.ends_at}:00+07:00`).toISOString() }))
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
    ...(sameDay ? [['activity_date', 'Ngày hoạt động', 'date']] : []),
    ['starts_at', 'Thời gian bắt đầu', sameDay ? 'time' : 'datetime-local'], ['ends_at', 'Thời gian kết thúc', sameDay ? 'time' : 'datetime-local'], ['capacity', 'Số lượng người cần tuyển', 'number']]
  return <form className="activity-editor" onSubmit={save}>
    <p>Nhập thời gian theo giờ Việt Nam (UTC+7). Hoạt động mới được lưu ở trạng thái Nháp.</p>
    <fieldset disabled={busy}>
      <legend className="sr-only">Thông tin hoạt động</legend>
      <label className="activity-day-option"><input type="checkbox" checked={sameDay} onChange={event => { setSameDay(event.target.checked); if (event.target.checked) changeDate(form.starts_at.slice(0, 10)) }} /> Hoạt động diễn ra trong một ngày</label>
      {[[0, 2, 'Thông tin cơ bản'], [2, fields.length, 'Thời gian, địa điểm và số lượng']].map(([start, end, title]) => <section className="om-editor-section" key={title}><h2>{title}</h2><div className="om-editor-fields">
      {fields.slice(start, end).map(([name, label, type, maxLength]) => { const Control = type === 'textarea' ? 'textarea' : 'input'; return <div className={`activity-field${['title', 'description', 'address', 'activity_date'].includes(name) ? ' om-wide' : ''}`} key={name}>
        <label htmlFor={name}>{label}</label><Control id={name} name={name} type={type === 'textarea' ? undefined : type} rows={type === 'textarea' ? 8 : undefined}
          value={name === 'activity_date' ? activityDate : type === 'time' ? (form[name].split('T')[1] || '') : form[name]} required maxLength={maxLength} min={type === 'number' ? 1 : undefined} max={type === 'number' ? 100000 : undefined} step={type === 'number' ? 1 : undefined}
          aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${name}-error` : undefined}
          onChange={event => name === 'activity_date' ? changeDate(event.target.value) : setForm(previous => ({ ...previous, [name]: type === 'time' ? `${activityDate}T${event.target.value}` : event.target.value }))} />
        {errors[name] && <p id={`${name}-error`} className="field-error">{[].concat(errors[name]).join(' ')}</p>}
      </div> })}
      </div></section>)}
      <section className="om-editor-section">
      <h2 className="profile-subtitle">Kỹ năng yêu cầu</h2>
      <p className="muted">Chọn kỹ năng phù hợp với hoạt động. Người chưa có kỹ năng vẫn có thể đăng ký để bạn xét duyệt.</p>
      <SkillPicker selected={form.required_skills} onChange={required_skills => setForm(previous => ({ ...previous, required_skills }))} />
      {errors.required_skills && <p className="field-error" role="alert">{[].concat(errors.required_skills).join(' ')}</p>}
      <p className="muted">Bạn có thể thêm hoặc thay ảnh bìa tại trang quản lý chi tiết sau khi lưu hoạt động.</p>
      </section>
      <TimelineFields items={timeline} onChange={setTimeline} date={sameDay ? activityDate : undefined} startsAt={form.starts_at} endsAt={form.ends_at} />
      {errors.timeline && <p className="field-error" role="alert">{errorText(errors.timeline)}</p>}
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
