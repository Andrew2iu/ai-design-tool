import { useState, useRef, useEffect } from 'react'
import { Send, Loader2 } from 'lucide-react'
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
    toggleRightPanel,
    setCanvasMode,
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
      await generateCode('react')
    } else if (cmd === '/check' || cmd === '/检查') {
      addChatMessage({ role: 'assistant', content: '正在检查设计规范一致性...' })
      await checkCompliance()
    } else {
      addChatMessage({ role: 'assistant', content: `未知命令: ${cmd}\n\n可用命令:\n- /code 生成代码\n- /check 合规检查` })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-medium text-gray-700">AI 设计助手</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          {currentDesign ? '输入修改需求或命令' : '描述你想要的界面设计'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.length === 0 && !isLoadingDesign && (
          <div className="text-center text-gray-400 mt-8">
            <p className="text-3xl mb-2">💬</p>
            <p className="text-sm">试试输入：</p>
            <div className="mt-3 space-y-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setInput(s)
                  }}
                  className="block w-full text-left text-xs text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg px-3 py-2 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-brand-600 text-white rounded-br-md'
                  : msg.role === 'system'
                    ? 'bg-amber-50 text-amber-800 border border-amber-200 rounded-bl-md'
                    : 'bg-gray-100 text-gray-800 rounded-bl-md'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.designData && (
                <button
                  onClick={() => {
                    setCanvasMode('preview')
                    toggleRightPanel()
                  }}
                  className="mt-2 text-xs bg-brand-600 text-white px-3 py-1 rounded-full hover:bg-brand-700"
                >
                  查看设计稿
                </button>
              )}
            </div>
          </div>
        ))}

        {isStreaming && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 size={16} className="animate-spin" />
                AI 正在生成设计稿...
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              currentDesign
                ? '输入修改要求，如"把间距调大"...'
                : '描述你想要的设计，如"一个深色仪表盘"...'
            }
            className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-50 transition-all"
            disabled={isLoadingDesign}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoadingDesign}
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {isLoadingDesign ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
        {currentDesign && (
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => handleCommand('/code')}
              className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg hover:bg-gray-200 transition-colors"
            >
              生成代码
            </button>
            <button
              onClick={() => handleCommand('/check')}
              className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg hover:bg-gray-200 transition-colors"
            >
              合规检查
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const suggestions = [
  '设计一个电商活动优惠券领取页面，红色调，圆角风格',
  '做一个极简风格的数据仪表盘，灰白配色',
  '生成一个 SaaS 后台管理页面，侧边栏+顶栏+内容区',
  '设计一个移动端登录注册页面',
]
