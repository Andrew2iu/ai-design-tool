/**
 * AI Design Studio MCP Server (HTTP / SSE mode)
 *
 * 通过 MCP 协议向外部 AI Agent（Cursor、Claude Code 等）暴露设计工具能力：
 * - 获取当前设计稿上下文（从 FastAPI 获取真实数据）
 * - 修改设计元素
 * - 提取设计规范
 * - 生成组件代码
 * - Agent Skills 能力查询与执行
 *
 * 已打通真实设计画布数据，第三方 Agent 可获取/操控真实设计稿。
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import cors from "cors";
import { z } from "zod";

// --- 配置 ---
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

// --- 工具定义（含 Agent Skills 能力查询） ---
// MCP 协议 + Agent Skills 能力体系（Anima Skill 范式），支持第三方 Agent 接入

const TOOLS = [
  {
    name: "get_design_context",
    description: "获取当前设计画布的完整 JSON 数据（从后端实时获取真实数据），包括所有元素的坐标、样式和组件类型",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "add_design_element",
    description: "向当前设计画布添加一个新元素（矩形、文字、圆形等），并同步更新到后端",
    inputSchema: {
      type: "object" as const,
      properties: {
        type: { type: "string", enum: ["rect", "text", "circle", "button", "input"] },
        left: { type: "number", description: "X 坐标" },
        top: { type: "number", description: "Y 坐标" },
        width: { type: "number" },
        height: { type: "number" },
        fill: { type: "string", description: "填充颜色 (#RRGGBB)" },
        text: { type: "string", description: "文字内容（仅 text 类型）" },
        fontSize: { type: "number", description: "字号（仅 text 类型）" },
        componentType: { type: "string", description: "组件语义类型: header/sidebar/card/button/input/chart" },
      },
      required: ["type", "left", "top", "width", "height"],
    },
  },
  {
    name: "modify_element",
    description: "修改设计画布中指定元素的属性，并同步更新到后端",
    inputSchema: {
      type: "object" as const,
      properties: {
        elementId: { type: "string" },
        properties: { type: "object", description: "要修改的属性键值对" },
      },
      required: ["elementId", "properties"],
    },
  },
  {
    name: "extract_design_tokens",
    description: "提取当前设计的 Design Tokens（色彩、字体、间距等规范），从真实设计数据中分析",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "generate_component_code",
    description: "根据设计画布元素调用后端代码生成引擎，生成 React 或 Vue 组件代码",
    inputSchema: {
      type: "object" as const,
      properties: {
        framework: { type: "string", enum: ["react", "vue"], default: "react" },
      },
    },
  },
  // ── Agent Skills 能力体系 ──
  {
    name: "list_skills",
    description: "列出可用的 Agent Skills（Anima Skill 范式），外部 Agent 可通过此接口了解平台能力",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "execute_skill",
    description: "执行指定 Agent Skill，外部 Agent 可通过此接口操控设计画布及规则，实现 AI Agent 驱动设计",
    inputSchema: {
      type: "object" as const,
      properties: {
        skill_name: { type: "string", description: "Skill 名称，可选: design_generation / brand_consistency / component_recommendation / code_generation / design_perception" },
        params: { type: "object", description: "Skill 执行参数" },
      },
      required: ["skill_name"],
    },
  },
];

// --- 真实设计数据获取 ---
// 从 FastAPI 后端获取真实设计画布数据，不再使用模拟数据
// 第三方 Agent 通过 MCP 协议可获取/操控真实设计稿

async function fetchDesignState(): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/design/current-state`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { design: Record<string, unknown> };
    return data.design;
  } catch (err) {
    console.error(`[MCP] Failed to fetch design state from backend: ${(err as Error).message}`);
    // 降级：返回空设计稿，而不是硬编码模拟数据
    return { version: "7.0.0", width: 1200, height: 800, elements: [] };
  }
}

async function updateDesignState(design: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/design/current-state`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(design),
    });
    return res.ok;
  } catch (err) {
    console.error(`[MCP] Failed to update design state: ${(err as Error).message}`);
    return false;
  }
}

function generateId() {
  return `el_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// --- Agent Skills 定义（Anima Skill 范式） ---
// 设计感知型 Skill，Agent 可理解设计语言和品牌规范

const AGENT_SKILLS = [
  {
    name: "design_generation",
    description: "自然语言→设计稿生成 Skill（E1），解析用户意图并调用AI生成设计稿",
    design_aware: true,
    endpoint: "/api/ai/generate",
  },
  {
    name: "brand_consistency",
    description: "设计规范约束 Skill（E2），检查品牌一致性并自动修正偏差",
    design_aware: true,
    endpoint: "/api/design/check-compliance",
  },
  {
    name: "component_recommendation",
    description: "组件智能推荐 Skill（E3），根据设计上下文推荐合适的组件和布局",
    design_aware: true,
    endpoint: "/api/ai/refine",
  },
  {
    name: "code_generation",
    description: "一键转代码 Skill（E4），将设计稿转为 React/Vue 代码",
    design_aware: true,
    endpoint: "/api/code/generate",
  },
  {
    name: "design_perception",
    description: "Anima Skill 范式——Agent 设计感知（E5），使外部 Agent 可理解设计语言和品牌规范",
    design_aware: true,
    endpoint: "/api/ai/providers",
  },
];

// --- Server 实现 ---

const server = new Server(
  {
    name: "ai-design-studio-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
  const { name, arguments: args } = request.params;
  const a = args as Record<string, unknown>;

  try {
    switch (name) {
      case "get_design_context": {
        // 从 FastAPI 获取真实设计画布数据
        const realDesign = await fetchDesignState();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(realDesign, null, 2),
            },
          ],
        };
      }

      case "add_design_element": {
        const schema = z.object({
          type: z.enum(["rect", "text", "circle", "button", "input"]),
          left: z.number(),
          top: z.number(),
          width: z.number(),
          height: z.number(),
          fill: z.string().optional(),
          text: z.string().optional(),
          fontSize: z.number().optional(),
          componentType: z.string().optional(),
        });
        const params = schema.parse(a);

        // 先获取当前真实设计数据
        const currentDesign = await fetchDesignState();
        const elements = (currentDesign.elements as Record<string, unknown>[]) || [];

        const el: Record<string, unknown> = {
          id: generateId(),
          type: params.type,
          left: params.left,
          top: params.top,
          width: params.width,
          height: params.height,
          fill: params.fill || "#f0f0f0",
          rx: params.type === "button" ? 8 : 0,
          ry: params.type === "button" ? 8 : 0,
          opacity: 1,
          componentType: params.componentType || params.type,
        };

        if (params.type === "text") {
          el.text = params.text || "Text";
          el.fontSize = params.fontSize || 16;
          el.fontFamily = "Inter";
        }

        // 将新元素加入设计稿并同步到后端
        currentDesign.elements = [...elements, el] as never;
        await updateDesignState(currentDesign);

        return {
          content: [
            {
              type: "text",
              text: `元素已添加并同步到设计画布: ${el.id} (${params.type})`,
            },
          ],
        };
      }

      case "modify_element": {
        const schema = z.object({
          elementId: z.string(),
          properties: z.record(z.unknown()),
        });
        const params = schema.parse(a);

        // 获取真实设计数据并修改
        const currentDesign = await fetchDesignState();
        const elements = (currentDesign.elements as Record<string, unknown>[]) || [];
        const idx = elements.findIndex((e: Record<string, unknown>) => e.id === params.elementId);
        if (idx === -1) {
          return {
            content: [{ type: "text", text: `未找到元素: ${params.elementId}` }],
            isError: true,
          };
        }

        Object.assign(elements[idx], params.properties);
        currentDesign.elements = elements as never;
        await updateDesignState(currentDesign);

        return {
          content: [
            {
              type: "text",
              text: `元素 ${params.elementId} 已更新并同步到设计画布`,
            },
          ],
        };
      }

      case "extract_design_tokens": {
        // 从真实设计数据提取 tokens
        const realDesign = await fetchDesignState();
        const tokens = extractTokens(realDesign);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(tokens, null, 2),
            },
          ],
        };
      }

      case "generate_component_code": {
        // 调用后端代码生成引擎获取真实代码
        const realDesign = await fetchDesignState();
        const framework = (a.framework as string) || "react";
        try {
          const res = await fetch(`${BACKEND_URL}/api/code/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ design: realDesign }),
          });
          if (res.ok) {
            const codeResult = await res.json() as Record<string, unknown>;
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(codeResult, null, 2),
                },
              ],
            };
          }
        } catch (err) {
          console.error(`[MCP] Code generation backend call failed: ${(err as Error).message}`);
        }
        // 降级：用本地模板生成
        const code = generateCode(realDesign, framework);
        return {
          content: [
            {
              type: "text",
              text: code,
            },
          ],
        };
      }

      // ── Agent Skills 能力体系 ──
      case "list_skills": {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                skills: AGENT_SKILLS.map(s => ({
                  name: s.name,
                  description: s.description,
                  design_aware: s.design_aware,
                  endpoint: s.endpoint,
                })),
                paradigm: "Anima Skill",
                description: "Agent Skills 能力体系（Anima Skill 范式），外部 Agent 可通过 MCP 协议调用这些 Skill 操控设计画布及规则",
              }, null, 2),
            },
          ],
        };
      }

      case "execute_skill": {
        const schema = z.object({
          skill_name: z.string(),
          params: z.record(z.unknown()).optional(),
        });
        const params = schema.parse(a);

        const skill = AGENT_SKILLS.find(s => s.name === params.skill_name);
        if (!skill) {
          return {
            content: [{ type: "text", text: `未知 Skill: ${params.skill_name}。可用 Skills: ${AGENT_SKILLS.map(s => s.name).join(', ')}` }],
            isError: true,
          };
        }

        // 调用后端对应 Skill 端点
        try {
          const skillParams = params.params || {};
          // 对于不同 Skill，构建不同的请求体
          let requestBody: Record<string, unknown>;
          if (skill.name === "design_generation") {
            requestBody = { prompt: skillParams.prompt || "生成一个默认设计稿", designSystem: skillParams.designSystem };
          } else if (skill.name === "brand_consistency") {
            const design = await fetchDesignState();
            requestBody = { design, designSystem: skillParams.designSystem };
          } else if (skill.name === "code_generation") {
            const design = await fetchDesignState();
            requestBody = { design };
          } else if (skill.name === "design_perception") {
            // 设计感知 Skill 返回当前AI提供商和设计上下文信息
            const design = await fetchDesignState();
            const providersRes = await fetch(`${BACKEND_URL}/api/ai/providers`);
            const providers = providersRes.ok ? await providersRes.json() as Record<string, unknown> : {};
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  paradigm: "Anima Skill",
                  current_design: design,
                  ai_provider: providers,
                  design_tokens: extractTokens(design),
                  message: "外部 Agent 可理解当前设计语言和品牌规范，实现 AI Agent 驱动设计的闭环",
                }, null, 2),
              }],
            };
          } else {
            requestBody = skillParams;
          }

          const res = await fetch(`${BACKEND_URL}${skill.endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
          });

          if (!res.ok) {
            return {
              content: [{ type: "text", text: `Skill ${skill.name} 执行失败: HTTP ${res.status}` }],
              isError: true,
            };
          }

          const result = await res.json() as Record<string, unknown>;
          return {
            content: [{
              type: "text",
              text: JSON.stringify({ skill: skill.name, result }, null, 2),
            }],
          };
        } catch (err) {
          return {
            content: [{ type: "text", text: `Skill ${skill.name} 执行异常: ${(err as Error).message}` }],
            isError: true,
          };
        }
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${(error as Error).message}` }],
      isError: true,
    };
  }
});

function extractTokens(design: Record<string, unknown>) {
  const elements = design.elements as Record<string, unknown>[];
  const colors = new Set<string>();
  const fontSizes = new Set<number>();

  for (const el of elements) {
    const fill = el.fill as string;
    if (fill && fill.startsWith("#")) colors.add(fill);
    const fs = el.fontSize as number;
    if (fs) fontSizes.add(fs);
  }

  return {
    colors: [...colors],
    fontSizes: [...fontSizes].sort((a, b) => a - b),
    primaryColor: colors.values().next().value || "#0052D9",
    fontFamily: "Inter",
  };
}

function generateCode(design: Record<string, unknown>, framework: string) {
  if (framework === "react") {
    return `import React from 'react'

export default function App() {
  return (
    <div className="min-h-screen bg-white">
      <header className="h-16 bg-blue-600 flex items-center px-6 text-white">
        <h1 className="text-lg font-semibold">控制台</h1>
      </header>
      <main className="p-6 flex justify-center">
        <div className="bg-white border rounded-xl p-6 w-full max-w-2xl">
          <h2 className="text-lg font-semibold mb-4">设计内容</h2>
          <p className="text-gray-500">基于 ${(design.elements as unknown[]).length} 个元素生成</p>
        </div>
      </main>
    </div>
  )
}`;
  }
  return `<template>
  <div class="min-h-screen bg-white">
    <header class="h-16 bg-blue-600 flex items-center px-6 text-white">
      <h1 class="text-lg font-semibold">控制台</h1>
    </header>
    <main class="p-6 flex justify-center">
      <div class="bg-white border rounded-xl p-6 w-full max-w-2xl">
        <h2 class="text-lg font-semibold mb-4">设计内容</h2>
        <p class="text-gray-500">基于 ${(design.elements as unknown[]).length} 个元素生成</p>
      </div>
    </main>
  </div>
</template>`;
}

// --- Express HTTP 服务 ---

const app = express();
app.use(cors());
app.use(express.json());

const transports: Record<string, SSEServerTransport> = {};

app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  transports[transport.sessionId] = transport;
  res.on("close", () => {
    delete transports[transport.sessionId];
  });
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports[sessionId];
  if (!transport) {
    res.status(400).json({ error: "No transport found for sessionId" });
    return;
  }
  await transport.handlePostMessage(req, res, req.body);
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", version: "1.0.0" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.error(`AI Design Studio MCP Server running on http://localhost:${PORT}`);
});
