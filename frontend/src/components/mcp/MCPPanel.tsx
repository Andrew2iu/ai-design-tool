import { useEffect, useRef, useState } from 'react'
import { Bot, Play, RefreshCw, Terminal, Loader2, Zap } from 'lucide-react'

interface MCPResponse {
  jsonrpc: '2.0'
  id?: number
  result?: Record<string, unknown>
  error?: { code: number; message: string }
}

export default function MCPPanel() {
  const [connected, setConnected] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [tools, setTools] = useState<string[]>([])
  const [logs, setLogs] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const pendingRef = useRef<Map<number, (value: MCPResponse | null) => void>>(new Map())
  const idRef = useRef(1)
  const logsEndRef = useRef<HTMLDivElement>(null)

  const log = (msg: string) => setLogs((prev) => [...prev.slice(-50), `> ${msg}`])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  useEffect(() => {
    // 避免重复连接：仅在未连接时自动初始化
    if (!eventSourceRef.current) {
      connect()
    }
    return () => {
      eventSourceRef.current?.close()
      eventSourceRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const connect = () => {
    // 关闭旧连接
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setConnected(false)
    setSessionId(null)
    log('正在连接 SSE...')
    const es = new EventSource('/mcp/sse')
    eventSourceRef.current = es

    es.onopen = () => {
      setConnected(true)
      log('SSE 连接已建立')
    }
    es.onerror = () => {
      setConnected(false)
      log('SSE 连接断开')
    }
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as Record<string, unknown>
        if (data.endpoint) {
          const url = new URL(data.endpoint as string, window.location.origin)
          const sid = url.searchParams.get('sessionId')
          setSessionId(sid)
          log(`sessionId: ${sid?.slice(0, 8)}...`)
          return
        }
        const res = data as unknown as MCPResponse
        if (res.id !== undefined && pendingRef.current.has(res.id)) {
          pendingRef.current.get(res.id)!(res)
          pendingRef.current.delete(res.id)
        }
      } catch {
        log('收到无法解析的消息')
      }
    }
  }

  const request = async (method: string, params?: Record<string, unknown>): Promise<MCPResponse | null> => {
    if (!sessionId) {
      log('尚未建立 session，请先连接')
      return null
    }
    const id = idRef.current++
    const body = { jsonrpc: '2.0', id, method, params }
    setLoading(true)
    try {
      const res = await fetch(`/mcp/messages?sessionId=${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return new Promise((resolve) => {
        pendingRef.current.set(id, resolve)
        setTimeout(() => {
          if (pendingRef.current.has(id)) {
            pendingRef.current.delete(id)
            resolve(null)
            log(`请求 ${id} 超时`)
          }
        }, 10000)
      })
    } catch (err) {
      log(`请求失败: ${(err as Error).message}`)
      return null
    } finally {
      setLoading(false)
    }
  }

  const listTools = async () => {
    const res = await request('tools/list')
    if (res?.result?.tools) {
      const names = (res.result.tools as { name: string }[]).map((t) => t.name)
      setTools(names)
      log(`已加载 ${names.length} 个工具: ${names.join(', ')}`)
    }
  }

  const callTool = async (name: string, args?: Record<string, unknown>) => {
    const res = await request('tools/call', { name, arguments: args })
    if (res?.result?.content) {
      const text = (res.result.content as { text: string }[]).map((c) => c.text).join('\n')
      log(`${name}:\n${text.slice(0, 300)}${text.length > 300 ? '...' : ''}`)
    } else if (res?.error) {
      log(`${name} 错误: ${res.error.message}`)
    }
  }

  const actions = [
    { label: '获取设计上下文', tool: 'get_design_context' },
    { label: '提取 Design Tokens', tool: 'extract_design_tokens' },
    { label: '生成 React 组件代码', tool: 'generate_component_code', args: { framework: 'react' }, full: true },
  ]

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-bg-elevated)' }}>
      {/* 头部 */}
      <div
        className="px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-border-light)' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--color-brand-light)' }}
          >
            <Bot size={14} style={{ color: 'var(--color-brand)' }} />
          </div>
          <div>
            <h3 className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              MCP 智能体
            </h3>
            <p className="text-[11px] flex items-center gap-1" style={{ color: connected ? '#16a34a' : 'var(--color-text-muted)' }}>
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: connected ? '#16a34a' : 'var(--color-text-muted)' }}
              />
              {connected ? '已连接' : '未连接'}
              {sessionId && ` · ${sessionId.slice(0, 8)}...`}
            </p>
          </div>
        </div>
      </div>

      {/* 控制按钮 */}
      <div
        className="p-3 flex-shrink-0 space-y-2"
        style={{ borderBottom: '1px solid var(--color-border-light)' }}
      >
        <div className="flex gap-2">
          <button
            onClick={connect}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-lg transition-all disabled:opacity-50 font-medium"
            style={{
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <RefreshCw size={11} />
            重新连接
          </button>
          <button
            onClick={listTools}
            disabled={loading || !connected}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-lg transition-all disabled:opacity-50 font-medium"
            style={{
              background: 'var(--color-brand-light)',
              border: '1px solid var(--color-brand-mid)',
              color: 'var(--color-brand)',
            }}
          >
            <Terminal size={11} />
            列出工具
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {actions.map((action) => (
            <button
              key={action.tool}
              onClick={() => callTool(action.tool, action.args)}
              disabled={loading || !connected}
              className={`${action.full ? 'col-span-2' : ''} flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-lg transition-all disabled:opacity-50 font-medium`}
              style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
              }}
              onMouseEnter={(e) => {
                if (!loading && connected) {
                  const el = e.currentTarget
                  el.style.borderColor = 'var(--color-brand-mid)'
                  el.style.color = 'var(--color-brand)'
                }
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget
                el.style.borderColor = 'var(--color-border)'
                el.style.color = 'var(--color-text-secondary)'
              }}
            >
              <Zap size={11} />
              {action.label}
            </button>
          ))}
        </div>

        {tools.length > 0 && (
          <div
            className="text-[11px] px-2 py-1.5 rounded-lg"
            style={{
              background: 'var(--color-bg)',
              color: 'var(--color-text-muted)',
              border: '1px solid var(--color-border-light)',
            }}
          >
            可用工具: {tools.join(', ')}
          </div>
        )}
      </div>

      {/* 日志区域 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-0.5" style={{ background: 'var(--color-bg)' }}>
        {loading && (
          <div className="flex items-center gap-2 py-2" style={{ color: 'var(--color-text-muted)' }}>
            <Loader2 size={11} className="animate-spin" style={{ color: 'var(--color-brand)' }} />
            <span className="text-xs">请求中...</span>
          </div>
        )}
        {logs.length === 0 ? (
          <div className="text-xs text-center py-6" style={{ color: 'var(--color-text-muted)' }}>
            点击上方按钮与 MCP Server 交互
          </div>
        ) : (
          logs.map((l, i) => (
            <div
              key={i}
              className="text-[11px] font-mono whitespace-pre-wrap break-words leading-relaxed py-0.5"
              style={{ color: l.includes('错误') ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}
            >
              {l}
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  )
}
