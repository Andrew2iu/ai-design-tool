"""
代码生成引擎 —— 设计稿 JSON → React 组件 + 自检报告
"""
import json
import re
import time
from openai import OpenAI
from app.core.config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL
from app.services.codegen_checker import check_code_accuracy

_client = None

def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)
    return _client


def generate_code(design: dict, framework: str = "react") -> dict:
    """将设计稿 JSON 转换为 React 组件代码（含自检报告）"""

    try:
        response = _get_client().chat.completions.create(
            model=DEEPSEEK_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": f"""你是一个专业的前端代码生成引擎。将设计稿 JSON 转换为 React 19 + TypeScript + TailwindCSS 代码。

## 输出格式

返回 JSON：
{{
  "react": "// 组件代码",
  "css": "// 样式代码（可选）"
}}

## 要求
1. 根据设计稿中的 componentType 语义化生成组件
2. 使用 TailwindCSS 类名，确保颜色、间距与设计稿精确一致
3. 保持布局和层级关系，不要遗漏任何元素
4. 保留设计稿中的文字内容，不要替换为占位文字
5. 代码要可以直接运行
6. 使用现代 React hooks（如设计稿需要交互）
7. 每个设计稿元素都应在代码中有对应实现
8. 只输出 JSON，不要其他内容""",
                },
                {
                    "role": "user",
                    "content": f"请将以下设计稿 JSON 生成 React 19 + TypeScript + TailwindCSS 代码：\n{str(design)[:3000]}",
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
        result.setdefault("css", "")

        # 🔍 自检
        react_code = result.get("react", "")
        self_check = check_code_accuracy(design, react_code)
        result["selfCheck"] = self_check

        return result

    except Exception:
        # 降级：用模板生成基础代码
        result = _template_codegen(design)
        # 降级代码也做一次自检
        try:
            react_code = result.get("react", "")
            self_check = check_code_accuracy(design, react_code)
            result["selfCheck"] = self_check
        except Exception:
            pass
        return result


def _template_codegen(design: dict) -> dict:
    """基于模板的降级代码生成"""
    elements = design.get("elements", [])

    # 分析页面结构
    has_header = any(e.get("componentType") == "header" for e in elements)
    has_sidebar = any(e.get("componentType") == "sidebar" for e in elements)
    cards = [e for e in elements if e.get("componentType") == "card" or e.get("type") == "rect" and e.get("width", 0) > 200]

    react_code = _generate_react_template(has_header, has_sidebar, cards)
    return {"react": react_code, "css": ""}


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
