import { useState } from 'react'
import { Square, Type, CreditCard, MousePointer2, Image as ImageIcon, LayoutGrid } from 'lucide-react'

export interface ComponentTemplate {
  type: 'rect' | 'text' | 'button' | 'input' | 'card' | 'image'
  label: string
  icon: React.ReactNode
  defaults: {
    width: number
    height: number
    fill?: string
    text?: string
    rx?: number
    componentType?: string
  }
}

const components: ComponentTemplate[] = [
  {
    type: 'rect',
    label: '矩形',
    icon: <Square size={16} />,
    defaults: { width: 160, height: 100, fill: '#f0f0f0', rx: 0, componentType: 'container' },
  },
  {
    type: 'card',
    label: '卡片',
    icon: <CreditCard size={16} />,
    defaults: { width: 240, height: 140, fill: '#ffffff', rx: 8, componentType: 'card' },
  },
  {
    type: 'button',
    label: '按钮',
    icon: <MousePointer2 size={16} />,
    defaults: { width: 120, height: 40, fill: '#0052D9', text: '按钮', rx: 8, componentType: 'button' },
  },
  {
    type: 'input',
    label: '输入框',
    icon: <LayoutGrid size={16} />,
    defaults: { width: 200, height: 40, fill: '#ffffff', text: '请输入...', rx: 6, componentType: 'input' },
  },
  {
    type: 'text',
    label: '文本',
    icon: <Type size={16} />,
    defaults: { width: 120, height: 24, fill: 'transparent', text: '文本内容', componentType: 'text' },
  },
  {
    type: 'image',
    label: '图片占位',
    icon: <ImageIcon size={16} />,
    defaults: { width: 160, height: 120, fill: '#e5e7eb', rx: 4, componentType: 'image' },
  },
]

export default function ComponentLibraryPanel() {
  const [search, setSearch] = useState('')

  const filtered = components.filter((c) => c.label.includes(search))

  const handleDragStart = (e: React.DragEvent, component: ComponentTemplate) => {
    e.dataTransfer.setData('application/json', JSON.stringify(component))
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div className="w-56 h-full bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-medium text-gray-700">组件库</h3>
        <p className="text-xs text-gray-400 mt-0.5">拖拽组件到画布</p>
      </div>

      <div className="p-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索组件..."
          className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-50"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2">
        {filtered.map((component) => (
          <div
            key={component.type}
            draggable
            onDragStart={(e) => handleDragStart(e, component)}
            className="group flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-100 bg-gray-50 hover:bg-brand-50 hover:border-brand-200 cursor-grab active:cursor-grabbing transition-all"
          >
            <div className="text-gray-500 group-hover:text-brand-600 transition-colors">{component.icon}</div>
            <span className="text-sm text-gray-700 group-hover:text-brand-700">{component.label}</span>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center text-xs text-gray-400 py-4">未找到组件</div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
        提示：拖到画布中央区域即可添加
      </div>
    </div>
  )
}
