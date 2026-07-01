import { useEffect, useRef, useState } from 'react'
import { Bot, Play, RefreshCw, Terminal, Loader2, Zap, Cpu } from 'lucide-react'

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
  const mcpPort = 3001 // SSE + POST 直连 MCP Server，不走 Vite 代理
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
    // SSE 连接直连 3001 端口，不走 Vite 代理（代理会丢失后续 SSE 事件）
    const es = new EventSource(`http://localhost:${mcpPort}/sse`)
    eventSourceRef.current = es

    es.onopen = () => {
      setConnected(true)
      log('SSE 连接已建立')
    }
    es.onerror = () => {
      setConnected(false)
      log('SSE 连接断开')
    }
    // MCP SDK 发送带 event: 类型标识的 SSE 事件
    // onmessage 只能捕获无 event: 标识的默认消息，所以必须用 addEventListener

    es.addEventListener('endpoint', (e) => {
      try {
        const data = JSON.parse(e.data) as Record<string, unknown>
        if (data.endpoint) {
          const url = new URL(data.endpoint as string, window.location.origin)
          const sid = url.searchParams.get('sessionId')
          setSessionId(sid)
          log(`sessionId: ${sid?.slice(0, 8)}...`)
        }
      } catch {
        // 有些实现直接传 endpoint URL 而不是 JSON
        const endpoint = e.data as string
        const url = new URL(endpoint, window.location.origin)
        const sid = url.searchParams.get('sessionId')
        if (sid) {
          setSessionId(sid)
          log(`sessionId: ${sid.slice(0, 8)}...`)
        }
      }
    })

    es.addEventListener('message', (e) => {
      const raw = e.data
      console.log('[MCP SSE] message event raw:', raw)
      try {
        const res = JSON.parse(raw) as unknown as MCPResponse
        // JSON-RPC id 可能是 string 或 number，统一用 String 比较
        const matchId = String(res.id)
        for (const [pid, resolve] of pendingRef.current.entries()) {
          if (String(pid) === matchId) {
            pendingRef.current.delete(pid)
            resolve(res)
            return
          }
        }
        console.log('[MCP SSE] unmatched response id:', res.id, 'pending ids:', [...pendingRef.current.keys()])
      } catch {
        log('收到无法解析的 message 事件')
      }
    })

    // 兜底：onmessage 捕获无 event: 标识的默认 SSE 事件
    es.onmessage = (e) => {
      const raw = e.data as string
      console.log('[MCP SSE] default event raw:', raw)
      try {
        const data = JSON.parse(raw) as Record<string, unknown>
        // 兼容某些实现直接在默认事件中传 endpoint
        if (data.endpoint) {
          const url = new URL(data.endpoint as string, window.location.origin)
          const sid = url.searchParams.get('sessionId')
          setSessionId(sid)
          log(`sessionId: ${sid?.slice(0, 8)}...`)
          return
        }
        const res = data as unknown as MCPResponse
        const matchId = String(res.id)
        for (const [pid, resolve] of pendingRef.current.entries()) {
          if (String(pid) === matchId) {
            pendingRef.current.delete(pid)
            resolve(res)
            return
          }
        }
      } catch {
        log('收到无法解析的默认事件')
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

    // 先注册 pending，再发 POST —— 防止 SSE 响应在 POST 返回前到达导致 miss
    const promise = new Promise<MCPResponse | null>((resolve) => {
      pendingRef.current.set(id, resolve)
      setTimeout(() => {
        if (pendingRef.current.has(id)) {
          pendingRef.current.delete(id)
          resolve(null)
          log(`请求 ${id} 超时`)
        }
      }, 15000)
    })

    setLoading(true)
    try {
      const res = await fetch(`http://localhost:${mcpPort}/messages?sessionId=${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        log(`POST 失败: HTTP ${res.status}`)
        pendingRef.current.delete(id)
        return null
      }
      log(`已发送 ${method} (id=${id})`)
    } catch (err) {
      log(`请求失败: ${(err as Error).message}`)
      pendingRef.current.delete(id)
      return null
    } finally {
      setLoading(false)
    }

    return promise
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
      const maxLen = (name === 'list_skills' || name === 'execute_skill') ? 800 : 400
      log(`${name}:\n${text.slice(0, maxLen)}${text.length > maxLen ? '...\n(完整内容见浏览器控制台)' : ''}`)
      // 输出完整内容到浏览器控制台便于演示时查看
      console.log(`[MCP] ${name} full response:`, text)
    } else if (res?.error) {
      log(`${name} 错误: ${res.error.message}`)
    }
  }

  const actions = [
    { label: '获取设计上下文', tool: 'get_design_context', desc: '从后端获取真实设计稿数据' },
    { label: '提取 Design Tokens', tool: 'extract_design_tokens', desc: '从设计稿提取色彩/字号等规范' },
    { label: '生成 React 组件代码', tool: 'generate_component_code', args: { framework: 'react' }, full: true, desc: '调用后端AI引擎生成代码' },
  ]

  const skillActions = [
    { label: '列出 Agent Skills', tool: 'list_skills', desc: '查看 Anima Skill E1~E5 能力等级', highlight: true },
    { label: '执行设计生成 (E1)', tool: 'execute_skill', args: { skill_name: 'design_generation', params: { prompt: '生成一个登录页面' } }, desc: 'Skill E1 - 基础执行' },
    { label: '执行规范检查 (E2)', tool: 'execute_skill', args: { skill_name: 'brand_consistency' }, desc: 'Skill E2 - 稳定执行' },
    { label: '执行设计感知 (E5)', tool: 'execute_skill', args: { skill_name: 'design_perception' }, desc: 'Anima 范式 - 最高等级', highlight: true },
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
              key={action.tool + (action.args ? JSON.stringify(action.args) : '')}
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

        {/* Agent Skills 能力体系（Anima Skill 范式） */}
        <div className="mt-1.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Cpu size={11} style={{ color: '#7c3aed' }} />
            <span className="text-[11px] font-semibold" style={{ color: '#7c3aed' }}>
              Agent Skills (Anima 范式)
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {skillActions.map((action) => (
              <button
                key={action.tool + (action.args ? JSON.stringify(action.args) : '')}
                onClick={() => callTool(action.tool, action.args)}
                disabled={loading || !connected}
                className={`${action.highlight ? 'col-span-2' : ''} flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-lg transition-all disabled:opacity-50 font-medium`}
                style={{
                  background: action.highlight ? '#7c3aed08' : 'var(--color-bg)',
                  border: action.highlight ? '1px solid #7c3aed30' : '1px solid var(--color-border)',
                  color: action.highlight ? '#7c3aed' : 'var(--color-text-secondary)',
                }}
                onMouseEnter={(e) => {
                  if (!loading && connected) {
                    const el = e.currentTarget
                    el.style.borderColor = '#7c3aed50'
                    el.style.color = '#7c3aed'
                    el.style.background = '#7c3aed10'
                  }
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget
                  el.style.borderColor = action.highlight ? '#7c3aed30' : 'var(--color-border)'
                  el.style.color = action.highlight ? '#7c3aed' : 'var(--color-text-secondary)'
                  el.style.background = action.highlight ? '#7c3aed08' : 'var(--color-bg)'
                }}
              >
                <Zap size={11} />
                {action.label}
              </button>
            ))}
          </div>
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
