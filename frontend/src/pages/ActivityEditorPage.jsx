import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import { apiMutation } from '../api/client.js'
import '../styles/activities.css'
import { SkillPicker } from '../components/VolunteerProfileFields.jsx'
import '../styles/profile.css'
import { TimelineFields } from '../components/ActivityTimeline.jsx'
import { timelineError } from '../api/timelineValidation.js'
import useUnsavedChanges from '../hooks/useUnsavedChanges.js'
import '../styles/organizer-activity-editor.css'
import ActivityPreviewDialog from '../components/ActivityPreviewDialog.jsx'

const vietnamInput = value => value ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)).replace(' ', 'T') : ''
const errorText = value => typeof value === 'string' ? value : Object.values(value || {}).map(errorText).join(' ')
const fieldLabels = { title: 'Tên hoạt động', description: 'Mô tả hoạt động', address: 'Địa chỉ hoạt động', activity_date: 'Ngày hoạt động', starts_at: 'Thời gian bắt đầu', ends_at: 'Thời gian kết thúc', capacity: 'Số lượng người cần tuyển', required_skills: 'Kỹ năng yêu cầu', timeline: 'Chương trình hoạt động' }
const snapshot = (form, timeline) => JSON.stringify({ ...form, capacity: Number(form.capacity), required_skills: [...form.required_skills].sort(), timeline })
const editorPayload = (form, timeline) => ({ ...form, capacity: Number(form.capacity), starts_at: new Date(`${form.starts_at}:00+07:00`).toISOString(), ends_at: new Date(`${form.ends_at}:00+07:00`).toISOString(),
  timeline: timeline.map(item => ({ ...item, starts_at: new Date(`${item.starts_at}:00+07:00`).toISOString(), ends_at: new Date(`${item.ends_at}:00+07:00`).toISOString() })) })

function issueFor(name, value) {
  const milestone = name.match(/^milestone-(title|description|starts_at|ends_at)-(\d+)$/)
  const label = milestone ? `${{ title: 'Tên', description: 'Mô tả', starts_at: 'Bắt đầu', ends_at: 'Kết thúc' }[milestone[1]]} mốc ${Number(milestone[2]) + 1}` : fieldLabels[name]
  return { id: label ? name : null, label: label || 'Thông tin hoạt động', message: errorText(value) }
}

function errorIssues(errors) {
  return Object.entries(errors).flatMap(([name, value]) => {
    if (name === 'timeline' && Array.isArray(value) && value.some(item => item && typeof item === 'object')) {
      return value.flatMap((item, index) => item && typeof item === 'object' ? Object.entries(item).map(([field, message]) => issueFor(`milestone-${field}-${index}`, message)) : [issueFor('timeline', item)])
    }
    return [issueFor(name, value)]
  }).filter(item => item.message)
}

