import ConfirmationDialog from './ConfirmationDialog.jsx'
import RequestState from './RequestState.jsx'
import useSkillCatalog from '../hooks/useSkillCatalog.js'
import { useAuth } from '../auth/context.js'
import { PublicActivityDetail } from '../pages/ActivityDetailPage.jsx'

export default function ActivityPreviewDialog({ value, initial, onClose }) {
  const { user } = useAuth()
  const skills = useSkillCatalog()
  const activity = {
    ...initial, ...value, id: initial?.id || 'activity-preview', status: initial?.status || 'draft',
    title: value.title.trim(), description: value.description.trim(), address: value.address.trim(),
    organizer_name: initial?.organizer_name || user.full_name, approved_count: initial?.approved_count || 0,
    skill_details: skills.data.filter(skill => value.required_skills.includes(skill.id)),
    timeline: [...value.timeline].sort((left, right) => left.starts_at.localeCompare(right.starts_at)),
  }
  return <ConfirmationDialog title="Xem trước hoạt động" className="activity-preview-dialog" onClose={onClose}>
    <p className="activity-preview-note" role="note">Đây là nội dung bạn đang nhập. Thay đổi chỉ được lưu khi bạn nhấn nút Lưu.</p>
    {value.required_skills.length > 0 && <RequestState loading={skills.loading} error={skills.error} retry={skills.retry} />}
    <div className="activity-public-detail activity-preview-content"><PublicActivityDetail activity={activity} preview /></div>
    <div className="activity-preview-actions"><button type="button" className="button secondary" onClick={onClose}>Tiếp tục chỉnh sửa</button></div>
  </ConfirmationDialog>
}
