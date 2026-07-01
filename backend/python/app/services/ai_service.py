"""
AI 编排服务 —— 自然语言到设计稿的核心引擎

v5.0: 多模型动态切换（Ollama本地 / DeepSeek云端 / OpenAI GPT） + 多方案并行生成 + 自动合规检查 + 自动颜色修正
"""
import json
import time
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from openai import OpenAI
from app.core.config import get_ai_client
from app.services.design_service import get_design_system, check_design_compliance, auto_fix_colors
from app.services.prompt_builder import (
    DesignConstraints,
    extract_constraints,
    build_enhanced_system_prompt,
    build_enhanced_user_prompt,
    validate_and_fix_colors,
)

# 动态获取 AI 客户端 — 支持 Ollama / DeepSeek / OpenAI 多模型切换
def _get_client() -> tuple[OpenAI, str]:
    client, model = get_ai_client()
    return client, model


def generate_design_json(prompt: str, design_system: str | None = None) -> dict:
    """将自然语言描述转换为设计稿 JSON

    优化流程:
    1. 先用 prompt_builder 提取颜色/风格/布局约束
    2. 构建增强 system prompt（含精确色板+视觉层次指南）
    3. 调用 AI 生成（优化参数：更高 token 限制、平衡的 temperature）
    4. 后处理验证颜色 → 自动修正偏差 + 补充阴影
    """
    start_time = time.time()

    # ── 步骤1: 从自然语言提取设计约束 ──
    constraints = extract_constraints(prompt)

    # ── 步骤2: 构建增强 system prompt ──
    system_msg = build_enhanced_system_prompt(constraints)

    # 如果有选中的设计系统，追加设计系统约束
    if design_system:
        ds = get_design_system(design_system)
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
        client, model = _get_client()
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.45,  # ★ 稍微提高温度，让设计更有创意但不失控
            max_tokens=8192,    # ★ 翻倍 token 限制，让 AI 生成更多元素
            top_p=0.9,
        )

        content = response.choices[0].message.content or "{}"

        # 尝试提取 JSON
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', content)
        if json_match:
            content = json_match.group(1)

        design = json.loads(content)

        # ── 确保必填字段 ──
        design.setdefault("version", "7.0.0")
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

        # ── 步骤4: 后处理（颜色修正 + 阴影补充） ──
        design = validate_and_fix_colors(design, constraints)

        # 如果元素太少（AI 偷懒），打标记让前端知道
        element_count = len(design.get("elements", []))
        if element_count < 10:
            design["_quality_warning"] = f"元素数量较少({element_count}个)，建议用更详细的 prompt 重新生成"

        elapsed_ms = int((time.time() - start_time) * 1000)

        return {
            "design": design,
            "tokens": response.usage.total_tokens if response.usage else 0,
            "time_ms": elapsed_ms,
        }

    except json.JSONDecodeError as e:
        elapsed_ms = int((time.time() - start_time) * 1000)
        raw_preview = content[:300] if 'content' in locals() else 'N/A'
        print(f"[AI Service] JSON 解析失败: {e}, 原始内容前300字符: {raw_preview}")
        return {
            "design": _generate_fallback_design(prompt, constraints),
            "tokens": 0,
            "time_ms": elapsed_ms,
            "parse_error": str(e),
        }
    except Exception as e:
        raise RuntimeError(f"AI 生成失败: {str(e)}") from e


# ── 变体风格提示词，用于生成不同视觉方向 ──

VARIANT_STYLE_HINTS = [
    {
        "label": "经典稳重",
        "hint": "采用经典稳重的设计风格，布局规整对称，留白充足，配色克制，适合企业级场景。",
        "temperature": 0.35,
    },
    {
        "label": "现代创意",
        "hint": "采用现代创意设计风格，大胆的排版和留白，非对称布局，渐变色彩和微交互细节，适合展示型页面。",
        "temperature": 0.55,
    },
    {
        "label": "紧凑高效",
        "hint": "采用紧凑高效的设计风格，信息密度较高，使用分割线和卡片分组，适合数据密集型仪表盘。",
        "temperature": 0.45,
    },
]


