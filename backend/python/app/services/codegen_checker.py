"""
代码自检引擎 —— 生成代码后自动对比设计稿 JSON，输出准确率报告

检查维度：
1. 元素数量 —— 设计稿有几个元素，代码里生成了几个
2. 颜色准确率 —— 设计稿用的颜色是否在代码里出现
3. 文字还原度 —— 设计稿里的文字内容是否被保留
4. 结构完整性 —— 布局层次是否合理
"""

import re
import json
from typing import Any


# ============================================================
# 解析工具
# ============================================================

def _extract_hex_colors(code: str) -> set[str]:
    """从 JSX 代码中提取所有 hex 颜色值（如 #1c30ca, #efebe5）"""
    matches = re.findall(r'#[0-9a-fA-F]{3,8}', code)
    return {m.lower() for m in matches}


def _extract_tailwind_colors(code: str) -> set[str]:
    """提取所有 TailwindCSS 颜色类名对应的语义色（如 bg-red-500 → red-500）"""
    patterns = [
        r'(?:bg|text|border|ring|shadow|from|to|via|placeholder|accent|caret|fill|stroke|outline|divide)-([a-z]+-\d{1,3}(?:/[0-9]{1,3})?)',
        r'(?:bg|text|border|ring|shadow|fill|stroke)-((?:white|black|transparent|current|inherit))\b',
        r'bg-\[(#[0-9a-fA-F]{3,8})\]',
    ]
    results: set[str] = set()
    for pat in patterns:
        for m in re.findall(pat, code):
            results.add(m.lower())
    return results


