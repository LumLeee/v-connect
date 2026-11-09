import { useId, useRef, useState } from 'react'
import { ClipboardPaste } from 'lucide-react'
import '../styles/image-paste.css'

const supportedTypes = ['image/png', 'image/jpeg', 'image/webp']

export default function ImagePasteInput({ onImage, disabled = false, label = 'Dán ảnh', compact = false, groupLabel = 'Tải ảnh bìa', children, actions }) {
  const [error, setError] = useState('')
  const pasteTarget = useRef(null)
  const hintId = useId()
  async function accept(file) {
    if (disabled || !file) return
    setError('')
    if (!supportedTypes.includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('Chỉ nhận ảnh PNG, JPEG hoặc WebP không quá 5 MB.')
      return
    }
    await onImage(file)
  }
  function paste(event) {
    if (disabled) return
    const files = [...(event.clipboardData?.files || []), ...[...(event.clipboardData?.items || [])].filter(item => item.kind === 'file').map(item => item.getAsFile()).filter(Boolean)]
    const file = files.find(file => supportedTypes.includes(file.type)) || files.find(file => file.type.startsWith('image/'))
    if (!file) { setError('Chưa nhận được ảnh. Hãy sao chép hình ảnh rồi nhấn Ctrl+V, hoặc chọn file ảnh.'); return }
    event.preventDefault()
    void accept(file)
  }
  function fallback() {
    setError('Nhấn Ctrl+V để dán ảnh đã sao chép, hoặc dùng nút Chọn ảnh.')
    pasteTarget.current?.focus({ preventScroll: true })
  }
  async function readClipboard() {
    if (disabled) return
    setError('')
    try {
      if (!navigator.clipboard?.read) throw new Error('Clipboard unavailable')
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const type = supportedTypes.find(type => item.types.includes(type))
        if (type) {
          const blob = await item.getType(type)
          await accept(new File([blob], `pasted-image.${type.split('/')[1]}`, { type }))
          return
        }
      }
      fallback()
    } catch {
      fallback()
    }
  }
  return <div className={`image-paste-input${compact ? ' image-paste-compact' : ''}`} onPaste={paste}
    ref={compact ? pasteTarget : undefined} tabIndex={compact && !disabled ? 0 : undefined}
    role={compact ? 'group' : undefined} aria-disabled={compact ? disabled : undefined} aria-label={compact ? groupLabel : undefined} aria-describedby={compact ? hintId : undefined}>
    <div className="image-paste-actions">
    {children}
    <button type="button" className="button secondary image-paste-button" disabled={disabled} onClick={readClipboard}><ClipboardPaste size={17} aria-hidden="true" />{label}</button>
    {actions}
    </div>
    {compact ? <p id={hintId} className="image-paste-hint">JPG, PNG, WebP · Tối đa 5 MB · Ctrl+V để dán ảnh</p> : <div ref={pasteTarget} className="image-paste-zone" role="group" tabIndex={disabled ? -1 : 0} aria-label={label} aria-disabled={disabled} aria-describedby={hintId}>
      <span id={hintId}>Nhấn vào đây rồi Ctrl+V hoặc ⌘V để dán ảnh đã sao chép.</span>
    </div>}
    {error && <p className="field-error" role="alert">{error}</p>}
  </div>
}
