import { useAppStore } from './stores/appStore'
import Toolbar from './components/layout/Toolbar'
import StatusBar from './components/layout/StatusBar'
import DesignCanvas from './components/canvas/DesignCanvas'
import PropertyPanel from './components/canvas/PropertyPanel'
import ComponentLibraryPanel from './components/library/ComponentLibraryPanel'
import ChatPanel from './components/chat/ChatPanel'
import CodePanel from './components/codegen/CodePanel'
import CompliancePanel from './components/codegen/CompliancePanel'
import DesignSystemPanel from './components/design/DesignSystemPanel'
import MCPPanel from './components/mcp/MCPPanel'

export default function App() {
  const { showRightPanel, activePanel, selectedElementId } = useAppStore()

  const renderPanel = () => {
    switch (activePanel) {
      case 'chat':
        return <ChatPanel />
      case 'code':
        return <CodePanel />
      case 'compliance':
        return <CompliancePanel />
      case 'design-system':
        return <DesignSystemPanel />
      case 'mcp':
        return <MCPPanel />
      default:
        return <ChatPanel />
    }
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      {/* 顶栏 */}
      <Toolbar />

      {/* 主体区域 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧组件库 */}
        <ComponentLibraryPanel />

        {/* 中央画布 */}
        <DesignCanvas />

        {/* 右侧面板 */}
        {selectedElementId && <PropertyPanel />}
        {showRightPanel && !selectedElementId && (
          <div
            className="w-[380px] flex-shrink-0 overflow-hidden flex flex-col animate-slide-in"
            style={{
              borderLeft: '1px solid var(--color-border)',
              background: 'var(--color-bg-elevated)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {renderPanel()}
          </div>
        )}
      </div>

      {/* 底部状态栏 */}
      <StatusBar />
    </div>
  )
}
