"""
代码生成引擎 —— 设计稿 JSON → React/Vue 组件
"""
import json
import re
from openai import OpenAI
from app.core.config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL

client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)


def generate_code(design: dict, framework: str = "react") -> dict:
    """将设计稿 JSON 转换为前端代码"""

    framework_desc = "React 19 + TypeScript + TailwindCSS" if framework == "react" else "Vue 3 + TypeScript + TailwindCSS"

    try:
        response = client.chat.completions.create(
            model=DEEPSEEK_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": f"""你是一个专业的前端代码生成引擎。将设计稿 JSON 转换为 {framework_desc} 代码。

## 输出格式

返回 JSON：
{{
  "{framework}": "// 组件代码",
  "css": "// 样式代码（可选）"
}}

## 要求
1. 根据设计稿中的 componentType 语义化生成组件
2. 使用 TailwindCSS 类名
3. 保持布局和层级关系
4. 为数据元素（如卡片数值、表格）添加合适的占位数据
5. 代码要可以直接运行
6. 使用现代 React hooks（如设计稿需要交互）或 Vue Composition API
7. 只输出 JSON，不要其他内容""",
                },
                {
                    "role": "user",
                    "content": f"请将以下设计稿 JSON 生成 {framework_desc} 代码：\n{str(design)[:3000]}",
                },
            ],
            temperature=0.3,
            max_tokens=4096,
        )

        content = response.choices[0].message.content or "{}"

        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', content)
        if json_match:
            content = json_match.group(1)

        result = json.loads(content)
        result.setdefault("react", "// 代码生成中...")
        result.setdefault("vue", "// 代码生成中...")
        result.setdefault("css", "")

        return result

    except Exception:
        # 降级：用模板生成基础代码
        return _template_codegen(design, framework)


def _template_codegen(design: dict, framework: str) -> dict:
    """基于模板的降级代码生成"""
    elements = design.get("elements", [])

    # 分析页面结构
    has_header = any(e.get("componentType") == "header" for e in elements)
    has_sidebar = any(e.get("componentType") == "sidebar" for e in elements)
    cards = [e for e in elements if e.get("componentType") == "card" or e.get("type") == "rect" and e.get("width", 0) > 200]

    if framework == "react":
        react_code = _generate_react_template(has_header, has_sidebar, cards)
        return {"react": react_code, "css": ""}
    else:
        vue_code = _generate_vue_template(has_header, has_sidebar, cards)
        return {"vue": vue_code, "css": ""}


def _generate_react_template(has_header: bool, has_sidebar: bool, cards: list) -> str:
    card_items = "\n".join([
        """        <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-2">
          <span className="text-sm text-gray-500">数据指标</span>
          <span className="text-2xl font-bold text-gray-900">--</span>
        </div>"""
        for _ in range(min(len(cards), 4))
    ]) or """        <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-2">
          <span className="text-sm text-gray-500">数据指标</span>
          <span className="text-2xl font-bold text-gray-900">--</span>
        </div>"""

    sidebar_jsx = """      <aside className="w-60 bg-gray-50 border-r border-gray-200 p-4 space-y-2">
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">导航</div>
        {['概览', '数据', '用户', '设置'].map(item => (
          <button key={item} className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            {item}
          </button>
        ))}
      </aside>""" if has_sidebar else ""

    header_jsx = """    <header className="h-16 bg-brand-600 flex items-center px-6 text-white">
      <h1 className="text-lg font-semibold">控制台</h1>
      <div className="ml-auto flex items-center gap-4">
        <span className="text-sm opacity-80">管理员</span>
      </div>
    </header>""" if has_header else ""

    main_classes = "flex-1" if has_sidebar else "flex-1"
    content_inner = "flex" if has_sidebar else ""

    return f"""import React from 'react'

export default function App() {{
  return (
    <div className="min-h-screen bg-gray-50">
{header_jsx}
      <div className="flex flex-1">
{sidebar_jsx}
        <main className="{main_classes} p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
{card_items}
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">详细数据</h2>
            <div className="text-sm text-gray-500">内容区域</div>
          </div>
        </main>
      </div>
    </div>
  )
}}"""


def _generate_vue_template(has_header: bool, has_sidebar: bool, cards: list) -> str:
    card_items = "\n".join([
        """        <div class="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-2">
          <span class="text-sm text-gray-500">数据指标</span>
          <span class="text-2xl font-bold text-gray-900">--</span>
        </div>"""
        for _ in range(min(len(cards), 4))
    ]) or """        <div class="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-2">
          <span class="text-sm text-gray-500">数据指标</span>
          <span class="text-2xl font-bold text-gray-900">--</span>
        </div>"""

    sidebar_template = """    <aside class="w-60 bg-gray-50 border-r border-gray-200 p-4 space-y-2">
      <div class="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">导航</div>
      <button v-for="item in navItems" :key="item"
        class="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
        {{ item }}
      </button>
    </aside>""" if has_sidebar else ""

    header_template = """  <header class="h-16 bg-brand-600 flex items-center px-6 text-white">
    <h1 class="text-lg font-semibold">控制台</h1>
    <div class="ml-auto flex items-center gap-4">
      <span class="text-sm opacity-80">管理员</span>
    </div>
  </header>""" if has_header else ""

    script_data = """const navItems = ref(['概览', '数据', '用户', '设置']);""" if has_sidebar else ""

    return f"""<template>
  <div class="min-h-screen bg-gray-50">
{header_template}
    <div class="flex flex-1">
{sidebar_template}
      <main class="flex-1 p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
{card_items}
        </div>
        <div class="bg-white border border-gray-200 rounded-xl p-6">
          <h2 class="text-base font-semibold text-gray-900 mb-4">详细数据</h2>
          <div class="text-sm text-gray-500">内容区域</div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
{script_data}
</script>"""
