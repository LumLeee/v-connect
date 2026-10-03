import { HeartHandshake } from 'lucide-react'
import { useState } from 'react'

export default function ActivityVisual({ id, coverUrl, large = false, children }) {
  const [failedUrl, setFailedUrl] = useState(null)
  const tone = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 3
  return <div className={`activity-visual tone-${tone}${large ? ' large' : ''}`}>
    {coverUrl && failedUrl !== coverUrl ? <img className="activity-cover-image" src={coverUrl} alt="Ảnh bìa hoạt động" onError={() => setFailedUrl(coverUrl)} /> : <>
      <div className="activity-visual-art" aria-hidden="true"><span className="activity-orbit" /><HeartHandshake /><span className="activity-art-dot" /></div>
      <span className="activity-visual-caption" aria-hidden="true">KẾT NỐI ĐỂ SẺ CHIA</span>
    </>}
    {children}
  </div>
}