# TailwindCSS 常用颜色 → hex 映射（用于更精准的颜色匹配）
TAILWIND_HEX_MAP: dict[str, str] = {
    # slate
    'slate-50': '#f8fafc', 'slate-100': '#f1f5f9', 'slate-200': '#e2e8f0', 'slate-300': '#cbd5e1',
    'slate-400': '#94a3b8', 'slate-500': '#64748b', 'slate-600': '#475569', 'slate-700': '#334155',
    'slate-800': '#1e293b', 'slate-900': '#0f172a', 'slate-950': '#020617',
    # gray
    'gray-50': '#f9fafb', 'gray-100': '#f3f4f6', 'gray-200': '#e5e7eb', 'gray-300': '#d1d5db',
    'gray-400': '#9ca3af', 'gray-500': '#6b7280', 'gray-600': '#4b5563', 'gray-700': '#374151',
    'gray-800': '#1f2937', 'gray-900': '#111827', 'gray-950': '#030712',
    # zinc
    'zinc-50': '#fafafa', 'zinc-100': '#f4f4f5', 'zinc-200': '#e4e4e7', 'zinc-300': '#d4d4d8',
    'zinc-400': '#a1a1aa', 'zinc-500': '#71717a', 'zinc-600': '#52525b', 'zinc-700': '#3f3f46',
    'zinc-800': '#27272a', 'zinc-900': '#18181b',
    # neutral
    'neutral-50': '#fafafa', 'neutral-100': '#f5f5f5', 'neutral-200': '#e5e5e5', 'neutral-300': '#d4d4d4',
    'neutral-400': '#a3a3a3', 'neutral-500': '#737373', 'neutral-600': '#525252', 'neutral-700': '#404040',
    'neutral-800': '#262626', 'neutral-900': '#171717',
    # stone
    'stone-50': '#fafaf9', 'stone-100': '#f5f5f4', 'stone-200': '#e7e5e4', 'stone-300': '#d6d3d1',
    'stone-400': '#a8a29e', 'stone-500': '#78716c', 'stone-600': '#57534e', 'stone-700': '#44403c',
    'stone-800': '#292524', 'stone-900': '#1c1917',
    # red
    'red-50': '#fef2f2', 'red-100': '#fee2e2', 'red-200': '#fecaca', 'red-300': '#fca5a5',
    'red-400': '#f87171', 'red-500': '#ef4444', 'red-600': '#dc2626', 'red-700': '#b91c1c',
    'red-800': '#991b1b', 'red-900': '#7f1d1d',
    # orange
    'orange-50': '#fff7ed', 'orange-100': '#ffedd5', 'orange-200': '#fed7aa', 'orange-300': '#fdba74',
    'orange-400': '#fb923c', 'orange-500': '#f97316', 'orange-600': '#ea580c',
    # amber
    'amber-50': '#fffbeb', 'amber-100': '#fef3c7', 'amber-200': '#fde68a', 'amber-300': '#fcd34d',
    'amber-400': '#fbbf24', 'amber-500': '#f59e0b',
    # yellow
    'yellow-50': '#fefce8', 'yellow-100': '#fef9c3', 'yellow-200': '#fef08a', 'yellow-300': '#fde047',
    'yellow-400': '#facc15', 'yellow-500': '#eab308',
    # green
    'green-50': '#f0fdf4', 'green-100': '#dcfce7', 'green-200': '#bbf7d0', 'green-300': '#86efac',
    'green-400': '#4ade80', 'green-500': '#22c55e', 'green-600': '#16a34a', 'green-700': '#15803d',
    # emerald
    'emerald-50': '#ecfdf5', 'emerald-100': '#d1fae5', 'emerald-200': '#a7f3d0', 'emerald-300': '#6ee7b7',
    'emerald-400': '#34d399', 'emerald-500': '#10b981',
    # teal
    'teal-50': '#f0fdfa', 'teal-100': '#ccfbf1', 'teal-200': '#99f6e4', 'teal-300': '#5eead4',
    'teal-400': '#2dd4bf', 'teal-500': '#14b8a6',
    # cyan
    'cyan-50': '#ecfeff', 'cyan-100': '#cffafe', 'cyan-200': '#a5f3fc', 'cyan-300': '#67e8f9',
    'cyan-400': '#22d3ee', 'cyan-500': '#06b6d4',
    # sky
    'sky-50': '#f0f9ff', 'sky-100': '#e0f2fe', 'sky-200': '#bae6fd', 'sky-300': '#7dd3fc',
    'sky-400': '#38bdf8', 'sky-500': '#0ea5e9', 'sky-600': '#0284c7',
    # blue
    'blue-50': '#eff6ff', 'blue-100': '#dbeafe', 'blue-200': '#bfdbfe', 'blue-300': '#93c5fd',
    'blue-400': '#60a5fa', 'blue-500': '#3b82f6', 'blue-600': '#2563eb', 'blue-700': '#1d4ed8',
    # indigo
    'indigo-50': '#eef2ff', 'indigo-100': '#e0e7ff', 'indigo-200': '#c7d2fe', 'indigo-300': '#a5b4fc',
    'indigo-400': '#818cf8', 'indigo-500': '#6366f1', 'indigo-600': '#4f46e5',
    # violet
    'violet-50': '#f5f3ff', 'violet-100': '#ede9fe', 'violet-200': '#ddd6fe', 'violet-300': '#c4b5fd',
    'violet-400': '#a78bfa', 'violet-500': '#8b5cf6',
    # purple
    'purple-50': '#faf5ff', 'purple-100': '#f3e8ff', 'purple-200': '#e9d5ff', 'purple-300': '#d8b4fe',
    'purple-400': '#c084fc', 'purple-500': '#a855f7',
    # pink
    'pink-50': '#fdf2f8', 'pink-100': '#fce7f3', 'pink-200': '#fbcfe8', 'pink-300': '#f9a8d4',
    'pink-400': '#f472b6', 'pink-500': '#ec4899',
    # rose
    'rose-50': '#fff1f2', 'rose-100': '#ffe4e6', 'rose-200': '#fecdd3', 'rose-300': '#fda4af',
    'rose-400': '#fb7185', 'rose-500': '#f43f5e',
    # basic
    'white': '#ffffff', 'black': '#000000', 'transparent': '#00000000',
    'current': 'currentColor',
}


def _tw_to_hex(tw_class: str) -> str | None:
    """将 Tailwind 颜色类名转为 hex"""
    return TAILWIND_HEX_MAP.get(tw_class)


