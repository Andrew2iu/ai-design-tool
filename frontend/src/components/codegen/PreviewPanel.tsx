import { useRef, useEffect, useState, useCallback } from 'react'
import { useAppStore } from '../../stores/appStore'
import { Loader2, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** 安全地产生 </script> 标签，避免 HTML 解析器中断 */
function scriptTag(src?: string, isModule = false): string {
  if (src) {
    return `<script src="${src}"${isModule ? ' type="module"' : ''}></scr` + 'ipt>'
  }
  return '<script></scr' + 'ipt>'
}

/** 清理 AI 生成的代码中可能混入的 markdown 标记 */
function cleanCode(code: string): string {
  return code
    .replace(/```(?:tsx?|jsx?|html|css)?\s*/g, '')
    .replace(/```\s*$/g, '')
    .trim()
}

function buildPreviewHTML(reactCode: string | undefined, cssCode: string | undefined): string {
  const code = cleanCode(reactCode || '// 暂无代码')
  const css = escapeHtml(cssCode || '')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>预览 - React</title>
${scriptTag('https://cdn.tailwindcss.com')}
<style>body{margin:0;font-family:Inter,system-ui,sans-serif}pre{margin:0;white-space:pre-wrap;word-break:break-word}${css}</style>
</head>
<body>
<div id="root"></div>
${scriptTag('https://unpkg.com/react@18/umd/react.production.min.js')}
${scriptTag('https://unpkg.com/react-dom@18/umd/react-dom.production.min.js')}
${scriptTag('https://unpkg.com/@babel/standalone/babel.min.js')}
<script>
window.onerror = function(msg, url, line, col, err) {
  document.body.innerHTML = '<div style="padding:20px;color:#dc2626;font-family:system-ui,sans-serif"><h3 style="margin:0 0 10px">预览渲染失败</h3><pre style="background:#fef2f2;padding:12px;border-radius:6px;font-size:12px">' + (err ? err.stack : msg) + '</pre></div>'
}

try {
  const rawCode = ${JSON.stringify(code)};

  // 1. 编译 JSX
  const compiled = Babel.transform(rawCode, {
    presets: ['react'],
    filename: 'App.jsx'
  }).code;

  // 2. 移除 import/export（UMD 环境下不需要）
  const executable = compiled
    .replace(/^\\s*import\\s+.*?from\\s+['"].*?['"];?\\s*$/gm, '')
    .replace(/^\\s*export\\s+default\\s+/gm, '')
    .replace(/\\bexport\\b/g, '');

  // 3. 执行代码，定义 App 组件
  const wrapped = '(function(React){\\n' + executable + '\\nreturn App;\\n})';
  const App = eval(wrapped)(window.React);

  // 4. 渲染
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(React.createElement(App));
} catch (err) {
  document.body.innerHTML = '<div style="padding:20px;color:#dc2626;font-family:system-ui,sans-serif"><h3 style="margin:0 0 10px">预览渲染失败</h3><pre style="background:#fef2f2;padding:12px;border-radius:6px;font-size:12px">' + err.stack + '</pre></div>';
}
</scr` + `ipt>
</body>
</html>`
}

export default function PreviewPanel() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { generatedCode } = useAppStore()

  const updatePreview = useCallback(() => {
    if (!iframeRef.current || !generatedCode) return
    setLoading(true)
    setError(null)

    try {
      const html = buildPreviewHTML(generatedCode.react, generatedCode.css)
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)

      const iframe = iframeRef.current
      const oldUrl = iframe.dataset.prevUrl
      if (oldUrl) URL.revokeObjectURL(oldUrl)
      iframe.dataset.prevUrl = url
      iframe.src = url
      iframe.onload = () => setLoading(false)
    } catch (err) {
      setLoading(false)
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [generatedCode])

  useEffect(() => {
    if (generatedCode) updatePreview()
  }, [generatedCode, updatePreview])

  const openInNewTab = () => {
    if (!generatedCode) return
    try {
      const html = buildPreviewHTML(generatedCode.react, generatedCode.css)
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  if (!generatedCode) {
    return (
      <div className="flex flex-col h-full" style={{ background: 'var(--color-bg-elevated)' }}>
        <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>实时预览</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>先生成代码后即可预览</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-bg-elevated)' }}>
      <div
        className="px-4 py-3 flex-shrink-0 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--color-border-light)' }}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>实时预览</h3>
        <div className="flex items-center gap-2">
          <span
            className="px-2.5 py-1 text-xs rounded-md font-medium"
            style={{ background: 'var(--color-brand)', color: '#fff' }}
          >
            React
          </span>
          <button
            onClick={updatePreview}
            className="p-1.5 rounded-md transition-all"
            style={{ color: 'var(--color-text-muted)' }}
            title="刷新预览"
          >
            <RefreshCw size={13} />
          </button>
          <button
            onClick={openInNewTab}
            className="p-1.5 rounded-md transition-all"
            style={{ color: 'var(--color-text-muted)' }}
            title="新窗口打开"
          >
            <ExternalLink size={13} />
          </button>
        </div>
      </div>

      {error && (
        <div
          className="px-4 py-2 flex-shrink-0 flex items-start gap-2"
          style={{
            background: 'var(--color-accent-light)',
            borderBottom: '1px solid rgba(159,51,48,0.2)',
          }}
        >
          <AlertCircle size={13} style={{ color: 'var(--color-accent)', flexShrink: 0, marginTop: 1 }} />
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-accent)' }}>
            {error}
          </p>
        </div>
      )}

      <div className="flex-1 relative" style={{ background: 'var(--color-bg)' }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: 'rgba(255,255,255,0.6)' }}>
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-brand)' }} />
          </div>
        )}
        <iframe
          ref={iframeRef}
          className="w-full h-full border-0"
          title="代码预览"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    </div>
  )
}