def _generate_single_variant(
    prompt: str,
    system_msg: str,
    user_msg: str,
    variant_style: dict,
    constraints: DesignConstraints,
    variant_index: int,
) -> dict | None:
    """生成单个设计变体（在线程中调用）"""
    try:
        # 在 user prompt 末尾追加风格引导
        styled_user_msg = user_msg + f"\n\n【风格方向 #{variant_index + 1}：{variant_style['label']}】{variant_style['hint']}"

        client, model = _get_client()
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": styled_user_msg},
            ],
            temperature=variant_style["temperature"],
            max_tokens=8192,
            top_p=0.9,
        )

        content = response.choices[0].message.content or "{}"

        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', content)
        if json_match:
            content = json_match.group(1)

        design = json.loads(content)

        # 确保必填字段
        design.setdefault("version", "7.0.0")
        design.setdefault("width", 1200)
        design.setdefault("height", 800)
        if "elements" not in design:
            design["elements"] = []

        # 补充默认值
        for idx, el in enumerate(design.get("elements", [])):
            el.setdefault("id", f"el_{variant_index}_{idx + 1}")
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

        # 后处理颜色
        design = validate_and_fix_colors(design, constraints)

        if len(design.get("elements", [])) < 10:
            design["_quality_warning"] = f"[{variant_style['label']}] 元素数量较少({len(design['elements'])}个)"

        return {
            "design": design,
            "label": variant_style["label"],
            "tokens": response.usage.total_tokens if response.usage else 0,
        }

    except json.JSONDecodeError as e:
        # 单个变体解析失败，不阻塞其他变体
        raw = content[:200] if 'content' in locals() else 'N/A'
        print(f"[AI] Variant {variant_index} ({variant_style['label']}) JSON parse error: {e}, raw: {raw}")
        return None
    except Exception as e:
        print(f"[AI] Variant {variant_index} ({variant_style['label']}) error: {e}")
        return None


def generate_design_variants(
    prompt: str,
    design_system: str | None = None,
    variant_count: int = 2,
) -> dict:
    """并行生成多个设计变体，返回多方案 + 合规检查报告

    Args:
        prompt: 用户自然语言输入
        design_system: 设计系统 ID
        variant_count: 生成变体数量（1-3，默认2）

    Returns:
        {"design": 主方案, "alternatives": [...], "compliance": {...}, "tokens": N, "timeMs": N}
    """
    start_time = time.time()

    # 提取约束 + 构建 prompt
    constraints = extract_constraints(prompt)
    system_msg = build_enhanced_system_prompt(constraints)
    user_msg = build_enhanced_user_prompt(prompt, constraints)

    # 追加设计系统约束
    if design_system:
        ds = get_design_system(design_system)
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
- 品牌色: {json.dumps(ds_colors, ensure_ascii=False)}
- 标题字体: {ds['typography']['heading']['font']}, 字重 {ds['typography']['heading']['weight']}, 字号 {ds['typography']['heading']['size']}
- 正文字体: {ds['typography']['body']['font']}, 字重 {ds['typography']['body']['weight']}, 字号 {ds['typography']['body']['size']}
- 基础间距: {ds['spacing']}px
- 圆角: {ds['borderRadius']}px
"""
        system_msg += ds_prompt

    # 限制变体数
    variant_count = min(variant_count, len(VARIANT_STYLE_HINTS))
    styles = VARIANT_STYLE_HINTS[:variant_count]

    total_tokens = 0
    variants = []

    # ── 并行生成多个变体 ──
    with ThreadPoolExecutor(max_workers=variant_count) as executor:
        futures = {}
        for i, style in enumerate(styles):
            future = executor.submit(
                _generate_single_variant,
                prompt, system_msg, user_msg, style, constraints, i,
            )
            futures[future] = (i, style["label"])

        for future in as_completed(futures):
            i, label = futures[future]
            try:
                result = future.result(timeout=60)
                if result:
                    variants.append(result)
                    total_tokens += result["tokens"]
                else:
                    print(f"[AI] Variant {i} ({label}) failed, skipped")
            except Exception as e:
                print(f"[AI] Variant {i} ({label}) timeout/error: {e}")

    # 如果所有变体都失败了，用降级模板
    if not variants:
        elapsed_ms = int((time.time() - start_time) * 1000)
        fallback = _generate_fallback_design(prompt, constraints)
        return {
            "design": fallback,
            "alternatives": [],
            "suggestions": ["生成失败，已返回降级模板"],
            "compliance": None,
            "tokens": 0,
            "timeMs": elapsed_ms,
        }

    # ── 按元素数量排序，最多的作为主方案 ──
    variants.sort(key=lambda v: len(v["design"].get("elements", [])), reverse=True)

    primary = variants[0]
    alternatives = variants[1:] if len(variants) > 1 else []

    # ── 自动合规检查 ──
    compliance = None
    try:
        compliance = check_design_compliance(primary["design"], design_system)
    except Exception as e:
        print(f"[AI] Compliance check error: {e}")

    # ── 自动颜色修正（品牌色使用率 < 50% 时触发） ──
    auto_fix_result = None
    color_check = next(
        (c for c in compliance["checks"] if c["category"] == "品牌色彩使用"),
        None,
    ) if compliance else None

    if color_check and not color_check["passed"]:
        try:
            fixed_design, fix_log = auto_fix_colors(primary["design"], design_system)
            primary["design"] = fixed_design
            auto_fix_result = {
                "fixed": True,
                "fixCount": len(fix_log),
                "fixes": fix_log[:5],  # 最多展示 5 条修复记录
            }
            # 重新跑合规检查，确认修复效果
            compliance = check_design_compliance(fixed_design, design_system)
        except Exception as e:
            print(f"[AI] Auto-fix colors error: {e}")
            auto_fix_result = {"fixed": False, "message": str(e)}

    elapsed_ms = int((time.time() - start_time) * 1000)

    # ── 生成优化建议 ──
    try:
        suggestions = generate_suggestions(primary["design"])
    except Exception:
        suggestions = []

    if auto_fix_result and auto_fix_result.get("fixed"):
        suggestions.insert(0, f"已自动修正 {auto_fix_result['fixCount']} 处颜色以符合品牌规范")

    return {
        "design": primary["design"],
        "alternatives": [a["design"] for a in alternatives],
        "suggestions": suggestions,
        "compliance": compliance,
        "autoFix": auto_fix_result,
        "tokens": total_tokens,
        "timeMs": elapsed_ms,
    }


def refine_design(prompt: str, current_design: dict) -> dict:
    """根据反馈调整现有设计"""
    start_time = time.time()

    constraints = extract_constraints(prompt)
    enhanced_prompt = build_enhanced_user_prompt(prompt, constraints)

    try:
        client, model = _get_client()
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": f"""你是设计稿调整引擎。当前设计稿 JSON:

