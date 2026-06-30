import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'

export default function CompliancePanel() {
  const { compliance, checkCompliance, currentDesign } = useAppStore()

  const PanelHeader = () => (
    <div
      className="px-4 py-3 flex-shrink-0"
      style={{ borderBottom: '1px solid var(--color-border-light)' }}
    >
      <h3 className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--color-text-secondary)' }}>
        设计规范检查
      </h3>
      <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
        检查设计稿与品牌规范的一致性
      </p>
    </div>
  )

  if (!compliance && currentDesign) {
    return (
      <div className="flex flex-col h-full" style={{ background: 'var(--color-bg-elevated)' }}>
        <PanelHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-6">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'var(--color-brand-light)', border: '1px solid var(--color-brand-mid)' }}
            >
              <ShieldCheck size={24} style={{ color: 'var(--color-brand)' }} />
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
              准备好检查了
            </p>
            <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
              检查设计稿对品牌规范的兼容性
            </p>
            <button
              onClick={checkCompliance}
              className="px-5 py-2 text-sm rounded-xl font-medium transition-all"
              style={{ background: 'var(--color-brand)', color: '#fff' }}
            >
              开始检查
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!compliance) {
    return (
      <div className="flex flex-col h-full" style={{ background: 'var(--color-bg-elevated)' }}>
        <PanelHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-6">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
            >
              <ShieldCheck size={24} style={{ color: 'var(--color-text-muted)', opacity: 0.5 }} />
            </div>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              先生成设计稿后再检查
            </p>
          </div>
        </div>
      </div>
    )
  }

  const score = compliance.overallScore
  const scoreStyle =
    score >= 85
      ? { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' }
      : score >= 70
      ? { color: '#d97706', bg: '#fffbeb', border: '#fde68a' }
      : { color: 'var(--color-accent)', bg: 'var(--color-accent-light)', border: 'rgba(159,51,48,0.3)' }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-bg-elevated)' }}>
      <PanelHeader />

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* 分数卡片 */}
        <div
          className="rounded-2xl p-4 text-center"
          style={{
            background: scoreStyle.bg,
            border: `1px solid ${scoreStyle.border}`,
          }}
        >
          <div className="text-4xl font-bold mb-1" style={{ color: scoreStyle.color }}>
            {score}%
          </div>
          <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            品牌规范兼容性
          </div>
          {/* 进度条 */}
          <div
            className="mt-3 rounded-full overflow-hidden h-1.5"
            style={{ background: 'rgba(0,0,0,0.06)' }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${score}%`, background: scoreStyle.color }}
            />
          </div>
        </div>

        {/* 检查项 */}
        <div className="space-y-2">
          {compliance.checks.map((check, i) => {
            const itemStyle = check.passed
              ? { bg: '#f0fdf4', border: '#bbf7d0', iconColor: '#16a34a' }
              : check.severity === 'error'
              ? { bg: 'var(--color-accent-light)', border: 'rgba(159,51,48,0.3)', iconColor: 'var(--color-accent)' }
              : { bg: '#fffbeb', border: '#fde68a', iconColor: '#d97706' }

            return (
              <div
                key={i}
                className="rounded-xl p-3"
                style={{ background: itemStyle.bg, border: `1px solid ${itemStyle.border}` }}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 mt-0.5">
                    {check.passed ? (
                      <ShieldCheck size={14} style={{ color: itemStyle.iconColor }} />
                    ) : check.severity === 'error' ? (
                      <ShieldX size={14} style={{ color: itemStyle.iconColor }} />
                    ) : (
                      <ShieldAlert size={14} style={{ color: itemStyle.iconColor }} />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: itemStyle.iconColor }}>
                      {check.category}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                      {check.message}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* 重新检查 */}
        <button
          onClick={checkCompliance}
          className="w-full py-2 text-xs rounded-xl font-medium transition-all"
          style={{
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
          }}
        >
          重新检查
        </button>
      </div>
    </div>
  )
}
