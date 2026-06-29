"""
设计规范约束检查服务
"""
import json
import re
from openai import OpenAI
from app.core.config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL

client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)

# 内置设计系统
BUILTIN_DESIGN_SYSTEMS = {
    "brand-design-token-23v1": {
        "name": "默认品牌设计系统 v23",
        "colors": {
            "primary": "#0052D9",
            "secondary": "#7C4DFF",
            "success": "#00A870",
            "warning": "#ED7B2F",
            "danger": "#E34D59",
            "background": "#F5F5F5",
            "surface": "#FFFFFF",
        },
        "typography": {
            "heading": {"font": "Inter", "weight": 600, "size": "24px"},
            "body": {"font": "Inter", "weight": 400, "size": "14px"},
        },
        "spacing": 8,
        "borderRadius": 8,
    }
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
    response = client.chat.completions.create(
        model=DEEPSEEK_MODEL,
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
    """确保设计系统数据结构完整"""
    return {
        "name": data.get("name", "未命名设计系统"),
        "colors": data.get("colors", {
            "primary": "#0052D9",
            "secondary": "#7C4DFF",
            "success": "#00A870",
            "warning": "#ED7B2F",
            "danger": "#E34D59",
            "background": "#F5F5F5",
            "surface": "#FFFFFF",
        }),
        "typography": data.get("typography", {
            "heading": {"font": "Inter", "weight": 600, "size": "24px"},
            "body": {"font": "Inter", "weight": 400, "size": "14px"},
        }),
        "spacing": int(data.get("spacing", 8)),
        "borderRadius": int(data.get("borderRadius", 8)),
    }


def get_design_system(design_system_id: str | None) -> dict:
    """获取完整设计系统，优先返回自定义，其次内置"""
    if not design_system_id:
        design_system_id = "brand-design-token-23v1"
    return CUSTOM_DESIGN_SYSTEMS.get(design_system_id) or BUILTIN_DESIGN_SYSTEMS.get(
        design_system_id, BUILTIN_DESIGN_SYSTEMS["brand-design-token-23v1"]
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
    """列出所有设计系统（内置 + 自定义）"""
    systems = [
        {"id": k, "name": v["name"], "builtIn": True}
        for k, v in BUILTIN_DESIGN_SYSTEMS.items()
    ]
    systems += [
        {"id": k, "name": v["name"], "builtIn": False}
        for k, v in CUSTOM_DESIGN_SYSTEMS.items()
    ]
    return systems
