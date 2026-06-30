"""
Prompt 预处理器 —— 从自然语言中提取设计约束，构建高质量 prompt

解决的问题：
1. 中文颜色词 → 精确 hex 色值映射
2. 风格关键词 → 设计参数转换
3. 布局关键词 → 结构约束注入
4. 生成后色彩验证与自动修正
5. ★ 增强视觉层次感，让 AI 生成"好看"的界面
"""
import re
import json
from dataclasses import dataclass, field


# ============================================================
# 颜色关键词映射表
# ============================================================

COLOR_PALETTE_MAP = {
    "红": {
        "primary": "#E34D59",
        "primary_light": "#FF6B7A",
        "primary_dark": "#C9353F",
        "primary_bg": "#FFF0F1",
        "primary_gradient": "linear-gradient(135deg, #E34D59, #FF6B7A)",
        "accent": "#FFD700",
        "surface": "#FFFFFF",
        "background": "#FFF5F5",
        "text_primary": "#2D1B1C",
        "text_secondary": "#8C6B6D",
        "border": "#F5D5D7",
        "shadow": "rgba(227,77,89,0.15)",
    },
    "蓝": {
        "primary": "#0052D9",
        "primary_light": "#3D7FFF",
        "primary_dark": "#003CAB",
        "primary_bg": "#EEF3FF",
        "primary_gradient": "linear-gradient(135deg, #0052D9, #3D7FFF)",
        "accent": "#00D4AA",
        "surface": "#FFFFFF",
        "background": "#F5F8FF",
        "text_primary": "#1A1A2E",
        "text_secondary": "#6B7B94",
        "border": "#D6E0F5",
        "shadow": "rgba(0,82,217,0.12)",
    },
    "橙": {
        "primary": "#ED7B2F",
        "primary_light": "#FF9A54",
        "primary_dark": "#C95E1A",
        "primary_bg": "#FFF4EC",
        "primary_gradient": "linear-gradient(135deg, #ED7B2F, #FF9A54)",
        "accent": "#FFD700",
        "surface": "#FFFFFF",
        "background": "#FFFBF7",
        "text_primary": "#2D1F13",
        "text_secondary": "#8C6B4D",
        "border": "#F5DCC8",
        "shadow": "rgba(237,123,47,0.15)",
    },
    "绿": {
        "primary": "#00A870",
        "primary_light": "#2ED4A1",
        "primary_dark": "#007A52",
        "primary_bg": "#EEFFF7",
        "primary_gradient": "linear-gradient(135deg, #00A870, #2ED4A1)",
        "accent": "#FFC107",
        "surface": "#FFFFFF",
        "background": "#F5FFFB",
        "text_primary": "#1A2D25",
        "text_secondary": "#5C8C77",
        "border": "#C8E8D8",
        "shadow": "rgba(0,168,112,0.12)",
    },
    "紫": {
        "primary": "#7C4DFF",
        "primary_light": "#A07FFF",
        "primary_dark": "#5A2DD9",
        "primary_bg": "#F6F0FF",
        "primary_gradient": "linear-gradient(135deg, #7C4DFF, #A07FFF)",
        "accent": "#FFD700",
        "surface": "#FFFFFF",
        "background": "#FAF7FF",
        "text_primary": "#1F1730",
        "text_secondary": "#6E5C8A",
        "border": "#E0D4F5",
        "shadow": "rgba(124,77,255,0.15)",
    },
    "粉": {
        "primary": "#E91E63",
        "primary_light": "#FF6090",
        "primary_dark": "#B0003A",
        "primary_bg": "#FFF0F5",
        "primary_gradient": "linear-gradient(135deg, #E91E63, #FF6090)",
        "accent": "#FFD700",
        "surface": "#FFFFFF",
        "background": "#FFF5F8",
        "text_primary": "#2D1820",
        "text_secondary": "#8C5C6D",
        "border": "#F5D0DD",
        "shadow": "rgba(233,30,99,0.15)",
    },
    "金": {
        "primary": "#D4A017",
        "primary_light": "#F5C842",
        "primary_dark": "#A07810",
        "primary_bg": "#FFFDF0",
        "primary_gradient": "linear-gradient(135deg, #D4A017, #F5C842)",
        "accent": "#E34D59",
        "surface": "#FFFFFF",
        "background": "#FFFDF5",
        "text_primary": "#2D2410",
        "text_secondary": "#8C7A4D",
        "border": "#F0E5C0",
        "shadow": "rgba(212,160,23,0.2)",
    },
    "黑": {
        "primary": "#1A1A2E",
        "primary_light": "#2D2D44",
        "primary_dark": "#0F0F1A",
        "primary_bg": "#F0F0F5",
        "primary_gradient": "linear-gradient(135deg, #1A1A2E, #2D2D44)",
        "accent": "#0052D9",
        "surface": "#FFFFFF",
        "background": "#F5F5F7",
        "text_primary": "#1A1A2E",
        "text_secondary": "#6B7280",
        "border": "#E5E7EB",
        "shadow": "rgba(0,0,0,0.08)",
    },
    "灰": {
        "primary": "#6B7280",
        "primary_light": "#9CA3AF",
        "primary_dark": "#4B5563",
        "primary_bg": "#F3F4F6",
        "primary_gradient": "linear-gradient(135deg, #6B7280, #9CA3AF)",
        "accent": "#0052D9",
        "surface": "#FFFFFF",
        "background": "#F9FAFB",
        "text_primary": "#111827",
        "text_secondary": "#6B7280",
        "border": "#E5E7EB",
        "shadow": "rgba(0,0,0,0.06)",
    },
    "白": {
        "primary": "#FFFFFF",
        "primary_light": "#FFFFFF",
        "primary_dark": "#F0F0F0",
        "primary_bg": "#FAFAFA",
        "primary_gradient": "linear-gradient(135deg, #FFFFFF, #F0F0F0)",
        "accent": "#0052D9",
        "surface": "#FFFFFF",
        "background": "#FFFFFF",
        "text_primary": "#1A1A2E",
        "text_secondary": "#9CA3AF",
        "border": "#E5E7EB",
        "shadow": "rgba(0,0,0,0.06)",
    },
}

