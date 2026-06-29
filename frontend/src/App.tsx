import { useAppStore } from './stores/appStore'
import Toolbar from './components/layout/Toolbar'
import DesignCanvas from './components/canvas/DesignCanvas'
import ComponentLibraryPanel from './components/library/ComponentLibraryPanel'
import ChatPanel from './components/chat/ChatPanel'
import CodePanel from './components/codegen/CodePanel'
import CompliancePanel from './components/codegen/CompliancePanel'
import DesignSystemPanel from './components/design/DesignSystemPanel'
import MCPPanel from './components/mcp/MCPPanel'

export default function App() {
  const { showRightPanel, activePanel } = useAppStore()

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
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <Toolbar />
      <div className="flex-1 flex overflow-hidden">
        <ComponentLibraryPanel />
        <DesignCanvas />
        {showRightPanel && (
          <div className="w-96 border-l border-gray-200 flex-shrink-0 overflow-hidden">
            {renderPanel()}
          </div>
        )}
      </div>
    </div>
  )
}
