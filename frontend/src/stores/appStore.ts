import { create } from 'zustand'
import type {
  DesignCanvasData,
  ChatMessage,
  GeneratedCode,
  ComplianceReport,
  DesignSystem,
  CanvasElement,
  AutoFixResult,
  AIProvider,
} from '../types'
import { api } from '../services/api'

interface AppState {
  // 设计画布
  currentDesign: DesignCanvasData | null
  designAlternatives: DesignCanvasData[]
  isLoadingDesign: boolean

  // 聊天
  messages: ChatMessage[]
  isStreaming: boolean

  // 代码生成
  generatedCode: GeneratedCode | null
  isLoadingCode: boolean

  // 合规检查
  compliance: ComplianceReport | null
  autoFix: AutoFixResult | null

  // 面板状态
  activePanel: 'chat' | 'code' | 'compliance' | 'design-system' | 'mcp'
  showRightPanel: boolean

  // 画布模式
  canvasMode: 'design' | 'preview'

  // 设计系统
  activeDesignSystem: string | null
  designSystems: { id: string; name: string; builtIn: boolean }[]
  isLoadingDesignSystems: boolean

  // AI 提供商
  aiProviders: AIProvider[]
  currentProvider: string
  isLoadingProviders: boolean

  // Actions
  generateDesign: (prompt: string) => Promise<void>
  refineDesign: (prompt: string) => Promise<void>
  generateCode: () => Promise<void>
  checkCompliance: () => Promise<void>
  addChatMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  setActivePanel: (panel: AppState['activePanel']) => void
  toggleRightPanel: () => void
  setCurrentDesign: (design: DesignCanvasData | null) => void
  setCanvasMode: (mode: AppState['canvasMode']) => void
  setActiveDesignSystem: (id: string | null) => void
  loadDesignSystems: () => Promise<void>
  createDesignSystem: (data: Omit<DesignSystem, 'id'>) => Promise<string>
  updateDesignSystem: (id: string, data: Omit<DesignSystem, 'id'>) => Promise<void>
  deleteDesignSystem: (id: string) => Promise<void>
  addCanvasElement: (el: Omit<CanvasElement, 'id'>) => void
  updateCanvasElement: (id: string, updates: Partial<CanvasElement>) => void
  deleteCanvasElement: (id: string) => void
  moveCanvasElement: (id: string, direction: 'front' | 'back' | 'forward' | 'backward') => void
  clearCanvas: () => void
  switchToVariant: (index: number) => void
  loadAIProviders: () => Promise<void>
  switchAIProvider: (providerId: string) => Promise<void>
  selectedElementId: string | null
  setSelectedElementId: (id: string | null) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  currentDesign: null,
  designAlternatives: [],
  isLoadingDesign: false,
  messages: [],
  isStreaming: false,
  generatedCode: null,
  isLoadingCode: false,
  compliance: null,
  autoFix: null,
  activePanel: 'chat',
  showRightPanel: true,
  canvasMode: 'design',
  activeDesignSystem: 'mdui-material-3',
  designSystems: [],
  isLoadingDesignSystems: false,
  selectedElementId: null,
  aiProviders: [],
  currentProvider: 'deepseek',
  isLoadingProviders: false,