function controlError(control) {
  const validity = control.validity
  if (validity.customError) return control.validationMessage
  if (validity.valueMissing) return 'Vui lòng nhập thông tin này.'
  if (validity.rangeUnderflow) return `Giá trị phải từ ${control.min} trở lên.`
  if (validity.rangeOverflow) return `Giá trị không được vượt quá ${control.max}.`
  if (validity.tooLong) return `Nhập tối đa ${control.maxLength} ký tự.`
  return 'Vui lòng nhập giá trị hợp lệ.'
}

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
  const [preview, setPreview] = useState(null)
  const [errorTitle, setErrorTitle] = useState('Chưa lưu được hoạt động')
  const original = useRef(snapshot(form, timeline))
  const formRef = useRef(null)
  const summaryRef = useRef(null)
  const editable = !initial || ['draft', 'published'].includes(initial.status)
  const dirty = snapshot(form, timeline) !== original.current
  const allowNavigation = useUnsavedChanges(dirty && editable)
  const issues = errorIssues(errors)
  useEffect(() => {
    if (error || Object.keys(errors).length) summaryRef.current?.focus()
  }, [errors, error])
  function goToError(event, id) {
    event.preventDefault()
    const target = document.getElementById(id)
    target?.focus({ preventScroll: true })
    target?.scrollIntoView({ block: 'center' })
  }
  function changeDate(date) {
    setActivityDate(date)
    setForm(previous => ({ ...previous, starts_at: `${date}T${previous.starts_at.split('T')[1] || ''}`, ends_at: `${date}T${previous.ends_at.split('T')[1] || ''}` }))
    setTimeline(previous => previous.map(item => ({ ...item, starts_at: `${date}T${item.starts_at.split('T')[1] || ''}`, ends_at: `${date}T${item.ends_at.split('T')[1] || ''}` })))
  }
  function validate(action) {
    const invalid = {}
    for (const control of formRef.current.elements) {
      if (control.willValidate && !control.validity.valid) invalid[control.id] = controlError(control)
    }
    if (!invalid.ends_at && form.ends_at && form.starts_at && form.ends_at <= form.starts_at) invalid.ends_at = 'Thời gian kết thúc phải sau thời gian bắt đầu.'
    const invalidIndex = timeline.findIndex(item => timelineError(item, form.starts_at, form.ends_at))
    if (invalidIndex !== -1 && !Object.keys(invalid).some(name => name.startsWith('milestone-'))) invalid.timeline = `Mốc ${invalidIndex + 1}: ${timelineError(timeline[invalidIndex], form.starts_at, form.ends_at)}`
    setErrorTitle(action === 'preview' ? 'Chưa thể xem trước hoạt động' : 'Chưa lưu được hoạt động')
    setError(''); setErrors(invalid)
    return Object.keys(invalid).length === 0
  }
  async function save(event) {
    event.preventDefault()
    if (!validate('save')) return
    setBusy(true)
    try {
      const payload = editorPayload(form, timeline)
      if (initial) {
        // Omit unchanged dates so editing text after the start remains possible.
        if (form.starts_at === vietnamInput(initial.starts_at)) delete payload.starts_at
        if (form.ends_at === vietnamInput(initial.ends_at)) delete payload.ends_at
      }
      const activity = await apiMutation(`/organizer/activities/${initial ? `${initial.id}/` : ''}`, payload, initial ? 'PATCH' : 'POST')
      allowNavigation()
      navigate(`/nha-to-chuc/hoat-dong/${activity.id}`)
    } catch (failure) {
      const details = failure.details?.error?.details
      const fieldErrors = details && typeof details === 'object' ? details : {}
      setErrors(fieldErrors); setError(errorIssues(fieldErrors).length ? '' : failure.message)
    }
    finally { setBusy(false) }
  }
  if (initial && !['draft', 'published'].includes(initial.status)) return <p>Không thể sửa hoạt động đã hoàn thành hoặc đã hủy. <Link to={`/nha-to-chuc/hoat-dong/${initial.id}`}>Xem hoạt động</Link></p>
  const fields = [['title', 'Tên hoạt động', 'text', 200], ['description', 'Mô tả hoạt động', 'textarea', 10000], ['address', 'Địa chỉ hoạt động', 'text', 500],
    ...(sameDay ? [['activity_date', 'Ngày hoạt động', 'date']] : []),
    ['starts_at', 'Thời gian bắt đầu', sameDay ? 'time' : 'datetime-local'], ['ends_at', 'Thời gian kết thúc', sameDay ? 'time' : 'datetime-local'], ['capacity', 'Số lượng người cần tuyển', 'number']]
  return <form ref={formRef} className="activity-editor om-activity-editor" onSubmit={save} noValidate>
    <p>Nhập thời gian theo giờ Việt Nam (UTC+7). Hoạt động mới được lưu ở trạng thái Nháp.</p>
    {(error || issues.length > 0) && <section ref={summaryRef} tabIndex={-1} className="om-editor-errors" role="alert" aria-labelledby="editor-errors-title">
      <h2 id="editor-errors-title">{errorTitle}</h2>
      {error && <p>{error}</p>}
      {issues.length > 0 && <><p>Kiểm tra các thông tin sau rồi lưu lại:</p><ul>{issues.map((issue, index) => <li key={`${issue.id}-${index}`}>
        {issue.id ? <a href={`#${issue.id}`} onClick={event => goToError(event, issue.id)}>{issue.label}: {issue.message}</a> : <span>{issue.message}</span>}
      </li>)}</ul></>}
    </section>}
    <fieldset disabled={busy}>
      <legend className="sr-only">Thông tin hoạt động</legend>
      <label className="activity-day-option"><input type="checkbox" checked={sameDay} onChange={event => { setSameDay(event.target.checked); if (event.target.checked) changeDate(form.starts_at.slice(0, 10)) }} /> Hoạt động diễn ra trong một ngày</label>
      {[[0, 2, 'Thông tin cơ bản'], [2, fields.length, 'Thời gian, địa điểm và số lượng']].map(([start, end, title]) => <section className="om-editor-section" key={title}><h2>{title}</h2><div className="om-editor-fields">
      {fields.slice(start, end).map(([name, label, type, maxLength]) => { const Control = type === 'textarea' ? 'textarea' : 'input'; return <div className={`activity-field${['title', 'description', 'address', 'activity_date'].includes(name) ? ' om-wide' : ''}`} key={name}>
        <label htmlFor={name}>{label}</label><Control id={name} name={name} type={type === 'textarea' ? undefined : type} rows={type === 'textarea' ? 8 : undefined}
          value={name === 'activity_date' ? activityDate : type === 'time' ? (form[name].split('T')[1] || '') : form[name]} required maxLength={maxLength} min={type === 'number' ? 1 : undefined} max={type === 'number' ? 100000 : undefined} step={type === 'number' ? 1 : undefined}
          aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${name}-error` : undefined}
          onChange={event => name === 'activity_date' ? changeDate(event.target.value) : setForm(previous => ({ ...previous, [name]: type === 'time' ? `${activityDate}T${event.target.value}` : event.target.value }))} />
        {errors[name] && <p id={`${name}-error`} className="field-error">{errorText(errors[name])}</p>}
      </div> })}
      </div></section>)}
      <section id="required_skills" tabIndex={-1} className="om-editor-section">
      <h2 className="profile-subtitle">Kỹ năng yêu cầu</h2>
      <p className="muted">Chọn kỹ năng phù hợp với hoạt động. Người chưa có kỹ năng vẫn có thể đăng ký để bạn xét duyệt.</p>
      <SkillPicker selected={form.required_skills} onChange={required_skills => setForm(previous => ({ ...previous, required_skills }))} />
      {errors.required_skills && <p className="field-error">{errorText(errors.required_skills)}</p>}
      <p className="muted">Bạn có thể thêm hoặc thay ảnh bìa tại trang quản lý chi tiết sau khi lưu hoạt động.</p>
      </section>
      <div id="timeline" tabIndex={-1}><TimelineFields items={timeline} onChange={setTimeline} date={sameDay ? activityDate : undefined} startsAt={form.starts_at} endsAt={form.ends_at} /></div>
      {errors.timeline && <p className="field-error">{errorText(errors.timeline)}</p>}
    </fieldset>
    {preview && <ActivityPreviewDialog value={preview} initial={initial} onClose={() => setPreview(null)} />}
    <div className="om-editor-savebar"><p role="status">{busy ? 'Đang lưu hoạt động…' : dirty ? 'Có thay đổi chưa lưu' : initial ? 'Chưa có thay đổi' : 'Hoạt động sẽ được lưu dưới dạng bản nháp'}</p>
      <div><button type="button" className="button secondary editor-preview-button" disabled={busy} onClick={() => { if (validate('preview')) setPreview(editorPayload(form, timeline)) }}>Xem trước</button>
        <Link className="button secondary" aria-disabled={busy || undefined} tabIndex={busy ? -1 : undefined} onClick={event => { if (busy) event.preventDefault() }} to={initial ? `/nha-to-chuc/hoat-dong/${initial.id}` : '/nha-to-chuc/hoat-dong'}>Quay lại</Link>
        <button className="button primary" disabled={busy}>{busy ? 'Đang lưu…' : initial ? 'Lưu thay đổi' : 'Lưu bản nháp'}</button></div>
    </div>
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
