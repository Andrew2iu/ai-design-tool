import { Palette, Eye, EyeOff, Settings2, Layers, SwatchBook, Bot } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import CollaborationIndicator from '../collaboration/CollaborationIndicator'
import clsx from 'clsx'

export default function Toolbar() {
  const { canvasMode, setCanvasMode, currentDesign, showRightPanel, toggleRightPanel, activePanel, setActivePanel } =
    useAppStore()

  return (
    <header className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Palette size={18} className="text-brand-600" />
          <span className="text-sm font-medium text-gray-800">AI Design Studio</span>
        </div>
        <span className="text-xs text-gray-300">|</span>
        <span className="text-xs text-gray-400">面向2026的AI原生产品设计工具</span>
        <CollaborationIndicator />
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setCanvasMode('design')}
            className={clsx(
              'px-3 py-1.5 text-xs rounded-md flex items-center gap-1.5 transition-all',
              canvasMode === 'design' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <Layers size={14} />
            设计
          </button>
          <button
            onClick={() => setCanvasMode('preview')}
            className={clsx(
              'px-3 py-1.5 text-xs rounded-md flex items-center gap-1.5 transition-all',
              canvasMode === 'preview' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}
            disabled={!currentDesign}
          >
            <Eye size={14} />
            预览
          </button>
        </div>

        <span className="text-xs text-gray-300">|</span>

        <div className="flex items-center gap-1">
          {(['chat', 'code', 'compliance', 'design-system', 'mcp'] as const).map((panel) => (
            <button
              key={panel}
              onClick={() => setActivePanel(panel)}
              className={clsx(
                'px-2.5 py-1.5 text-xs rounded-md transition-all',
                activePanel === panel && showRightPanel
                  ? 'bg-brand-50 text-brand-600'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {panel === 'chat' && 'AI 助手'}
              {panel === 'code' && '代码'}
              {panel === 'compliance' && '规范检查'}
              {panel === 'design-system' && '设计系统'}
              {panel === 'mcp' && 'MCP'}
            </button>
          ))}
        </div>

        <button
          onClick={toggleRightPanel}
          className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-all"
        >
          {showRightPanel ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </header>
  )
}
