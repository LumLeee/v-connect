import { useState } from 'react'
import { Link } from 'react-router-dom'
import { UserRound } from 'lucide-react'
import { apiMutation } from '../api/client.js'
import { useAuth, roleLabels, workspacePaths } from '../auth/context.js'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import '../styles/profile.css'

const emptyOrganization = { organization_name: '', description: '', website: '', contact_address: '' }

function Field({ name, label, value, onChange, error, multiline = false, ...props }) {
  const Control = multiline ? 'textarea' : 'input'
  return <div className="profile-field">
    <label htmlFor={name}>{label}</label>
    <Control id={name} name={name} value={value} onChange={event => onChange(event.target.value)}
      aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : undefined} {...props} />
    {error && <span id={`${name}-error`} className="field-error">{Array.isArray(error) ? error.join(' ') : error}</span>}
  </div>
}

function ProfileEditor({ initial }) {
  const { acceptUser } = useAuth()
  const [form, setForm] = useState({ full_name: initial.full_name, phone: initial.phone, bio: initial.bio,
    organizer: { ...emptyOrganization, ...initial.organizer } })
  const [avatar, setAvatar] = useState(initial.avatar_url)
  const [avatarVersion, setAvatarVersion] = useState(0)
  const [avatarFailed, setAvatarFailed] = useState(false)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const [avatarMessage, setAvatarMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [saveError, setSaveError] = useState('')
  const isOrganizer = initial.role === 'organizer'
  const update = (name, value) => { setForm(previous => ({ ...previous, [name]: value })); setMessage('') }
  const updateOrganization = (name, value) => {
    setForm(previous => ({ ...previous, organizer: { ...previous.organizer, [name]: value } })); setMessage('')
  }

  async function save(event) {
    event.preventDefault()
    setSaving(true); setErrors({}); setMessage(''); setSaveError('')
    const payload = { full_name: form.full_name, phone: form.phone, bio: form.bio }
    if (isOrganizer) payload.organizer = form.organizer
    try {
      const { profile } = await apiMutation('/auth/profile/', payload)
      setForm({ full_name: profile.full_name, phone: profile.phone, bio: profile.bio,
        organizer: { ...emptyOrganization, ...profile.organizer } })
      acceptUser({ id: profile.id, full_name: profile.full_name, email: profile.email, username: profile.username, role: profile.role })
      setMessage('Đã lưu hồ sơ của bạn.')
    } catch (failure) {
      setErrors(failure.details?.error?.details || {}); setSaveError(failure.message)
    } finally { setSaving(false) }
  }

  async function changeAvatar(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setAvatarError(''); setAvatarMessage('')
    if (file.size > 5 * 1024 * 1024) { setAvatarError('Ảnh không được vượt quá 5 MB.'); return }
    const body = new FormData(); body.append('avatar', file)
    await submitAvatar(body, 'POST')
  }

  async function submitAvatar(body, method) {
    setAvatarBusy(true); setAvatarError(''); setAvatarMessage('')
    try {
      const data = await apiMutation('/auth/profile/avatar/', body, method)
      setAvatar(data.avatar_url); setAvatarVersion(Date.now()); setAvatarFailed(false)
      setAvatarMessage(method === 'DELETE' ? 'Đã xóa ảnh đại diện.' : 'Đã cập nhật ảnh đại diện.')
    } catch (failure) {
      const detail = failure.details?.error?.details?.avatar
      setAvatarError(Array.isArray(detail) ? detail.join(' ') : detail || failure.message)
    } finally { setAvatarBusy(false) }
  }

  return <div className="profile-layout">
    <aside className="profile-card profile-summary">
      {avatar && !avatarFailed ? <img className="profile-avatar" src={`${avatar}?v=${avatarVersion}`} alt="Ảnh đại diện của bạn" onError={() => setAvatarFailed(true)} />
        : <div className="profile-avatar profile-placeholder" aria-label="Chưa có ảnh đại diện"><UserRound size={52} /></div>}
      <h2>Ảnh đại diện</h2>
      <p>{roleLabels[initial.role]}</p>
      <label className="profile-file-label" htmlFor="avatar">Chọn ảnh đại diện</label>
      <input id="avatar" className="profile-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={changeAvatar} disabled={avatarBusy} aria-describedby="avatar-hint" />
      <p id="avatar-hint" className="profile-hint">JPEG, PNG hoặc WebP, tối đa 5 MB và 16 triệu điểm ảnh. Ảnh được lưu riêng khi bạn chọn file.</p>
      {avatar && <button type="button" className="text-button" disabled={avatarBusy} onClick={() => submitAvatar(undefined, 'DELETE')}>Xóa ảnh đại diện</button>}
      {avatarBusy && <p role="status">Đang cập nhật ảnh…</p>}
      {avatarError && <p className="field-error" role="alert">{avatarError}</p>}
      {avatarMessage && <p className="success" role="status">{avatarMessage}</p>}
    </aside>
    <form className="profile-card profile-form" onSubmit={save}>
      <fieldset disabled={saving}>
        <legend>Thông tin cơ bản</legend>
        <p className="profile-hint">{initial.role === 'admin' ? 'Username đăng nhập' : 'Email đăng nhập'}: <strong>{initial.role === 'admin' ? initial.username : initial.email}</strong></p>
        <Field name="full_name" label="Họ và tên" value={form.full_name} onChange={value => update('full_name', value)} error={errors.full_name} maxLength={150} required autoComplete="name" />
        <Field name="phone" label="Số điện thoại" value={form.phone} onChange={value => update('phone', value)} error={errors.phone} maxLength={25} type="tel" autoComplete="tel" />
        <Field name="bio" label="Giới thiệu bản thân" value={form.bio} onChange={value => update('bio', value)} error={errors.bio} maxLength={2000} multiline rows={4} />
      </fieldset>
      {isOrganizer && <fieldset disabled={saving} className="organization-fields">
        <legend>Hồ sơ Nhà tổ chức</legend>
        <p className="profile-hint">Thông tin về tổ chức mà bạn đại diện. Bạn có thể bổ sung dần.</p>
        <Field name="organization_name" label="Tên tổ chức" value={form.organizer.organization_name} onChange={value => updateOrganization('organization_name', value)} error={errors.organizer?.organization_name} maxLength={200} autoComplete="organization" />
        <Field name="description" label="Mô tả tổ chức" value={form.organizer.description} onChange={value => updateOrganization('description', value)} error={errors.organizer?.description} maxLength={4000} multiline rows={5} />
        <Field name="website" label="Website" value={form.organizer.website} onChange={value => updateOrganization('website', value)} error={errors.organizer?.website} maxLength={300} type="url" placeholder="https://example.org" />
        <Field name="contact_address" label="Địa chỉ liên hệ" value={form.organizer.contact_address} onChange={value => updateOrganization('contact_address', value)} error={errors.organizer?.contact_address} maxLength={300} autoComplete="street-address" />
      </fieldset>}
      {saveError && <p className="request-error" role="alert">{saveError}</p>}
      {message && <p className="success profile-feedback" role="status">{message}</p>}
      <div className="profile-actions"><button className="button primary" disabled={saving} type="submit">{saving ? 'Đang lưu…' : 'Lưu hồ sơ'}</button>
        <Link to={workspacePaths[initial.role]} className="button secondary">Về tài khoản</Link></div>
    </form>
  </div>
}

function ProfileContent() {
  const { data, loading, error, retry } = useApi('/auth/profile/')
  return <section className="page-width section interior profile-page">
    <p className="eyebrow">TÀI KHOẢN CỦA BẠN</p><h1>Hồ sơ của tôi</h1>
    <p className="lead">Chia sẻ đôi nét về bạn và cập nhật thông tin liên hệ.</p>
    <RequestState loading={loading} error={error} retry={retry} />
    {data && <ProfileEditor key={data.profile.id} initial={data.profile} />}
  </section>
}

export default function ProfilePage() {
  const { user } = useAuth()
  return <ProfileContent key={user.id} />
}
