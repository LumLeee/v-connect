import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Award, Trophy, UserRound } from 'lucide-react'
import { useAuth } from '../auth/context.js'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import { activityTime } from '../api/activityFormat.js'
import '../styles/leaderboard.css'
import '../styles/admin-leaderboard.css'

function Avatar({ url }) {
  const [failed, setFailed] = useState(false)
  return <span className="lb-avatar">{url && !failed ? <img src={url} alt="" onError={() => setFailed(true)} /> : <UserRound size={22} aria-hidden="true" />}</span>
}

function Level({ level }) {
  return <span className={`lb-level lb-${level.key}`}><Award size={14} aria-hidden="true" />{level.name}</span>
}

function LevelGuide({ levels }) {
  return <><p>Mỗi hoạt động được chấm điểm nguyên 0–10. Tổng điểm cộng qua nhiều hoạt động để xác định cấp bậc.</p><ul>{levels.map(level => <li key={level.key}><Level level={level} /><span>{level.max_score == null ? `Từ ${level.min_score}` : `${level.min_score}–${level.max_score}`} điểm</span></li>)}</ul><p className="lb-privacy">Chỉ người đã đăng nhập xem được bảng. Không hiển thị email, số điện thoại hoặc hồ sơ riêng tư.</p></>
}

export default function LeaderboardPage() {
  const { user } = useAuth()
  const organizer = user.role === 'organizer'
  const volunteer = user.role === 'volunteer'
  const admin = user.role === 'admin'
  const { data, loading, error, retry } = useApi('/leaderboard/')
  return <section className={`page-width section interior lb-page${organizer ? ' lb-organizer' : ''}${volunteer ? ' lb-volunteer' : ''}${admin ? ' lb-admin' : ''}`}>
    <div className="lb-heading"><div>{!organizer && !volunteer && !admin && <p className="lb-eyebrow">DẤU ẤN ĐÓNG GÓP</p>}<h1><Trophy size={30} aria-hidden="true" />Bảng xếp hạng tình nguyện viên</h1>{admin && <p>Ghi nhận điểm đóng góp và cấp bậc trên toàn hệ thống.</p>}</div><button type="button" className="button secondary refresh-button" onClick={retry} disabled={loading}>Làm mới</button></div>
    <RequestState loading={loading} error={error} retry={retry} />
    {data && <>
      {data.me && !organizer && !admin && <article className="lb-personal" aria-label="Thứ hạng của tôi"><div className="lb-personal-main"><Avatar key={data.me.avatar_url} url={data.me.avatar_url} /><div><h2>{data.me.full_name}</h2><Level level={data.me.level} /></div></div>
        <div className="lb-personal-stats"><div><span>Tổng điểm đóng góp</span><strong>{data.me.total_score} điểm</strong></div><div><span>Thứ hạng toàn hệ thống</span><strong>{data.me.rank == null ? 'Chưa xếp hạng' : `#${data.me.rank}`}</strong></div></div>
        <div className="lb-progress"><div><p>{data.me.level.next_min_score == null ? 'Bạn đã đạt cấp bậc cao nhất. Cảm ơn bạn vì những đóng góp cho cộng đồng.' : `Còn ${data.me.level.next_min_score - data.me.total_score} điểm để đạt cấp ${data.me.level.next_name}.`}</p><progress max="100" value={data.me.level.progress} aria-label="Tiến độ cấp bậc" />{volunteer && data.me.rank != null && !data.results.some(entry => entry.is_me) && <p>Bạn không nằm trong danh sách 20 người bên dưới.</p>}</div><Link className="button secondary arrow-link-button" to="/tinh-nguyen-vien/dong-gop">Xem điểm từng hoạt động</Link></div>
      </article>}
      <div className="lb-content">{organizer && <details className="lb-levels lb-levels-collapsible"><summary>Cấp bậc</summary><LevelGuide levels={data.levels} /></details>}<section className="lb-board" aria-labelledby="lb-top-title"><div className="lb-board-heading"><h2 id="lb-top-title">Top 20 đóng góp</h2><span>{organizer || volunteer || admin ? `${data.results.length} tình nguyện viên` : `${data.results.length}/20 người`}</span></div>
        {(organizer || volunteer || admin) && data.results.length > 0 && <div className="lb-column-labels" aria-hidden="true"><span>Hạng</span><span>Tình nguyện viên</span><span>Điểm</span><span>Cấp bậc</span></div>}
        {!data.results.length ? <p className="lb-empty">Chưa có tình nguyện viên có điểm đóng góp để xếp hạng. Điểm sẽ xuất hiện sau khi Nhà tổ chức chấm cho hoạt động đủ điều kiện.</p> : <ol className="lb-list">{data.results.map((entry, index) => <li key={index} className={`lb-row${entry.is_me ? ' lb-me' : ''}`}>
          <span className={`lb-rank${entry.rank <= 3 ? ' lb-podium' : ''}`} aria-label={`Hạng ${entry.rank}`}>#{entry.rank}</span><Avatar key={entry.avatar_url} url={entry.avatar_url} /><div className="lb-name"><strong>{entry.full_name}{entry.is_me && <span className="lb-you">Bạn</span>}</strong>{!organizer && !volunteer && !admin && <Level level={entry.level} />}</div><span className="lb-score"><strong>{entry.total_score}</strong><span>điểm</span></span>{(organizer || volunteer || admin) && <Level level={entry.level} />}
        </li>)}</ol>}
        <p className="lb-updated">Cập nhật lúc {admin && (!data.updated_at || !Number.isFinite(Date.parse(data.updated_at))) ? 'chưa có thông tin' : <time dateTime={data.updated_at} title={new Date(data.updated_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}>{activityTime(data.updated_at)}</time>}{!volunteer && '. Điểm/cấp bậc được tính lại khi tải trang hoặc bấm Làm mới.'}</p>
      </section>{volunteer ? <details className="lb-levels lb-volunteer-rules"><summary>Cách tính điểm và cấp bậc</summary><LevelGuide levels={data.levels} /></details> : admin ? <details className="lb-levels lb-admin-rules"><summary>Quy tắc xếp hạng và cấp bậc</summary><p>Người bằng điểm có cùng thứ hạng. Danh sách hiển thị tối đa 20 tình nguyện viên.</p><LevelGuide levels={data.levels} /></details> : !organizer && <aside className="lb-levels" aria-labelledby="lb-levels-title"><h2 id="lb-levels-title">Các cấp bậc đóng góp</h2><LevelGuide levels={data.levels} /></aside>}</div>
    </>}
  </section>
}