  generateDesign: async (prompt: string) => {
    set({ isLoadingDesign: true, isStreaming: true })
    try {
      const result = await api.generateDesign({
        prompt,
        designSystem: get().activeDesignSystem ?? undefined,
      })
      const alternatives = result.alternatives ?? []
      const autoFix = result.autoFix ?? null
      const compliance = result.compliance ?? null

      set({
        currentDesign: result.design,
        designAlternatives: alternatives,
        compliance,
        autoFix,
        isLoadingDesign: false,
        isStreaming: false,
      })

      // 构建消息内容
      const parts: string[] = []
      parts.push(`已生成设计稿（耗时 ${(result.timeMs / 1000).toFixed(1)}s）`)

      if (autoFix?.fixed) {
        parts.push(`\n🔧 已自动修正 ${autoFix.fixCount} 处颜色以符合品牌规范`)
      }

      if (compliance) {
        const failCount = compliance.checks.filter((c) => !c.passed).length
        if (failCount > 0) {
          parts.push(`\n⚠️ 规范检查：${failCount} 项未通过（${compliance.overallScore}分）`)
        } else {
          parts.push(`\n✅ 规范检查全部通过（${compliance.overallScore}分）`)
        }
      }

      if (alternatives.length > 0) {
        parts.push(`\n💡 已生成 ${alternatives.length + 1} 个方案变体，可在画布上方切换`)
      }

      parts.push(`\n${result.suggestions?.join('\n') || ''}`)

      get().addChatMessage({
        role: 'assistant',
        content: parts.join('\n'),
        designData: result.design,
      })
    } catch (err) {
      set({ isLoadingDesign: false, isStreaming: false })
      get().addChatMessage({
        role: 'assistant',
        content: `生成失败: ${(err as Error).message}`,
      })
    }
  },

  refineDesign: async (prompt: string) => {
    const current = get().currentDesign
    if (!current) return
    set({ isLoadingDesign: true, isStreaming: true })
    try {
      const result = await api.refineDesign(prompt, current)
      set({
        currentDesign: result.design,
        isLoadingDesign: false,
        isStreaming: false,
      })
      get().addChatMessage({
        role: 'assistant',
        content: `已根据你的要求调整设计。${result.suggestions?.[0] || ''}`,
        designData: result.design,
      })
    } catch (err) {
      set({ isLoadingDesign: false, isStreaming: false })
      get().addChatMessage({
        role: 'assistant',
        content: `调整失败: ${(err as Error).message}`,
      })
    }
  },

  generateCode: async () => {
    const design = get().currentDesign
    if (!design) return
    set({ isLoadingCode: true })
    try {
      const code = await api.generateCode(design)
      set({ generatedCode: code, isLoadingCode: false })
    } catch (err) {
      set({ isLoadingCode: false })
      get().addChatMessage({
        role: 'assistant',
        content: `代码生成失败: ${(err as Error).message}`,
      })
    }
  },

  checkCompliance: async () => {
    const design = get().currentDesign
    if (!design) return
    try {
      const report = await api.checkCompliance(design, get().activeDesignSystem)
      set({ compliance: report })
    } catch (err) {
      get().addChatMessage({
        role: 'assistant',
        content: `合规检查失败: ${(err as Error).message}`,
      })
    }
  },

  addChatMessage: (msg) => {
    const message: ChatMessage = {
      ...msg,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    }
    set((s) => ({ messages: [...s.messages, message] }))
  },

  setActivePanel: (panel) => set({ activePanel: panel, showRightPanel: true }),
  toggleRightPanel: () => set((s) => ({ showRightPanel: !s.showRightPanel })),
  setCurrentDesign: (design) => set({ currentDesign: design }),
  setCanvasMode: (mode) => set({ canvasMode: mode }),
  setActiveDesignSystem: (id) => set({ activeDesignSystem: id }),

  loadDesignSystems: async () => {
    set({ isLoadingDesignSystems: true })
    try {
      const result = await api.getDesignSystems()
      set({ designSystems: result.systems, isLoadingDesignSystems: false })
    } catch (err) {
      set({ isLoadingDesignSystems: false })
      get().addChatMessage({
        role: 'assistant',
        content: `加载设计系统失败: ${(err as Error).message}`,
      })
    }
  },

  createDesignSystem: async (data) => {
    const result = await api.createDesignSystem(data)
    await get().loadDesignSystems()
    return result.system.id
  },

  updateDesignSystem: async (id, data) => {
    await api.updateDesignSystem(id, data)
    await get().loadDesignSystems()
  },