def _extract_text_content(code: str) -> list[str]:
    """提取 JSX 中的文本内容（>text< / >"text"< 之间的文字）"""
    texts: list[str] = []
    # 匹配 >文本内容< 或者 >"文本内容"<
    pattern = r'>\s*["\']?([^<>{}\[\]]{2,})["\']?\s*<'
    for m in re.findall(pattern, code):
        t = m.strip()
        if t and not t.startswith('//') and not t.startswith('{') and len(t) >= 2:
            texts.append(t)
    return texts


def _extract_jsx_tags(code: str) -> list[str]:
    """提取 JSX 标签名（div, button, input, span, h1-h6, img, table 等）"""
    # 匹配 <TagName 或 </TagName>，排除注释
    tags = re.findall(r'<(\w+)', code)
    return [t for t in tags if t not in ('import', 'export', 'React', 'Fragment')]


def _extract_flex_grid(code: str) -> bool:
    """检查代码是否使用了 flex/grid 布局"""
    return bool(re.search(r'(?:flex|grid)\b', code))


def _extract_tailwind_spacing(code: str) -> list[str]:
    """提取 Tailwind 间距/尺寸类"""
    patterns = [
        r'(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-[xy])-(\d+)',
        r'(?:w|h|min-w|min-h|max-w|max-h)-(\d+)',
    ]
    results: list[str] = []
    for pat in patterns:
        results.extend(re.findall(pat, code))
    return results


# ============================================================
# 设计稿数据提取
# ============================================================

def _get_design_colors(elements: list[dict]) -> set[str]:
    """从设计稿元素中提取所有使用的颜色"""
    colors: set[str] = set()
    for el in elements:
        fill = el.get('fill')
        stroke = el.get('stroke')
        if fill and isinstance(fill, str) and fill.startswith('#'):
            colors.add(fill.lower())
        if stroke and isinstance(stroke, str) and stroke.startswith('#'):
            colors.add(stroke.lower())
    return colors


def _get_design_texts(elements: list[dict]) -> list[dict]:
    """从设计稿中提取所有文字元素"""
    texts = []
    for el in elements:
        t = el.get('text')
        placeholder = el.get('placeholder')
        if t and isinstance(t, str) and len(t.strip()) >= 2:
            texts.append({'id': el.get('id', ''), 'text': t.strip()})
        if placeholder and isinstance(placeholder, str) and len(placeholder.strip()) >= 2:
            texts.append({'id': el.get('id', ''), 'text': placeholder.strip()})
    return texts


def _get_design_types(elements: list[dict]) -> list[str]:
    """获取设计稿元素类型分布"""
    types: list[str] = []
    for el in elements:
        ct = el.get('componentType') or el.get('type', 'unknown')
        types.append(ct)
    return types


# ============================================================
# 检查逻辑
# ============================================================

def _check_element_count(design_elements: list[dict], jsx_tags: list[str]) -> dict:
    """检查元素数量：设计稿有 N 个元素，代码里应有对应的组件标签"""
    design_count = len(design_elements)

    # 有意义的结构标签（div 是容器，不算独立组件）
    component_tags = [t for t in jsx_tags if t not in ('div', 'span', 'main', 'section', 'article', 'header', 'footer', 'aside', 'nav')]
    structural_tags = [t for t in jsx_tags if t in ('div', 'main', 'section', 'article', 'header', 'footer', 'aside', 'nav')]

    # 分数：有结构标签 + 有组件标签，两者都有则高分
    score = 0
    details = []

    if len(jsx_tags) >= 1:
        score += 30
    else:
        details.append("代码中没有任何 JSX 标签")

    if len(component_tags) >= min(design_count, 2):
        score += 30
        details.append(f"组件标签 {len(component_tags)} 个，设计稿元素 {design_count} 个")
    else:
        score += max(0, len(component_tags) * 10)
        details.append(f"组件标签偏少：{len(component_tags)} 个（设计稿 {design_count} 个元素）")

    if len(structural_tags) >= 2:
        score += 20
    else:
        score += len(structural_tags) * 10
        details.append("布局结构标签偏少")

    return {
        "category": "元素数量",
        "score": min(80, score),
        "maxScore": 80,
        "details": "; ".join(details) if details else f"共 {len(jsx_tags)} 个 JSX 标签，结构完整",
        "passed": score >= 40,
    }