COLOR_ALIASES = {
    "红色": "红", "红色调": "红", "红调": "红", "亮红": "红", "中国红": "红",
    "蓝色": "蓝", "蓝色调": "蓝", "蓝调": "蓝", "深蓝": "蓝", "天蓝": "蓝",
    "橙色": "橙", "橙色调": "橙", "橙调": "橙", "暖橙": "橙",
    "绿色": "绿", "绿色调": "绿", "绿调": "绿", "翠绿": "绿", "清新绿": "绿",
    "紫色": "紫", "紫色调": "紫", "紫调": "紫", "深紫": "紫",
    "粉色": "粉", "粉色调": "粉", "粉调": "粉", "樱花粉": "粉",
    "金色": "金", "金色调": "金", "金调": "金", "暗金": "金",
    "黑色": "黑", "深色": "黑", "暗色": "黑", "暗黑": "黑", "黑色调": "黑",
    "灰色": "灰", "浅灰": "灰", "深灰": "灰", "灰色调": "灰",
    "白色": "白", "浅色": "白", "白色调": "白", "亮色": "白",
    "灰白": "灰", "灰白配色": "灰", "红黑": "红", "蓝白": "蓝", "橙红": "橙",
    "深色主题": "黑", "暗色主题": "黑", "暗黑主题": "黑",
    "暖色": "橙", "暖色调": "橙", "冷色": "蓝", "冷色调": "蓝",
}


# ============================================================
# 风格关键词映射
# ============================================================

STYLE_KEYWORDS = {
    "圆角": {"borderRadius": 16, "style_desc": "大圆角卡片风格，所有卡片和按钮使用 16px 圆角（rx=16, ry=16）"},
    "大圆角": {"borderRadius": 24, "style_desc": "超大圆角风格，所有卡片和按钮使用 24px 圆角（rx=24, ry=24）"},
    "直角": {"borderRadius": 0, "style_desc": "直角风格，所有元素使用 0px 圆角（rx=0, ry=0）"},
    "小圆角": {"borderRadius": 8, "style_desc": "小圆角风格，所有卡片和按钮使用 8px 圆角（rx=8, ry=8）"},
    "极简": {"density": "sparse", "style_desc": "极简风格：大量留白（元素间距 40-60px），仅 2-3 种颜色，细字体，无多余装饰"},
    "紧凑": {"density": "dense", "style_desc": "紧凑风格：元素间距 8-16px，信息密度高"},
    "渐变": {"hasGradient": True, "style_desc": "重要区域使用渐变色背景（header、banner、主按钮），渐变角度 135deg"},
    "毛玻璃": {"hasGlass": True, "style_desc": "导航栏和浮层使用半透明毛玻璃效果（opacity 0.85-0.95），配合 backdrop 模糊"},
    "卡片式": {"layout": "cards", "style_desc": "卡片式布局，每个内容块都是独立卡片（白色表面 + 柔和阴影 + 边框）"},
    "扁平": {"depth": "flat", "style_desc": "扁平化设计，不使用阴影和渐变，纯色块+细边框"},
    "立体": {"depth": "elevated", "style_desc": "立体感设计：明显的卡片阴影、元素悬浮感、层次分明"},
    "电商": {"domain": "ecommerce", "style_desc": "电商风格：大图区域、价格标签（醒目字体）、促销徽章、醒目的 CTA 按钮"},
    "仪表盘": {"domain": "dashboard", "style_desc": "仪表盘风格：数据卡片（带数值和趋势箭头）、图表区域、KPI 指标网格"},
    "移动端": {"viewport": "mobile", "style_desc": "移动端适配，窄布局（375-414px 宽），适合手机屏幕"},
    "后台": {"domain": "admin", "style_desc": "后台管理风格：侧边栏、数据表格、操作按钮组"},
    "登录": {"domain": "auth", "style_desc": "登录/注册风格：居中大卡片、表单输入框、醒目的提交按钮"},
    "列表": {"domain": "list", "style_desc": "列表风格：顶部搜索栏 + 多行列表项（每行含图标/头像+标题+描述+右侧操作）"},
}

COMPOUND_STYLES = [
    ("电商活动", {"domain": "ecommerce", "hasBadge": True, "hasCTA": True}),
    ("优惠券", {"hasCoupon": True, "style_hint": "需要优惠券卡片：虚线边框（strokeDasharray）、大号折扣数字、醒目的「立即领取」按钮"}),
    ("活动页", {"hasBanner": True, "hasCountdown": True, "style_hint": "需要全宽活动横幅（渐变背景）+ 倒计时组件"}),
    ("领取", {"hasClaimButton": True, "style_hint": "需要有突出的行动号召按钮（如「立即领取」、「马上抢购」），大尺寸、醒目颜色"}),
    ("表单", {"hasForm": True, "style_hint": "需要表单区域：多个输入框（type=input）、标签文字、提交按钮"}),
    ("数据看板", {"hasDashboard": True, "style_hint": "需要数据看板：多个统计卡片（数值+标签+图标区域）、网格排列"}),
    ("用户信息", {"hasProfile": True, "style_hint": "需要用户信息区：头像圆形占位、用户名、标签/徽章、统计数据"}),
]


