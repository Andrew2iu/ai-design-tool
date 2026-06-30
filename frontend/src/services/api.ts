import type {
  AIDesignRequest,
  AIDesignResponse,
  ChatMessage,
  GeneratedCode,
  ComplianceReport,
  DesignSystem,
} from '../types'

const BASE = '/api'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  generateDesign: (data: AIDesignRequest) =>
    request<AIDesignResponse>('/ai/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  refineDesign: (prompt: string, currentDesign: unknown) =>
    request<AIDesignResponse>('/ai/refine', {
      method: 'POST',
      body: JSON.stringify({ prompt, currentDesign }),
    }),

  generateCode: (design: unknown) =>
    request<GeneratedCode>('/code/generate', {
      method: 'POST',
      body: JSON.stringify({ design, framework: 'react' }),
    }),

  checkCompliance: (design: unknown, designSystemId?: string | null) =>
    request<ComplianceReport>('/design/check-compliance', {
      method: 'POST',
      body: JSON.stringify({ design, designSystem: designSystemId }),
    }),

  getDesignSystems: () =>
    request<{ systems: { id: string; name: string; builtIn: boolean }[] }>('/design/systems'),

  getDesignSystem: (id: string) =>
    request<{ system: DesignSystem & { id: string } }>(`/design/systems/${id}`),

  createDesignSystem: (data: Omit<DesignSystem, 'id'>) =>
    request<{ system: DesignSystem & { id: string } }>('/design/systems', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateDesignSystem: (id: string, data: Omit<DesignSystem, 'id'>) =>
    request<{ system: DesignSystem & { id: string } }>(`/design/systems/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteDesignSystem: (id: string) =>
    request<{ success: boolean }>(`/design/systems/${id}`, {
      method: 'DELETE',
    }),

  getChatHistory: () =>
    request<{ messages: ChatMessage[] }>('/chat/history'),

  healthCheck: () =>
    request<{ status: string; version: string }>('/health'),
}
