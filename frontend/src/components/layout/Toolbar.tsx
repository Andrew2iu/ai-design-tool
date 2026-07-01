import { Palette, Eye, EyeOff, Layers, Code, ShieldCheck, Database, Cpu, Sparkles, LayoutGrid, Bot, ChevronDown } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import CollaborationIndicator from '../collaboration/CollaborationIndicator'
import { useState, useEffect, useRef } from 'react'

interface TabItem {
  key: 'chat' | 'code' | 'compliance' | 'design-system' | 'mcp'
  label: string
  icon: React.ReactNode
  color: string
}

const tabs: TabItem[] = [
  { key: 'chat', label: 'AI 助手', icon: <Sparkles size={14} />, color: 'var(--color-brand)' },
  { key: 'code', label: '代码生成', icon: <Code size={14} />, color: '#4f46e5' },
  { key: 'compliance', label: '规范检查', icon: <ShieldCheck size={14} />, color: 'var(--color-accent)' },
  { key: 'design-system', label: '设计系统', icon: <Database size={14} />, color: '#0d9488' },
  { key: 'mcp', label: 'MCP', icon: <Cpu size={14} />, color: '#7c3aed' },
]

export default function Toolbar() {
  const {
    canvasMode,
    setCanvasMode,
    currentDesign,
    showRightPanel,
    toggleRightPanel,
    activePanel,
    setActivePanel,
    designAlternatives,
    switchToVariant,
    aiProviders,
    currentProvider,
    isLoadingProviders,
    loadAIProviders,
    switchAIProvider,
  } = useAppStore()

  const [providerMenuOpen, setProviderMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadAIProviders()
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setProviderMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const providerLabel = aiProviders.find(p => p.id === currentProvider)?.name || currentProvider

  const totalVariants = designAlternatives.length + (currentDesign ? 1 : 0)

  const handleTabClick = (panel: typeof activePanel) => {
    // 如果已选中且面板已打开 → 关闭面板
    if (activePanel === panel && showRightPanel) {
      toggleRightPanel()
    } else {
      setActivePanel(panel)
    }
  }

  return (
    <header
      className="h-14 flex items-center justify-between px-5 flex-shrink-0"
      style={{
        background: 'var(--color-bg-elevated)',
        borderBottom: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* ========== 左：品牌区域 ========== */}
      <div className="flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, var(--color-brand) 0%, #3b4fd4 100%)',
              color: '#fff',
              boxShadow: 'var(--shadow-brand)',
            }}
          >
            <Palette size={16} />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold" style={{ color: 'var(--color-brand)' }}>
              AI Design
            </span>
            <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              Studio 2026
            </span>
          </div>
        </div>

        <div className="w-px h-6" style={{ background: 'var(--color-border)' }} />

        {/* 设计 / 预览切换 */}
        <div
          className="flex items-center rounded-lg p-0.5"
          style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border-light)' }}
        >
          <button
            onClick={() => setCanvasMode('design')}
            className="px-3.5 py-1.5 text-xs rounded-md flex items-center gap-1.5 transition-all font-medium"
            style={
              canvasMode === 'design'
                ? {
                    background: 'var(--color-brand)',
                    color: '#fff',
                    boxShadow: 'var(--shadow-brand)',
                  }
                : { color: 'var(--color-text-secondary)' }
            }
          >
            <Layers size={13} />
            设计
          </button>
          <button
            onClick={() => setCanvasMode('preview')}
            disabled={!currentDesign}
            className="px-3.5 py-1.5 text-xs rounded-md flex items-center gap-1.5 transition-all font-medium disabled:opacity-35 disabled:cursor-not-allowed"
            style={
              canvasMode === 'preview'
                ? {
                    background: 'var(--color-brand)',
                    color: '#fff',
                    boxShadow: 'var(--shadow-brand)',
                  }
                : { color: 'var(--color-text-secondary)' }
            }
          >
            <Eye size={13} />
            预览
          </button>
        </div>

        {/* 方案变体切换器 */}
        {totalVariants > 1 && (
          <div className="flex items-center gap-1.5">
            <LayoutGrid size={13} style={{ color: 'var(--color-text-muted)' }} />
            {Array.from({ length: totalVariants }).map((_, i) => {
              const isActive = i === 0
              return (
                <button
                  key={i}
                  onClick={() => switchToVariant(i)}
                  className="text-xs px-2.5 py-1 rounded-md transition-all font-medium"
                  style={{
                    background: isActive ? 'var(--color-brand)' : 'var(--color-bg)',
                    color: isActive ? '#fff' : 'var(--color-text-secondary)',
                    border: isActive ? 'none' : '1px solid var(--color-border-light)',
                  }}
                >
                  方案{i + 1}
                </button>
              )
            })}
          </div>
        )}

        <CollaborationIndicator />
      </div>

      {/* ========== 中：面板标签导航 ========== */}
      <div className="flex items-center gap-1">
        {tabs.map((tab) => {
          const isActive = activePanel === tab.key && showRightPanel
          return (
            <button
              key={tab.key}
              onClick={() => handleTabClick(tab.key)}
              className="relative flex items-center gap-1.5 px-3.5 py-1.5 text-xs rounded-lg transition-all font-medium"
              style={{
                color: isActive ? tab.color : 'var(--color-text-secondary)',
                background: isActive ? `${tab.color}10` : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = `${tab.color}08`
                  e.currentTarget.style.color = tab.color
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--color-text-secondary)'
                }
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {isActive && (
                <span
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full"
                  style={{ background: tab.color }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* ========== 右：操作区 ========== */}
      <div className="flex items-center gap-2">
        {/* AI 模型切换 */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setProviderMenuOpen(!providerMenuOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg transition-all font-medium"
            style={{
              background: providerMenuOpen ? 'var(--color-brand-light)' : 'var(--color-bg)',
              color: currentProvider === 'ollama' ? '#16a34a' : currentProvider === 'openai' ? '#7c3aed' : 'var(--color-brand)',
              border: '1px solid var(--color-border-light)',
            }}
          >
            <Bot size={14} />
            <span>{providerLabel}</span>
            <ChevronDown size={12} style={{ opacity: 0.6 }} />
          </button>

          {providerMenuOpen && (
            <div
              className="absolute top-full right-0 mt-1.5 w-52 rounded-xl overflow-hidden z-50"
              style={{
                background: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              {isLoadingProviders ? (
                <div className="px-3 py-2.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>加载中...</div>
              ) : (
                aiProviders.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      switchAIProvider(p.id)
                      setProviderMenuOpen(false)
                    }}
                    className="w-full flex items-start gap-2 px-3 py-2.5 text-left transition-all"
                    style={{
                      background: p.id === currentProvider ? 'var(--color-brand-light)' : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (p.id !== currentProvider) e.currentTarget.style.background = 'var(--color-bg)'
                    }}
                    onMouseLeave={(e) => {
                      if (p.id !== currentProvider) e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <div
                      className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                      style={{
                        background: p.id === currentProvider
                          ? 'var(--color-brand)'
                          : p.id === 'ollama' ? '#16a34a' : p.id === 'openai' ? '#7c3aed' : 'var(--color-text-muted)',
                      }}
                    />
                    <div className="flex flex-col leading-tight">
                      <span className="text-xs font-semibold" style={{ color: p.id === currentProvider ? 'var(--color-brand)' : 'var(--color-text-primary)' }}>
                        {p.name}
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                        {p.model} · {p.description}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* 面板显隐开关 */}
        <button
          onClick={toggleRightPanel}
          className="w-9 h-9 flex items-center justify-center rounded-lg transition-all"
          style={{
            color: showRightPanel ? 'var(--color-brand)' : 'var(--color-text-muted)',
            background: showRightPanel ? 'var(--color-brand-light)' : 'transparent',
          }}
          title={showRightPanel ? '隐藏面板 (Ctrl+/)' : '显示面板 (Ctrl+/)'}
        >
          {showRightPanel ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </header>
  )
}
