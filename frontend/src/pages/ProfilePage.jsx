import { useSearchParams } from 'react-router-dom'
import ApplicantProfilePage from './ApplicantProfilePage.jsx'
import { useAuth } from '../auth/context.js'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import ProfileEditor from '../components/ProfileEditor.jsx'
import '../styles/profile.css'

function ProfileContent() {
  const { data, loading, error, retry } = useApi('/auth/profile/')
  return <section className="page-width section interior profile-page">
    <p className="eyebrow">TÀI KHOẢN CỦA BẠN</p><h1>Hồ sơ của tôi</h1>

    <RequestState loading={loading} error={error} retry={retry} />
    {data && <ProfileEditor key={data.profile.id} initial={data.profile} />}
  </section>
}

export default function ProfilePage() {
  const { user } = useAuth()
  const [params] = useSearchParams()
  if (params.has('hoat-dong') || params.has('ung-vien')) {
    if (user.role !== 'organizer' || !params.get('hoat-dong') || !params.get('ung-vien')) {
      return <section className="page-width section interior profile-page"><p role="alert">Không thể truy cập hồ sơ ứng viên này.</p></section>
    }
    return <ApplicantProfilePage activityId={params.get('hoat-dong')} applicantId={params.get('ung-vien')} />
  }
  return <ProfileContent key={user.id} />
}
