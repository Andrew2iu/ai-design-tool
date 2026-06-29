import { useEffect, useRef, useState } from 'react'
import { Bot, Play, RefreshCw, Terminal, Loader2 } from 'lucide-react'

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

  const log = (msg: string) => setLogs((prev) => [...prev.slice(-20), `> ${msg}`])

  useEffect(() => {
    connect()
    return () => {
      eventSourceRef.current?.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const connect = () => {
    eventSourceRef.current?.close()
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
      log('SSE 连接错误')
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
      log('尚未建立 session')
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
    setLoading(true)
    const res = await request('tools/call', { name, arguments: args })
    setLoading(false)
    if (res?.result?.content) {
      const text = (res.result.content as { text: string }[]).map((c) => c.text).join('\n')
      log(`${name} 结果:\n${text.slice(0, 300)}${text.length > 300 ? '...' : ''}`)
    } else if (res?.error) {
      log(`${name} 错误: ${res.error.message}`)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-brand-600" />
          <h3 className="text-sm font-medium text-gray-700">MCP 智能体</h3>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          {connected ? '✅ 已连接' : '❌ 未连接'}
          {sessionId && ` · ${sessionId.slice(0, 8)}...`}
        </p>
      </div>

      <div className="p-3 border-b border-gray-100 space-y-2">
        <div className="flex gap-2">
          <button
            onClick={connect}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} />
            重新连接
          </button>
          <button
            onClick={listTools}
            disabled={loading || !connected}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-brand-50 text-brand-600 rounded-lg hover:bg-brand-100 transition-colors disabled:opacity-50"
          >
            <Terminal size={12} />
            列出工具
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => callTool('get_design_context')}
            disabled={loading || !connected}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-white border border-gray-200 text-gray-700 rounded-lg hover:border-brand-300 hover:text-brand-600 transition-colors disabled:opacity-50"
          >
            <Play size={12} />
            获取设计上下文
          </button>
          <button
            onClick={() => callTool('extract_design_tokens')}
            disabled={loading || !connected}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-white border border-gray-200 text-gray-700 rounded-lg hover:border-brand-300 hover:text-brand-600 transition-colors disabled:opacity-50"
          >
            <Play size={12} />
            提取 Design Tokens
          </button>
          <button
            onClick={() => callTool('generate_component_code', { framework: 'react' })}
            disabled={loading || !connected}
            className="col-span-2 flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-white border border-gray-200 text-gray-700 rounded-lg hover:border-brand-300 hover:text-brand-600 transition-colors disabled:opacity-50"
          >
            <Play size={12} />
            生成 React 组件代码
          </button>
        </div>

        {tools.length > 0 && (
          <div className="text-xs text-gray-500">
            可用工具: {tools.join(', ')}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 bg-gray-50 text-xs font-mono space-y-1">
        {loading && (
          <div className="flex items-center gap-2 text-gray-400 py-2">
            <Loader2 size={12} className="animate-spin" />
            请求中...
          </div>
        )}
        {logs.length === 0 ? (
          <div className="text-gray-400 py-4 text-center">点击上方按钮与 MCP Server 交互</div>
        ) : (
          logs.map((l, i) => (
            <div key={i} className="text-gray-700 whitespace-pre-wrap break-words leading-relaxed">
              {l}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
