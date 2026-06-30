import { Layers, ZoomIn, MousePointer2 } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'

export default function StatusBar() {
  const { currentDesign, canvasMode, setCanvasMode, selectedElementId } = useAppStore()

  const elementCount = currentDesign?.elements?.length ?? 0

  return (
    <div
      className="h-8 flex items-center justify-between px-4 flex-shrink-0 text-[11px]"
      style={{
        background: 'var(--color-bg-elevated)',
        borderTop: '1px solid var(--color-border)',
        color: 'var(--color-text-muted)',
      }}
    >
      {/* 左侧：项目信息 */}
      <div className="flex items-center gap-4">
        {/* 画布模式指示 */}
        <button
          onClick={() => setCanvasMode(canvasMode === 'design' ? 'preview' : 'design')}
          className="flex items-center gap-1.5 transition-colors hover:text-brand-600"
          style={{ color: 'var(--color-text-secondary)' }}
          title="切换设计/预览模式"
        >
          <Layers size={12} />
          <span className="font-medium" style={{ color: 'var(--color-brand)' }}>
            {canvasMode === 'design' ? '设计模式' : '预览模式'}
          </span>
        </button>

        <span style={{ color: 'var(--color-border)' }}>|</span>

        {/* 元素数量 */}
        <div className="flex items-center gap-1">
          <MousePointer2 size={11} />
          <span>{elementCount} 个元素</span>
        </div>

        {selectedElementId && (
          <>
            <span style={{ color: 'var(--color-border)' }}>|</span>
            <span style={{ color: 'var(--color-accent)' }}>已选中元素</span>
          </>
        )}
      </div>

      {/* 右侧：画布信息 */}
      <div className="flex items-center gap-4">
        {currentDesign && (
          <span>
            {currentDesign.width} × {currentDesign.height} px
          </span>
        )}
        <span style={{ color: 'var(--color-border)' }}>|</span>
        <div className="flex items-center gap-1">
          <ZoomIn size={11} />
          <span>100%</span>
        </div>
      </div>
    </div>
  )
}
