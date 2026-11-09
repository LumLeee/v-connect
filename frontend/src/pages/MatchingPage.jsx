import ActionRow from '../components/ActionRow.jsx'
import RecordDetails from '../components/RecordDetails.jsx'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import ConfirmationDialog from '../components/ConfirmationDialog.jsx'
import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { apiPost } from '../api/client.js'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import OrganizerActivityHeader from '../components/OrganizerActivityHeader.jsx'
import { ReportPagination } from '../components/ReportMetrics.jsx'
import { activityTime } from '../api/activityFormat.js'
import '../styles/activities.css'
import '../styles/matching.css'
import '../styles/volunteer-matching.css'

const invitationLabels = { pending: 'Đã gửi lời mời', accepted: 'Đã chấp nhận lời mời', declined: 'Đã từ chối lời mời', withdrawn: 'Lời mời đã thu hồi' }

const ruleLimits = { skills: 50, interests: 20, availability: 30 }
const criterionLabels = { skills: 'Kỹ năng', interests: 'Sở thích', availability: 'Lịch rảnh', semantic: 'Nội dung tương đồng' }

function MatchingSource({ ai }) {
  if (!ai?.status) return null
  const active = ai.status === 'active'
  const fallback = ai.status === 'fallback'
  return <div className={`matching-source${active ? ' matching-source--ai' : ''}`} role="status" aria-label="Phương pháp ghép nối">
    <span className="matching-source-label">{active ? 'AI + quy tắc' : fallback ? 'Quy tắc dự phòng' : 'Ghép nối theo quy tắc'}</span>
    <p>{active ? 'AI so sánh nội dung hồ sơ và hoạt động; kỹ năng và lịch rảnh vẫn được tính riêng.' : fallback ? 'AI hiện chưa sẵn sàng. Gợi ý vẫn được tính bằng kỹ năng, sở thích và lịch rảnh.' : ai.status === 'not_applicable' ? 'Chưa áp dụng AI cho danh sách này.' : 'Gợi ý được tính bằng kỹ năng, sở thích và lịch rảnh.'}</p>
  </div>
}

function ScoreBreakdown({ entry, limits = ruleLimits }) {
  if (!entry.components) return null
  return <dl className="matching-score-breakdown vm-score-breakdown" aria-label="Điểm theo tiêu chí">
    {Object.entries(criterionLabels).filter(([criterion]) => limits[criterion] != null).map(([criterion, label]) => <div key={criterion}><dt>{label}</dt><dd>{entry.components[criterion] ?? 0}/{limits[criterion]}</dd></div>)}
  </dl>
}

function SemanticExplanation({ entry, limits }) {
  if (limits?.semantic == null) return null
  return <p className="matching-semantic-note">{entry.semantic ? <>Mức tương đồng nội dung: <strong>{entry.semantic.similarity}%</strong>. AI so sánh ý nghĩa của hồ sơ và hoạt động; mức này không xác nhận kỹ năng hoặc khả năng được duyệt.</> : 'Chưa có đủ nội dung hồ sơ để AI so sánh. Mục nội dung tương đồng chưa được cộng điểm.'}</p>
}