def _check_color_accuracy(design_colors: set[str], hex_colors: set[str], tw_colors: set[str]) -> dict:
    """检查颜色准确率（支持 Tailwind 语义色 → hex 映射）"""
    if not design_colors:
        return {
            "category": "颜色还原",
            "score": 100,
            "maxScore": 100,
            "details": "设计稿无特定颜色要求",
            "passed": True,
        }

    # 将代码中的 Tailwind 语义色转为 hex
    code_hex_set: set[str] = set(hex_colors)  # 直接使用的 hex
    for tw in tw_colors:
        hex_val = _tw_to_hex(tw)
        if hex_val:
            code_hex_set.add(hex_val.lower())

    matched = set()
    for dc in design_colors:
        dc_lower = dc.lower()
        # 精确 hex 匹配
        if dc_lower in code_hex_set:
            matched.add(dc)
            continue

    ratio = len(matched) / len(design_colors) if design_colors else 1.0
    score = int(ratio * 100)

    missing = design_colors - matched
    details_parts = [f"设计稿 {len(design_colors)} 种颜色，代码匹配 {len(matched)} 种（{int(ratio*100)}%）"]
    if missing:
        details_parts.append(f"缺失颜色: {', '.join(sorted(missing))}")

    return {
        "category": "颜色还原",
        "score": score,
        "maxScore": 100,
        "details": " | ".join(details_parts),
        "passed": ratio >= 0.5,
    }


def _check_text_accuracy(design_texts: list[dict], code_texts: list[str]) -> dict:
    """检查文字内容还原度"""
    if not design_texts:
        return {
            "category": "文字还原",
            "score": 100,
            "maxScore": 100,
            "details": "设计稿无文字内容",
            "passed": True,
        }

    matched_count = 0
    matched_items: list[str] = []
    missing_items: list[str] = []

    for item in design_texts:
        dt = item['text']
        found = False
        for ct in code_texts:
            # 模糊匹配：包含关系或相似
            if dt in ct or ct in dt or _similar_text(dt, ct) > 0.6:
                found = True
                matched_items.append(dt[:30])
                break
        if found:
            matched_count += 1
        else:
            missing_items.append(dt[:30])

    ratio = matched_count / len(design_texts) if design_texts else 1.0
    score = int(ratio * 100)

    details_parts = [f"设计稿 {len(design_texts)} 段文字，代码匹配 {matched_count} 段（{int(ratio*100)}%）"]
    if missing_items:
        details_parts.append(f"未还原: {', '.join(missing_items[:5])}")

    return {
        "category": "文字还原",
        "score": score,
        "maxScore": 100,
        "details": " | ".join(details_parts),
        "passed": ratio >= 0.5,
    }


def _check_structure(design_elements: list[dict], code: str, jsx_tags: list[str]) -> dict:
    """检查结构完整性"""
    issues: list[str] = []
    score = 100

    # 检查是否有 flex/grid 布局
    if not _extract_flex_grid(code):
        issues.append("代码未使用 flex/grid 布局")
        score -= 25

    # 检查是否有 header/sidebar（如果设计稿有的话）
    design_types = _get_design_types(design_elements)
    has_header = 'header' in design_types or any('header' in str(e.get('componentType', '')).lower() for e in design_elements)
    has_card = 'card' in design_types or any(e.get('type') == 'rect' and e.get('width', 0) > 200 for e in design_elements)

    if has_header and 'header' not in jsx_tags:
        issues.append("设计稿有 header 但代码缺失")
        score -= 15

    if has_card and 'card' not in str(code).lower() and 'rounded' not in code:
        issues.append("代码可能缺少卡片组件")
        score -= 10

    # 检查是否有 container/wrapper
    if not re.search(r'(?:className\s*=\s*["\'][^"\']*\b(?:container|wrapper|root|app)\b)', code):
        issues.append("缺少顶层容器")
        score -= 10

    score = max(0, score)

    return {
        "category": "结构完整性",
        "score": score,
        "maxScore": 100,
        "details": "; ".join(issues) if issues else "布局结构完整，使用了 flex/grid",
        "passed": score >= 60,
    }


