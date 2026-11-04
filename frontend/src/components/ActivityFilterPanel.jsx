import { ChevronDown, SlidersHorizontal } from 'lucide-react'

export default function ActivityFilterPanel({ children }) {
  return <details className="activity-filter-panel">
    <summary className="button secondary">
      <SlidersHorizontal size={18} aria-hidden="true" />
      <span className="filter-show-label">Tìm và lọc hoạt động</span>
      <span className="filter-hide-label">Ẩn tìm kiếm và bộ lọc</span>
      <ChevronDown className="filter-toggle-icon" size={18} aria-hidden="true" />
    </summary>
    {children}
  </details>
}
