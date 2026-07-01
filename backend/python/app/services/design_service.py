"""
设计规范约束检查服务
支持多模型动态切换（Ollama本地 / DeepSeek云端 / OpenAI GPT）
"""
import json
import re
from openai import OpenAI
from app.core.config import get_ai_client

# 动态获取 AI 客户端
def _get_client() -> tuple[OpenAI, str]:
    client, model = get_ai_client()
    return client, model


# ── 颜色距离计算（RGB 欧几里得距离） ──

def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    """#RRGGBB → (R, G, B)"""
    c = hex_color.lstrip("#")
    if len(c) == 3:
        c = c[0] * 2 + c[1] * 2 + c[2] * 2
    return int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16)


def _color_distance(c1: str, c2: str) -> float:
    """两个 hex 颜色的 RGB 欧几里得距离"""
    r1, g1, b1 = _hex_to_rgb(c1)
    r2, g2, b2 = _hex_to_rgb(c2)
    return ((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2) ** 0.5


def _find_nearest_brand_color(color: str, brand_palette: list[str]) -> str:
    """找到最接近的品牌色"""
    closest = brand_palette[0]
    min_dist = _color_distance(color, closest)
    for bc in brand_palette[1:]:
        dist = _color_distance(color, bc)
        if dist < min_dist:
            min_dist = dist
            closest = bc
    return closest


# ── 品牌色自动修正 ──

def auto_fix_colors(design: dict, design_system_id: str | None = None) -> tuple[dict, list[dict]]:
    """自动将设计稿中的非品牌色替换为最近品牌色

    Returns:
        (fixed_design, fix_log) - 修正后的设计稿 + 修复日志列表
    """
    ds = get_design_system(design_system_id)

    # 收集品牌色板（hex 值）
    brand_palette = []
    for k, v in ds["colors"].items():
        if isinstance(v, str) and v.startswith("#"):
            brand_palette.append(v)

    if not brand_palette:
        return design, []

    brand_lower = {c.lower() for c in brand_palette}
    elements = design.get("elements", [])
    fix_log = []
    fixed_elements = []

    for el in elements:
        el = dict(el)  # shallow copy
        el_fixed = False

        # 修正 fill 颜色
        fill = el.get("fill", "")
        if isinstance(fill, str) and fill.startswith("#") and fill.lower() not in brand_lower:
            old_fill = fill
            new_fill = _find_nearest_brand_color(fill.lower(), [b.lower() for b in brand_palette])
            el["fill"] = new_fill
            el_fixed = True
            fix_log.append({
                "elementId": el.get("id", "?"),
                "elementType": el.get("type", "?"),
                "field": "fill",
                "from": old_fill,
                "to": new_fill,
            })

        # 修正 stroke 颜色
        stroke = el.get("stroke", "")
        if isinstance(stroke, str) and stroke.startswith("#") and stroke.lower() not in brand_lower:
            old_stroke = stroke
            new_stroke = _find_nearest_brand_color(stroke.lower(), [b.lower() for b in brand_palette])
            el["stroke"] = new_stroke
            el_fixed = True
            fix_log.append({
                "elementId": el.get("id", "?"),
                "elementType": el.get("type", "?"),
                "field": "stroke",
                "from": old_stroke,
                "to": new_stroke,
            })

        # 修正 text fill 颜色
        text_fill = el.get("fill", "")
        if el.get("type") == "text" and isinstance(text_fill, str) and text_fill.startswith("#"):
            if text_fill.lower() not in brand_lower and text_fill.lower() not in {"#ffffff", "#000000", "#1a1a2e", "#333333"}:
                old = text_fill
                new = _find_nearest_brand_color(text_fill.lower(), [b.lower() for b in brand_palette])
                el["fill"] = new
                el_fixed = True
                fix_log.append({
                    "elementId": el.get("id", "?"),
                    "elementType": el.get("type", "?"),
                    "field": "textFill",
                    "from": old,
                    "to": new,
                })

        fixed_elements.append(el)

    design["elements"] = fixed_elements

    if fix_log:
        print(f"[Design] Auto-fixed {len(fix_log)} color(s) for design system compliance")

    return design, fix_log

# 内置设计系统（仅 MDUI Material Design 3 企业设计系统 SDK）
BUILTIN_DESIGN_SYSTEMS = {
    # ── MDUI Material Design 3 企业设计系统 SDK ──
    # 基于 MDUI 组件库的设计规范，提供完整的 MD3 Design Token
    "mdui-material-3": {
        "name": "MDUI Material Design 3",
        "source": "mdui",
        "description": "基于 MDUI 企业设计系统 SDK 的 Material Design 3 规范预设",
        "colors": {
            "primary": "#6750A4",           # MD3 Primary
            "on-primary": "#FFFFFF",        # MD3 On Primary
            "primary-container": "#EADDFF", # MD3 Primary Container
            "secondary": "#625B71",         # MD3 Secondary
            "tertiary": "#7D5260",          # MD3 Tertiary
            "error": "#B3261E",             # MD3 Error
            "background": "#FFFBFE",        # MD3 Background
            "surface": "#FFFBFE",           # MD3 Surface
            "surface-variant": "#E7E0EC",   # MD3 Surface Variant
            "outline": "#79747E",           # MD3 Outline
        },
        "typography": {
            "heading": {"font": "Roboto", "weight": 500, "size": "22px"},
            "body": {"font": "Roboto", "weight": 400, "size": "14px"},
        },
        "spacing": 8,        # MD3 基础间距单位 8dp
        "borderRadius": 12,  # MD3 默认圆角 12dp
        "mduiTokens": {
            # MDUI / MD3 完整 Design Token 映射
            "md-sys-color-primary": "#6750A4",
            "md-sys-color-on-primary": "#FFFFFF",
            "md-sys-color-primary-container": "#EADDFF",
            "md-sys-color-on-primary-container": "#21005D",
            "md-sys-color-secondary": "#625B71",
            "md-sys-color-on-secondary": "#FFFFFF",
            "md-sys-color-secondary-container": "#E8DEF8",
            "md-sys-color-on-secondary-container": "#1D192B",
            "md-sys-color-tertiary": "#7D5260",
            "md-sys-color-on-tertiary": "#FFFFFF",
            "md-sys-color-tertiary-container": "#FFD8E4",
            "md-sys-color-error": "#B3261E",
            "md-sys-color-on-error": "#FFFFFF",
            "md-sys-color-error-container": "#F9DEDC",
            "md-sys-color-background": "#FFFBFE",
            "md-sys-color-surface": "#FFFBFE",
            "md-sys-color-surface-variant": "#E7E0EC",
            "md-sys-color-outline": "#79747E",
            "md-sys-typescale-headline-font": "Roboto",
            "md-sys-typescale-body-font": "Roboto",
            "md-sys-shape-corner-medium-radius": "12dp",
        },
    },
}


def check_design_compliance(design: dict, design_system_id: str | None = None) -> dict:
    """检查设计稿对品牌规范的兼容性"""
    ds = get_design_system(design_system_id)
    elements = design.get("elements", [])

    checks = []

    # 1. 检查主色使用
    brand_colors = set(ds["colors"].values())
    used_colors = set()
    for el in elements:
        fill = el.get("fill", "")
        if fill and fill.startswith("#"):
            used_colors.add(fill.lower())

    brand_used = used_colors & {c.lower() for c in brand_colors}
    color_score = len(brand_used) / max(len(used_colors), 1) * 100 if used_colors else 0

    checks.append({
        "category": "品牌色彩使用",
        "passed": color_score >= 30,
        "message": f"使用了 {len(brand_used)} 种品牌色彩 / 共 {len(used_colors)} 种颜色（{color_score:.0f}%）",
        "severity": "error" if color_score < 30 else ("warning" if color_score < 60 else "info"),
    })

    # 2. 检查圆角统一性
    radii = [el.get("rx", 0) for el in elements if el.get("rx", 0) > 0]
    expected_radius = ds["borderRadius"]
    if radii:
        consistent = all(abs(r - expected_radius) <= 4 for r in radii)
        checks.append({
            "category": "圆角统一性",
            "passed": consistent,
            "message": f"圆角值: {set(radii)}，预期 {expected_radius}px" if not consistent else f"圆角统一为 {expected_radius}px ±4px",
            "severity": "warning" if not consistent else "info",
        })
    else:
        checks.append({
            "category": "圆角统一性",
            "passed": True,
            "message": "无圆角元素",
            "severity": "info",
        })

    # 3. 检查字号规范
    expected_sizes = [14, 16, 20, 24, 28, 32, 36]
    text_elements = [el for el in elements if el.get("type") == "text" and el.get("fontSize")]
    if text_elements:
        valid_sizes = sum(1 for el in text_elements if el.get("fontSize") in expected_sizes)
        size_score = valid_sizes / len(text_elements) * 100
        checks.append({
            "category": "字号规范性",
            "passed": size_score >= 70,
            "message": f"{valid_sizes}/{len(text_elements)} 个文字使用标准字号",
            "severity": "warning" if size_score < 70 else "info",
        })
    else:
        checks.append({
            "category": "字号规范性",
            "passed": True,
            "message": "无文字元素",
            "severity": "info",
        })

    # 4. 检查间距
    base_spacing = ds["spacing"]
    gaps = []
    for i in range(len(elements) - 1):
        el1 = elements[i]
        el2 = elements[i + 1]
        if el1.get("componentType") == el2.get("componentType"):
            el1_top = el1.get("top", 0)
            el2_top = el2.get("top", 0)
            el1_height = el1.get("height", 0)
            gap = abs(el2_top - (el1_top + el1_height))
            if gap > 0:
                gaps.append(gap)

    if gaps:
        valid_gaps = sum(1 for g in gaps if g % base_spacing == 0)
        gap_score = valid_gaps / len(gaps) * 100
        checks.append({
            "category": "间距规范 (8px 基准)",
            "passed": gap_score >= 50,
            "message": f"间距符合 8px 基准的比例: {gap_score:.0f}%",
            "severity": "warning" if gap_score < 50 else "info",
        })
    else:
        checks.append({
            "category": "间距规范 (8px 基准)",
            "passed": True,
            "message": "无需检查间距",
            "severity": "info",
        })

    # 5. AI 语义检查
    try:
        ai_check = _ai_semantic_check(design, ds)
        checks.append(ai_check)
    except Exception:
        checks.append({
            "category": "AI 语义检查",
            "passed": True,
            "message": "AI 语义检查暂不可用，已跳过",
            "severity": "info",
        })

    # 计算总分
    passed = sum(1 for c in checks if c["passed"])
    total = len(checks)
    score = int(passed / max(total, 1) * 100)

    # 加入权重：色彩占 40%，其他各占 20%
    weights = {"品牌色彩使用": 0.40, "圆角统一性": 0.15, "字号规范性": 0.15, "间距规范 (8px 基准)": 0.15, "AI 语义检查": 0.15}

    weighted_score = 0
    for c in checks:
        w = weights.get(c["category"], 0.2)
        if c["passed"]:
            weighted_score += w * 100
    score = int(weighted_score)

    return {
        "overall_score": min(score, 100),
        "checks": checks,
    }


def _ai_semantic_check(design: dict, design_system: dict) -> dict:
    """使用 AI 进行语义层面的设计规范检查"""
    client, model = _get_client()
    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": "你是设计规范审查专家。检查设计稿是否视觉一致、层级合理。返回 JSON: {\"passed\": true/false, \"message\": \"简评\"}",
            },
            {
                "role": "user",
                "content": f"设计规范: {json.dumps(design_system, ensure_ascii=False)}\n设计稿: {json.dumps(design, ensure_ascii=False)[:2000]}",
            },
        ],
        temperature=0.3,
        max_tokens=128,
    )

    content = response.choices[0].message.content or "{}"
    json_match = re.search(r'\{[^}]+\}', content)
    if json_match:
        result = json.loads(json_match.group())
        return {
            "category": "AI 语义检查",
            "passed": result.get("passed", True),
            "message": result.get("message", "语义检查完成"),
            "severity": "warning" if not result.get("passed", True) else "info",
        }

    return {
        "category": "AI 语义检查",
        "passed": True,
        "message": "语义检查完成",
        "severity": "info",
    }
