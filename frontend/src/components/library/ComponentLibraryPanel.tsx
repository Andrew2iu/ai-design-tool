import { useState } from 'react'
import {
  Square, Type, CreditCard, MousePointer2,
  Image as ImageIcon, LayoutGrid, Hash, ToggleLeft,
  Search, GripVertical
} from 'lucide-react'

export interface ComponentTemplate {
  type: 'rect' | 'text' | 'button' | 'input' | 'card' | 'image'
  label: string
  icon: React.ReactNode
  category: string
  defaults: {
    width: number
    height: number
    fill?: string
    text?: string
    rx?: number
    componentType?: string
  }
}

const categories = [
  { key: 'layout', label: '布局容器' },
  { key: 'form', label: '表单控件' },
  { key: 'display', label: '展示元素' },
]

const components: ComponentTemplate[] = [
  {
    type: 'rect',
    label: '矩形容器',
    icon: <Square size={14} />,
    category: 'layout',
    defaults: { width: 200, height: 120, fill: '#ffffff', rx: 8, componentType: 'container' },
  },
  {
    type: 'card',
    label: '卡片',
    icon: <CreditCard size={14} />,
    category: 'layout',
    defaults: { width: 260, height: 160, fill: '#ffffff', rx: 16, componentType: 'card' },
  },
  {
    type: 'button',
    label: '按钮',
    icon: <MousePointer2 size={14} />,
    category: 'form',
    defaults: { width: 140, height: 44, fill: '#1c30ca', text: '按钮文字', rx: 10, componentType: 'button' },
  },
  {
    type: 'input',
    label: '输入框',
    icon: <LayoutGrid size={14} />,
    category: 'form',
    defaults: { width: 240, height: 44, fill: '#ffffff', text: '请输入...', rx: 10, componentType: 'input' },
  },
  {
    type: 'rect',
    label: '开关',
    icon: <ToggleLeft size={14} />,
    category: 'form',
    defaults: { width: 52, height: 28, fill: '#d5cfc5', rx: 14, componentType: 'toggle' },
  },
  {
    type: 'text',
    label: '标题',
    icon: <Hash size={14} />,
    category: 'display',
    defaults: { width: 200, height: 32, fill: 'transparent', text: '标题文字', componentType: 'heading' },
  },
  {
    type: 'text',
    label: '正文',
    icon: <Type size={14} />,
    category: 'display',
    defaults: { width: 180, height: 20, fill: 'transparent', text: '正文内容...', componentType: 'text' },
  },
  {
    type: 'image',
    label: '图片',
    icon: <ImageIcon size={14} />,
    category: 'display',
    defaults: { width: 200, height: 140, fill: '#e5dfd9', rx: 12, componentType: 'image' },
  },
]

export default function ComponentLibraryPanel() {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    layout: true,
    form: true,
    display: true,
  })

  const filtered = components.filter((c) =>
    !search || c.label.includes(search)
  )

  const toggleCategory = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleDragStart = (e: React.DragEvent, component: ComponentTemplate) => {
    e.dataTransfer.setData('application/json', JSON.stringify(component))
    e.dataTransfer.effectAllowed = 'copy'
  }

  // 按分类分组
  const grouped = categories.map((cat) => ({
    ...cat,
    items: filtered.filter((c) => c.category === cat.key),
  })).filter((g) => g.items.length > 0)

  return (
    <div
      className="w-[220px] h-full flex flex-col flex-shrink-0 select-none"
      style={{
        background: 'var(--color-bg-elevated)',
        borderRight: '1px solid var(--color-border)',
      }}
    >
      {/* 标题区 */}
      <div className="px-4 pt-4 pb-2 flex-shrink-0">
        <h3
          className="text-xs font-bold uppercase tracking-[0.08em]"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          组件库
        </h3>
      </div>

      {/* 搜索 */}
      <div className="px-3 pb-3 flex-shrink-0">
        <div className="relative">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--color-text-muted)' }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索..."
            className="w-full pl-8 pr-3 py-2 text-xs rounded-lg outline-none transition-all"
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
          />
        </div>
      </div>

      {/* 分割线 */}
      <div className="mx-4" style={{ borderTop: '1px solid var(--color-border-light)' }} />

      {/* 组件列表 */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {grouped.map((cat) => (
          <div key={cat.key}>
            {/* 分类标题 */}
            <button
              onClick={() => toggleCategory(cat.key)}
              className="flex items-center gap-2 w-full text-left px-1 py-1 mb-1.5 group"
            >
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.08em] flex-1"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {cat.label}
              </span>
              <span
                className="text-[11px] transition-transform"
                style={{
                  color: 'var(--color-text-muted)',
                  transform: expanded[cat.key] ? 'rotate(0deg)' : 'rotate(-90deg)',
                }}
              >
                ▼
              </span>
            </button>

            {/* 展开区 */}
            {expanded[cat.key] && (
              <div className="space-y-1 animate-fade-in">
                {cat.items.map((component) => (
                  <div
                    key={`${component.type}-${component.label}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, component)}
                    className="group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-grab active:cursor-grabbing active:scale-[0.97] transition-all"
                    style={{
                      background: 'var(--color-bg)',
                      border: '1px solid var(--color-border-light)',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget
                      el.style.background = 'var(--color-brand-soft)'
                      el.style.borderColor = 'var(--color-brand-mid)'
                      el.style.boxShadow = 'var(--shadow-md)'
                      el.style.transform = 'translateX(2px)'
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget
                      el.style.background = 'var(--color-bg)'
                      el.style.borderColor = 'var(--color-border-light)'
                      el.style.boxShadow = 'var(--shadow-sm)'
                      el.style.transform = 'translateX(0)'
                    }}
                  >
                    {/* 拖拽手柄 */}
                    <div
                      className="flex-shrink-0 opacity-40 group-hover:opacity-70 transition-opacity"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      <GripVertical size={12} />
                    </div>

                    {/* 缩略图 */}
                    <div
                      className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 border"
                      style={{
                        background: component.defaults.fill || 'transparent',
                        borderColor: 'var(--color-border-light)',
                        borderRadius: component.defaults.rx ? `${Math.max(4, component.defaults.rx / 3)}px` : '4px',
                        color: component.defaults.fill && component.defaults.fill !== 'transparent' ? '#fff' : 'var(--color-text-muted)',
                      }}
                    >
                      <span className="flex items-center justify-center">
                        {component.icon}
                      </span>
                    </div>

                    {/* 名称 + 尺寸 */}
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium block" style={{ color: 'var(--color-text-primary)' }}>
                        {component.label}
                      </span>
                      <span className="text-[10px] block" style={{ color: 'var(--color-text-muted)' }}>
                        {component.defaults.width} × {component.defaults.height}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {grouped.length === 0 && (
          <div className="text-center py-10">
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              未找到「{search}」
            </p>
          </div>
        )}
      </div>

      {/* 底部提示 */}
      <div
        className="px-4 py-2.5 text-[10px] flex-shrink-0 flex items-center gap-1.5"
        style={{
          borderTop: '1px solid var(--color-border-light)',
          color: 'var(--color-text-muted)',
        }}
      >
        <GripVertical size={10} />
        拖拽组件到画布
      </div>
    </div>
  )
}
