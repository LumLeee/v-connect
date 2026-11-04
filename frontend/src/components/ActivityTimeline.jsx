import { activityTime } from '../api/activityFormat.js'
import { timelineError } from '../api/timelineValidation.js'
import '../styles/timeline.css'

export default function ActivityTimeline({ items = [] }) {
  return <section className="activity-timeline" aria-label="Chương trình hoạt động">
    <h2>Chương trình hoạt động</h2>
    {!items.length ? <p className="muted">Nhà tổ chức chưa cập nhật chương trình chi tiết.</p> : <>
      <p className="muted">Thời gian theo giờ Việt Nam (UTC+7).</p>
      <ol>{items.map((item, index) => <li key={`${item.starts_at}-${index}`}>
        <p className="timeline-time"><time dateTime={item.starts_at}>{activityTime(item.starts_at)}</time> → <time dateTime={item.ends_at}>{activityTime(item.ends_at)}</time></p>
        <h3>{item.title}</h3>{item.description && <p className="activity-description">{item.description}</p>}
      </li>)}</ol>
    </>}
  </section>
}

export function TimelineFields({ items, onChange, date, startsAt, endsAt }) {
  const inputValue = value => date ? (value?.split('T')[1] || '') : (value || '')
  const validRange = Number.isFinite(Date.parse(startsAt)) && Number.isFinite(Date.parse(endsAt)) && endsAt > startsAt
  function update(index, field, value) { onChange(items.map((item, position) => position === index ? { ...item, [field]: value } : item)) }
  return <section className="om-editor-section timeline-editor">
    <h2>Chương trình hoạt động</h2>
    <p className="muted">Tối đa 50 mốc, nằm trong thời gian hoạt động. Tự sắp xếp theo giờ bắt đầu sau khi lưu. Có thể trùng giờ nếu chương trình diễn ra song song.</p>
    {items.map((item, index) => <fieldset key={index} className="timeline-editor-item"><legend>Mốc {index + 1}</legend>
      <div className="activity-field"><label htmlFor={`milestone-title-${index}`}>Tên mốc {index + 1}</label><input id={`milestone-title-${index}`} required maxLength={200} value={item.title} onChange={event => update(index, 'title', event.target.value)} /></div>
      <div className="om-editor-fields">{[['starts_at', 'Bắt đầu'], ['ends_at', 'Kết thúc']].map(([field, label]) => <div className="activity-field" key={field}>
        <label htmlFor={`milestone-${field}-${index}`}>{label} mốc {index + 1}</label><input id={`milestone-${field}-${index}`} required type={date ? 'time' : 'datetime-local'} value={inputValue(item[field])}
          min={validRange ? inputValue(field === 'ends_at' && item.starts_at > startsAt ? item.starts_at : startsAt) : undefined}
          max={validRange ? inputValue(endsAt) : undefined}
          aria-invalid={Boolean(validRange && timelineError(item, startsAt, endsAt))}
          aria-describedby={validRange && timelineError(item, startsAt, endsAt) ? `milestone-error-${index}` : undefined}
          ref={input => { if (input) input.setCustomValidity(validRange ? timelineError(item, startsAt, endsAt) : '') }}
          onChange={event => update(index, field, date ? `${date}T${event.target.value}` : event.target.value)} />
      </div>)}</div>
      {validRange && timelineError(item, startsAt, endsAt) && <p id={`milestone-error-${index}`} className="field-error" role="alert">{timelineError(item, startsAt, endsAt)}</p>}
      <div className="activity-field"><label htmlFor={`milestone-description-${index}`}>Mô tả mốc {index + 1}</label><textarea id={`milestone-description-${index}`} rows={3} maxLength={2000} value={item.description} onChange={event => update(index, 'description', event.target.value)} /></div>
      <button className="text-button" type="button" onClick={() => onChange(items.filter((_, position) => position !== index))}>Xóa mốc {index + 1}</button>
    </fieldset>)}
    {!validRange && <p className="muted">Chọn thời gian bắt đầu và kết thúc hoạt động trước khi thêm mốc.</p>}
    <button type="button" className="button secondary" disabled={items.length >= 50 || !validRange} onClick={() => onChange([...items, { title: '', description: '', starts_at: startsAt, ends_at: endsAt }])}>Thêm mốc chương trình</button>
  </section>
}
