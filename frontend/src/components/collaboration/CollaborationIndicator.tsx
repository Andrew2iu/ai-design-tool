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
    collabService.connect()
    return () => collabService.disconnect()
  }, [])

  return (
    <div className="flex items-center gap-2 px-2.5 py-1 bg-gray-50 rounded-lg text-xs text-gray-500">
      {connected ? (
        <Wifi size={12} className="text-green-500" />
      ) : (
        <WifiOff size={12} className="text-gray-400" />
      )}
      <Users size={12} />
      <span>{Math.max(onlineCount, connected ? 1 : 0)}</span>
    </div>
  )
}
