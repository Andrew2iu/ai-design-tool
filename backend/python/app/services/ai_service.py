"""
AI 编排服务 —— 自然语言到设计稿的核心引擎

v2.0: 集成 prompt 预处理器，自动提取颜色/风格/布局约束，解决颜色偏差问题
"""
import json
import time
import re
from openai import OpenAI
from app.core.config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL
from app.services.design_service import get_design_system
from app.services.prompt_builder import (
    extract_constraints,
    build_enhanced_system_prompt,
    build_enhanced_user_prompt,
    validate_and_fix_colors,
)

client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)


def generate_design_json(prompt: str, design_system: str | None = None) -> dict:
    """将自然语言描述转换为设计稿 JSON

    优化流程:
    1. 先用 prompt_builder 提取颜色/风格/布局约束
    2. 构建增强 system prompt（含精确色板）
    3. 调用 AI 生成
    4. 后处理验证颜色 → 自动修正偏差
    """
    start_time = time.time()

    # ── 步骤1: 从自然语言提取设计约束 ──
    constraints = extract_constraints(prompt)

    # ── 步骤2: 构建增强 system prompt ──
    system_msg = build_enhanced_system_prompt(constraints)

    # 如果有选中的设计系统，追加设计系统约束
    if design_system:
        ds = get_design_system(design_system)
        # 如果用户 prompt 中指定了颜色，用用户指定的颜色覆盖设计系统颜色
        if constraints.color_palette:
            ds_colors = dict(ds["colors"])
            ds_colors["primary"] = constraints.color_palette["primary"]
            ds_colors["background"] = constraints.color_palette["background"]
            ds_colors["surface"] = constraints.color_palette["surface"]
        else:
            ds_colors = ds["colors"]

        ds_prompt = f"""

## 当前设计系统约束

- 名称: {ds['name']}
- 品牌色（已根据你的要求调整）: {json.dumps(ds_colors, ensure_ascii=False)}
- 标题字体: {ds['typography']['heading']['font']}, 字重 {ds['typography']['heading']['weight']}, 字号 {ds['typography']['heading']['size']}
- 正文字体: {ds['typography']['body']['font']}, 字重 {ds['typography']['body']['weight']}, 字号 {ds['typography']['body']['size']}
- 基础间距: {ds['spacing']}px
- 圆角: {ds['borderRadius']}px
"""
        system_msg += ds_prompt

    # ── 步骤3: 构建增强 user prompt ──
    user_msg = build_enhanced_user_prompt(prompt, constraints)

    try:
        response = client.chat.completions.create(
            model=DEEPSEEK_MODEL,
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.3,  # 降低温度提高颜色一致性
            max_tokens=4096,
        )

        content = response.choices[0].message.content or "{}"

        # 尝试提取 JSON
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', content)
        if json_match:
            content = json_match.group(1)

        design = json.loads(content)

        # ── 确保必填字段 ──
        design.setdefault("version", "6.0.0")
        design.setdefault("width", 1200)
        design.setdefault("height", 800)
        if "elements" not in design:
            design["elements"] = []

        # ── 补充默认值 ──
        for idx, el in enumerate(design.get("elements", [])):
            el.setdefault("id", f"el_{idx + 1}")
            el.setdefault("opacity", 1)
            if constraints.border_radius:
                el.setdefault("rx", constraints.border_radius)
                el.setdefault("ry", constraints.border_radius)
            else:
                el.setdefault("rx", 0)
                el.setdefault("ry", 0)
            if el.get("type") == "text":
                el.setdefault("fontFamily", "Inter")
                el.setdefault("fontWeight", "normal")
                el.setdefault("textAlign", "left")

        # ── 步骤4: 后处理颜色验证 ──
        if constraints.color_palette:
            design = validate_and_fix_colors(design, constraints)

        elapsed_ms = int((time.time() - start_time) * 1000)

        return {
            "design": design,
            "tokens": response.usage.total_tokens if response.usage else 0,
            "time_ms": elapsed_ms,
        }

    except json.JSONDecodeError as e:
        elapsed_ms = int((time.time() - start_time) * 1000)
        print(f"[AI Service] JSON 解析失败: {e}, 原始内容前200字符: {content[:200] if 'content' in dir() else 'N/A'}")
        return {
            "design": _generate_fallback_design(prompt, constraints),
            "tokens": 0,
            "time_ms": elapsed_ms,
            "parse_error": str(e),
        }
    except Exception as e:
        raise RuntimeError(f"AI 生成失败: {str(e)}") from e


