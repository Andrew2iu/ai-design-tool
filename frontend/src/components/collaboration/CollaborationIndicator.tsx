import { useEffect, useState } from 'react'
import { Users, Wifi, WifiOff } from 'lucide-react'
import { collabService } from '../../services/collaboration'

export default function CollaborationIndicator() {
  const [connected, setConnected] = useState(false)
  const [onlineCount, setOnlineCount] = useState(0)

  useEffect(() => {
    collabService.onStatusChange((conn, count) => {
      setConnected(conn)
      setOnlineCount(count)
    })
    // 避免重复连接：仅在服务未连接时发起
    if (!(collabService as any).isConnected?.()) {
      collabService.connect()
    }
    return () => {
      collabService.disconnect()
    }
  }, [])

  const displayCount = Math.max(onlineCount, connected ? 1 : 0)

  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs"
      style={{
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border-light)',
        color: 'var(--color-text-muted)',
      }}
    >
      {connected ? (
        <Wifi size={11} style={{ color: '#16a34a' }} />
      ) : (
        <WifiOff size={11} style={{ color: 'var(--color-text-muted)' }} />
      )}
      <Users size={11} />
      <span>{displayCount}</span>
    </div>
  )
}
