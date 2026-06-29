import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import clsx from 'clsx'

export default function CompliancePanel() {
  const { compliance, checkCompliance, currentDesign } = useAppStore()

  if (!compliance && currentDesign) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-medium text-gray-700">设计规范检查</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-6">
            <ShieldCheck size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-500 mb-1">检查设计稿对品牌规范的兼容性</p>
            <button
              onClick={checkCompliance}
              className="mt-3 px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700"
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
      <div className="flex flex-col h-full bg-white">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-medium text-gray-700">设计规范检查</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-400 px-6">
            <ShieldCheck size={40} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">先生成设计稿后再检查</p>
          </div>
        </div>
      </div>
    )
  }

  const scoreColor =
    compliance.overallScore >= 85
      ? 'text-green-600'
      : compliance.overallScore >= 70
        ? 'text-amber-600'
        : 'text-red-600'

  const scoreBg =
    compliance.overallScore >= 85
      ? 'bg-green-50'
      : compliance.overallScore >= 70
        ? 'bg-amber-50'
        : 'bg-red-50'

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-medium text-gray-700">设计规范检查</h3>
      </div>

      <div className="p-4">
        <div
          className={clsx(
            'rounded-2xl p-4 text-center mb-4',
            scoreBg
          )}
        >
          <div className={clsx('text-3xl font-bold', scoreColor)}>
            {compliance.overallScore}%
          </div>
          <div className="text-xs text-gray-500 mt-1">品牌规范兼容性</div>
        </div>

        <div className="space-y-2">
          {compliance.checks.map((check, i) => (
            <div
              key={i}
              className={clsx(
                'rounded-xl p-3 border',
                check.passed
                  ? 'bg-green-50 border-green-100'
                  : check.severity === 'error'
                    ? 'bg-red-50 border-red-100'
                    : 'bg-amber-50 border-amber-100'
              )}
            >
              <div className="flex items-start gap-2">
                {check.passed ? (
                  <ShieldCheck size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
                ) : check.severity === 'error' ? (
                  <ShieldX size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <ShieldAlert size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className={clsx('text-xs font-medium', check.passed ? 'text-green-800' : check.severity === 'error' ? 'text-red-800' : 'text-amber-800')}>
                    {check.category}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{check.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={checkCompliance}
          className="mt-4 w-full py-2 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200 transition-colors"
        >
          重新检查
        </button>
      </div>
    </div>
  )
}