def refine_design(prompt: str, current_design: dict) -> dict:
    """根据反馈调整现有设计"""
    start_time = time.time()

    # 也提取约束用于 refine
    constraints = extract_constraints(prompt)
    enhanced_prompt = build_enhanced_user_prompt(prompt, constraints)

    try:
        response = client.chat.completions.create(
            model=DEEPSEEK_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": f"""你是设计稿调整引擎。当前设计稿 JSON:

{json.dumps(current_design, ensure_ascii=False, indent=2)}

用户会提出修改意见。请根据意见调整设计稿，返回完整的新 JSON。

## 颜色规则
如果用户提到特定颜色（如"红色"、"蓝色"），请严格使用对应颜色替换所有相关元素。
只修改需要改的部分，保持其他元素不变。

只输出 JSON，不要输出其他内容。""",
                },
                {"role": "user", "content": enhanced_prompt},
            ],
            temperature=0.3,
            max_tokens=4096,
        )

        content = response.choices[0].message.content or "{}"
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', content)
        if json_match:
            content = json_match.group(1)

        new_design = json.loads(content)

        # 后处理颜色
        if constraints.color_palette:
            new_design = validate_and_fix_colors(new_design, constraints)

        elapsed_ms = int((time.time() - start_time) * 1000)

        return {
            "design": new_design,
            "tokens": response.usage.total_tokens if response.usage else 0,
            "time_ms": elapsed_ms,
        }

    except json.JSONDecodeError:
        elapsed_ms = int((time.time() - start_time) * 1000)
        return {"design": current_design, "tokens": 0, "time_ms": elapsed_ms}
    except Exception as e:
        raise RuntimeError(f"设计调整失败: {str(e)}") from e


def generate_suggestions(design: dict) -> list[str]:
    """根据设计稿生成优化建议"""
    try:
        response = client.chat.completions.create(
            model=DEEPSEEK_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "你是设计审查专家。给出 2-3 条简短的界面优化建议（每条不超过20字），以 JSON 数组形式返回。",
                },
                {
                    "role": "user",
                    "content": f"请对以下设计稿给出优化建议：\n{json.dumps(design, ensure_ascii=False, indent=2)}",
                },
            ],
            temperature=0.6,
            max_tokens=256,
        )

        content = response.choices[0].message.content or "[]"
        json_match = re.search(r'\[[\s\S]*?\]', content)
        if json_match:
            return json.loads(json_match.group())
        return []
    except Exception:
        return ["可以尝试调整元素间距", "检查颜色对比度是否足够"]


def _generate_fallback_design(prompt: str, constraints=None) -> dict:
    """当 AI 生成失败时的降级设计稿，尽可能匹配用户需求"""
    from app.services.prompt_builder import DesignConstraints

    if constraints is None:
        constraints = DesignConstraints()

    # 根据颜色约束选择颜色
    if constraints.color_palette:
        cp = constraints.color_palette
        primary = cp["primary"]
        primary_bg = cp["primary_bg"]
        bg = cp["background"]
        surface = cp["surface"]
        text_primary = cp["text_primary"]
        text_secondary = cp["text_secondary"]
        border = cp["border"]
    else:
        primary = "#0052D9"
        primary_bg = "#EEF3FF"
        bg = "#F5F5F5"
        surface = "#FFFFFF"
        text_primary = "#1A1A2E"
        text_secondary = "#6B7280"
        border = "#E5E7EB"

    br = constraints.border_radius if constraints.border_radius else 8

    elements = [
        # ── Header ──
        {
            "id": "header_bg",
            "type": "rect",
            "left": 0, "top": 0, "width": 1200, "height": 64,
            "fill": primary, "rx": 0, "ry": 0, "opacity": 1,
            "componentType": "header",
        },
        {
            "id": "header_title",
            "type": "text",
            "left": 40, "top": 18, "width": 400, "height": 28,
            "text": "🎁 活动中心" if constraints.has_coupon else "设计稿预览",
            "fontSize": 20, "fontFamily": "Inter", "fontWeight": "bold",
            "textAlign": "left", "fill": "#ffffff", "opacity": 1,
            "componentType": "header",
        },
    ]

    # ── 如果是优惠券页面 ──
    if constraints.has_coupon:
        # Banner
        elements.append({
            "id": "banner_bg",
            "type": "rect",
            "left": 0, "top": 64, "width": 1200, "height": 160,
            "fill": primary_bg, "rx": 0, "ry": 0, "opacity": 1,
            "componentType": "banner",
        })
        elements.append({
            "id": "banner_title",
            "type": "text",
            "left": 80, "top": 88, "width": 500, "height": 40,
            "text": "限时优惠 · 全场满减",
            "fontSize": 32, "fontFamily": "Inter", "fontWeight": "bold",
            "textAlign": "left", "fill": text_primary, "opacity": 1,
            "componentType": "banner",
        })
        elements.append({
            "id": "banner_subtitle",
            "type": "text",
            "left": 80, "top": 140, "width": 500, "height": 22,
            "text": "精选好物，低至五折起",
            "fontSize": 16, "fontFamily": "Inter", "fontWeight": "normal",
            "textAlign": "left", "fill": text_secondary, "opacity": 1,
            "componentType": "banner",
        })

        # 优惠券卡片
        for i in range(3):
            x = 40 + i * 380
            y = 260
            elements.append({
                "id": f"coupon_{i}_bg",
                "type": "rect",
                "left": x, "top": y, "width": 360, "height": 180,
                "fill": surface, "stroke": primary,
                "strokeWidth": 2, "rx": br, "ry": br, "opacity": 1,
                "componentType": "coupon-card",
            })
            elements.append({
                "id": f"coupon_{i}_amount",
                "type": "text",
                "left": x + 20, "top": y + 30, "width": 200, "height": 48,
                "text": ["满199减50", "满299减80", "满499减150"][i],
                "fontSize": 28, "fontFamily": "Inter", "fontWeight": "bold",
                "textAlign": "left", "fill": primary, "opacity": 1,
                "componentType": "coupon-card",
            })
            elements.append({
                "id": f"coupon_{i}_desc",
                "type": "text",
                "left": x + 20, "top": y + 90, "width": 320, "height": 20,
                "text": f"有效期至 2026.07.31 | 全场通用",
                "fontSize": 13, "fontFamily": "Inter", "fontWeight": "normal",
                "textAlign": "left", "fill": text_secondary, "opacity": 1,
                "componentType": "coupon-card",
            })
            elements.append({
                "id": f"coupon_{i}_btn",
                "type": "rect",
                "left": x + 240, "top": y + 125, "width": 100, "height": 36,
                "fill": primary, "rx": br, "ry": br, "opacity": 1,
                "componentType": "button",
            })
            elements.append({
                "id": f"coupon_{i}_btn_text",
                "type": "text",
                "left": x + 254, "top": y + 135, "width": 72, "height": 17,
                "text": "立即领取",
                "fontSize": 14, "fontFamily": "Inter", "fontWeight": "bold",
                "textAlign": "center", "fill": "#ffffff", "opacity": 1,
                "componentType": "button",
            })

    else:
        # 普通页面
        elements.append({
            "id": "content_bg",
            "type": "rect",
            "left": 40, "top": 100, "width": 1120, "height": 660,
            "fill": surface, "stroke": border, "strokeWidth": 1,
            "rx": br, "ry": br, "opacity": 1,
            "componentType": "card",
        })
        elements.append({
            "id": "content_title",
            "type": "text",
            "left": 80, "top": 140, "width": 400, "height": 32,
            "text": "设计稿内容区域",
            "fontSize": 24, "fontFamily": "Inter", "fontWeight": "bold",
            "textAlign": "left", "fill": text_primary, "opacity": 1,
            "componentType": "card",
        })

    return {
        "version": "6.0.0",
        "width": 1200,
        "height": 800,
        "elements": elements,
    }