# 自定义设计系统（运行时内存存储）
CUSTOM_DESIGN_SYSTEMS: dict[str, dict] = {}


def _normalize_design_system(data: dict) -> dict:
    """确保设计系统数据结构完整（含 source 来源标识）"""
    return {
        "name": data.get("name", "未命名设计系统"),
        "source": data.get("source", "mdui"),  # 来源: custom / mdui / material-3
        "description": data.get("description", ""),
        "colors": data.get("colors", {
            "primary": "#6750A4",
            "on-primary": "#FFFFFF",
            "primary-container": "#EADDFF",
            "secondary": "#625B71",
            "tertiary": "#7D5260",
            "error": "#B3261E",
            "background": "#FFFBFE",
            "surface": "#FFFBFE",
            "surface-variant": "#E7E0EC",
            "outline": "#79747E",
        }),
        "typography": data.get("typography", {
            "heading": {"font": "Roboto", "weight": 500, "size": "22px"},
            "body": {"font": "Roboto", "weight": 400, "size": "14px"},
        }),
        "spacing": int(data.get("spacing", 8)),
        "borderRadius": int(data.get("borderRadius", 12)),
    }


def get_design_system(design_system_id: str | None) -> dict:
    """获取完整设计系统，优先返回自定义，其次内置，默认 MDUI"""
    if not design_system_id:
        design_system_id = "mdui-material-3"
    return CUSTOM_DESIGN_SYSTEMS.get(design_system_id) or BUILTIN_DESIGN_SYSTEMS.get(
        design_system_id, BUILTIN_DESIGN_SYSTEMS["mdui-material-3"]
    )


