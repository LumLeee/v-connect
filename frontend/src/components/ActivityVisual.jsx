import { HeartHandshake } from 'lucide-react'

export default function ActivityVisual({ id, large = false, children }) {
  const tone = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 3
  return <div className={`activity-visual tone-${tone}${large ? ' large' : ''}`}>
    <div className="activity-visual-art" aria-hidden="true"><span className="activity-orbit" /><HeartHandshake /><span className="activity-art-dot" /></div>
    <span className="activity-visual-caption" aria-hidden="true">KẾT NỐI ĐỂ SẺ CHIA</span>
    {children}
  </div>
}