# ============================================================
# 布局关键词映射
# ============================================================

LAYOUT_HINTS = {
    "侧边栏": "包含左侧导航侧边栏（240px 宽，从 top=0 开始延伸到画布底部）",
    "顶栏": "包含顶部导航栏（64px 高，全宽）",
    "全宽": "使用全宽布局，不需要侧边栏",
    "两栏": "使用左右两栏布局，左栏占比 60-65%",
    "三栏": "使用三栏网格布局，等宽排列",
    "居中": "内容水平居中排列，左右留白至少 80px",
    "网格": "使用 3-4 列网格布局排列卡片元素",
    "上下": "使用上下分区布局，上半部分 banner/统计，下半部分列表/表格",
}


# ============================================================
# 核心提取类
# ============================================================

@dataclass
class DesignConstraints:
    """从自然语言 prompt 中提取的设计约束"""
    color_palette: dict | None = None
    color_name: str | None = None
    border_radius: int | None = None
    style_descriptions: list[str] = field(default_factory=list)
    layout_hints: list[str] = field(default_factory=list)
    domain_hints: list[str] = field(default_factory=list)
    special_elements: list[str] = field(default_factory=list)
    has_coupon: bool = False
    has_banner: bool = False
    has_countdown: bool = False
    has_claim_button: bool = False
    has_form: bool = False
    has_dashboard: bool = False
    has_profile: bool = False
    has_gradient: bool = False
    has_glass: bool = False
    density: str | None = None
    viewport: str | None = None
    layout_type: str | None = None


def extract_constraints(prompt: str) -> DesignConstraints:
    """从自然语言 prompt 中提取所有设计约束"""
    constraints = DesignConstraints()

    # 1. 提取颜色
    constraints.color_palette, constraints.color_name = _extract_color(prompt)

    # 2. 提取风格关键词
    for keyword, info in STYLE_KEYWORDS.items():
        if keyword in prompt:
            if "borderRadius" in info:
                constraints.border_radius = info["borderRadius"]
            if "density" in info:
                constraints.density = info["density"]
            if "viewport" in info:
                constraints.viewport = info["viewport"]
            if "domain" in info:
                constraints.domain_hints.append(info["domain"])
            if "hasGradient" in info:
                constraints.has_gradient = info["hasGradient"]
            if "hasGlass" in info:
                constraints.has_glass = info["hasGlass"]
            if "layout" in info:
                constraints.layout_type = info["layout"]
            constraints.style_descriptions.append(info["style_desc"])

    # 3. 提取复合风格
    for keyword, info in COMPOUND_STYLES:
        if keyword in prompt:
            if "domain" in info:
                domain = info["domain"]
                if domain not in constraints.domain_hints:
                    constraints.domain_hints.append(domain)
            if info.get("hasCoupon"):
                constraints.has_coupon = True
            if info.get("hasBanner"):
                constraints.has_banner = True
            if info.get("hasCountdown"):
                constraints.has_countdown = True
            if info.get("hasClaimButton"):
                constraints.has_claim_button = True
            if info.get("hasForm"):
                constraints.has_form = True
            if info.get("hasDashboard"):
                constraints.has_dashboard = True
            if info.get("hasProfile"):
                constraints.has_profile = True
            if "style_hint" in info:
                constraints.style_descriptions.append(info["style_hint"])

    # 4. 提取布局提示
    for keyword, hint in LAYOUT_HINTS.items():
        if keyword in prompt:
            constraints.layout_hints.append(hint)

    # 5. 默认值
    if constraints.border_radius is None:
        constraints.border_radius = 12

    return constraints


def _extract_color(prompt: str) -> tuple[dict | None, str | None]:
    """从 prompt 中提取颜色约束

    优先级：
    1. 用户指定 hex 色值（如 #FF6B6B）→ 动态生成完整色板
    2. 中文颜色别名（如 "红色调"）→ 使用预设色板
    """
    # ★ 优先：提取用户指定的 hex 颜色
    hex_match = re.search(r'#([0-9a-fA-F]{6})', prompt)
    if hex_match:
        user_hex = hex_match.group(0)
        # 判断颜色名（用于后续文案匹配）
        color_name = _infer_color_name_from_hex(user_hex)
        palette = _build_palette_from_hex(user_hex)
        return palette, color_name

    # 原有逻辑：中文别名匹配
    sorted_aliases = sorted(COLOR_ALIASES.items(), key=lambda x: len(x[0]), reverse=True)

    for alias, color_key in sorted_aliases:
        if alias in prompt:
            palette = COLOR_PALETTE_MAP.get(color_key)
            if palette:
                return palette, color_key

    return None, None


# ============================================================
# ★ 新增：hex 颜色 → 完整色板动态生成
# ============================================================

def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    """#FF6B6B → (255, 107, 107)"""
    h = hex_color.lstrip('#')
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def _rgb_to_hex(r: int, g: int, b: int) -> str:
    """(255, 107, 107) → '#FF6B6B'"""
    return f"#{max(0, min(255, r)):02X}{max(0, min(255, g)):02X}{max(0, min(255, b)):02X}"


