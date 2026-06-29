/**
 * WebSocket 协作服务
 */
type MessageHandler = (data: Record<string, unknown>) => void

class CollaborationService {
  private ws: WebSocket | null = null
  private clientId = ''
  private handlers: Map<string, Set<MessageHandler>> = new Map()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private _onlineCount = 0
  private _connected = false
  private _onStatusChange: ((connected: boolean, count: number) => void) | null = null

  get connected() { return this._connected }
  get onlineCount() { return this._onlineCount }

  onStatusChange(fn: (connected: boolean, count: number) => void) {
    this._onStatusChange = fn
  }

  on(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set())
    this.handlers.get(type)!.add(handler)
    return () => this.handlers.get(type)?.delete(handler)
  }

  private emit(type: string, data: Record<string, unknown>) {
    this.handlers.get(type)?.forEach((fn) => fn(data))
  }

  connect() {
    if (this.ws) return

    this.clientId = `user-${crypto.randomUUID().slice(0, 8)}`
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host

    try {
      this.ws = new WebSocket(`${protocol}//${host}/ws/${this.clientId}`)

      this.ws.onopen = () => {
        this._connected = true
        this._onStatusChange?.(true, this._onlineCount)
        console.log('[WS] 已连接到协作服务器')
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          const type = data.type || 'unknown'
          if (type === 'user_joined' || type === 'user_left') {
            this._onlineCount = data.onlineCount || 0
            this._onStatusChange?.(this._connected, this._onlineCount)
          }
          this.emit(type, data)
        } catch {
          // ignore parse errors
        }
      }

      this.ws.onclose = () => {
        this._connected = false
        this._onStatusChange?.(false, this._onlineCount)
        console.log('[WS] 连接断开，3秒后重连...')
        this.scheduleReconnect()
      }

      this.ws.onerror = () => {
        this.ws?.close()
      }
    } catch {
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, 3000)
  }

  send(data: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
  }
}

export const collabService = new CollaborationService()