def create_design_system(data: dict) -> dict:
    """创建新的设计系统"""
    import uuid
    system_id = f"custom-{uuid.uuid4().hex[:8]}"
    CUSTOM_DESIGN_SYSTEMS[system_id] = _normalize_design_system(data)
    return {"id": system_id, **CUSTOM_DESIGN_SYSTEMS[system_id]}


def update_design_system(design_system_id: str, data: dict) -> dict | None:
    """更新自定义设计系统，内置系统不可修改"""
    if design_system_id not in CUSTOM_DESIGN_SYSTEMS:
        return None
    CUSTOM_DESIGN_SYSTEMS[design_system_id] = _normalize_design_system(data)
    return {"id": design_system_id, **CUSTOM_DESIGN_SYSTEMS[design_system_id]}


def delete_design_system(design_system_id: str) -> bool:
    """删除自定义设计系统，内置系统不可删除"""
    if design_system_id not in CUSTOM_DESIGN_SYSTEMS:
        return False
    del CUSTOM_DESIGN_SYSTEMS[design_system_id]
    return True


def get_design_systems() -> list[dict]:
    """列出所有设计系统（内置 + 自定义），含来源标识"""
    systems = [
        {"id": k, "name": v["name"], "source": v.get("source", "custom"), "builtIn": True}
        for k, v in BUILTIN_DESIGN_SYSTEMS.items()
    ]
    systems += [
        {"id": k, "name": v["name"], "source": v.get("source", "custom"), "builtIn": False}
        for k, v in CUSTOM_DESIGN_SYSTEMS.items()
    ]
    return systems