def _clamp(v: int) -> int:
    return max(0, min(255, v))


def _build_palette_from_hex(primary_hex: str) -> dict:
    """根据用户指定 hex 动态生成完整色板（含亮色变体、深色变体、背景色、强调色等）"""
    r, g, b = _hex_to_rgb(primary_hex)

    # 主色变体：加亮 30/减暗 30
    primary_light = _rgb_to_hex(_clamp(r + 30), _clamp(g + 30), _clamp(b + 30))
    primary_dark = _rgb_to_hex(_clamp(r - 40), _clamp(g - 40), _clamp(b - 40))

    # 浅底：主色加大量白（保留主色 10% 饱和度）
    primary_bg_r = _clamp(r + int((255 - r) * 0.85))
    primary_bg_g = _clamp(g + int((255 - g) * 0.85))
    primary_bg_b = _clamp(b + int((255 - b) * 0.85))
    primary_bg = _rgb_to_hex(primary_bg_r, primary_bg_g, primary_bg_b)

    # 背景：主色加极大量白（保留 3% 色彩倾向）
    bg_r = _clamp(r + int((255 - r) * 0.93))
    bg_g = _clamp(g + int((255 - g) * 0.93))
    bg_b = _clamp(b + int((255 - b) * 0.93))
    background = _rgb_to_hex(bg_r, bg_g, bg_b)

    # 强调色：与主色互补（HSL 色相偏移 150° ≈ 青色-金色范围）
    # 红色 → 金色强调；蓝色 → 橙色强调
    accent_r = _clamp(255 - r + 30)
    accent_g = _clamp(255 - g)
    accent_b = _clamp(255 - b - 30)
    accent = _rgb_to_hex(accent_r, accent_g, accent_b)

    # 文字色：主色的深色变体
    text_primary = f"#{max(0, r - 150):02X}{max(0, g - 150):02X}{max(0, b - 150):02X}"
    # 辅助文字：灰色调
    text_secondary = "#9CA3AF"
    # 边框：浅色变体
    border_r = _clamp(r + int((255 - r) * 0.7))
    border_g = _clamp(g + int((255 - g) * 0.7))
    border_b = _clamp(b + int((255 - b) * 0.7))
    border = _rgb_to_hex(border_r, border_g, border_b)

    # 阴影色
    shadow = f"rgba({r},{g},{b},0.15)"

    return {
        "primary": primary_hex,
        "primary_light": primary_light,
        "primary_dark": primary_dark,
        "primary_bg": primary_bg,
        "primary_gradient": f"linear-gradient(135deg, {primary_hex}, {primary_light})",
        "accent": accent,
        "surface": "#FFFFFF",
        "background": background,
        "text_primary": text_primary,
        "text_secondary": text_secondary,
        "border": border,
        "shadow": shadow,
    }


def _infer_color_name_from_hex(hex_color: str) -> str:
    """从 hex 值推断颜色名（红/蓝/绿/橙/紫/粉/金/灰）"""
    r, g, b = _hex_to_rgb(hex_color)

    # 红色判定：R 显著大于 G 和 B
    if r > b + 40 and r > g + 30:
        return "红"
    # 蓝色判定
    if b > r + 30 and b > g + 20:
        return "蓝"
    # 绿色判定
    if g > r + 30 and g > b + 20:
        return "绿"
    # 橙色判定
    if r > b + 50 and g > b + 30 and abs(r - g) < 80:
        return "橙"
    # 紫色判定
    if r > g + 40 and b > g + 40:
        return "紫"
    # 粉色判定
    if r > b + 30 and r > g + 20 and g > b + 20:
        return "粉"
    # 金色判定
    if r > g + 40 and g > b + 40:
        return "金"
    # 灰色判定 (RGB相近)
    if abs(r - g) < 30 and abs(g - b) < 30 and abs(r - b) < 30:
        return "灰"

    return "红"  # 默认算红色系


# ============================================================
# ★★★ 增强版 System Prompt —— 核心优化 ★★★
# ============================================================

def build_enhanced_system_prompt(constraints: DesignConstraints) -> str:
    """根据提取的约束构建增强版 system prompt

    核心改进：
    1. 增加视觉层次感设计指南（阴影、渐变、间距层级）
    2. 增加丰富的组件类型（icon、image、divider、progress、tag、avatar）
    3. 增加排版层级规则（H1/H2/H3/body/caption）
    4. 增加装饰元素建议（背景装饰、分割线、强调色点缀）
    """

    # ── 颜色约束 ──
    color_section = _build_color_section(constraints)

    # ── 视觉层次感指南 ──
    visual_guide = _build_visual_guide()

    # ── 风格约束 ──
    style_section = _build_style_section(constraints)

    # ── 布局约束 ──
    layout_section = _build_layout_section(constraints)

    # ── 组件丰富度指南 ──
    component_guide = _build_component_guide(constraints)

    # ── 输出规范 ──
    output_spec = _build_output_spec()

    # ── 场景专属视觉增强（优惠券/活动页）──
    scene_visual = _build_scene_visual_guide(constraints)

    return "\n\n".join([
        color_section,
        visual_guide,
        style_section,
        layout_section,
        component_guide,
        scene_visual,
        output_spec,
    ])


