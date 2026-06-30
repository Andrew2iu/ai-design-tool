import { useEffect, useRef, useState, useCallback } from 'react'
import * as fabric from 'fabric'
import { Plus, Minus, Maximize, Grid3X3, Trash2 } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import type { DesignCanvasData, CanvasElement } from '../../types'
import type { ComponentTemplate } from '../library/ComponentLibraryPanel'

export default function DesignCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)

  const currentDesign = useAppStore((s) => s.currentDesign)
  const canvasMode = useAppStore((s) => s.canvasMode)
  const addCanvasElement = useAppStore((s) => s.addCanvasElement)
  const setSelectedElementId = useAppStore((s) => s.setSelectedElementId)
  const selectedElementId = useAppStore((s) => s.selectedElementId)
  const deleteCanvasElement = useAppStore((s) => s.deleteCanvasElement)
  const clearCanvas = useAppStore((s) => s.clearCanvas)

  // ★ 追踪上一次的元素列表，用于增量同步
  const prevElementsRef = useRef<CanvasElement[]>([])
  const isFirstRenderRef = useRef(true)

  // ========== 缩放计算 ==========
  const calcScale = useCallback(() => {
    const container = containerRef.current
    if (!container) return 1
    const w = container.clientWidth - 64
    const h = container.clientHeight - 64
    return Math.min(w / 1200, h / 800, 1)
  }, [])

  // ========== 初始化 Fabric ==========
  useEffect(() => {
    if (!canvasRef.current || fabricRef.current) return

    const c = new fabric.Canvas(canvasRef.current, {
      width: 1200,
      height: 800,
      backgroundColor: '#ffffff',
      selection: true,
      preserveObjectStacking: true,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    c.on('selection:created', (e: any) => {
      const obj = e.selected?.[0]
      if (obj?._elementId) setSelectedElementId(obj._elementId)
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    c.on('selection:updated', (e: any) => {
      const obj = e.selected?.[0]
      if (obj?._elementId) setSelectedElementId(obj._elementId)
    })
    c.on('selection:cleared', () => setSelectedElementId(null))

    // ★ 键盘 Delete/Backspace 删除选中元素
    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Delete' || ev.key === 'Backspace') {
        // 不要让浏览器后退（Backspace）
        const activeTag = (ev.target as HTMLElement)?.tagName
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return
        const activeObj = c.getActiveObject()
        if (!activeObj) return
        const eid = (activeObj as fabric.Object & { _elementId?: string })._elementId
        if (eid) {
          ev.preventDefault()
          deleteCanvasElement(eid)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    fabricRef.current = c

    const doResize = () => {
      const scale = calcScale()
      setZoom(scale)
      c.setDimensions({ width: 1200 * scale, height: 800 * scale })
      c.setZoom(scale)
    }
    doResize()

    const observer = new ResizeObserver(doResize)
    if (containerRef.current) observer.observe(containerRef.current)
    window.addEventListener('resize', doResize)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', doResize)
      window.removeEventListener('keydown', handleKeyDown)
      c.dispose()
      fabricRef.current = null
    }
  }, [])

  // ========== design 数据 → Fabric（增量同步）==========
  useEffect(() => {
    const c = fabricRef.current
    if (!c) return

    // ★ 清空画布：currentDesign 为 null 时清除所有 Fabric 对象
    if (!currentDesign) {
      c.clear()
      c.backgroundColor = '#ffffff'
      c.renderAll()
      prevElementsRef.current = []
      isFirstRenderRef.current = true
      return
    }

    const prevEls = prevElementsRef.current
    const currEls = currentDesign.elements

    // 首次加载：全量重建
    if (isFirstRenderRef.current || prevEls.length === 0) {
      isFirstRenderRef.current = false
      c.clear()
      c.backgroundColor = '#ffffff'
      const fabricJson = convertDesignToFabric(currentDesign)
      c.loadFromJSON(fabricJson as unknown as Record<string, unknown>).then(() => {
        c.renderAll()
        const scale = calcScale()
        setZoom(scale)
        c.setZoom(scale)
        c.setDimensions({ width: 1200 * scale, height: 800 * scale })
      })
      prevElementsRef.current = [...currEls]
      return
    }

    // ★ 增量检测：比较新旧元素列表
    const prevIds = new Set(prevEls.map((e) => e.id))
    const currIds = new Set(currEls.map((e) => e.id))

    const added = currEls.filter((e) => !prevIds.has(e.id))
    const removed = prevEls.filter((e) => !currIds.has(e.id))

    // 检查是否仅顺序变化（元素相同、位置不同）
    const orderChanged =
      added.length === 0 &&
      removed.length === 0 &&
      currEls.length === prevEls.length &&
      currEls.some((e, i) => e.id !== prevEls[i]?.id)

    // 删除的元素 → 从画布移除
    for (const el of removed) {
      const obj = c.getObjects().find((o) => (o as fabric.Object & { _elementId?: string })._elementId === el.id)
      if (obj) c.remove(obj)
    }

    // 新增的元素 → 逐个添加到画布（★ 不重建已有元素）
    // ★ 必须用真正的 Fabric 实例，不能用普通对象（c.add 不吃 plain object）
    for (const el of added) {
      const fabricObj = createFabricElement(el)
      if (fabricObj) {
        c.add(fabricObj)
      }
    }

    // 顺序变化 → 重排画布层级
    if (orderChanged) {
      const objects = c.getObjects()
      const idToObj = new Map<string, fabric.FabricObject>()
      for (const obj of objects) {
        const eid = (obj as fabric.Object & { _elementId?: string })._elementId
        if (eid) idToObj.set(eid, obj)
      }
      // 移除再按顺序重新插入
      for (const obj of objects) c.remove(obj)
      for (const el of currEls) {
        const obj = idToObj.get(el.id)
        if (obj) c.add(obj)
      }
    }

    // 如果有删除或新增操作，确保缩放不变
    if (removed.length > 0 || added.length > 0 || orderChanged) {
      c.renderAll()
    }

    prevElementsRef.current = [...currEls]
  }, [currentDesign])

  // ========== 增量更新选中元素 ==========
  useEffect(() => {
    const c = fabricRef.current
    if (!c || !currentDesign || !selectedElementId) return

    const el = currentDesign.elements.find((e) => e.id === selectedElementId)
    if (!el) return

    const fabricObj = c.getObjects().find(
      (o) => (o as fabric.Object & { _elementId?: string })._elementId === selectedElementId
    )
    if (!fabricObj) return

    if (el.fill) {
      const grad = parseGradient(el.fill, el.width, el.height)
      fabricObj.set('fill', grad || el.fill)
    } else {
      fabricObj.set('fill', '#f0f0f0')
    }
    fabricObj.set('stroke', el.stroke || null)
    fabricObj.set('strokeWidth', el.strokeWidth ?? 0)
    fabricObj.set('rx', el.rx ?? 0)
    fabricObj.set('ry', el.ry ?? 0)
    fabricObj.set('opacity', el.opacity ?? 1)
    if (el.text !== undefined) fabricObj.set('text', el.text)
    if (el.fontSize) fabricObj.set('fontSize', el.fontSize)

    c.renderAll()
  }, [currentDesign?.elements, selectedElementId])

  // ========== 拖放 ==========
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const c = fabricRef.current
    if (!c) return

    const data = e.dataTransfer.getData('application/json')
    if (!data) return

    const component = JSON.parse(data) as ComponentTemplate
    const scale = calcScale()
    const pointer = c.getPointer(e.nativeEvent)
    // 把画布坐标换算回设计稿坐标
    const x = pointer.x / scale
    const y = pointer.y / scale

    const typeMap: Record<string, CanvasElement['type']> = {
      rect: 'rect', card: 'rect', button: 'rect', input: 'rect',
      image: 'rect', text: 'text', circle: 'circle',
    }

    addCanvasElement({
      type: typeMap[component.type] || 'rect',
      left: Math.max(0, x - component.defaults.width / 2),
      top: Math.max(0, y - component.defaults.height / 2),
      width: component.defaults.width,
      height: component.defaults.height,
      fill: component.defaults.fill === 'transparent' ? undefined : component.defaults.fill,
      text: component.defaults.text,
      rx: component.defaults.rx,
      componentType: component.defaults.componentType,
    })
  }

  // ========== 缩放控件 ==========
  const handleZoomIn = () => {
    const c = fabricRef.current
    if (!c) return
    const newZ = Math.min(zoom + 0.1, 2)
    setZoom(newZ)
    c.setZoom(newZ)
    c.setDimensions({ width: 1200 * newZ, height: 800 * newZ })
    c.renderAll()
  }
  const handleZoomOut = () => {
    const c = fabricRef.current
    if (!c) return
    const newZ = Math.max(zoom - 0.1, 0.25)
    setZoom(newZ)
    c.setZoom(newZ)
    c.setDimensions({ width: 1200 * newZ, height: 800 * newZ })
    c.renderAll()
  }
  const handleZoomReset = () => {
    const c = fabricRef.current
    if (!c) return
    const s = calcScale()
    setZoom(s)
    c.setZoom(s)
    c.setDimensions({ width: 1200 * s, height: 800 * s })
    c.renderAll()
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 relative overflow-hidden"
      style={{ background: 'var(--color-canvas-surface)' }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* 网格背景 */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="var(--color-canvas-grid)" strokeWidth="0.5" />
          </pattern>
          <pattern id="grid-lg" width="96" height="96" patternUnits="userSpaceOnUse">
            <rect width="96" height="96" fill="url(#grid)" />
            <path d="M 96 0 L 0 0 0 96" fill="none" stroke="var(--color-canvas-grid)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-lg)" />
      </svg>

      {/* 画布容器 */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="rounded-xl overflow-hidden"
          style={{
            boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          <canvas ref={canvasRef} />
        </div>
      </div>

      {/* 空状态引导 */}
      {!currentDesign && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center animate-fade-in">
            <div
              className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6"
              style={{
                background: 'linear-gradient(135deg, var(--color-brand-light) 0%, var(--color-brand-soft) 100%)',
                border: '2px dashed var(--color-brand-mid)',
              }}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <p className="text-lg font-bold mb-1.5" style={{ color: 'var(--color-brand)' }}>
              开始设计
            </p>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              在右侧 AI 助手输入设计需求
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              或从左侧组件库拖拽组件到这里
            </p>
          </div>
        </div>
      )}

      {/* 预览模式标签 */}
      {canvasMode === 'preview' && currentDesign && (
        <div
          className="absolute top-5 left-1/2 -translate-x-1/2 px-5 py-2 rounded-full text-sm font-semibold z-10"
          style={{
            background: 'var(--color-brand)',
            color: '#fff',
            boxShadow: 'var(--shadow-brand)',
          }}
        >
          预览模式
        </div>
      )}

      {/* 缩放控件浮层 */}
      <div
        className="absolute bottom-4 right-4 flex items-center gap-0.5 rounded-xl p-1 z-10"
        style={{
          background: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <button
          onClick={handleZoomOut}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-brand-light)'; e.currentTarget.style.color = 'var(--color-brand)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)' }}
        >
          <Minus size={14} />
        </button>
        <button
          onClick={handleZoomReset}
          className="text-[11px] font-medium w-12 text-center transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={handleZoomIn}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-brand-light)'; e.currentTarget.style.color = 'var(--color-brand)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)' }}
        >
          <Plus size={14} />
        </button>
        <div className="w-px h-5 mx-0.5" style={{ background: 'var(--color-border-light)' }} />
        <button
          onClick={handleZoomReset}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-brand-light)'; e.currentTarget.style.color = 'var(--color-brand)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)' }}
          title="适应屏幕"
        >
          <Maximize size={13} />
        </button>
        <div className="w-px h-5 mx-0.5" style={{ background: 'var(--color-border-light)' }} />
        <button
          onClick={() => { if (currentDesign && currentDesign.elements.length > 0) clearCanvas() }}
          disabled={!currentDesign || currentDesign.elements.length === 0}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ color: 'var(--color-danger, #dc2626)' }}
          onMouseEnter={(e) => {
            if (!e.currentTarget.disabled) {
              e.currentTarget.style.background = 'rgba(220,38,38,0.1)'
            }
          }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          title="清空画布"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* 画布模式指示点 */}
      {currentDesign && canvasMode === 'design' && (
        <div
          className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] z-10"
          style={{
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <Grid3X3 size={12} style={{ color: 'var(--color-brand)' }} />
          <span>设计模式</span>
          <span style={{ color: 'var(--color-text-muted)' }}>
            {currentDesign.elements.length} 元素
          </span>
        </div>
      )}
    </div>
  )
}

// ========== 以下函数保持不变 ==========

function convertDesignToFabric(design: DesignCanvasData): Record<string, unknown> {
  const objects = design.elements.map((el) => convertSingleElementToFabric(el))
  return { objects, version: design.version || '7.0.0' }
}

/** ★ 单个元素转 Fabric 对象（供增量添加使用） */
function convertSingleElementToFabric(el: CanvasElement): Record<string, unknown> {
  const base: Record<string, unknown> = {
    type: mapType(el.type),
    left: el.left,
    top: el.top,
    width: el.width,
    height: el.height,
    stroke: el.stroke || undefined,
    strokeWidth: el.strokeWidth ?? 0,
    rx: el.rx ?? 0,
    ry: el.ry ?? 0,
    opacity: el.opacity ?? 1,
    angle: el.angle ?? 0,
    scaleX: el.scaleX ?? 1,
    scaleY: el.scaleY ?? 1,
    _elementId: el.id,
  }

  if (el.fill) {
    const grad = parseGradient(el.fill, el.width, el.height)
    base.fill = grad || el.fill
  } else {
    base.fill = '#f0f0f0'
  }

  if (el.strokeDasharray) base.strokeDashArray = parseDashArray(el.strokeDasharray)
  if (el.shadow) { const s = parseShadow(el.shadow); if (s) base.shadow = s }

  if (el.type === 'text' && el.text) {
    base.text = el.text
    base.fontSize = el.fontSize ?? 16
    base.fontFamily = el.fontFamily ?? 'Inter'
    base.fontWeight = el.fontWeight ?? 'normal'
    base.textAlign = el.textAlign ?? 'left'
  }

  if (el.type === 'circle') {
    base.type = 'circle'
    base.radius = Math.min(el.width, el.height) / 2
    delete base.width
    delete base.height
  }

  if (el.type === 'input' && el.placeholder) {
    base.text = el.placeholder
    base.fontSize = el.fontSize ?? 14
    base.fontFamily = el.fontFamily ?? 'Inter'
    base.fill = el.fill || '#9CA3AF'
  }

  return base
}

function mapType(type: string): string {
  const m: Record<string, string> = {
    rect: 'rect', text: 'textbox', circle: 'circle', input: 'textbox', button: 'rect',
  }
  return m[type] || 'rect'
}

function parseGradient(fill: string, _width: number, _height: number): fabric.Gradient<'linear'> | null {
  const m = fill.match(/linear-gradient\((\d+)deg,\s*(#[0-9a-fA-F]{3,8})\s*,\s*(#[0-9a-fA-F]{3,8})\)/)
  if (!m) return null
  const angle = parseInt(m[1])
  const rad = (angle * Math.PI) / 180
  const cos = Math.cos(rad), sin = Math.sin(rad)
  return new fabric.Gradient({
    type: 'linear',
    coords: { x1: 0.5 - cos * 0.5, y1: 0.5 - sin * 0.5, x2: 0.5 + cos * 0.5, y2: 0.5 + sin * 0.5 },
    colorStops: [
      { offset: 0, color: m[2] },
      { offset: 1, color: m[3] },
    ],
  })
}

function parseDashArray(dash: string): number[] {
  return dash.split(',').map(Number).filter((n) => !isNaN(n))
}

/** ★ 创建真正的 Fabric 实例（用于增量添加） */
function createFabricElement(el: CanvasElement): fabric.FabricObject | null {
  const common = {
    left: el.left,
    top: el.top,
    width: el.width,
    height: el.height,
    stroke: el.stroke || undefined,
    strokeWidth: el.strokeWidth ?? 0,
    rx: el.rx ?? 0,
    ry: el.ry ?? 0,
    opacity: el.opacity ?? 1,
    angle: el.angle ?? 0,
    scaleX: el.scaleX ?? 1,
    scaleY: el.scaleY ?? 1,
    fill: el.fill
      ? (parseGradient(el.fill, el.width, el.height) || el.fill)
      : '#f0f0f0',
  }

  let obj: fabric.FabricObject

  switch (el.type) {
    case 'text': {
      obj = new fabric.Textbox(el.text || '', {
        ...common,
        fontSize: el.fontSize ?? 16,
        fontFamily: el.fontFamily ?? 'Inter',
        fontWeight: el.fontWeight ?? ('normal' as string | number),
        textAlign: el.textAlign ?? 'left',
      })
      break
    }
    case 'circle': {
      const r = Math.min(el.width, el.height) / 2
      obj = new fabric.Circle({
        left: el.left,
        top: el.top,
        radius: r,
        fill: common.fill,
        stroke: common.stroke,
        strokeWidth: common.strokeWidth,
        opacity: common.opacity,
        angle: common.angle,
        scaleX: common.scaleX,
        scaleY: common.scaleY,
      })
      break
    }
    case 'rect':
    case 'button':
    default: {
      obj = new fabric.Rect({ ...common })
    }
  }

  // ★ 挂 _elementId 用于后续查找
  ;(obj as fabric.Object & { _elementId: string })._elementId = el.id

  if (el.strokeDasharray) {
    const dash = parseDashArray(el.strokeDasharray)
    if (dash.length > 0) obj.set('strokeDashArray' as keyof fabric.FabricObjectProps, dash as never)
  }

  if (el.shadow) {
    const s = parseShadow(el.shadow)
    if (s) obj.set('shadow', s)
  }

  return obj
}

function parseShadow(shadowStr: string): fabric.Shadow | null {
  const m = shadowStr.match(/([\d.]+)px\s+([\d.]+)px\s+([\d.]+)px\s+(rgba?\([^)]+\)|#[0-9a-fA-F]+)/)
  if (!m) return null
  return new fabric.Shadow({
    offsetX: parseFloat(m[1]),
    offsetY: parseFloat(m[2]),
    blur: parseFloat(m[3]),
    color: m[4],
  })
}
