import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Sparkles, CornerDownLeft, Zap, Wand2 } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'

export default function ChatPanel() {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const {
    messages,
    isLoadingDesign,
    isStreaming,
    generateDesign,
    refineDesign,
    addChatMessage,
    currentDesign,
    generateCode,
    checkCompliance,
    setActivePanel,
  } = useAppStore()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isLoadingDesign) return

    setInput('')
    addChatMessage({ role: 'user', content: text })

    if (text.startsWith('/')) {
      handleCommand(text)
    } else if (!currentDesign) {
      await generateDesign(text)
    } else {
      await refineDesign(text)
    }
  }

  const handleCommand = async (cmd: string) => {
    if (cmd === '/code' || cmd === '/生成代码') {
      addChatMessage({ role: 'assistant', content: '正在生成 React + TypeScript 代码...' })
      setActivePanel('code')
      await generateCode()
    } else if (cmd === '/check' || cmd === '/检查') {
      addChatMessage({ role: 'assistant', content: '正在检查设计规范一致性...' })
      setActivePanel('compliance')
      await checkCompliance()
    } else {
      addChatMessage({
        role: 'assistant',
        content: `未知命令: ${cmd}\n\n可用命令:\n- /code 生成代码\n- /check 合规检查`,
      })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-bg-elevated)' }}>
      {/* ========== 头部 ========== */}
      <div className="px-4 py-3.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, var(--color-brand-light), var(--color-brand-soft))',
              color: 'var(--color-brand)',
            }}
          >
            <Wand2 size={15} />
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              AI 设计助手
            </h3>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {currentDesign ? '描述修改内容，AI 会调整设计稿' : '用自然语言描述界面，AI 帮你生成'}
            </p>
          </div>
        </div>
      </div>

      {/* ========== 消息列表 ========== */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !isLoadingDesign && (
          <div className="animate-fade-in">
            <p className="text-[11px] font-medium mb-3" style={{ color: 'var(--color-text-muted)' }}>
              试试这些 ↓
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s.label}
                  onClick={() => setInput(s.label)}
                  className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full transition-all font-medium"
                  style={{
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-border-light)',
                    color: 'var(--color-text-secondary)',
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget
                    el.style.background = 'var(--color-brand-soft)'
                    el.style.borderColor = 'var(--color-brand-mid)'
                    el.style.color = 'var(--color-brand)'
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget
                    el.style.background = 'var(--color-bg)'
                    el.style.borderColor = 'var(--color-border-light)'
                    el.style.color = 'var(--color-text-secondary)'
                  }}
                >
                  {s.icon}
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
            style={{ animationDelay: `${idx * 30}ms` }}
          >
            <div
              className="max-w-[90%] text-xs leading-relaxed"
              style={
                msg.role === 'user'
                  ? {
                      padding: '10px 16px',
                      background: 'linear-gradient(135deg, var(--color-brand) 0%, #3b4fd4 100%)',
                      color: '#fff',
                      borderRadius: 'var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-lg)',
                      boxShadow: 'var(--shadow-brand)',
                    }
                  : msg.role === 'system'
                  ? {
                      padding: '10px 16px',
                      background: '#fef9e7',
                      color: '#92400e',
                      borderRadius: 'var(--radius-lg) var(--radius-lg) var(--radius-lg) var(--radius-sm)',
                      border: '1px solid #fde68a',
                    }
                  : {
                      padding: '12px 16px',
                      background: 'var(--color-bg)',
                      color: 'var(--color-text-primary)',
                      borderRadius: 'var(--radius-lg) var(--radius-lg) var(--radius-lg) var(--radius-sm)',
                      border: '1px solid var(--color-border-light)',
                      boxShadow: 'var(--shadow-sm)',
                    }
              }
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {isStreaming && (
          <div className="flex justify-start">
            <div
              className="px-4 py-3 rounded-xl flex items-center gap-2.5"
              style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border-light)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ background: 'var(--color-brand)', animationDelay: '0ms' }}
                />
                <span
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ background: 'var(--color-brand)', animationDelay: '150ms' }}
                />
                <span
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ background: 'var(--color-brand)', animationDelay: '300ms' }}
                />
              </div>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                AI 正在生成设计稿...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ========== 快捷操作 ========== */}
      {currentDesign && (
        <div className="px-3 pt-1 flex gap-2 flex-shrink-0">
          <button
            onClick={() => handleCommand('/code')}
            className="flex-1 flex items-center justify-center gap-1.5 text-[11px] py-2 rounded-lg transition-all font-medium"
            style={{
              background: 'var(--color-brand-soft)',
              color: 'var(--color-brand)',
              border: '1px solid var(--color-brand-mid)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--color-brand-light)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--color-brand-soft)'
            }}
          >
            <Zap size={12} />
            生成代码
          </button>
          <button
            onClick={() => handleCommand('/check')}
            className="flex-1 flex items-center justify-center gap-1.5 text-[11px] py-2 rounded-lg transition-all font-medium"
            style={{
              background: 'var(--color-accent-light)',
              color: 'var(--color-accent)',
              border: '1px solid var(--color-accent-mid)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#fde8e7'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--color-accent-light)'
            }}
          >
            <Zap size={12} />
            规范检查
          </button>
        </div>
      )}

      {/* ========== 输入框 ========== */}
      <div className="p-3 flex-shrink-0" style={{ borderTop: '1px solid var(--color-border-light)' }}>
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              currentDesign
                ? '描述修改要求...'
                : '描述你想要的界面，如「做一个深色数据仪表盘」...'
            }
            rows={2}
            className="w-full pl-4 pr-12 py-3 text-xs rounded-xl outline-none transition-all resize-none leading-relaxed"
            style={{
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--color-brand)'
              e.target.style.boxShadow = '0 0 0 3px var(--color-brand-light)'
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--color-border)'
              e.target.style.boxShadow = 'none'
            }}
            disabled={isLoadingDesign}
          />
          <div className="absolute right-2 bottom-2 flex items-center gap-1.5">
            <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              ↵
            </span>
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoadingDesign}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background: input.trim() ? 'var(--color-brand)' : 'var(--color-border)',
                color: '#fff',
              }}
            >
              {isLoadingDesign ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={13} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const suggestions = [
  { label: '电商促销活动页面', icon: '🛍' },
  { label: '数据仪表盘', icon: '📊' },
  { label: 'SaaS 后台管理', icon: '⚙' },
  { label: '移动端登录页', icon: '📱' },
  { label: '深色科技风页面', icon: '🌙' },
  { label: '优惠券领取页', icon: '🎫' },
]