function VolunteerActivityMatch({ entry, limits }) {
  const activity = entry.activity
  const matched = new Set(entry.matched_skills || [])
  const skills = activity.skill_details || []
  const matchingSkills = skills.filter(skill => matched.has(skill.name))
  const otherSkills = skills.filter(skill => !matched.has(skill.name))
  return <ActionRow className="activity-card matching-card matching-activity-row vm-match-row" label={`Xem hoạt động ${activity.title}`}>
    <span className="matching-score">{entry.score}/100 điểm</span>
    <div className="matching-card-info">
      <h2><Link to={`/hoat-dong/${activity.id}`}>{activity.title}</Link></h2>
      <p className="vm-activity-meta">{activityTime(activity.starts_at)}{activity.address && <> · {activity.address}</>}</p>
      {!!matchingSkills.length && <div className="vm-skills-group">
        <p className="vm-skills-label">Kỹ năng khớp hồ sơ</p>
        <div className="activity-skill-tags vm-matched-skills" aria-label="Kỹ năng khớp hồ sơ">{matchingSkills.map(skill => <span key={skill.id}><Check size={14} aria-hidden="true" />{skill.name}</span>)}</div>
      </div>}
      {!!otherSkills.length && <div className="vm-skills-group">
        <p className="vm-skills-label">Kỹ năng khác của hoạt động</p>
        <div className="activity-skill-tags vm-other-skills" aria-label="Kỹ năng khác của hoạt động">{otherSkills.map(skill => <span key={skill.id}>{skill.name}</span>)}</div>
      </div>}
      <details className="vm-match-explanation" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
        <summary>Vì sao được gợi ý?<ChevronDown size={16} aria-hidden="true" /></summary>
        <div className="vm-match-explanation-content">
          {!!entry.reasons?.length && <ul>{entry.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}
          <ScoreBreakdown entry={entry} limits={limits} />
          <SemanticExplanation entry={entry} limits={limits} />
        </div>
      </details>
    </div>
    <div className="matching-card-actions"><Link data-row-primary data-row-keep-action className="button primary" to={`/hoat-dong/${activity.id}`}>Xem chi tiết</Link></div>
  </ActionRow>
}

function InviteButton({ activityId, volunteer, invitationStatus }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sentStatus, setSentStatus] = useState(null)
  const status = sentStatus || invitationStatus
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const result = await apiPost(`/organizer/activities/${activityId}/invitations/`, { volunteer: volunteer.id, message })
      setSentStatus(result.status); setOpen(false)
      setError(result.status !== 'pending' ? 'Lời mời này đã được xử lý trước đó; không gửi lại.' : '')
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }
  return <div className="matching-invite-action">{!open && error && <p role="alert">{error}</p>}{status ? <><p className="matching-invitation-status" role="status">{invitationLabels[status] || 'Đã gửi lời mời'}</p><Link className="button secondary" to={`/nha-to-chuc/hoat-dong/${activityId}/loi-moi`}>Xem lời mời</Link></> : <button className="button primary" onClick={() => setOpen(true)}>Gửi lời mời</button>}
    {open && <ConfirmationDialog title="Xác nhận gửi lời mời" busy={busy} onClose={() => setOpen(false)}><form className="matching-invitation-form" onSubmit={submit}>
    <p>Gửi lời mời cho {volunteer.full_name || volunteer.name}?</p>
    {error && <p role="alert">{error}</p>}
    <label>Lời nhắn (không bắt buộc)<textarea rows={4} value={message} maxLength={1000} onChange={event => setMessage(event.target.value)} disabled={busy} /></label>
    <p>Lời mời không giữ chỗ. Người nhận chấp nhận đúng hạn và còn chỗ sẽ được tự động duyệt.</p>
    <div className="activity-actions"><button className="button primary" disabled={busy}>Xác nhận gửi lời mời</button><button type="button" className="button secondary" disabled={busy} onClick={() => setOpen(false)}>Quay lại</button></div>
  </form></ConfirmationDialog>}</div>
}

