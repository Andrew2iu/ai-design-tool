import { useState } from 'react'
import { Copy, Check, Code2, FileText, Loader2, ShieldCheck, ShieldAlert, ShieldX, ChevronDown, ChevronRight } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import type { CodeCheckReport } from '../../types'

function SelfCheckReport({ report }: { report: CodeCheckReport }) {
  const [expanded, setExpanded] = useState(false)
  const { overallScore, dimensions, suggestions } = report

  const badgeColor =
    overallScore >= 85
      ? { bg: '#dcfce7', text: '#166534', border: '#bbf7d0' }
      : overallScore >= 60
        ? { bg: '#fef9c3', text: '#854d0e', border: '#fef08a' }
        : { bg: '#fee2e2', text: '#991b1b', border: '#fecaca' }

  const Icon = overallScore >= 85 ? ShieldCheck : overallScore >= 60 ? ShieldAlert : ShieldX

  return (
    <div className="flex-shrink-0" style={{ borderTop: '1px solid var(--color-border-light)' }}>
      {/* 总体得分头部 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2.5 flex items-center justify-between hover:opacity-80 transition-opacity"
        style={{ background: 'var(--color-bg)' }}
      >
        <div className="flex items-center gap-2">
          <Icon size={16} style={{ color: badgeColor.text }} />
          <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            代码自检报告
          </span>
          <span
            className="px-1.5 py-0.5 text-[10px] font-bold rounded"
            style={{ background: badgeColor.bg, color: badgeColor.text, border: `1px solid ${badgeColor.border}` }}
          >
            {overallScore}分
          </span>
        </div>
        {expanded ? <ChevronDown size={14} style={{ color: 'var(--color-text-muted)' }} /> : <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />}
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {/* 关键建议 */}
          {suggestions.length > 0 && (
            <div
              className="p-2.5 rounded-lg mt-2 text-[11px] leading-relaxed"
              style={{
                background: overallScore >= 85 ? '#f0fdf4' : overallScore >= 60 ? '#fefce8' : '#fef2f2',
                border: `1px solid ${badgeColor.border}`,
                color: badgeColor.text,
              }}
            >
              {suggestions.map((s, i) => (
                <p key={i} className={i === 0 ? 'font-semibold' : 'mt-1 opacity-80'}>
                  {i === 0 ? '' : '• '}{s}
                </p>
              ))}
            </div>
          )}

          {/* 各维度得分 */}
          <div className="space-y-1.5">
            {dimensions.map((dim) => {
              const pct = Math.round((dim.score / dim.maxScore) * 100)
              const barColor =
                dim.passed ? 'var(--color-brand)' : pct >= 40 ? '#eab308' : '#ef4444'
              return (
                <div key={dim.category} className="flex items-center gap-2 text-[11px]">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: dim.passed ? '#22c55e' : '#ef4444' }} />
                  <span className="w-16 flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
                    {dim.category}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--color-bg)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: barColor }}
                    />
                  </div>
                  <span className="w-8 text-right font-mono flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                    {dim.score}/{dim.maxScore}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function CodePanel() {
  const [copied, setCopied] = useState(false)
  const { generatedCode, isLoadingCode, generateCode } = useAppStore()

  const code = generatedCode?.react
  const css = generatedCode?.css
  const selfCheck = generatedCode?.selfCheck

  const handleCopy = async () => {
    if (code) {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!generatedCode && !isLoadingCode) {
    return (
      <div className="flex flex-col h-full" style={{ background: 'var(--color-bg-elevated)' }}>
        <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--color-text-secondary)' }}>
            代码生成
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-6">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
            >
              <Code2 size={24} style={{ color: 'var(--color-text-muted)' }} />
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
              暂未生成代码
            </p>
            <p className="text-xs mb-5" style={{ color: 'var(--color-text-muted)' }}>
              先生成设计稿后，点击生成 React 组件代码
            </p>
            <button
              onClick={() => generateCode()}
              className="px-5 py-2 text-sm rounded-xl font-medium transition-all"
              style={{ background: 'var(--color-brand)', color: '#fff' }}
            >
              生成 React 代码
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-bg-elevated)' }}>
      {/* 头部 */}
      <div
        className="px-4 py-3 flex-shrink-0 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--color-border-light)' }}
      >
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--color-text-secondary)' }}>
          代码生成
        </h3>
        <div className="flex items-center gap-2">
          {selfCheck && (
            <span
              className="px-1.5 py-0.5 text-[10px] font-bold rounded"
              style={{
                background: selfCheck.overallScore >= 85 ? '#dcfce7' : selfCheck.overallScore >= 60 ? '#fef9c3' : '#fee2e2',
                color: selfCheck.overallScore >= 85 ? '#166534' : selfCheck.overallScore >= 60 ? '#854d0e' : '#991b1b',
              }}
            >
              {selfCheck.overallScore}分
            </span>
          )}
          <span
            className="px-2.5 py-1 text-xs rounded-md font-medium"
            style={{ background: 'var(--color-brand)', color: '#fff' }}
          >
            React
          </span>
        </div>
      </div>

      {isLoadingCode ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 size={28} className="mx-auto mb-3 animate-spin" style={{ color: 'var(--color-brand)' }} />
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              正在生成 React 组件代码...
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)', opacity: 0.6 }}>
              生成后将自动进行准确率自检
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* 文件名 + 复制 */}
          <div
            className="flex items-center justify-between px-4 py-2 flex-shrink-0"
            style={{
              background: 'var(--color-bg)',
              borderBottom: '1px solid var(--color-border-light)',
            }}
          >
            <span className="text-[11px] flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
              <FileText size={11} />
              App.tsx
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs transition-all"
              style={{ color: copied ? 'var(--color-brand)' : 'var(--color-text-muted)' }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? '已复制' : '复制'}
            </button>
          </div>

          {/* 自检报告 */}
          {selfCheck && <SelfCheckReport report={selfCheck} />}

          {/* 代码块 */}
          <div className="flex-1 overflow-auto">
            <pre
              className="p-4 text-xs leading-relaxed font-mono whitespace-pre-wrap"
              style={{ color: 'var(--color-text-primary)' }}
            >
              <code>{code}</code>
            </pre>
          </div>

          {/* CSS */}
          {css && (
            <>
              <div
                className="px-4 py-2 flex-shrink-0"
                style={{
                  borderTop: '1px solid var(--color-border-light)',
                  background: 'var(--color-bg)',
                }}
              >
                <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                  styles.css
                </span>
              </div>
              <div className="max-h-32 overflow-auto" style={{ background: 'var(--color-bg-elevated)' }}>
                <pre className="p-4 text-xs leading-relaxed font-mono whitespace-pre-wrap" style={{ color: 'var(--color-text-secondary)' }}>
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