{json.dumps(current_design, ensure_ascii=False, indent=2)}

用户会提出修改意见。请根据意见调整设计稿，返回完整的新 JSON。

## 调整规则
- 如果用户提到颜色（如"改成红色"），替换所有相关元素的颜色
- 如果用户说"加阴影"、"加圆角"等，按要求修改
- 如果用户说"太简单"、"丰富一点"，增加更多元素（装饰、分割线、图标占位等）
- 只修改需要改的部分，保持其他元素不变
- 保持原有的视觉层次感

只输出 JSON，不要输出其他内容。""",
                },
                {"role": "user", "content": enhanced_prompt},
            ],
            temperature=0.4,
            max_tokens=8192,
            top_p=0.9,
        )

        content = response.choices[0].message.content or "{}"
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', content)
        if json_match:
            content = json_match.group(1)

        new_design = json.loads(content)

        # 后处理颜色+阴影
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
        client, model = _get_client()
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": """你是设计审查专家。分析设计稿给出 2-3 条具体可执行的优化建议。
每条建议不超过 25 字，以 JSON 数组形式返回。
关注：颜色对比度、视觉层次、间距、装饰元素、组件丰富度。""",
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
        return ["可以增加阴影增强立体感", "考虑添加分割线分隔区块", "尝试增加装饰元素提升精致度"]


def _generate_fallback_design(prompt: str, constraints=None) -> dict:
    """★ 增强版降级设计稿 —— 当 AI 调用失败时的备用方案"""
    if constraints is None:
        constraints = DesignConstraints()

    # 颜色
    if constraints.color_palette:
        cp = constraints.color_palette
        primary = cp["primary"]
        primary_light = cp.get("primary_light", primary)
        primary_bg = cp["primary_bg"]
        bg = cp["background"]
        surface = cp["surface"]
        text_primary = cp["text_primary"]
        text_secondary = cp["text_secondary"]
        border = cp["border"]
        accent = cp.get("accent", "#FFD700")
        shadow = cp.get("shadow", "rgba(0,0,0,0.08)")
    else:
        primary = "#0052D9"
        primary_light = "#3D7FFF"
        primary_bg = "#EEF3FF"
        bg = "#F5F8FF"
        surface = "#FFFFFF"
        text_primary = "#1A1A2E"
        text_secondary = "#6B7B94"
        border = "#D6E0F5"
        accent = "#00D4AA"
        shadow = "rgba(0,82,217,0.12)"

    br = constraints.border_radius if constraints.border_radius else 12

    # 基础元素：header
    elements = [
        {
            "id": "header_bg",
            "type": "rect",
            "left": 0, "top": 0, "width": 1200, "height": 64,
            "fill": primary, "rx": 0, "ry": 0, "opacity": 1,
            "shadow": f"0 2px 12px {shadow}",
            "componentType": "header",
        },
        {
            "id": "header_title",
            "type": "text",
            "left": 40, "top": 16, "width": 400, "height": 32,
            "text": "🎁 活动中心" if constraints.has_coupon else "📊 数据概览" if constraints.has_dashboard else "设计稿预览",
            "fontSize": 22, "fontFamily": "Inter", "fontWeight": "bold",
            "textAlign": "left", "fill": "#FFFFFF", "opacity": 1,
            "componentType": "header",
        },
    ]

    # 页面标题区域
    page_title = "限时优惠活动" if constraints.has_coupon else "数据统计面板" if constraints.has_dashboard else "内容区域"
    elements.extend([
        # 标题左侧装饰色块
        {
            "id": "title_decorator",
            "type": "rect",
            "left": 40, "top": 100, "width": 4, "height": 28,
            "fill": primary, "rx": 2, "ry": 2, "opacity": 1,
            "componentType": "decorator",
        },
        {
            "id": "page_title",
            "type": "text",
            "left": 56, "top": 100, "width": 400, "height": 28,
            "text": page_title,
            "fontSize": 22, "fontFamily": "Inter", "fontWeight": "bold",
            "textAlign": "left", "fill": text_primary, "opacity": 1,
            "componentType": "text",
        },
    ])

    # ── 优惠券页面 ──
    if constraints.has_coupon:
        # Banner
        elements.append({
            "id": "banner_bg",
            "type": "rect",
            "left": 0, "top": 64, "width": 1200, "height": 180,
            "fill": f"linear-gradient(135deg, {primary}, {primary_light})",
            "rx": 0, "ry": 0, "opacity": 1,
            "componentType": "banner",
        })
        elements.append({
            "id": "banner_title",
            "type": "text",
            "left": 80, "top": 100, "width": 600, "height": 42,
            "text": "🔥 限时优惠 · 全场满减",
            "fontSize": 32, "fontFamily": "Inter", "fontWeight": "bold",
            "textAlign": "left", "fill": "#FFFFFF", "opacity": 1,
            "componentType": "banner",
        })
        elements.append({
            "id": "banner_subtitle",
            "type": "text",
            "left": 80, "top": 152, "width": 600, "height": 24,
            "text": "精选好物，低至五折起 · 活动倒计时 3 天",
            "fontSize": 15, "fontFamily": "Inter", "fontWeight": "normal",
            "textAlign": "left", "fill": "rgba(255,255,255,0.85)", "opacity": 1,
            "componentType": "banner",
        })
        # 优惠券卡片 x3
        coupon_data = [
            ("满199减50", "有效期至 2026.07.31", "全场通用"),
            ("满299减80", "有效期至 2026.07.31", "限品类"),
            ("满499减150", "有效期至 2026.07.31", "新人专享"),
        ]
        for i, (amount, date, tag) in enumerate(coupon_data):
            x = 40 + i * 380
            y = 280
            # 卡片背景
            elements.append({
                "id": f"coupon_{i}_bg",
                "type": "rect",
                "left": x, "top": y, "width": 360, "height": 200,
                "fill": surface, "stroke": primary,
                "strokeWidth": 2, "strokeDasharray": "6,3",
                "rx": br, "ry": br, "opacity": 1,
                "shadow": f"0 4px 16px {shadow}",
                "componentType": "coupon-card",
            })
            # 折扣金额
            elements.append({
                "id": f"coupon_{i}_amount",
                "type": "text",
                "left": x + 24, "top": y + 28, "width": 312, "height": 48,
                "text": amount,
                "fontSize": 32, "fontFamily": "Inter", "fontWeight": "bold",
                "textAlign": "left", "fill": primary, "opacity": 1,
                "componentType": "coupon-card",
            })
            # 有效期
            elements.append({
                "id": f"coupon_{i}_date",
                "type": "text",
                "left": x + 24, "top": y + 90, "width": 312, "height": 20,
                "text": date,
                "fontSize": 13, "fontFamily": "Inter", "fontWeight": "normal",
                "textAlign": "left", "fill": text_secondary, "opacity": 1,
                "componentType": "coupon-card",
            })
            # 标签徽章
            elements.append({
                "id": f"coupon_{i}_tag",
                "type": "rect",
                "left": x + 24, "top": y + 120, "width": 72, "height": 24,
                "fill": primary_bg, "rx": 12, "ry": 12, "opacity": 1,
                "componentType": "tag",
            })
            elements.append({
                "id": f"coupon_{i}_tag_text",
                "type": "text",
                "left": x + 32, "top": y + 126, "width": 56, "height": 14,
                "text": tag,
                "fontSize": 12, "fontFamily": "Inter", "fontWeight": "normal",
                "textAlign": "center", "fill": primary, "opacity": 1,
                "componentType": "tag",
            })
            # 领取按钮
            elements.append({
                "id": f"coupon_{i}_btn",
                "type": "rect",
                "left": x + 230, "top": y + 148, "width": 106, "height": 38,
                "fill": primary, "rx": br, "ry": br, "opacity": 1,
                "shadow": f"0 2px 8px {shadow}",
                "componentType": "primary-btn",
            })
            elements.append({
                "id": f"coupon_{i}_btn_text",
                "type": "text",
                "left": x + 244, "top": y + 158, "width": 78, "height": 18,
                "text": "立即领取",
                "fontSize": 14, "fontFamily": "Inter", "fontWeight": "bold",
                "textAlign": "center", "fill": "#FFFFFF", "opacity": 1,
                "componentType": "primary-btn",
            })

    # ── 仪表盘页面 ──
    elif constraints.has_dashboard:
        stat_cards = [
            ("总用户数", "12,850", "▲ 12.5%", accent),
            ("活跃用户", "8,420", "▲ 8.3%", accent),
            ("今日收入", "¥35,280", "▼ 3.2%", "#E34D59"),
            ("转化率", "24.8%", "▲ 5.1%", accent),
        ]
        for i, (label, value, trend, trend_color) in enumerate(stat_cards):
            x = 40 + i * 285
            y = 156
            # 卡片
            elements.append({
                "id": f"stat_{i}_card",
                "type": "rect",
                "left": x, "top": y, "width": 265, "height": 140,
                "fill": surface, "stroke": border, "strokeWidth": 1,
                "rx": br, "ry": br, "opacity": 1,
                "shadow": f"0 2px 12px {shadow}",
                "componentType": "stat-card",
            })
            # 卡片顶部渐变装饰条
            elements.append({
                "id": f"stat_{i}_accent",
                "type": "rect",
                "left": x, "top": y, "width": 265, "height": 4,
                "fill": f"linear-gradient(90deg, {primary}, {primary_light})",
                "rx": br, "ry": 0, "opacity": 1,
                "componentType": "decorator",
            })
            # 标签
            elements.append({
                "id": f"stat_{i}_label",
                "type": "text",
                "left": x + 20, "top": y + 24, "width": 225, "height": 18,
                "text": label,
                "fontSize": 13, "fontFamily": "Inter", "fontWeight": "normal",
                "textAlign": "left", "fill": text_secondary, "opacity": 1,
                "componentType": "stat-card",
            })
            # 数值
            elements.append({
                "id": f"stat_{i}_value",
                "type": "text",
                "left": x + 20, "top": y + 48, "width": 225, "height": 36,
                "text": value,
                "fontSize": 30, "fontFamily": "Inter", "fontWeight": "bold",
                "textAlign": "left", "fill": text_primary, "opacity": 1,
                "componentType": "stat-card",
            })
            # 趋势
            elements.append({
                "id": f"stat_{i}_trend",
                "type": "text",
                "left": x + 20, "top": y + 96, "width": 225, "height": 20,
                "text": trend,
                "fontSize": 13, "fontFamily": "Inter", "fontWeight": "bold",
                "textAlign": "left", "fill": trend_color, "opacity": 1,
                "componentType": "stat-card",
            })

        # 分割线
        elements.append({
            "id": "divider_1",
            "type": "rect",
            "left": 40, "top": 328, "width": 1120, "height": 1,
            "fill": border, "rx": 0, "ry": 0, "opacity": 1,
            "componentType": "divider",
        })

        # 第二个区块标题
        elements.extend([
            {
                "id": "section2_decorator",
                "type": "rect",
                "left": 40, "top": 360, "width": 4, "height": 24,
                "fill": primary, "rx": 2, "ry": 2, "opacity": 1,
                "componentType": "decorator",
            },
            {
                "id": "section2_title",
                "type": "text",
                "left": 56, "top": 360, "width": 400, "height": 24,
                "text": "最近活动",
                "fontSize": 18, "fontFamily": "Inter", "fontWeight": "bold",
                "textAlign": "left", "fill": text_primary, "opacity": 1,
                "componentType": "text",
            },
        ])

        # 活动列表项 x4
        activities = [
            ("新用户注册", "2分钟前", primary_bg, primary),
            ("订单支付成功", "15分钟前", "#EEFFF7", "#00A870"),
            ("优惠券已领取", "1小时前", primary_bg, primary),
            ("系统维护通知", "3小时前", "#FFF4EC", "#ED7B2F"),
        ]
        for i, (act_name, act_time, act_bg, act_color) in enumerate(activities):
            y = 408 + i * 56
            # 列表行背景
            elements.append({
                "id": f"activity_{i}_row",
                "type": "rect",
                "left": 40, "top": y, "width": 1120, "height": 48,
                "fill": surface, "stroke": border, "strokeWidth": 1,
                "rx": br, "ry": br, "opacity": 1,
                "componentType": "card",
            })
            # 状态圆点
            elements.append({
                "id": f"activity_{i}_dot",
                "type": "circle",
                "left": 60, "top": y + 16, "width": 16, "height": 16,
                "fill": act_color, "rx": 8, "ry": 8, "opacity": 1,
                "componentType": "icon",
            })
            # 活动名称
            elements.append({
                "id": f"activity_{i}_name",
                "type": "text",
                "left": 88, "top": y + 14, "width": 400, "height": 20,
                "text": act_name,
                "fontSize": 14, "fontFamily": "Inter", "fontWeight": "normal",
                "textAlign": "left", "fill": text_primary, "opacity": 1,
                "componentType": "text",
            })
            # 时间
            elements.append({
                "id": f"activity_{i}_time",
                "type": "text",
                "left": 1000, "top": y + 14, "width": 140, "height": 20,
                "text": act_time,
                "fontSize": 13, "fontFamily": "Inter", "fontWeight": "normal",
                "textAlign": "right", "fill": text_secondary, "opacity": 1,
                "componentType": "text",
            })

    # ── 通用页面 ──
    else:
        # 主内容卡片
        elements.append({
            "id": "main_card",
            "type": "rect",
            "left": 40, "top": 156, "width": 1120, "height": 600,
            "fill": surface, "stroke": border, "strokeWidth": 1,
            "rx": br, "ry": br, "opacity": 1,
            "shadow": f"0 4px 20px {shadow}",
            "componentType": "card",
        })
        elements.append({
            "id": "main_card_title",
            "type": "text",
            "left": 80, "top": 200, "width": 500, "height": 32,
            "text": "欢迎使用 AI Design Studio",
            "fontSize": 24, "fontFamily": "Inter", "fontWeight": "bold",
            "textAlign": "left", "fill": text_primary, "opacity": 1,
            "componentType": "text",
        })
        elements.append({
            "id": "main_card_desc",
            "type": "text",
            "left": 80, "top": 248, "width": 600, "height": 22,
            "text": "在左侧对话框输入你的设计需求，AI 将自动生成设计稿",
            "fontSize": 15, "fontFamily": "Inter", "fontWeight": "normal",
            "textAlign": "left", "fill": text_secondary, "opacity": 1,
            "componentType": "text",
        })
        # 装饰元素
        elements.append({
            "id": "decorator_bar",
            "type": "rect",
            "left": 80, "top": 290, "width": 60, "height": 3,
            "fill": primary, "rx": 1.5, "ry": 1.5, "opacity": 1,
            "componentType": "decorator",
        })

    return {
        "version": "7.0.0",
        "width": 1200,
        "height": 800,
        "elements": elements,
    }
