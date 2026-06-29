import { create } from 'zustand'
import type {
  DesignCanvasData,
  ChatMessage,
  GeneratedCode,
  ComplianceReport,
  DesignSystem,
  CanvasElement,
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

  // 面板状态
  activePanel: 'chat' | 'code' | 'compliance' | 'tokens' | 'design-system' | 'mcp'
  showRightPanel: boolean

  // 画布模式
  canvasMode: 'design' | 'preview'

  // 设计系统
  activeDesignSystem: string | null
  designSystems: { id: string; name: string; builtIn: boolean }[]
  isLoadingDesignSystems: boolean

  // Actions
  generateDesign: (prompt: string) => Promise<void>
  refineDesign: (prompt: string) => Promise<void>
  generateCode: (framework: 'react' | 'vue') => Promise<void>
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
  activePanel: 'chat',
  showRightPanel: true,
  canvasMode: 'design',
  activeDesignSystem: 'brand-design-token-23v1',
  designSystems: [],
  isLoadingDesignSystems: false,

  generateDesign: async (prompt: string) => {
    set({ isLoadingDesign: true, isStreaming: true })
    try {
      const result = await api.generateDesign({
        prompt,
        designSystem: get().activeDesignSystem ?? undefined,
      })
      set({
        currentDesign: result.design,
        designAlternatives: result.alternatives ?? [],
        isLoadingDesign: false,
        isStreaming: false,
      })
      get().addChatMessage({
        role: 'assistant',
        content: `已生成设计稿（耗时 ${(result.timeMs / 1000).toFixed(1)}s）\n\n${result.suggestions?.join('\n') || ''}`,
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

  generateCode: async (framework: 'react' | 'vue') => {
    const design = get().currentDesign
    if (!design) return
    set({ isLoadingCode: true })
    try {
      const code = await api.generateCode(design, framework)
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
      set({ activeDesignSystem: 'brand-design-token-23v1' })
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
}))