def _build_color_section(constraints: DesignConstraints) -> str:
    """构建颜色约束部分"""
    if constraints.color_palette and constraints.color_name:
        cp = constraints.color_palette
        color_label = {"红": "红色", "蓝": "蓝色", "橙": "橙色", "绿": "绿色", "紫": "紫色",
                       "粉": "粉色", "金": "金色", "黑": "深色", "灰": "灰色", "白": "白色"}.get(constraints.color_name, constraints.color_name)

        return f"""你是一个世界级 UI 设计师。用户指定了 **{color_label}** 作为主色调。

## 🚨 颜色色板（必须严格使用）

| 用途 | 颜色值 | 说明 |
|------|--------|------|
| **主色 (primary)** | `{cp['primary']}` | 按钮填充、header 背景、重要图标、选中态 |
| 主色浅色 | `{cp['primary_light']}` | hover 态、渐变终点、次要高亮 |
| 主色深色 | `{cp['primary_dark']}` | 按下态、深色变体 |
| 主色浅底 | `{cp['primary_bg']}` | 浅色背景区块、标签背景 |
| 强调色 | `{cp['accent']}` | 徽章、角标、特殊标记、CTA 点缀 |
| 页面背景 | `{cp['background']}` | 整体页面底色 |
| 卡片表面 | `{cp['surface']}` | 卡片、弹窗、白色区块背景 |
| 主文字色 | `{cp['text_primary']}` | 标题、正文（深色） |
| 辅助文字色 | `{cp['text_secondary']}` | 说明文字、标签、时间戳 |
| 边框色 | `{cp['border']}` | 分割线、卡片边框 |
| 阴影色 | `{cp.get('shadow', 'rgba(0,0,0,0.1)')}` | 卡片阴影（带主色色调） |

⚠️ **禁止**使用默认蓝色（#0052D9）除非用户明确要蓝色。"""
    else:
        return """你是一个世界级 UI 设计师。用户没有指定颜色，默认使用品牌蓝色系（#0052D9）作为主色。

## 🚨 颜色色板（必须严格使用）

| 用途 | 颜色值 |
|------|--------|
| 主色 (primary) | `#0052D9` |
| 主色浅色 | `#3D7FFF` |
| 主色深色 | `#003CAB` |
| 主色浅底 | `#EEF3FF` |
| 强调色 | `#00D4AA` |
| 页面背景 | `#F5F8FF` |
| 卡片表面 | `#FFFFFF` |
| 主文字色 | `#1A1A2E` |
| 辅助文字色 | `#6B7B94` |
| 边框色 | `#D6E0F5` |
| 阴影色 | `rgba(0,82,217,0.12)` |"""


def _build_visual_guide() -> str:
    """★ 核心新增：视觉层次感设计指南"""
    return """## 🎨 视觉层次感指南（必须遵守）

### 1. 阴影系统（提升立体感）
- 卡片：使用 `shadow` 属性，如 `"shadow": "0 2px 12px rgba(0,0,0,0.08)"`
- 悬浮元素（如 header、浮层）：更深的阴影 `"shadow": "0 4px 20px rgba(0,0,0,0.12)"`
- 按钮：轻微阴影 `"shadow": "0 2px 8px rgba(主色,0.25)"`

### 2. 渐变运用（提升视觉吸引力）
- Header/Banner 区域：使用主色渐变作为背景 `"fill": "linear-gradient(135deg, primary, primary_light)"`
- 统计卡片顶部：加一条渐变装饰条（4px 高的 rect，渐变填充）
- 不要所有地方都用渐变——只在 1-2 个重点区域使用

### 3. 间距层级（制造呼吸感）
- 页面外边距：左右至少 40px，顶部至少 24px
- 区块间距：至少 32px（标题与内容之间 16-20px）
- 卡片内边距：上下 24px，左右 20px
- 元素间距：同类元素 16-20px，不同类元素 32-40px

### 4. 排版层级
- 页面大标题：fontSize 28-32，fontWeight bold，color = text_primary
- 区块标题：fontSize 18-22，fontWeight bold，color = text_primary
- 卡片标题：fontSize 15-17，fontWeight bold/semibold，color = text_primary
- 正文：fontSize 13-15，fontWeight normal，color = text_primary
- 辅助文字：fontSize 12-13，fontWeight normal，color = text_secondary
- 数字/数据：fontSize 24-36，fontWeight bold，color = primary

### 5. 装饰元素（增加精致感）
- 在标题左侧添加小色块装饰（如 4x20px 的 primary 色矩形）
- 卡片之间用细分割线（1px，边框色）隔开
- 重要数据旁边添加趋势小箭头图标文字（▲、▼）
- 使用强调色做小面积点缀（徽章、角标）"""


def _build_style_section(constraints: DesignConstraints) -> str:
    """构建风格约束部分"""
    base = ""

    # 圆角
    base += f"\n### 圆角规则\n所有卡片、按钮、输入框的圆角统一为 **rx={constraints.border_radius}, ry={constraints.border_radius}**。"

    # 风格描述
    if constraints.style_descriptions:
        base += "\n\n### 风格约束"
        for i, desc in enumerate(constraints.style_descriptions, 1):
            base += f"\n{i}. {desc}"

    # 渐变/毛玻璃
    if constraints.has_gradient:
        base += "\n- 重要区域（header、banner、主按钮）使用渐变填充"
    if constraints.has_glass:
        base += "\n- 导航栏和浮层使用半透明毛玻璃效果，opacity 设为 0.9"

    return base


