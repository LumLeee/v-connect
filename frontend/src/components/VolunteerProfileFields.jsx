import { useState } from 'react'
import useApi from '../hooks/useApi.js'
import RequestState from './RequestState.jsx'

const weekdays = ['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy', 'Chủ nhật']
const errorText = error => !error ? '' : typeof error === 'string' ? error : Object.values(error).map(errorText).filter(Boolean).join(' ')

function SkillPicker({ selected, onChange }) {
  const [page, setPage] = useState(1)
  const { data, loading, error, retry } = useApi(`/skills/?page_size=100&page=${page}`)
  return <div className="profile-skills">
    <p className="profile-hint">Chọn tối đa 20 kỹ năng. Đã chọn: {selected.length}.</p>
    <RequestState loading={loading} error={error} retry={retry} />
    {data && <>
      {!data.count && <p className="profile-hint">Chưa có kỹ năng trong danh mục.</p>}
      <div className="profile-skill-options">{data.results.map(skill => <label key={skill.id}>
        <input type="checkbox" checked={selected.includes(skill.id)} disabled={selected.length >= 20 && !selected.includes(skill.id)}
          onChange={event => onChange(event.target.checked ? [...selected, skill.id] : selected.filter(id => id !== skill.id))} />
        <span>{skill.name}</span>
      </label>)}</div>
      {(data.previous || data.next) && <div className="profile-actions"><button type="button" className="button secondary" disabled={!data.previous} onClick={() => setPage(page - 1)}>Trang kỹ năng trước</button><span>Trang {page}</span><button type="button" className="button secondary" disabled={!data.next} onClick={() => setPage(page + 1)}>Trang kỹ năng sau</button></div>}
    </>}
    {selected.length > 0 && <button type="button" className="text-button" onClick={() => onChange([])}>Bỏ chọn tất cả kỹ năng</button>}
  </div>
}

export default function VolunteerProfileFields({ value, onChange, errors = {}, disabled }) {
  function update(field, next) { onChange({ ...value, [field]: next }) }
  function changeSlot(index, field, next) {
    update('availability', value.availability.map((slot, position) => position === index ? { ...slot, [field]: next } : slot))
  }
  return <fieldset className="volunteer-fields" disabled={disabled}>
    <legend>Hồ sơ tình nguyện mở rộng</legend>
    <p className="profile-hint">Bổ sung kỹ năng, sở thích và thời gian bạn có thể tham gia. Các thông tin này không bắt buộc.</p>
    <h2 className="profile-subtitle">Kỹ năng</h2>
    <SkillPicker selected={value.skills} onChange={next => update('skills', next)} />
    {errors.skills && <p className="field-error" role="alert">{errorText(errors.skills)}</p>}
    <div className="profile-field"><label htmlFor="volunteer-interests">Sở thích</label>
      <textarea id="volunteer-interests" rows={4} maxLength={2000} value={value.interestsText} onChange={event => update('interestsText', event.target.value)}
        aria-describedby="interests-hint" aria-invalid={Boolean(errors.interests)} placeholder={'Bảo vệ môi trường\nGiáo dục cộng đồng'} />
      <span id="interests-hint" className="profile-hint">Mỗi dòng một sở thích, tối đa 20 sở thích và 80 ký tự mỗi mục.</span>
      {errors.interests && <p className="field-error" role="alert">{errorText(errors.interests)}</p>}
    </div>
    <h2 className="profile-subtitle">Lịch rảnh hằng tuần</h2>
    <p className="profile-hint">Giờ Việt Nam (UTC+7), lặp lại mỗi tuần. Mỗi khung giờ nằm trong cùng ngày; giờ kết thúc phải sau giờ bắt đầu. Không nhập khung giờ chồng lấn. Tối đa 28 khung giờ.</p>
    {!value.availability.length && <p className="profile-hint">Chưa có lịch rảnh. Bạn có thể bổ sung sau.</p>}
    <div className="availability-list">{value.availability.map((slot, index) => <div className="availability-slot" key={index}>
      <label>Ngày trong tuần<select aria-label={`Ngày trong tuần ${index + 1}`} value={slot.weekday} onChange={event => changeSlot(index, 'weekday', Number(event.target.value))}>
        {weekdays.map((day, dayIndex) => <option key={dayIndex} value={dayIndex}>{day}</option>)}
      </select></label>
      <label>Từ giờ<input aria-label={`Giờ bắt đầu ${index + 1}`} type="time" step="60" value={slot.starts_at} required onChange={event => changeSlot(index, 'starts_at', event.target.value)} /></label>
      <label>Đến giờ<input aria-label={`Giờ kết thúc ${index + 1}`} type="time" step="60" value={slot.ends_at} required onChange={event => changeSlot(index, 'ends_at', event.target.value)} /></label>
      <button type="button" className="text-button" aria-label={`Xóa khung giờ ${index + 1}`} onClick={() => update('availability', value.availability.filter((_, position) => position !== index))}>Xóa</button>
    </div>)}</div>
    {errors.availability && <p className="field-error" role="alert">{errorText(errors.availability)}</p>}
    <button type="button" className="button secondary" disabled={value.availability.length >= 28} onClick={() => update('availability', [...value.availability, { weekday: 0, starts_at: '08:00', ends_at: '12:00' }])}>Thêm khung giờ</button>
    {errors.non_field_errors && <p className="field-error" role="alert">{errorText(errors.non_field_errors)}</p>}
    {typeof errors === 'string' && <p className="field-error" role="alert">{errors}</p>}
  </fieldset>
}
