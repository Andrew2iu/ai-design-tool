import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '../../stores/appStore'
import type { CanvasElement } from '../../types'
import { X, Pipette, Type, Square, Palette, Trash2, ChevronsUp, ChevronsDown, ChevronUp, ChevronDown } from 'lucide-react'

/** 预设调色板 */
const PRESET_COLORS = [
  '#1c30ca', '#9f3330', '#efebe5', '#ffffff', '#000000',
  '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4',
  '#f97316', '#ec4899', '#14b8a6', '#6366f1', '#84cc16',
]

/** 渐变色预设 */
const PRESET_GRADIENTS = [
  { label: '蓝→紫', value: 'linear-gradient(135deg, #1c30ca, #8b5cf6)' },
  { label: '红→橙', value: 'linear-gradient(135deg, #9f3330, #f97316)' },
  { label: '绿→青', value: 'linear-gradient(135deg, #10b981, #06b6d4)' },
  { label: '橙→粉', value: 'linear-gradient(135deg, #f97316, #ec4899)' },
]

export default function PropertyPanel() {
  const currentDesign = useAppStore((s) => s.currentDesign)
  const selectedElementId = useAppStore((s) => s.selectedElementId)
  const setSelectedElementId = useAppStore((s) => s.setSelectedElementId)
  const updateCanvasElement = useAppStore((s) => s.updateCanvasElement)
  const deleteCanvasElement = useAppStore((s) => s.deleteCanvasElement)
  const moveCanvasElement = useAppStore((s) => s.moveCanvasElement)

  const element = currentDesign?.elements.find((e) => e.id === selectedElementId) ?? null

  const [localColor, setLocalColor] = useState(element?.fill || '')
  const [localText, setLocalText] = useState(element?.text || '')
  const [localFontSize, setLocalFontSize] = useState(element?.fontSize || 16)
  const [localStrokeColor, setLocalStrokeColor] = useState(element?.stroke || '')
  const [localStrokeWidth, setLocalStrokeWidth] = useState(element?.strokeWidth || 0)
  const [localRx, setLocalRx] = useState(element?.rx || 0)
  const [localOpacity, setLocalOpacity] = useState(element?.opacity ?? 1)

  useEffect(() => {
    if (element) {
      setLocalColor(element.fill || '')
      setLocalText(element.text || '')
      setLocalFontSize(element.fontSize || 16)
      setLocalStrokeColor(element.stroke || '')
      setLocalStrokeWidth(element.strokeWidth || 0)
      setLocalRx(element.rx || 0)
      setLocalOpacity(element.opacity ?? 1)
    }
  }, [element?.id])

  const apply = useCallback(
    (updates: Partial<CanvasElement>) => {
      if (!selectedElementId) return
      updateCanvasElement(selectedElementId, updates)
    },
    [selectedElementId, updateCanvasElement],
  )

  if (!element) {
    return (
      <div
        className="w-[280px] h-full flex flex-col flex-shrink-0 animate-slide-in"
        style={{
          background: 'var(--color-bg-elevated)',
          borderLeft: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--color-text-secondary)' }}>
            属性面板
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center px-4">
          <p className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
            点击画布上的元素<br />即可编辑属性
          </p>
        </div>
      </div>
    )
  }

  const elementTypeLabel: Record<string, string> = {
    rect: '矩形/卡片',
    text: '文本',
    button: '按钮',
    input: '输入框',
    circle: '圆形',
    image: '图片',
  }

  return (
    <div
      className="w-[280px] h-full flex flex-col flex-shrink-0 animate-slide-in"
      style={{
        background: 'var(--color-bg-elevated)',
        borderLeft: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      {/* 标题栏 */}
      <div
        className="px-4 py-3 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-border-light)' }}
      >
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--color-text-secondary)' }}>
            属性面板
          </h3>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {elementTypeLabel[element.type] || element.type} · {element.componentType || 'basic'}
          </p>
        </div>
        <button
          onClick={() => setSelectedElementId(null)}
          className="p-1 rounded-md hover:bg-black/5 transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* ── 填充颜色 ── */}
        <section>
          <label className="flex items-center gap-1.5 text-[11px] font-semibold mb-2 uppercase tracking-[0.08em]" style={{ color: 'var(--color-text-secondary)' }}>
            <Palette size={12} />
            填充颜色
          </label>

          {/* 颜色输入 */}
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-8 h-8 rounded-lg border flex-shrink-0"
              style={{
                background: localColor || '#efebe5',
                borderColor: 'var(--color-border)',
              }}
            />
            <input
              type="text"
              value={localColor}
              onChange={(e) => {
                setLocalColor(e.target.value)
                apply({ fill: e.target.value })
              }}
              placeholder="#1c30ca"
              className="flex-1 px-2.5 py-1.5 text-xs rounded-md outline-none"
              style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />
            <input
              type="color"
              value={/^#[0-9a-fA-F]{3,8}$/.test(localColor) ? localColor : '#efebe5'}
              onChange={(e) => {
                setLocalColor(e.target.value)
                apply({ fill: e.target.value })
              }}
              className="w-7 h-7 rounded cursor-pointer border-0 p-0"
              style={{ borderColor: 'var(--color-border)' }}
            />
          </div>

          {/* 预设颜色 */}
          <div className="flex flex-wrap gap-1.5">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setLocalColor(c)
                  apply({ fill: c })
                }}
                className="w-6 h-6 rounded-md border transition-transform hover:scale-110"
                style={{
                  background: c,
                  borderColor: localColor === c ? 'var(--color-brand)' : 'var(--color-border)',
                  boxShadow: localColor === c ? '0 0 0 2px var(--color-brand-light)' : undefined,
                }}
                title={c}
              />
            ))}
          </div>

          {/* 渐变色 */}
          <label className="text-[10px] font-medium mt-2 block" style={{ color: 'var(--color-text-muted)' }}>
            渐变色
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_GRADIENTS.map((g) => (
              <button
                key={g.value}
                onClick={() => {
                  setLocalColor(g.value)
                  apply({ fill: g.value })
                }}
                className="px-2 py-1 rounded-md text-[10px] border transition-all hover:scale-105"
                style={{
                  background: g.value,
                  color: '#fff',
                  borderColor: localColor === g.value ? 'var(--color-brand)' : 'transparent',
                  boxShadow: localColor === g.value ? '0 0 0 2px var(--color-brand-light)' : undefined,
                }}
              >
                {g.label}
              </button>
            ))}
          </div>
        </section>

        {/* ── 描边 ── */}
        <section>
          <label className="flex items-center gap-1.5 text-[11px] font-semibold mb-2 uppercase tracking-[0.08em]" style={{ color: 'var(--color-text-secondary)' }}>
            <Square size={12} />
            描边
          </label>
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg border flex-shrink-0"
              style={{
                background: localStrokeColor || 'transparent',
                borderColor: 'var(--color-border)',
              }}
            />
            <input
              type="text"
              value={localStrokeColor}
              onChange={(e) => {
                setLocalStrokeColor(e.target.value)
                apply({ stroke: e.target.value || undefined })
              }}
              placeholder="边框颜色"
              className="flex-1 px-2.5 py-1.5 text-xs rounded-md outline-none"
              style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>粗细</span>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={localStrokeWidth}
              onChange={(e) => {
                const v = parseInt(e.target.value)
                setLocalStrokeWidth(v)
                apply({ strokeWidth: v })
              }}
              className="flex-1"
            />
            <span className="text-[11px] w-5 text-right" style={{ color: 'var(--color-text-secondary)' }}>
              {localStrokeWidth}px
            </span>
          </div>
        </section>

        {/* ── 圆角 ── */}
        {element.type !== 'text' && element.type !== 'circle' && (
          <section>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold mb-2 uppercase tracking-[0.08em]" style={{ color: 'var(--color-text-secondary)' }}>
              <Square size={12} />
              圆角
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={40}
                step={1}
                value={localRx}
                onChange={(e) => {
                  const v = parseInt(e.target.value)
                  setLocalRx(v)
                  apply({ rx: v, ry: v })
                }}
                className="flex-1"
              />
              <span className="text-[11px] w-5 text-right" style={{ color: 'var(--color-text-secondary)' }}>
                {localRx}px
              </span>
            </div>
          </section>
        )}

        {/* ── 透明度 ── */}
        <section>
          <label className="flex items-center gap-1.5 text-[11px] font-semibold mb-2 uppercase tracking-[0.08em]" style={{ color: 'var(--color-text-secondary)' }}>
            <Pipette size={12} />
            透明度
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={localOpacity}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                setLocalOpacity(v)
                apply({ opacity: v })
              }}
              className="flex-1"
            />
            <span className="text-[11px] w-8 text-right" style={{ color: 'var(--color-text-secondary)' }}>
              {Math.round(localOpacity * 100)}%
            </span>
          </div>
        </section>

        {/* ── 层级 ── */}
        <section>
          <label className="flex items-center gap-1.5 text-[11px] font-semibold mb-2 uppercase tracking-[0.08em]" style={{ color: 'var(--color-text-secondary)' }}>
            <ChevronsUp size={12} />
            层级
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => {
                if (selectedElementId) moveCanvasElement(selectedElementId, 'front')
              }}
              className="flex items-center justify-center gap-1 px-2 py-2 rounded-md text-[11px] font-medium transition-all hover:scale-[1.02]"
              style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
              }}
              title="置于顶层"
            >
              <ChevronsUp size={12} />
              置顶
            </button>
            <button
              onClick={() => {
                if (selectedElementId) moveCanvasElement(selectedElementId, 'back')
              }}
              className="flex items-center justify-center gap-1 px-2 py-2 rounded-md text-[11px] font-medium transition-all hover:scale-[1.02]"
              style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
              }}
              title="置于底层"
            >
              <ChevronsDown size={12} />
              置底
            </button>
            <button
              onClick={() => {
                if (selectedElementId) moveCanvasElement(selectedElementId, 'forward')
              }}
              className="flex items-center justify-center gap-1 px-2 py-2 rounded-md text-[11px] font-medium transition-all hover:scale-[1.02]"
              style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
              }}
              title="上移一层"
            >
              <ChevronUp size={12} />
              上移
            </button>
            <button
              onClick={() => {
                if (selectedElementId) moveCanvasElement(selectedElementId, 'backward')
              }}
              className="flex items-center justify-center gap-1 px-2 py-2 rounded-md text-[11px] font-medium transition-all hover:scale-[1.02]"
              style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
              }}
              title="下移一层"
            >
              <ChevronDown size={12} />
              下移
            </button>
          </div>
        </section>

        {/* ── 文字属性 ── */}
        {(element.type === 'text' || element.type === 'input' || element.componentType === 'button') && (
          <section>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold mb-2 uppercase tracking-[0.08em]" style={{ color: 'var(--color-text-secondary)' }}>
              <Type size={12} />
              文字
            </label>

            {/* 文字内容 */}
            <textarea
              value={localText}
              onChange={(e) => setLocalText(e.target.value)}
              onBlur={() => apply({ text: localText })}
              rows={2}
              className="w-full px-2.5 py-1.5 text-xs rounded-md resize-none outline-none mb-2"
              style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
              placeholder="输入文字..."
            />

            {/* 字体大小 */}
            <div className="flex items-center gap-2">
              <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>字号</span>
              <input
                type="range"
                min={10}
                max={72}
                step={1}
                value={localFontSize}
                onChange={(e) => {
                  const v = parseInt(e.target.value)
                  setLocalFontSize(v)
                  apply({ fontSize: v })
                }}
                className="flex-1"
              />
              <span className="text-[11px] w-7 text-right" style={{ color: 'var(--color-text-secondary)' }}>
                {localFontSize}
              </span>
            </div>
          </section>
        )}
      </div>

      {/* 底部操作 */}
      <div
        className="px-3 py-2.5 flex items-center justify-between flex-shrink-0"
        style={{
          borderTop: '1px solid var(--color-border-light)',
        }}
      >
        <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
          ID: {element.id.slice(0, 8)}...
        </span>
        <button
          onClick={() => {
            if (selectedElementId) {
              deleteCanvasElement(selectedElementId)
            }
          }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all hover:scale-[1.02]"
          style={{
            background: 'var(--color-urgent-light, #fef2f2)',
            color: 'var(--color-urgent)',
            border: '1px solid var(--color-urgent-border, #fecaca)',
          }}
        >
          <Trash2 size={12} />
          删除
        </button>
      </div>
    </div>
  )
}