def _build_layout_section(constraints: DesignConstraints) -> str:
    """构建布局约束部分"""
    base = "\n### 布局约束"

    if constraints.layout_hints:
        for hint in constraints.layout_hints:
            base += f"\n- {hint}"
    else:
        base += "\n- 默认使用上下分区布局：顶部 banner/header → 中间主要内容 → 底部操作区"

    if constraints.viewport == "mobile":
        base += "\n- 移动端布局：画布宽度设为 390，内容区宽度 350，单列排列"

    return base


def _build_component_guide(constraints: DesignConstraints) -> str:
    """★ 核心新增：组件丰富度指南"""
    base = """## 🧩 组件丰富度要求

你的设计稿必须包含多种类型的元素，不能只有简单的矩形+文字。以下是一个"好设计"应该包含的元素类型：

### 必选元素（每个设计稿至少包含 5 种）
1. **Header/导航栏**：全宽，包含标题文字+可能有的操作按钮
2. **卡片**：白色表面+圆角+阴影，内部包含标题+描述+数值/状态
3. **按钮**：主色填充+白色文字，或者主色边框+主色文字（幽灵按钮）
4. **文字层级**：至少包含大标题(28px+) + 正文(14px) + 辅助文字(12px) 三种字号
5. **装饰元素**：标题左侧色块、分割线、徽章/标签 中至少一种

### 推荐元素（根据场景选择 2-4 种）
6. **数据展示**：大号数字+单位+趋势箭头（如 "12,850 ▲12%"）
7. **图标占位**：小圆形或圆角矩形（用于模拟图标位置）
8. **进度条**：背景条+填充条（如完成度 68%）
9. **标签/徽章**：小圆角矩形+文字（如 "热门"、"NEW"、"进行中"）
10. **头像占位**：圆形+首字母文字（如用户头像）
11. **输入框**：圆角矩形+边框+placeholder 文字
12. **分割线**：1px 高全宽矩形，用边框色

### 元素数量
- 简单页面：12-18 个元素
- 中等页面：18-25 个元素
- 复杂页面：25-35 个元素"""

    # 场景专属元素
    scene_elements = []
    if constraints.has_coupon:
        scene_elements.append("""- **优惠券页面（重要！详细模板）**：必须包含以下层次结构：
  1. **顶部活动 Banner** (全宽, 高 200-260px)：渐变背景填充 primary→primary_light，上面叠加活动标题（白色 fontSize 32-36 bold）+ 副标题（白色 fontSize 16, opacity 0.85）+ 装饰几何图形
  2. **优惠券卡片区** (Banner 下方 40px, 左右 padding 40px)：
     - 至少生成 3 张优惠券卡片，横向排列（每个 340x180px）或纵向排列（每个全宽 200px）
     - 每张卡片结构：白色背景 + 左侧大号折扣数字区（宽 120px, primary 背景, 白色 fontSize 42-56 bold）+ 右侧内容区（券名称 fontSize 18 bold, 使用条件 fontSize 13 text_secondary, 有效期 fontSize 12 text_secondary）+ 底部「立即领取」按钮（全宽 48px 高, primary 填充, 白色粗体文字）
     - 卡片使用虚线边框（strokeDasharray="6,3", stroke=primary, strokeWidth=2）
     - 卡片之间有 16-24px 间距
  3. **活动规则区**：在优惠券下方，标题"活动规则"（fontSize 18 bold）+ 3-5条规则项（每条用 • 开头，fontSize 14, text_secondary, 行间距 28px）
  4. **底部固定 CTA**：画布底部放置一条全宽横幅（高 72px, primary 渐变背景），居中放置"查看更多优惠"文字（白色 fontSize 18 bold）""")
    if constraints.has_banner:
        scene_elements.append("- **活动横幅**：全宽 300-400px 高，渐变背景，包含大标题+副标题+装饰图形")
    if constraints.has_countdown:
        scene_elements.append("- **倒计时**：4 个方块（天/时/分/秒），每个方块内大号数字，方块间用冒号分隔")
    if constraints.has_claim_button:
        scene_elements.append("- **CTA 按钮**：大尺寸（至少 200x48px），主色填充，白色粗体文字，圆角，居中放置")
    if constraints.has_form:
        scene_elements.append("- **表单**：2-3 个输入框（带标签文字），1 个提交按钮")
    if constraints.has_dashboard:
        scene_elements.append("- **数据卡片网格**：3-4 个统计卡片，每个包含：图标占位+标签文字+大号数值+趋势箭头")
    if constraints.has_profile:
        scene_elements.append("- **用户信息区**：圆形头像(80x80)+用户名+角色标签+统计数据行")

    if scene_elements:
        base += "\n\n### 场景专属元素\n" + "\n".join(scene_elements)

    return base


# ============================================================
# ★ 场景专属视觉指南
# ============================================================

