import { useRef, useEffect, useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { Loader2, ExternalLink, RefreshCw } from 'lucide-react'

function buildPreviewHTML(
  reactCode: string | undefined,
  vueCode: string | undefined,
  cssCode: string | undefined,
  framework: 'react' | 'vue'
): string {
  const css = (cssCode || '').replace(/<\/style>/gi, '<\\/style>')

  const tailwindCDN = '<script src="https://cdn.tailwindcss.com"><\\/script>'
  const tailwindConfig = `<script>tailwind.config={theme:{extend:{colors:{brand:{50:'#f0f4ff',100:'#dbe4ff',200:'#bac8ff',300:'#91a7ff',400:'#748ffc',500:'#5c7cfa',600:'#4c6ef5',700:'#4263eb',800:'#3b5bdb',900:'#364fc7'}}}}}</script>`

  if (framework === 'react') {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>预览 - React</title>
${tailwindCDN}
${tailwindConfig}
<style>body{margin:0;font-family:Inter,system-ui,sans-serif}${css}</style>
</head>
<body>
<div id="root"></div>
<script src="https://unpkg.com/react@18/umd/react.production.min.js"><\\/script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\\/script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"><\\/script>
<script type="text/babel" data-type="module">
${reactCode || '// 暂无代码'}

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(React.createElement(App))
</script>
</body>
</html>`
  }

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>预览 - Vue</title>
${tailwindCDN}
${tailwindConfig}
<style>body{margin:0;font-family:Inter,system-ui,sans-serif}${css}</style>
</head>
<body>
<div id="app"></div>
<script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"><\\/script>
<script type="module">
const { createApp, ref } = Vue

${vueCode?.replace(/<script setup lang="ts">[\s\S]*?<\/script>/, '') || '// 暂无代码'}

// Vue SFC extraction
const templateMatch = document.querySelector('script[type="preview-vue"]')
</script>
<template id="preview-template">
${(vueCode || '').replace(/<script[\s\S]*?<\/script>/g, '')}
</template>
<script>
const template = document.getElementById('preview-template').innerHTML
const app = Vue.createApp({
  template: template,
  setup() {
    const navItems = Vue.ref(['概览', '数据', '用户', '设置'])
    return { navItems }
  }
})
app.mount('#app')
</script>
</body>
</html>`
}

export default function PreviewPanel() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [framework, setFramework] = useState<'react' | 'vue'>('react')
  const [loading, setLoading] = useState(false)
  const { generatedCode } = useAppStore()

  const updatePreview = () => {
    if (!iframeRef.current || !generatedCode) return
    setLoading(true)
    const html = buildPreviewHTML(
      generatedCode.react,
      generatedCode.vue,
      generatedCode.css,
      framework
    )
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    iframeRef.current.src = url
    const oldUrl = iframeRef.current.dataset.prevUrl
    if (oldUrl) URL.revokeObjectURL(oldUrl)
    iframeRef.current.dataset.prevUrl = url
    iframeRef.current.onload = () => setLoading(false)
  }

  useEffect(() => {
    if (generatedCode) updatePreview()
  }, [generatedCode, framework])

  const openInNewTab = () => {
    if (!generatedCode) return
    const html = buildPreviewHTML(
      generatedCode.react,
      generatedCode.vue,
      generatedCode.css,
      framework
    )
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  }

  if (!generatedCode) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-medium text-gray-700">实时预览</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-gray-400">先生成代码后即可预览</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">实时预览</h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
            {(['react', 'vue'] as const).map((fw) => (
              <button
                key={fw}
                onClick={() => setFramework(fw)}
                className={`px-2.5 py-1 text-xs rounded-md transition-all ${
                  framework === fw ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {fw === 'react' ? 'React' : 'Vue'}
              </button>
            ))}
          </div>
          <button onClick={updatePreview} className="p-1.5 text-gray-400 hover:text-gray-600" title="刷新预览">
            <RefreshCw size={14} />
          </button>
          <button onClick={openInNewTab} className="p-1.5 text-gray-400 hover:text-gray-600" title="新窗口打开">
            <ExternalLink size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 relative bg-gray-100">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-10">
            <Loader2 size={24} className="animate-spin text-brand-600" />
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
