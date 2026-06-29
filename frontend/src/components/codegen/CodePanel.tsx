import { useState } from 'react'
import { Copy, Check, Code2, FileText, Loader2, Eye } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import PreviewPanel from './PreviewPanel'
import clsx from 'clsx'

export default function CodePanel() {
  const [copied, setCopied] = useState(false)
  const [framework, setFramework] = useState<'react' | 'vue'>('react')
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('code')
  const { generatedCode, isLoadingCode, generateCode } = useAppStore()

  const code = framework === 'react' ? generatedCode?.react : generatedCode?.vue
  const css = generatedCode?.css

  const handleCopy = async () => {
    if (code) {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!generatedCode && !isLoadingCode) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-medium text-gray-700">代码生成</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-400 px-6">
            <Code2 size={40} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium mb-1">暂未生成代码</p>
            <p className="text-xs mb-4">先生成设计稿后，点击生成 React 或 Vue 组件代码</p>
            <div className="flex items-center gap-2 justify-center mb-3">
              {(['react', 'vue'] as const).map((fw) => (
                <button
                  key={fw}
                  onClick={() => setFramework(fw)}
                  className={clsx(
                    'px-3 py-1 text-xs rounded-md transition-all border',
                    framework === fw
                      ? 'bg-brand-50 text-brand-600 border-brand-200'
                      : 'text-gray-500 border-gray-200 hover:text-gray-700'
                  )}
                >
                  {fw === 'react' ? 'React' : 'Vue'}
                </button>
              ))}
            </div>
            <button
              onClick={() => generateCode(framework)}
              className="px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 transition-colors"
            >
              立即生成 {framework === 'react' ? 'React' : 'Vue'} 代码
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">代码生成</h3>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {(['react', 'vue'] as const).map((fw) => (
            <button
              key={fw}
              onClick={() => setFramework(fw)}
              className={clsx(
                'px-3 py-1 text-xs rounded-md transition-all',
                framework === fw ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {fw === 'react' ? 'React' : 'Vue'}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs: Code / Preview */}
      <div className="flex border-b border-gray-100">
        <button
          onClick={() => setActiveTab('code')}
          className={clsx(
            'flex-1 py-2 text-xs font-medium transition-all border-b-2',
            activeTab === 'code'
              ? 'text-brand-600 border-brand-600'
              : 'text-gray-400 border-transparent hover:text-gray-600'
          )}
        >
          <Code2 size={12} className="inline mr-1" />
          代码
        </button>
        <button
          onClick={() => setActiveTab('preview')}
          className={clsx(
            'flex-1 py-2 text-xs font-medium transition-all border-b-2',
            activeTab === 'preview'
              ? 'text-brand-600 border-brand-600'
              : 'text-gray-400 border-transparent hover:text-gray-600'
          )}
        >
          <Eye size={12} className="inline mr-1" />
          预览
        </button>
      </div>

      {activeTab === 'preview' ? (
        <PreviewPanel />
      ) : isLoadingCode ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <Loader2 size={32} className="mx-auto mb-3 animate-spin" />
            <p className="text-sm">正在生成 {framework === 'react' ? 'React' : 'Vue'} 组件代码...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
            <span className="text-xs text-gray-500 flex items-center gap-1.5">
              <FileText size={12} />
              {framework === 'react' ? 'App.tsx' : 'App.vue'}
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-brand-600 transition-colors"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? '已复制' : '复制'}
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            <pre className="p-4 text-xs leading-relaxed text-gray-800 font-mono whitespace-pre-wrap">
              <code>{code}</code>
            </pre>
          </div>
          {css && (
            <>
              <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
                <span className="text-xs text-gray-500">styles.css</span>
              </div>
              <div className="max-h-32 overflow-auto">
                <pre className="p-4 text-xs leading-relaxed text-gray-600 font-mono whitespace-pre-wrap">
                  <code>{css}</code>
                </pre>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