def _build_scene_visual_guide(constraints: DesignConstraints) -> str:
    """为特定场景（优惠券/活动页）注入专属视觉增强指南"""
    sections = []

    if constraints.has_coupon:
        sections.append("""## 🎫 电商优惠券页面专属视觉增强

### 空间布局（移动端优先）
- 画布宽度：420px（模拟手机屏幕），高度 900-1100px
- 内容左右留白：16px
- 垂直布局：Banner → 优惠券区 → 规则区 → 底部操作栏

### 视觉重心法则
- **70% 视觉重心在折扣数字**：折扣数字占据卡片左侧 1/3 面积，字号 42-56px，用 primary 纯色背景+白色粗体数字
- **20% 在 CTA 按钮**：按钮颜色与卡片底色形成强对比（primary 填充 vs 白色卡片）
- **10% 在辅助信息**：券名、条件、有效期用最小字号+辅助文字色

### 优惠力度视觉表达
- 折扣数字区域使用主色+略微深色渐变（如 primary→primary_dark 的 135deg 渐变）
- 在折扣数字旁添加小字「折」或「元」作为单位（fontSize 20, 白色, opacity 0.7）
- 每张优惠券卡片左上角添加标签徽章（如 "限时"、"新人专享"，fontSize 12, primary_bg 底色, primary 文字色）

### 页面节奏感
- Banner 区占页面高度 25%（带装饰图形打破单调）
- 优惠券卡片区占 45%（核心视觉区，元素最密集）
- 规则区占 20%（稀疏文字，留白充足）
- 底部 CTA 占 10%（简单的渐变条）

### 关键配色规则
- 每张优惠券折扣数字区用不同的主色变体交替（如第1张 primary, 第2张 primary_light, 第3张 primary_dark），制造节奏感
- 优惠券卡片边框用 primary，虚线样式增强"可撕下"的物理感受
- 页面背景用 primary_bg 或 background，与白色卡片形成层次""")

    if constraints.has_countdown:
        sections.append("""## ⏱ 倒计时模块视觉指南
- 倒计时的 4 个时间方块（天/时/分/秒）尺寸统一 64x80px，背景用 primary_bg，数字用 primary 色 fontSize 32 bold
- 方块间分隔符 ":" 用 primary 色 fontSize 28
- 整个倒计时区域用半透明 primary_bg 背景包裹，圆角 12px，内边距 24px""")

    if not sections:
        return ""

    return "\n\n".join(sections)


def _build_output_spec() -> str:
    """构建输出规范"""
    return """## 📐 输出格式

返回一个 JSON 对象：

```json
{
  "version": "7.0.0",
  "width": 1200,
  "height": 800,
  "elements": [
    {
      "id": "唯一ID（如 header_bg, stat_card_1, btn_submit）",
      "type": "rect | text | circle | input | button",
      "left": 数字(像素),
      "top": 数字(像素),
      "width": 数字(像素),
      "height": 数字(像素),
      "fill": "#hex颜色 或 linear-gradient(...)",
      "stroke": "#hex颜色 或空字符串",
      "strokeWidth": 数字,
      "strokeDasharray": "虚线样式 如 '6,3'（可选，用于优惠券边框）",
      "rx": 数字(圆角),
      "ry": 数字(圆角),
      "text": "文字内容（仅 type=text/button/input 时）",
      "fontSize": 数字（仅 type=text 时）,
      "fontFamily": "Inter",
      "fontWeight": "normal | bold",
      "textAlign": "left | center | right",
      "opacity": 0到1之间的数字,
      "shadow": "CSS box-shadow 字符串（可选，用于卡片和按钮）",
      "placeholder": "占位文字（仅 type=input 时）",
      "componentType": "组件语义类型，见下方列表"
    }
  ]
}
```

### componentType 可用值
`header` `banner` `card` `stat-card` `button` `primary-btn` `ghost-btn` `text` `badge` `tag` `divider` `icon` `avatar` `input` `progress-bar` `progress-fill` `countdown` `coupon-card` `price-tag` `decorator`

### 关键规则
1. **精确坐标**：每个元素的 left/top/width/height 必须精确到像素
2. **画布 1200x800**：所有元素坐标在此范围内
3. **颜色必须来自色板**：不允许使用色板外的颜色
4. **ID 要有语义**：如 `header_bg`, `stat_card_revenue`, `btn_primary_submit`
5. **元素至少 12 个**：太少的设计看起来简陋
6. **丰富视觉层次**：使用阴影、分割线、装饰元素
7. **只输出 JSON**：不要任何解释文字

## ❌ 常见错误（必须避免）
- 所有元素都是一种颜色 → 使用色板中的多种颜色
- 文字字号全部一样 → 区分标题/正文/辅助文字字号
- 没有阴影 → 卡片必须加 shadow
- 元素太少 → 至少 12 个元素
- 间距太小 → 区块间至少 32px 间距
- 没有装饰元素 → 至少加 1-2 个分割线或色块装饰"""


# ============================================================
# 增强 User Prompt
# ============================================================

