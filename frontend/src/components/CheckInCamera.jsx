import { useEffect, useRef, useState } from 'react'

export default function CheckInCamera({ onRead, onClose }) {
  const video = useRef(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let disposed = false
    let scanner
    async function start() {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('camera_unavailable')
        const { default: QrScanner } = await import('qr-scanner')
        if (disposed) return
        scanner = new QrScanner(video.current, result => { if (!disposed) onRead(result.data) },
          { preferredCamera: 'environment', returnDetailedScanResult: true, maxScansPerSecond: 5, onDecodeError: () => {} })
        await scanner.start()
        if (disposed) scanner.destroy()
      } catch {
        scanner?.destroy()
        if (!disposed) setError('Không mở được camera. Hãy kiểm tra quyền camera, dùng HTTPS hoặc localhost; bạn cũng có thể nhập mã hoặc chọn ảnh QR.')
      }
    }
    start()
    return () => { disposed = true; scanner?.destroy() }
  }, [onRead])
  return <div className="checkin-camera">
    <video ref={video} autoPlay playsInline muted aria-label="Camera quét QR" />
    {error && <p className="request-error" role="alert">{error}</p>}
    <button type="button" className="button secondary" onClick={onClose}>Tắt camera</button>
  </div>
}
