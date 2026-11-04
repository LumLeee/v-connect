import { Link, useParams } from 'react-router-dom'
import ProfileEditor from '../components/ProfileEditor.jsx'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import '../styles/profile.css'

export default function ApplicantProfilePage({ activityId, applicantId }) {
  const params = useParams()
  const id = activityId || params.id
  const entryId = applicantId || params.entryId
  const { data, loading, error, retry } = useApi(`/organizer/activities/${id}/applicants/${entryId}/`)
  return <section className="page-width section interior profile-page">
    <p className="eyebrow">HỒ SƠ ỨNG VIÊN · CHỈ XEM</p>
    <div className="applicant-profile-heading">
      <h1>Hồ sơ ứng viên</h1>
      <Link to={`/nha-to-chuc/hoat-dong/${id}/dang-ky`} className="button secondary">Về danh sách đăng ký</Link>
    </div>
    <RequestState loading={loading} error={error} retry={retry} />
    {data && <ProfileEditor key={`${id}-${entryId}`} initial={data.profile} readOnly />}
  </section>
}
