export interface DesignToken {
  id: string
  name: string
  category: 'color' | 'typography' | 'spacing' | 'border'
  value: string
  description?: string
}

export interface DesignSystem {
  id: string
  name: string
  colors: Record<string, string>
  typography: {
    heading: { font: string; weight: number; size: string }
    body: { font: string; weight: number; size: string }
  }
  spacing: number // base unit
  borderRadius: number
}

export interface CanvasElement {
  id: string
  type: 'rect' | 'text' | 'image' | 'circle' | 'group' | 'input' | 'button'
  left: number
  top: number
  width: number
  height: number
  fill?: string
  stroke?: string
  strokeWidth?: number
  strokeDasharray?: string  // ★ 虚线边框样式，如 "6,3"
  rx?: number
  ry?: number
  text?: string
  fontSize?: number
  fontFamily?: string
  fontWeight?: number | string
  textAlign?: string
  opacity?: number
  angle?: number
  scaleX?: number
  scaleY?: number
  shadow?: string  // ★ CSS box-shadow 字符串
  placeholder?: string  // ★ 输入框占位文字
  children?: CanvasElement[]
  componentType?: string
  props?: Record<string, unknown>
}

export interface DesignCanvasData {
  version: string
  width: number
  height: number
  elements: CanvasElement[]
  designSystem?: DesignSystem
}

export interface AutoFixResult {
  fixed: boolean
  fixCount?: number
  fixes?: { elementId: string; elementType: string; field: string; from: string; to: string }[]
  message?: string
}

export interface AIDesignRequest {
  prompt: string
  designSystem?: string
  constraints?: {
    minWidth?: number
    maxWidth?: number
    theme?: string
  }
}

export interface AIDesignResponse {
  design: DesignCanvasData
  alternatives?: DesignCanvasData[]
  suggestions?: string[]
  compliance?: ComplianceReport | null
  autoFix?: AutoFixResult | null
  tokens: number
  timeMs: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  designData?: DesignCanvasData
}

export interface CodeCheckDimension {
  category: string
  score: number
  maxScore: number
  details: string
  passed: boolean
}

export interface CodeCheckReport {
  overallScore: number
  dimensions: CodeCheckDimension[]
  suggestions: string[]
  timestamp: number
}

export interface GeneratedCode {
  react?: string
  css?: string
  timestamp: number
  selfCheck?: CodeCheckReport
}

export interface ComplianceReport {
  overallScore: number
  checks: {
    category: string
    passed: boolean
    message: string
    severity: 'error' | 'warning' | 'info'
  }[]
  timestamp: number
}

export interface AIProvider {
  id: string
  name: string
  model: string
  description: string
}

export interface AIProvidersResponse {
  current: string
  available: AIProvider[]
}