def _check_code_quality(code: str) -> dict:
    """检查代码质量"""
    issues: list[str] = []
    score = 100

    # 检查是否有 import React
    if 'import' not in code:
        issues.append("缺少 import 语句")
        score -= 20

    # 检查是否有 export default
    if 'export default' not in code and 'export {' not in code:
        issues.append("缺少 export")
        score -= 15

    # 检查是否有 className（TailwindCSS 使用的标志）
    if 'className' not in code:
        issues.append("未使用 className（可能不是 React）")
        score -= 30

    # 检查代码长度合理（至少 50 字符）
    if len(code.strip()) < 50:
        issues.append("代码过短，可能生成不完整")
        score -= 40

    # 检查是否包含奇怪字符
    if '```' in code:
        issues.append("代码中包含 markdown 标记（未清理干净）")
        score -= 10

    return {
        "category": "代码规范",
        "score": max(0, score),
        "maxScore": 100,
        "details": "; ".join(issues) if issues else "代码格式规范，包含 import/export/className",
        "passed": score >= 60,
    }


# ============================================================
# 工具函数
# ============================================================

def _similar_text(a: str, b: str) -> float:
    """简单的文本相似度计算（Jaccard 字符级）"""
    if not a or not b:
        return 0.0
    set_a = set(a.lower())
    set_b = set(b.lower())
    intersection = len(set_a & set_b)
    union = len(set_a | set_b)
    return intersection / union if union > 0 else 0.0


# ============================================================
# 主入口
# ============================================================

def check_code_accuracy(design: dict, code: str) -> dict:
    """
    自检生成的代码准确率

    返回:
    {
        "overallScore": 85,          # 总分 0-100
        "dimensions": [...],         # 各维度得分
        "suggestions": [...],        # 改进建议
        "timestamp": 1719700000
    }
    """
    elements = design.get("elements", [])

    # 解析生成代码
    hex_colors = _extract_hex_colors(code)
    tw_colors = _extract_tailwind_colors(code)
    code_texts = _extract_text_content(code)
    jsx_tags = _extract_jsx_tags(code)

    # 解析设计稿
    design_colors = _get_design_colors(elements)
    design_texts = _get_design_texts(elements)

    # 各项检查
    dimensions = [
        _check_element_count(elements, jsx_tags),
        _check_color_accuracy(design_colors, hex_colors, tw_colors),
        _check_text_accuracy(design_texts, code_texts),
        _check_structure(elements, code, jsx_tags),
        _check_code_quality(code),
    ]

    # 计算总分（加权平均）
    weights = [15, 30, 25, 15, 15]  # 颜色和文字权重最高
    total_weight = sum(weights)
    weighted_sum = sum(
        d["score"] / d["maxScore"] * w
        for d, w in zip(dimensions, weights)
    )
    overall_score = int((weighted_sum / total_weight) * 100)

    # 生成改进建议
    suggestions: list[str] = []
    for d in dimensions:
        if not d["passed"]:
            suggestions.append(f"[{d['category']}] {d['details']}")

    if overall_score >= 90:
        suggestions.insert(0, "✅ 代码质量优秀，准确率超过 90%")
    elif overall_score >= 70:
        suggestions.insert(0, "⚠️ 代码基本可用，建议人工检查关键部分")
    else:
        suggestions.insert(0, "🔴 准确率偏低，建议重新生成或手动修改")

    return {
        "overallScore": overall_score,
        "dimensions": dimensions,
        "suggestions": suggestions,
        "timestamp": 0,  # 前端会用 Date.now()
    }
