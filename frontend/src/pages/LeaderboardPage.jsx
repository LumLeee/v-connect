import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Award, Trophy, UserRound } from 'lucide-react'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import { activityTime } from '../api/activityFormat.js'
import '../styles/leaderboard.css'

function Avatar({ url }) {
  const [failed, setFailed] = useState(false)
  return <span className="lb-avatar">{url && !failed ? <img src={url} alt="" onError={() => setFailed(true)} /> : <UserRound size={22} aria-hidden="true" />}</span>
}

function Level({ level }) {
  return <span className={`lb-level lb-${level.key}`}><Award size={14} aria-hidden="true" />{level.name}</span>
}

export default function LeaderboardPage() {
  const { data, loading, error, retry } = useApi('/leaderboard/')
  return <section className="page-width section interior lb-page">
    <div className="lb-heading"><div><p className="lb-eyebrow">DẤU ẤN ĐÓNG GÓP</p><h1><Trophy size={30} aria-hidden="true" />Bảng xếp hạng tình nguyện viên</h1><p>Top 20 theo tổng điểm tích lũy toàn thời gian do Nhà tổ chức chấm.</p></div><button className="button secondary" onClick={retry} disabled={loading}>Cập nhật bảng xếp hạng</button></div>
    <p className="lb-rule">Chỉ tính hoạt động Hoàn thành, {data?.time_checks_disabled ? 'đang tạm bỏ điều kiện giờ kết thúc, ' : 'đã kết thúc, '}có điểm danh và đăng ký Được duyệt. Tài khoản đang hoạt động có tổng điểm lớn hơn 0 mới được xếp hạng. Bằng điểm cùng hạng (1, 1, 3); danh sách tối đa 20 người, thứ tự khi bằng điểm dùng ngày tham gia rồi mã tài khoản.</p>
    <RequestState loading={loading} error={error} retry={retry} />
    {data && <>
      {data.me && <article className="lb-personal" aria-label="Thứ hạng của tôi"><div className="lb-personal-main"><Avatar key={data.me.avatar_url} url={data.me.avatar_url} /><div><p className="lb-eyebrow">HÀNH TRÌNH CỦA BẠN</p><h2>{data.me.full_name}</h2><Level level={data.me.level} /></div></div>
        <div className="lb-personal-stats"><div><span>Tổng điểm đóng góp</span><strong>{data.me.total_score} điểm</strong></div><div><span>Thứ hạng toàn hệ thống</span><strong>{data.me.rank == null ? 'Chưa xếp hạng' : `#${data.me.rank}`}</strong></div></div>
        <div className="lb-progress"><p>{data.me.level.next_min_score == null ? 'Bạn đã đạt cấp bậc cao nhất. Cảm ơn bạn vì những đóng góp cho cộng đồng.' : `Còn ${data.me.level.next_min_score - data.me.total_score} điểm để đạt cấp ${data.me.level.next_name}.`}</p><progress max="100" value={data.me.level.progress} aria-label="Tiến độ cấp bậc" /><Link to="/tinh-nguyen-vien/dong-gop">Xem điểm từng hoạt động →</Link></div>
      </article>}
      <div className="lb-content"><section className="lb-board" aria-labelledby="lb-top-title"><div className="lb-board-heading"><h2 id="lb-top-title">Top 20 đóng góp</h2><span>{data.results.length}/20 người</span></div>
        {!data.results.length ? <p className="lb-empty">Chưa có tình nguyện viên có điểm đóng góp để xếp hạng. Điểm sẽ xuất hiện sau khi Nhà tổ chức chấm cho hoạt động đủ điều kiện.</p> : <ol className="lb-list">{data.results.map((entry, index) => <li key={index} className={`lb-row${entry.is_me ? ' lb-me' : ''}`}>
          <span className={`lb-rank${entry.rank <= 3 ? ' lb-podium' : ''}`} aria-label={`Hạng ${entry.rank}`}>#{entry.rank}</span><Avatar key={entry.avatar_url} url={entry.avatar_url} /><div className="lb-name"><strong>{entry.full_name}{entry.is_me && <span className="lb-you">Bạn</span>}</strong><Level level={entry.level} /></div><span className="lb-score"><strong>{entry.total_score}</strong><span>điểm</span></span>
        </li>)}</ol>}
        <p className="lb-updated">Cập nhật lúc {activityTime(data.updated_at)} (giờ Việt Nam). Điểm/cấp bậc được tính lại khi tải trang hoặc bấm cập nhật.</p>
      </section><aside className="lb-levels" aria-labelledby="lb-levels-title"><h2 id="lb-levels-title">Các cấp bậc đóng góp</h2><p>Mỗi hoạt động được chấm điểm nguyên 0–10. Tổng điểm cộng qua nhiều hoạt động để xác định cấp bậc.</p><ul>{data.levels.map(level => <li key={level.key}><Level level={level} /><span>{level.max_score == null ? `Từ ${level.min_score}` : `${level.min_score}–${level.max_score}`} điểm</span></li>)}</ul><p className="lb-privacy">Chỉ người đã đăng nhập xem được bảng. Không hiển thị email, số điện thoại hoặc hồ sơ riêng tư.</p></aside></div>
    </>}
  </section>
}
