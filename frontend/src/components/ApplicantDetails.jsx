import useApi from '../hooks/useApi.js'
import RequestState from './RequestState.jsx'

export default function ApplicantDetails({ activityId, entryId }) {
  const { data, loading, error, retry } = useApi(`/organizer/activities/${activityId}/applicants/${entryId}/`)
  return <>
    <RequestState loading={loading} error={error} retry={retry} />
    {data && <>
      <p><strong>Họ tên:</strong> {data.volunteer_name}</p>
      <p><strong>Email:</strong> {data.volunteer_email || 'Chưa cung cấp'}</p>
      <p><strong>Số điện thoại:</strong> {data.volunteer_phone || 'Chưa cung cấp'}</p>
      <p><strong>Giới thiệu:</strong> {data.volunteer_bio || 'Chưa cung cấp'}</p>
      <p><strong>Kỹ năng:</strong> {data.skills.length ? data.skills.join(', ') : 'Chưa bổ sung'}</p>
      <p><strong>Sở thích:</strong> {data.interests.length ? data.interests.join(', ') : 'Chưa bổ sung'}</p>
    </>}
  </>
}
