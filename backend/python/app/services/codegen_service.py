"""
代码生成引擎 —— 设计稿 JSON → React 组件 + 自检报告
支持多模型动态切换（Ollama本地 / DeepSeek云端 / OpenAI GPT）
"""
import json
import re
import time
from openai import OpenAI
from app.core.config import get_ai_client
from app.services.codegen_checker import check_code_accuracy

# 动态获取 AI 客户端 — 支持 Ollama / DeepSeek / OpenAI 多模型切换
def _get_client() -> tuple[OpenAI, str]:
    client, model = get_ai_client()
    return client, model


def _build_design_summary(design: dict) -> str:
    """将设计稿 JSON 精炼为 AI 可高效理解的摘要格式，避免直接丢原始 JSON"""
    elements = design.get("elements", [])
    width = design.get("width", 1200)
    height = design.get("height", 800)
    design_system = design.get("designSystem", "custom")
    background = design.get("background", "#ffffff")

    lines = [f"画布: {width}x{height}, 背景={background}, 设计系统={design_system}"]

    for el in elements:
        eid = el.get("id", "?")
        etype = el.get("type", "rect")
        comp = el.get("componentType", etype)
        x, y = el.get("left", 0), el.get("top", 0)
        w, h = el.get("width", 100), el.get("height", 50)
        fill = el.get("fill", "#ccc")
        rx = el.get("rx", 0)
        ry = el.get("ry", 0)
        opacity = el.get("opacity", 1)
        text = el.get("text", "")
        fs = el.get("fontSize", 14)
        ff = el.get("fontFamily", "Inter")
        fw = el.get("fontWeight", "normal")
        stroke = el.get("stroke", "")
        sw = el.get("strokeWidth", 0)
        placeholder = el.get("placeholder", "")
        align = el.get("textAlign", "left")

        line = f"[{eid}] {comp}({etype}) @({x},{y}) {w}x{h} fill={fill} rx={rx} opacity={opacity}"
        extras = []
        if text:
            extras.append(f"text='{text}' fs={fs} fw={fw} ff={ff} align={align}")
        if placeholder:
            extras.append(f"placeholder='{placeholder}'")
        if stroke:
            extras.append(f"stroke={stroke} sw={sw}")
        if rx > 0:
            extras.append(f"rounded(rx={rx})")
        if extras:
            line += " | " + " ".join(extras)
        lines.append(line)

    return "\n".join(lines)


def generate_code(design: dict, framework: str = "react") -> dict:
    """将设计稿 JSON 转换为 React 组件代码（含自检报告）"""

    design_summary = _build_design_summary(design)
    design_json_str = json.dumps(design, ensure_ascii=False)

    try:
        client, model = _get_client()
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": """你是一个专业的前端代码生成引擎，专门将设计稿精确还原为 React 19 + TypeScript + TailwindCSS 组件代码。

## 核心要求（必须严格遵守）

