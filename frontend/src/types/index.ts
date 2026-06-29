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

export interface GeneratedCode {
  react?: string
  vue?: string
  css?: string
  timestamp: number
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