def build_enhanced_user_prompt(original_prompt: str, constraints: DesignConstraints) -> str:
    """构建增强版用户 prompt"""

    enhanced = original_prompt

    if constraints.color_palette and constraints.color_name:
        cp = constraints.color_palette
        color_label = {"红": "红色", "蓝": "蓝色", "橙": "橙色", "绿": "绿色", "紫": "紫色",
                       "粉": "粉色", "金": "金色", "黑": "深色", "灰": "灰色", "白": "白色"}.get(constraints.color_name, constraints.color_name)

        enhanced += f"""

【颜色约束 - 必须遵守】
- 主色: {cp['primary']}（{color_label}）
- 按钮/header: {cp['primary']}
- 卡片: {cp['surface']}
- 页面背景: {cp['background']}
- 强调色: {cp['accent']}
- 主文字: {cp['text_primary']}
- 辅助文字: {cp['text_secondary']}
- 边框: {cp['border']}
"""

    enhanced += f"\n【圆角】rx={constraints.border_radius}, ry={constraints.border_radius}"

    if constraints.has_coupon:
        enhanced += """
【必含 - 优惠券页面详细要求】
- 顶部活动 Banner（全宽 200-260px 高，渐变背景，大标题 32px bold + 副标题 16px）
- 至少 3 张优惠券卡片（每张 340x180px 或全宽 200px 高）
- 每张卡片 = 左侧折扣数字区（primary 背景 120px 宽 + 白色 48px bold 数字）+ 右侧信息区（券名/条件/有效期）+ 底部全宽"立即领取"按钮
- 卡片使用虚线边框 strokeDasharray="6,3" stroke=primary
- 活动规则区（标题 bold + 3-5条规则项）
- 底部固定 CTA 横幅"""
    if constraints.has_banner:
        enhanced += "\n【必含】全宽活动横幅（渐变背景+标题+装饰）"
    if constraints.has_countdown:
        enhanced += "\n【必含】倒计时组件"
    if constraints.has_dashboard:
        enhanced += "\n【必含】数据统计卡片网格（3-4个卡片，数值+标签+趋势）"
    if constraints.has_form:
        enhanced += "\n【必含】表单区域（输入框+标签+提交按钮）"

    # ★ 关键追加：明确要求视觉丰富度
    if constraints.has_coupon:
        enhanced += """

【视觉要求 - 优惠券页面专版】
- 至少生成 20 个元素（优惠券页面内容多，绝对不能简陋）
- 每张优惠券卡片本身包含至少 7 个子元素（折扣区背景、折扣数字、单位文字、券名、条件、有效期、领取按钮）
- 3张优惠券卡片的折扣数字区使用不同的主色变体交替（primary / primary_light / primary_dark）
- 卡片必须加阴影 + 虚线边框
- 至少包含 4 种不同的字号（Banner 大标题 32px + 折扣数字 48px + 卡片标题 18px + 辅助文字 13px）
- Banner 区域必须使用渐变背景
- 优惠券卡片左上角添加标签徽章（如"限时"、"新人专享"）"""
    else:
        enhanced += """

【视觉要求 - 必须做到】
- 至少生成 15 个元素
- 卡片必须加阴影
- 至少包含 3 种不同的字号（大标题/正文/辅助文字）
- 至少包含 1 个装饰元素（分割线或色块）
- 使用至少 3 种不同的 componentType
- Header 区域使用渐变背景
- 重要数据使用大号粗体数字"""

    return enhanced


# ============================================================
# 生成后色彩验证与自动修正
# ============================================================

def validate_and_fix_colors(design: dict, constraints: DesignConstraints) -> dict:
    """
    验证生成的设计稿颜色是否符合约束
    如果主色不对，用启发式规则自动修正
    """
    if not constraints.color_palette:
        return design

    cp = constraints.color_palette
    expected_primary = cp["primary"].upper()
    elements = design.get("elements", [])

    # 统计颜色使用
    color_usage = {}
    for el in elements:
        fill = (el.get("fill") or "").upper()
        if fill and fill.startswith("#"):
            color_usage[fill] = color_usage.get(fill, 0) + 1

    # 检查关键组件颜色
    primary_used = any(
        el.get("fill", "").upper() == expected_primary
        for el in elements
        if el.get("componentType") in ("header", "button", "banner", "primary-btn")
    )

    if not primary_used:
        fixed_count = 0
        for el in elements:
            ct = el.get("componentType", "")
            current_fill = (el.get("fill") or "").upper()

            if ct in ("header", "banner", "button", "badge", "primary-btn"):
                if current_fill != expected_primary:
                    el["fill"] = cp["primary"]
                    fixed_count += 1

            if ct == "coupon-card":
                if el.get("type") == "rect" and el.get("stroke"):
                    el["stroke"] = cp["primary"]
                if current_fill not in (cp["surface"].upper(), "#FFFFFF", "#FFF", ""):
                    el["fill"] = cp["surface"]

            if ct in ("card", "stat-card") and el.get("type") == "rect":
                if current_fill not in (cp["surface"].upper(), "#FFFFFF", "#FFF"):
                    el["fill"] = cp["surface"]

        if fixed_count == 0 and color_usage:
            most_used = max(color_usage, key=color_usage.get)
            palette_hexes = {v.upper() for v in cp.values() if isinstance(v, str) and v.startswith("#")}
            if most_used not in palette_hexes and color_usage[most_used] >= 2:
                for el in elements:
                    if (el.get("fill") or "").upper() == most_used and el.get("componentType") in ("header", "banner", "button", "rect"):
                        el["fill"] = cp["primary"]

        design["_color_auto_fixed"] = True

    # 验证文字颜色
    for el in elements:
        if el.get("type") == "text":
            ct = el.get("componentType", "")
            fill = (el.get("fill") or "").upper()
            if ct == "header" and fill not in ("#FFFFFF", "#FFF"):
                el["fill"] = "#FFFFFF"
            if fill == expected_primary:
                el["fill"] = "#FFFFFF"

    # 验证并补充 shadow
    shadow_added = 0
    for el in elements:
        ct = el.get("componentType", "")
        if ct in ("card", "stat-card") and el.get("type") == "rect" and not el.get("shadow"):
            shadow_color = cp.get("shadow", "rgba(0,0,0,0.08)")
            el["shadow"] = f"0 2px 12px {shadow_color}"
            shadow_added += 1

    if shadow_added > 0:
        design["_shadow_auto_added"] = shadow_added

    return design