1. **像素级还原**：每个设计稿元素都必须在代码中有对应实现，位置、大小、颜色、文字必须精确匹配
2. **布局还原**：使用绝对定位+translate 或 flex/grid 模拟设计稿的元素位置关系，不要随意改变布局
3. **颜色精确**：设计稿中的 fill/stroke 颜色必须用 bg-[#hex] / text-[#hex] / border-[#hex] 精确指定，不要用 Tailwind 语义色替换
4. **文字完整**：设计稿中的 text/placeholder 内容必须原样保留，不能改成占位文字
5. **圆角还原**：design稿中的 rx/ry 值必须用 rounded-[Npx] 精确指定
6. **字号还原**：fontSize 必须用 text-[Npx] 精确指定，不要用 text-sm/text-lg 等语义字号
7. **层级还原**：opacity 和叠加关系必须保留

## 生成策略

- **外层容器**：使用相对定位容器 (relative)，宽高与画布一致
- **每个元素**：使用 absolute 定位，left/top/width/height 与设计稿完全一致
- **文字元素**：用 <span> 或 <p>，保留 fontSize/fontWeight/fontFamily/textAlign
- **按钮元素**：用 <button>，保留圆角、填充色、文字
- **输入框元素**：用 <input>，保留 placeholder、边框、圆角
- **卡片/矩形**：用 <div>，保留圆角、填充色
- **图片元素**：用 <img> 或占位 <div>

## 输出格式

返回纯 JSON（不要 markdown 包裹）：
{
  "react": "// 完整的 React 19 + TS + TailwindCSS 组件代码",
  "css": "// 如果 Tailwind 不够，补充自定义 CSS（可选）"
}

## 代码结构模板

```tsx
import React from 'react'

export default function App() {
  return (
    <div className="relative w-[画布宽]px h-[画布高]px bg-[画布背景色]" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* 每个元素逐一还原 */}
      <div className="absolute left-[X]px top-[Y]px w-[W]px h-[H]px bg-[#fill] rounded-[rx]px opacity-[opacity]" />
      {/* 文字元素 */}
      <span className="absolute left-[X]px top-[Y]px text-[fontSize]px font-[fontWeight] text-[#fill]" style={{ textAlign: 'align' }}>
        原始文字内容
      </span>
      {/* 按钮元素 */}
      <button className="absolute left-[X]px top-[Y]px w-[W]px h-[H]px bg-[#fill] rounded-[rx]px text-[fontSize]px text-[#文字色]">
        按钮文字
      </button>
      {/* 输入框 */}
      <input className="absolute left-[X]px top-[Y]px w-[W]px h-[H]px bg-[#fill] rounded-[rx]px border border-[#stroke] text-[fontSize]px" placeholder="原始placeholder" />
    </div>
  )
}
```""",
                },
                {
                    "role": "user",
                    "content": f"""请将以下设计稿精确还原为 React 组件代码。

## 设计稿摘要（元素列表）
{design_summary}

## 设计稿完整 JSON
{design_json_str}

要求：
- 每个元素都要有对应的 JSX 实现，不能遗漏
- 颜色用 bg-[#hex] 精确还原，不要替换为语义色
- 文字原样保留
- 位置和大小用 absolute + left/top/w/h 精确还原
- 只输出 JSON""",
                },
            ],
            temperature=0.1,
            max_tokens=8192,
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
    """基于模板的降级代码生成 —— 精确还原每个设计稿元素"""
    elements = design.get("elements", [])
    width = design.get("width", 1200)
    height = design.get("height", 800)
    bg = design.get("background", "#ffffff")

    element_jsx_parts = []

    for el in elements:
        eid = el.get("id", f"el_{len(element_jsx_parts)}")
        etype = el.get("type", "rect")
        x = el.get("left", 0)
        y = el.get("top", 0)
        w = el.get("width", 100)
        h = el.get("height", 50)
        fill = el.get("fill", "#ccc")
        rx = el.get("rx", 0)
        ry = el.get("ry", 0)
        opacity = el.get("opacity", 1)
        text = el.get("text", "")
        fs = el.get("fontSize", 14)
        fw = el.get("fontWeight", "normal")
        ff = el.get("fontFamily", "Inter")
        align = el.get("textAlign", "left")
        stroke = el.get("stroke", "")
        sw = el.get("strokeWidth", 0)
        placeholder = el.get("placeholder", "")
        comp = el.get("componentType", etype)

        base_style = f"left:[{x}]px top:[{y}]px w:[{w}]px h:[{h}]px"
        fill_class = f"bg-[{fill}]"
        rounded = f"rounded-[{rx}]px" if rx > 0 else ""
        opacity_class = f"opacity-[{opacity}]" if opacity != 1 else ""
        border_class = ""
        if stroke and sw > 0:
            border_class = f"border-[{sw}]px border-[{stroke}]"

        if etype == "text" or text:
            align_style = f"text-{align}" if align != "left" else ""
            fw_class = f"font-{fw}" if fw not in ("normal", 400) else ""
            jsx = f"""<span
            key="{eid}"
            className="absolute {base_style} {fill_class} text-[{fs}]px {fw_class} {align_style} {opacity_class}"
            style={{ fontFamily: '{ff}' }}
          >
            {text}
          </span>"""
        elif comp == "button" or etype == "button":
            jsx = f"""<button
            key="{eid}"
            className="absolute {base_style} {fill_class} {rounded} {opacity_class} {border_class} text-[{fs}]px text-white cursor-pointer hover:opacity-90 transition-opacity"
          >
            {text or '按钮'}
          </button>"""
        elif comp == "input" or etype == "input":
            jsx = f"""<input
            key="{eid}"
            className="absolute {base_style} {fill_class} {rounded} {border_class} {opacity_class} text-[{fs}]px px-3"
            placeholder="{placeholder or '请输入'}"
          />"""
        else:
            jsx = f"""<div
            key="{eid}"
            className="absolute {base_style} {fill_class} {rounded} {border_class} {opacity_class}"
          />"""

        # 清理多余的空格
        jsx = re.sub(r'\s+', ' ', jsx.strip())
        element_jsx_parts.append(jsx)

    elements_jsx = "\n          ".join(element_jsx_parts) if element_jsx_parts else "{}"

    react_code = f"""import React from 'react'

export default function App() {{
  return (
    <div
      className="relative w-[{width}]px h-[{height}]px bg-[{bg}] overflow-hidden"
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
          {elements_jsx}
    </div>
  )
}}"""

    return {"react": react_code, "css": ""}
