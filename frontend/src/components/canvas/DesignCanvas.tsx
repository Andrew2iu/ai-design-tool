import { useEffect, useRef } from 'react'
import * as fabric from 'fabric'
import { useAppStore } from '../../stores/appStore'
import type { DesignCanvasData, CanvasElement } from '../../types'
import type { ComponentTemplate } from '../library/ComponentLibraryPanel'

export default function DesignCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)
  const currentDesign = useAppStore((s) => s.currentDesign)
  const canvasMode = useAppStore((s) => s.canvasMode)
  const addCanvasElement = useAppStore((s) => s.addCanvasElement)

  useEffect(() => {
    if (!canvasRef.current || fabricRef.current) return

    const c = new fabric.Canvas(canvasRef.current, {
      width: 1200,
      height: 800,
      backgroundColor: '#ffffff',
      selection: true,
      preserveObjectStacking: true,
    })

    c.on('object:modified', () => {
      // 同步变化可以在此处处理
    })

    fabricRef.current = c

    const resizeCanvas = () => {
      const container = c.wrapperEl?.parentElement
      if (!container) return
      const scale = container.clientWidth / 1200
      c.setDimensions({
        width: 1200 * scale,
        height: 800 * scale,
      })
      c.setZoom(scale)
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      c.dispose()
      fabricRef.current = null
    }
  }, [])

  useEffect(() => {
    const c = fabricRef.current
    if (!c || !currentDesign) return

    c.clear()
    c.backgroundColor = '#ffffff'

    const fabricJson = convertDesignToFabric(currentDesign)
    c.loadFromJSON(fabricJson as unknown as Record<string, unknown>).then(() => {
      c.renderAll()
      // 适配画布缩放
      const container = c.wrapperEl?.parentElement
      if (container) {
        const scale = container.clientWidth / 1200
        c.setZoom(scale)
      }
    })
  }, [currentDesign])

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
    const pointer = c.getPointer(e.nativeEvent)

    const typeMap: Record<string, CanvasElement['type']> = {
      rect: 'rect',
      card: 'rect',
      button: 'rect',
      input: 'rect',
      image: 'rect',
      text: 'text',
    }

    addCanvasElement({
      type: typeMap[component.type] || 'rect',
      left: Math.max(0, pointer.x - component.defaults.width / 2),
      top: Math.max(0, pointer.y - component.defaults.height / 2),
      width: component.defaults.width,
      height: component.defaults.height,
      fill: component.defaults.fill === 'transparent' ? undefined : component.defaults.fill,
      text: component.defaults.text,
      rx: component.defaults.rx,
      componentType: component.defaults.componentType,
    })
  }

  return (
    <div
      className="flex-1 relative bg-gray-100 overflow-hidden flex items-center justify-center"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="shadow-lg rounded-lg overflow-hidden" style={{ maxWidth: '100%', maxHeight: '100%' }}>
        <canvas ref={canvasRef} />
      </div>
      {!currentDesign && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-gray-400">
            <div className="text-5xl mb-4">🎨</div>
            <p className="text-lg font-medium">AI Design Studio</p>
            <p className="text-sm mt-2">在右侧聊天框输入设计需求，AI 将为你生成设计稿</p>
          </div>
        </div>
      )}
      {canvasMode === 'preview' && currentDesign && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-brand-600 text-white px-4 py-1.5 rounded-full text-sm font-medium">
          预览模式
        </div>
      )}
    </div>
  )
}

function convertDesignToFabric(design: DesignCanvasData): Record<string, unknown> {
  const objects = design.elements.map((el) => {
    const base: Record<string, unknown> = {
      type: el.type,
      left: el.left,
      top: el.top,
      width: el.width,
      height: el.height,
      fill: el.fill || '#f0f0f0',
      stroke: el.stroke,
      strokeWidth: el.strokeWidth ?? 0,
      rx: el.rx ?? 0,
      ry: el.ry ?? 0,
      opacity: el.opacity ?? 1,
      angle: el.angle ?? 0,
      scaleX: el.scaleX ?? 1,
      scaleY: el.scaleY ?? 1,
    }

    if (el.type === 'text' && el.text) {
      base.text = el.text
      base.fontSize = el.fontSize ?? 16
      base.fontFamily = el.fontFamily ?? 'Inter'
      base.fontWeight = el.fontWeight ?? 'normal'
    }

    return base
  })

  return { objects, version: design.version || '6.0.0' }
}