  deleteDesignSystem: async (id) => {
    await api.deleteDesignSystem(id)
    await get().loadDesignSystems()
    if (get().activeDesignSystem === id) {
      set({ activeDesignSystem: 'mdui-material-3' })
    }
  },

  addCanvasElement: (el) => {
    const current = get().currentDesign
    const element: CanvasElement = {
      ...el,
      id: crypto.randomUUID(),
    }
    if (!current) {
      set({
        currentDesign: {
          version: '6.0.0',
          width: 1200,
          height: 800,
          elements: [element],
        },
      })
    } else {
      set({
        currentDesign: {
          ...current,
          elements: [...current.elements, element],
        },
      })
    }
  },

  updateCanvasElement: (id, updates) => {
    const current = get().currentDesign
    if (!current) return
    set({
      currentDesign: {
        ...current,
        elements: current.elements.map((el) =>
          el.id === id ? { ...el, ...updates } : el
        ),
      },
    })
  },

  deleteCanvasElement: (id) => {
    const current = get().currentDesign
    if (!current) return
    if (get().selectedElementId === id) set({ selectedElementId: null })
    set({
      currentDesign: {
        ...current,
        elements: current.elements.filter((el) => el.id !== id),
      },
    })
  },

  moveCanvasElement: (id, direction) => {
    const current = get().currentDesign
    if (!current) return
    const elements = [...current.elements]
    const idx = elements.findIndex((e) => e.id === id)
    if (idx === -1) return

    switch (direction) {
      case 'front': {
        if (idx < elements.length - 1) {
          const [el] = elements.splice(idx, 1)
          elements.push(el)
        }
        break
      }
      case 'back': {
        if (idx > 0) {
          const [el] = elements.splice(idx, 1)
          elements.unshift(el)
        }
        break
      }
      case 'forward': {
        if (idx < elements.length - 1) {
          ;[elements[idx], elements[idx + 1]] = [elements[idx + 1], elements[idx]]
        }
        break
      }
      case 'backward': {
        if (idx > 0) {
          ;[elements[idx], elements[idx - 1]] = [elements[idx - 1], elements[idx]]
        }
        break
      }
    }

    set({ currentDesign: { ...current, elements } })
  },

  clearCanvas: () => {
    set({ currentDesign: null, selectedElementId: null })
  },

  switchToVariant: (index: number) => {
    const { currentDesign, designAlternatives } = get()
    if (designAlternatives.length === 0) return
    // 当前方案压入 alternatives，选中方案取出
    const allVariants = [currentDesign!, ...designAlternatives]
    const target = allVariants[index]
    if (!target) return
    const newAlternatives = allVariants.filter((_, i) => i !== index)
    set({
      currentDesign: target,
      designAlternatives: newAlternatives,
    })
  },

  setSelectedElementId: (id) => set({ selectedElementId: id }),

  loadAIProviders: async () => {
    set({ isLoadingProviders: true })
    try {
      const result = await api.getAIProviders()
      set({
        aiProviders: result.available,
        currentProvider: result.current,
        isLoadingProviders: false,
      })
    } catch {
      set({ isLoadingProviders: false })
    }
  },

  switchAIProvider: async (providerId: string) => {
    set({ isLoadingProviders: true })
    try {
      const result = await api.switchAIProvider(providerId)
      set({
        currentProvider: result.current,
        aiProviders: result.available,
        isLoadingProviders: false,
      })
      get().addChatMessage({
        role: 'system',
        content: `已切换AI模型为: ${result.current === 'ollama' ? 'Ollama 本地（数据安全）' : result.current === 'openai' ? 'OpenAI GPT' : 'DeepSeek 云端'}`,
      })
    } catch (err) {
      set({ isLoadingProviders: false })
      get().addChatMessage({
        role: 'system',
        content: `切换模型失败: ${(err as Error).message}`,
      })
    }
  },
}))