export default function MatchingPage({ managed = false }) {
  const { id } = useParams()
  const [rulesOpen, setRulesOpen] = useState(false)
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const { data, loading, error, retry } = useApi(`${managed ? `/organizer/activities/${id}/matching/` : '/matching/activities/'}?page=${page}&page_size=12`)
  return <section className={`page-width section interior activity-page matching-page${managed ? ' organizer-matching-page' : ' volunteer-matching-page'}`}>

    <h1>{managed ? 'Tình nguyện viên phù hợp' : 'Hoạt động phù hợp'}</h1>

    {managed && <OrganizerActivityHeader id={id} selected="matching" />}
    <div className="matching-toolbar list-results-toolbar">
      {!managed ? <div className="vm-toolbar-actions"><Link className="button secondary" to="/ho-so">Cập nhật hồ sơ</Link>{data && <button type="button" className="button secondary" onClick={() => setRulesOpen(true)}>Quy tắc</button>}</div> : data && <button type="button" className="button secondary" onClick={() => setRulesOpen(true)}>Quy tắc</button>}
      <button type="button" className="button secondary refresh-button" disabled={loading} onClick={retry}>{loading ? 'Đang tải…' : 'Làm mới'}</button>
    </div>
    <RequestState loading={loading} error={error} retry={retry} />
    {data && <>
      <MatchingSource ai={data.ai} />
      <p className={!managed ? 'vm-results-count' : undefined}>{data.count} gợi ý có ít nhất một tiêu chí phù hợp.</p>
      {rulesOpen && <ConfirmationDialog title="Quy tắc ghép nối" onClose={() => setRulesOpen(false)}>
        <p>{data.explanation}</p><p>{data.note}</p>
        {data.ai?.status === 'active' && <p className="matching-model-note">{data.ai.model === 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2' ? 'Mô hình: MiniLM đa ngôn ngữ (L12-v2), chạy trên máy chủ V-Connect.' : 'AI đa ngôn ngữ chạy trên máy chủ V-Connect.'}</p>}
        <button type="button" className="button secondary" onClick={() => setRulesOpen(false)}>Đóng</button>
      </ConfirmationDialog>}

      {!data.count && (managed ? <p className="activity-empty">Chưa có gợi ý phù hợp. Người tham gia cần bật cho phép được gợi ý và có hồ sơ phù hợp. Kiểm tra trạng thái, thời gian và số chỗ còn lại của hoạt động.</p> : <div className="activity-empty vm-empty-state"><h2>Chưa có gợi ý phù hợp</h2><p>Bổ sung kỹ năng, sở thích và lịch rảnh trong hồ sơ để cải thiện gợi ý. Bạn vẫn có thể khám phá các hoạt động công khai.</p><Link className="button primary" to="/hoat-dong">Khám phá hoạt động</Link></div>)}
      <div className={`activity-grid${managed ? ' organizer-matching-list' : ' matching-activity-list'}`}>{data.results.map(entry => !managed ? <VolunteerActivityMatch key={entry.activity.id} entry={entry} limits={data.component_limits} /> : <ActionRow className="activity-card matching-card organizer-matching-row" key={`${id}-${entry.volunteer.id}`}>
        <span className="matching-score">{entry.score}/100 điểm</span>
        <div className="matching-card-info">
        <h2>{entry.volunteer.full_name}</h2>
        {managed && entry.matched_skills?.length > 0 && <div className="activity-skill-tags" aria-label="Kỹ năng phù hợp">
          {entry.matched_skills.map(skill => <span key={skill}>{skill}</span>)}
        </div>}
        </div>
        <div className="matching-card-actions">
        {managed && <RecordDetails title={entry.volunteer.full_name}><ul>{entry.reasons?.map(reason => <li key={reason}>{reason}</li>)}</ul>
        {!!entry.matched_skills?.length && <p>Kỹ năng phù hợp: {entry.matched_skills.join(', ')}.</p>}
        <ScoreBreakdown entry={entry} limits={data.component_limits} />
        <SemanticExplanation entry={entry} limits={data.component_limits} />
        </RecordDetails>}
        {managed && <InviteButton activityId={id} volunteer={entry.volunteer} invitationStatus={entry.invitation_status} />}
        </div>
      </ActionRow>)}</div>
      <ReportPagination data={data} page={page} onPage={value => setParams({ page: String(value) })} />
    </>}
    {managed && <p><Link className="button secondary arrow-link-button" to={`/nha-to-chuc/hoat-dong/${id}/dang-ky`}>Xem và xét duyệt người đã đăng ký</Link></p>}
  </section>
}
