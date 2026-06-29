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
        primary: '#0052D9',
        secondary: '#7C4DFF',
        success: '#00A870',
        warning: '#ED7B2F',
        danger: '#E34D59',
        background: '#F5F5F5',
        surface: '#FFFFFF',
      },
      typography: {
        heading: { font: 'Inter', weight: 600, size: '24px' },
        body: { font: 'Inter', weight: 400, size: '14px' },
      },
      spacing: 8,
      borderRadius: 8,
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

  const renderEditor = () => {
    if (!editing) return null
    return (
      <div className="space-y-4 mt-4">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">名称</label>
          <input
            type="text"
            value={editing.name}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-50"
          />
        </div>

        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-2">
            <Palette size={13} />
            品牌色彩
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(editing.colors).map(([key, color]) => (
              <div key={key} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-2 border border-gray-100">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => updateColor(key, e.target.value)}
                  className="w-6 h-6 rounded overflow-hidden border-0 p-0 cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-gray-400 capitalize">{key}</div>
                  <div className="text-xs text-gray-700 font-mono uppercase">{color}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-2">
            <Type size={13} />
            字体排版
          </div>
          <div className="space-y-2">
            {(['heading', 'body'] as const).map((key) => (
              <div key={key} className="bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100 space-y-2">
                <div className="text-xs font-medium text-gray-700 capitalize">{key === 'heading' ? '标题' : '正文'}</div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={editing.typography[key].font}
                    onChange={(e) => updateTypography(key, 'font', e.target.value)}
                    placeholder="字体"
                    className="px-2 py-1.5 text-xs bg-white border border-gray-200 rounded outline-none focus:border-brand-400"
                  />
                  <input
                    type="number"
                    value={editing.typography[key].weight}
                    onChange={(e) => updateTypography(key, 'weight', Number(e.target.value))}
                    placeholder="字重"
                    className="px-2 py-1.5 text-xs bg-white border border-gray-200 rounded outline-none focus:border-brand-400"
                  />
                  <input
                    type="text"
                    value={editing.typography[key].size}
                    onChange={(e) => updateTypography(key, 'size', e.target.value)}
                    placeholder="字号"
                    className="px-2 py-1.5 text-xs bg-white border border-gray-200 rounded outline-none focus:border-brand-400"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1.5">
              <Move size={13} />
              基础间距
            </div>
            <input
              type="number"
              value={editing.spacing}
              onChange={(e) => updateNumber('spacing', Number(e.target.value))}
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-brand-400"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1.5">
              <Square size={13} />
              圆角
            </div>
            <input
              type="number"
              value={editing.borderRadius}
              onChange={(e) => updateNumber('borderRadius', Number(e.target.value))}
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-brand-400"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          {isCreating ? (
            <button
              onClick={handleCreate}
              className="flex-1 flex items-center justify-center gap-1.5 bg-brand-600 text-white text-sm py-2 rounded-lg hover:bg-brand-700 transition-colors"
            >
              <Plus size={14} />
              创建
            </button>
          ) : (
            <button
              onClick={() => handleEdit(editing.id)}
              className="flex-1 flex items-center justify-center gap-1.5 bg-brand-600 text-white text-sm py-2 rounded-lg hover:bg-brand-700 transition-colors"
            >
              <Save size={14} />
              保存
            </button>
          )}
          <button
            onClick={() => {
              setEditing(null)
              setIsCreating(false)
            }}
            className="px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-medium text-gray-700">设计系统</h3>
        <p className="text-xs text-gray-400 mt-0.5">管理品牌色、字体、间距与圆角</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isLoadingDesignSystems ? (
          <div className="text-center text-gray-400 text-sm py-8">加载中...</div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500">已启用</span>
              <button
                onClick={startCreate}
                className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium"
              >
                <Plus size={14} />
                新建
              </button>
            </div>

            <div className="space-y-2 mb-5">
              {designSystems.map((system) => (
                <div
                  key={system.id}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-all ${
                    activeDesignSystem === system.id
                      ? 'bg-brand-50 border-brand-200 text-brand-700'
                      : 'bg-white border-gray-100 text-gray-700 hover:border-gray-200'
                  }`}
                >
                  <button
                    onClick={() => setActiveDesignSystem(system.id)}
                    className="flex-1 text-left"
                  >
                    <div className="font-medium">{system.name}</div>
                    <div className="text-[10px] text-gray-400">{system.builtIn ? '内置' : '自定义'}</div>
                  </button>
                  {activeDesignSystem === system.id && <Check size={14} className="text-brand-600" />}
                  {!system.builtIn && (
                    <button
                      onClick={() => handleEdit(system.id)}
                      className="text-xs text-gray-400 hover:text-brand-600 px-1"
                    >
                      编辑
                    </button>
                  )}
                  {!system.builtIn && (
                    <button
                      onClick={() => {
                        if (confirm('确定删除这个设计系统吗？')) {
                          deleteDesignSystem(system.id)
                        }
                      }}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {active && !editing && (
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="text-xs font-medium text-gray-500 mb-3">当前规范预览</div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Palette size={13} className="text-gray-400" />
                    <div className="flex gap-1.5">
                      {Object.entries(
                        designSystems.find((s) => s.id === activeDesignSystem) || {}
                      )
                        .filter(([k]) => k.startsWith('#'))
                        .map(([k, v]) => (
                          <div
                            key={k}
                            className="w-5 h-5 rounded-full border border-gray-200"
                            style={{ backgroundColor: v as string }}
                            title={k}
                          />
                        ))}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    选择上方设计系统，AI 生成设计稿时将自动应用对应规范。
                  </div>
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
