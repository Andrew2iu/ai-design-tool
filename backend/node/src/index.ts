/**
 * AI Design Studio MCP Server (HTTP / SSE mode)
 *
 * 通过 MCP 协议向外部 AI Agent（Cursor、Claude Code 等）暴露设计工具能力：
 * - 获取当前设计稿上下文
 * - 修改设计元素
 * - 提取设计规范
 * - 生成组件代码
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

// --- 工具定义 ---

const TOOLS = [
  {
    name: "get_design_context",
    description: "获取当前设计画布的完整 JSON 数据，包括所有元素的坐标、样式和组件类型",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "add_design_element",
    description: "向当前设计画布添加一个新元素（矩形、文字、圆形等）",
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
    description: "修改设计画布中指定元素的属性",
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
    description: "提取当前设计的 Design Tokens（色彩、字体、间距等规范）",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "generate_component_code",
    description: "根据设计画布元素生成 React 或 Vue 组件代码",
    inputSchema: {
      type: "object" as const,
      properties: {
        framework: { type: "string", enum: ["react", "vue"], default: "react" },
      },
    },
  },
];

// --- 模拟设计状态（实际部署时连接真实设计画布） ---

let designState = getDefaultDesign();

function getDefaultDesign() {
  return {
    version: "6.0.0",
    width: 1200,
    height: 800,
    elements: [
      {
        id: "header_bg",
        type: "rect",
        left: 0,
        top: 0,
        width: 1200,
        height: 64,
        fill: "#0052D9",
        rx: 0,
        ry: 0,
        opacity: 1,
        componentType: "header",
      },
      {
        id: "header_title",
        type: "text",
        left: 40,
        top: 20,
        width: 200,
        height: 28,
        text: "控制台",
        fontSize: 20,
        fontFamily: "Inter",
        fontWeight: "bold",
        fill: "#ffffff",
        componentType: "header",
      },
      {
        id: "main_card",
        type: "rect",
        left: 280,
        top: 104,
        width: 640,
        height: 400,
        fill: "#ffffff",
        stroke: "#e5e7eb",
        strokeWidth: 1,
        rx: 12,
        ry: 12,
        opacity: 1,
        componentType: "card",
      },
    ],
  };
}

function generateId() {
  return `el_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

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
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(designState, null, 2),
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

        designState.elements.push(el as never);

        return {
          content: [
            {
              type: "text",
              text: `元素已添加: ${el.id} (${params.type})`,
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

        const idx = designState.elements.findIndex((e: Record<string, unknown>) => e.id === params.elementId);
        if (idx === -1) {
          return {
            content: [{ type: "text", text: `未找到元素: ${params.elementId}` }],
            isError: true,
          };
        }

        Object.assign(designState.elements[idx], params.properties);
        return {
          content: [
            {
              type: "text",
              text: `元素 ${params.elementId} 已更新`,
            },
          ],
        };
      }

      case "extract_design_tokens": {
        const tokens = extractTokens(designState);
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
        const framework = (a.framework as string) || "react";
        const code = generateCode(designState, framework);
        return {
          content: [
            {
              type: "text",
              text: code,
            },
          ],
        };
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
