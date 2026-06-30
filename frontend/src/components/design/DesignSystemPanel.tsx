import { useEffect, useState } from 'react'
import { Plus, Trash2, Check, X, Palette, Type, Move, Square, Save } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import type { DesignSystem } from '../../types'

interface EditingSystem extends DesignSystem {
  id: string
}

export default function DesignSystemPanel() {
  const {
    designSystems,
    activeDesignSystem,
    isLoadingDesignSystems,
    loadDesignSystems,
    setActiveDesignSystem,
    createDesignSystem,
    updateDesignSystem,
    deleteDesignSystem,
  } = useAppStore()

  const [editing, setEditing] = useState<EditingSystem | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    loadDesignSystems()
  }, [loadDesignSystems])

  const active = designSystems.find((s) => s.id === activeDesignSystem)

  const handleEdit = async (systemId: string) => {
    if (editing?.id === systemId) {
      await updateDesignSystem(systemId, editing)
      setEditing(null)
      return
    }
    try {
      const res = await fetch(`/api/design/systems/${systemId}`)
      const data = await res.json()
      setEditing(data.system)
    } catch (err) {
      alert(`加载设计系统失败: ${(err as Error).message}`)
    }
  }

  const handleCreate = async () => {
    if (!editing) return
    await createDesignSystem(editing)
    setIsCreating(false)
    setEditing(null)
  }

  const startCreate = () => {
    setIsCreating(true)
    setEditing({
      id: '',
      name: '我的设计系统',
      colors: {
        primary: '#1c30ca',
        secondary: '#9f3330',
        success: '#16a34a',
        warning: '#d97706',
        danger: '#dc2626',
        background: '#efebe5',
        surface: '#faf8f5',
      },
      typography: {
        heading: { font: 'Inter', weight: 600, size: '24px' },
        body: { font: 'Inter', weight: 400, size: '14px' },
      },
      spacing: 8,
      borderRadius: 10,
    })
  }

  const updateColor = (key: string, value: string) => {
    if (!editing) return
    setEditing({ ...editing, colors: { ...editing.colors, [key]: value } })
  }

  const updateTypography = (
    key: 'heading' | 'body',
    field: 'font' | 'weight' | 'size',
    value: string | number
  ) => {
    if (!editing) return
    setEditing({
      ...editing,
      typography: {
        ...editing.typography,
        [key]: { ...editing.typography[key], [field]: value },
      },
    })
  }

  const updateNumber = (field: 'spacing' | 'borderRadius', value: number) => {
    if (!editing) return
    setEditing({ ...editing, [field]: Math.max(0, value) })
  }

  const inputStyle = {
    background: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-primary)',
    outline: 'none',
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: 12,
    width: '100%',
  }

  const renderEditor = () => {
    if (!editing) return null
    return (
      <div className="space-y-4 mt-4">
        {/* 名称 */}
        <div>
          <label className="text-[11px] font-semibold mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>
            名称
          </label>
          <input
            type="text"
            value={editing.name}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            style={inputStyle}
          />
        </div>

        {/* 色彩 */}
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            <Palette size={12} />
            品牌色彩
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(editing.colors).map(([key, color]) => (
              <div
                key={key}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2"
                style={{
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border-light)',
                }}
              >
                <input
                  type="color"
                  value={color}
                  onChange={(e) => updateColor(key, e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer flex-shrink-0"
                  style={{ border: 'none', padding: 0 }}
                />
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="text-[10px] capitalize" style={{ color: 'var(--color-text-muted)' }}>
                    {key}
                  </div>
                  <div className="text-[11px] font-mono uppercase truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {color}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 字体排版 */}
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            <Type size={12} />
            字体排版
          </div>
          <div className="space-y-2">
            {(['heading', 'body'] as const).map((key) => (
              <div
                key={key}
                className="rounded-xl px-3 py-2.5 space-y-2"
                style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border-light)' }}
              >
                <div className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {key === 'heading' ? '标题' : '正文'}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['font', 'weight', 'size'] as const).map((field) => (
                    <input
                      key={field}
                      type={field === 'weight' ? 'number' : 'text'}
                      value={editing.typography[key][field]}
                      onChange={(e) =>
                        updateTypography(key, field, field === 'weight' ? Number(e.target.value) : e.target.value)
                      }
                      placeholder={field === 'font' ? '字体' : field === 'weight' ? '字重' : '字号'}
                      style={{ ...inputStyle, padding: '5px 8px' }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 间距 & 圆角 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-center gap-1 text-[11px] font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              <Move size={12} />
              基础间距
            </div>
            <input
              type="number"
              value={editing.spacing}
              onChange={(e) => updateNumber('spacing', Number(e.target.value))}
              style={inputStyle}
            />
          </div>
          <div>
            <div className="flex items-center gap-1 text-[11px] font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              <Square size={12} />
              圆角
            </div>
            <input
              type="number"
              value={editing.borderRadius}
              onChange={(e) => updateNumber('borderRadius', Number(e.target.value))}
              style={inputStyle}
            />
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-2 pt-1">
          {isCreating ? (
            <button
              onClick={handleCreate}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm py-2 rounded-xl font-medium transition-all"
              style={{ background: 'var(--color-brand)', color: '#fff' }}
            >
              <Plus size={13} />
              创建
            </button>
          ) : (
            <button
              onClick={() => handleEdit(editing.id)}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm py-2 rounded-xl font-medium transition-all"
              style={{ background: 'var(--color-brand)', color: '#fff' }}
            >
              <Save size={13} />
              保存
            </button>
          )}
          <button
            onClick={() => {
              setEditing(null)
              setIsCreating(false)
            }}
            className="px-3 py-2 text-sm rounded-xl transition-all"
            style={{
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <X size={15} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-bg-elevated)' }}>
      <div
        className="px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-border-light)' }}
      >
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--color-text-secondary)' }}>
          设计系统
        </h3>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          管理品牌色、字体、间距与圆角
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isLoadingDesignSystems ? (
          <div className="text-center text-sm py-8" style={{ color: 'var(--color-text-muted)' }}>
            加载中...
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                已启用
              </span>
              <button
                onClick={startCreate}
                className="flex items-center gap-1 text-xs font-semibold transition-all"
                style={{ color: 'var(--color-brand)' }}
              >
                <Plus size={13} />
                新建
              </button>
            </div>

            <div className="space-y-1.5 mb-5">
              {designSystems.map((system) => (
                <div
                  key={system.id}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-all"
                  style={
                    activeDesignSystem === system.id
                      ? {
                          background: 'var(--color-brand-light)',
                          border: '1px solid var(--color-brand-mid)',
                        }
                      : {
                          background: 'var(--color-bg)',
                          border: '1px solid var(--color-border-light)',
                        }
                  }
                >
                  <button onClick={() => setActiveDesignSystem(system.id)} className="flex-1 text-left">
                    <div
                      className="text-xs font-semibold"
                      style={{
                        color:
                          activeDesignSystem === system.id ? 'var(--color-brand)' : 'var(--color-text-primary)',
                      }}
                    >
                      {system.name}
                    </div>
                    <div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                      {system.builtIn ? '内置' : '自定义'}
                    </div>
                  </button>
                  {activeDesignSystem === system.id && (
                    <Check size={13} style={{ color: 'var(--color-brand)', flexShrink: 0 }} />
                  )}
                  {!system.builtIn && (
                    <>
                      <button
                        onClick={() => handleEdit(system.id)}
                        className="text-[11px] transition-all px-1"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('确定删除这个设计系统吗？')) {
                            deleteDesignSystem(system.id)
                          }
                        }}
                        className="transition-all"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* 当前规范预览 - 修复了颜色键值过滤的bug（应该过滤 v 而非 k） */}
            {active && !editing && (
              <div
                className="rounded-xl p-4"
                style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border-light)' }}
              >
                <div className="text-[11px] font-semibold mb-3" style={{ color: 'var(--color-text-muted)' }}>
                  当前规范预览
                </div>
                <div className="flex items-center gap-1.5 mb-3">
                  <Palette size={12} style={{ color: 'var(--color-text-muted)' }} />
                  <div className="flex gap-1.5 flex-wrap">
                    {Object.entries((active as any).colors || {}).map(([k, v]) => (
                      <div
                        key={k}
                        className="w-5 h-5 rounded-full border"
                        style={{
                          backgroundColor: v as string,
                          borderColor: 'var(--color-border)',
                        }}
                        title={`${k}: ${v}`}
                      />
                    ))}
                  </div>
                </div>
                <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                  AI 生成设计稿时将自动应用此规范约束。
                </div>
              </div>
            )}

            {renderEditor()}
          </>
        )}
      </div>
    </div>
  )
}
