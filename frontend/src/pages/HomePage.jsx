import { ArrowRight, Heart, Sprout, Users, CalendarCheck, HandHeart, Compass } from 'lucide-react'
import { Link } from 'react-router-dom'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'

const steps = [
  { icon: Compass, number: '01', title: 'Tìm điều bạn quan tâm', text: 'Khám phá những hoạt động phù hợp với kỹ năng, sở thích và thời gian của bạn.' },
  { icon: Users, number: '02', title: 'Cùng nhau tham gia', text: 'Kết nối với nhà tổ chức và những người cùng mong muốn đóng góp cho cộng đồng.' },
  { icon: CalendarCheck, number: '03', title: 'Ghi lại hành trình', text: 'Theo dõi hoạt động, chia sẻ trải nghiệm và nhìn lại những đóng góp của mình.' },
]

export default function HomePage() {
  const { data, loading, error, retry } = useApi('/skills/')
  return (
    <>
      <section className="hero page-width">
        <div className="hero-copy">
          <div className="eyebrow"><span />BẮT ĐẦU TỪ MỘT ĐIỀU TỬ TẾ</div>
          <h1>Một chút thời gian.<br />Một <em>đổi thay</em><br />cho cộng đồng.</h1>
          <p>Mỗi người đều có điều gì đó để sẻ chia. V-Connect giúp bạn tìm nơi để những kỹ năng và tấm lòng của mình trở nên có ích.</p>
          <Link className="button primary" to="/hoat-dong">Khám phá hoạt động <ArrowRight size={18} /></Link>
          <div className="hero-note"><Heart size={17} />Kết nối tình nguyện viên và nhà tổ chức</div>
        </div>
        <div className="hero-art" role="img" aria-label="Minh họa những bàn tay cùng nuôi dưỡng một mầm cây">
          <span className="art-grid" /><span className="art-orbit" />
          <div className="art-label"><span className="status-dot" />CÙNG LÀM ĐIỀU Ý NGHĨA</div>
          <div className="art-sun"><Heart size={31} fill="currentColor" /></div>
          <div className="plant"><Sprout strokeWidth={1.2} /></div>
          <div className="hand-base"><HandHeart strokeWidth={1} /></div>
          <div className="art-caption"><span>Từ những đóng góp nhỏ</span><strong>đến những giá trị lớn.</strong></div>
          <span className="art-spark spark-one">✦</span><span className="art-spark spark-two">✧</span>
        </div>
      </section>
      <section className="values-strip"><div className="page-width"><span><Sprout size={20} />Đóng góp bằng thế mạnh</span><span><Users size={20} />Kết nối cùng cộng đồng</span><span><Heart size={20} />Lan tỏa những điều tốt đẹp</span></div></section>
      <section className="page-width section" id="hanh-trinh">
        <div className="section-heading"><div><p className="eyebrow">HÀNH TRÌNH TÌNH NGUYỆN</p><h2>Từ sự quan tâm đến hành động.</h2></div><p>Những bước nhỏ để bắt đầu<br />một hành trình có ý nghĩa.</p></div>
        <div className="steps">{steps.map(({ icon: Icon, number, title, text }) => <article className="step" key={number}><div className="step-top"><Icon size={26} /><span>{number}</span></div><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>
      <section className="page-width section skills-section">
        <p className="eyebrow">BẠN CÓ THỂ ĐÓNG GÓP ĐIỀU GÌ?</p><h2>Mỗi kỹ năng đều có giá trị.</h2>
        <p className="muted">Một lời hướng dẫn, một tấm ảnh, hay khả năng kết nối mọi người.</p>
        <RequestState loading={loading} error={error} retry={retry} />
        {data && <div className="skill-tags">{data.results.map((skill) => <span key={skill.id}>{skill.name}</span>)}</div>}
        {data?.count === 0 && <p className="muted">Danh mục kỹ năng đang được chuẩn bị.</p>}
      </section>
      <section className="page-width project-note"><div><p className="eyebrow">CÙNG TẠO NÊN THAY ĐỔI</p><h2>Tìm một hoạt động để bắt đầu.</h2><p>Hoàn thiện hồ sơ, khám phá hoạt động và đăng ký tham gia. Bạn có thể theo dõi kết quả xét duyệt trong danh sách đăng ký của mình. Nhà tổ chức quản lý hoạt động và xét duyệt người tham gia.</p></div><Link to="/hoat-dong" className="button secondary">Xem hoạt động <ArrowRight size={18} /></Link></section>
    </>
  )
}
