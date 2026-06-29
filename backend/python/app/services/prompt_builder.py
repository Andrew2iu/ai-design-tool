"""
Prompt 预处理器 —— 从自然语言中提取设计约束，构建高质量 prompt

解决的问题：
1. 中文颜色词 → 精确 hex 色值映射
2. 风格关键词 → 设计参数转换
3. 布局关键词 → 结构约束注入
4. 生成后色彩验证与自动修正
"""
import re
import json
from dataclasses import dataclass, field


# ============================================================
# 颜色关键词映射表 —— 核心
# ============================================================

# 主色调映射：中文颜色词 → 完整色板
COLOR_PALETTE_MAP = {
    # ── 红色系 ──
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
    },
    # ── 蓝色系 ──
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
    },
    # ── 橙色系 ──
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
    },
    # ── 绿色系 ──
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
    },
    # ── 紫色系 ──
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
    },
    # ── 粉色系 ──
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
    },
    # ── 金色系 ──
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
    },
    # ── 灰/深色系 ──
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
    },
    # ── 白/浅色系 ──
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
    },
}

# 颜色别名映射（处理各种中文表达）
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
    # 复合色
    "灰白": "灰", "灰白配色": "灰", "红黑": "红", "蓝白": "蓝", "橙红": "橙",
    "深色主题": "黑", "暗色主题": "黑", "暗黑主题": "黑",
    "暖色": "橙", "暖色调": "橙", "冷色": "蓝", "冷色调": "蓝",
}


# ============================================================
# 风格关键词映射
# ============================================================

STYLE_KEYWORDS = {
    "圆角": {"borderRadius": 16, "style_desc": "大圆角卡片风格，所有卡片和按钮使用 16px 圆角（rx=16, ry=16）"},
    "大圆角": {"borderRadius": 24, "style_desc": "超大街圆角风格，所有卡片和按钮使用 24px 圆角（rx=24, ry=24）"},
    "直角": {"borderRadius": 0, "style_desc": "直角风格，所有元素使用 0px 圆角（rx=0, ry=0）"},
    "小圆角": {"borderRadius": 8, "style_desc": "小圆角风格，所有卡片和按钮使用 8px 圆角（rx=8, ry=8）"},
    "极简": {"density": "sparse", "style_desc": "极简风格，大量留白，元素间距 32-48px，使用细字体，颜色不超过3种"},
    "紧凑": {"density": "dense", "style_desc": "紧凑风格，元素间距 8-16px"},
    "渐变": {"hasGradient": True, "style_desc": "使用渐变色作为背景和按钮填充"},
    "毛玻璃": {"hasGlass": True, "style_desc": "使用半透明毛玻璃效果"},
    "卡片式": {"layout": "cards", "style_desc": "卡片式布局，所有内容放在独立卡片中"},
    "扁平": {"depth": "flat", "style_desc": "扁平化设计，不使用阴影和渐变"},
    "立体": {"depth": "elevated", "style_desc": "立体感设计，使用阴影和层级"},
    "电商": {"domain": "ecommerce", "style_desc": "电商风格：大图、价格标签、促销徽章、醒目的 CTA 按钮"},
    "仪表盘": {"domain": "dashboard", "style_desc": "仪表盘风格：数据卡片、图表区域、KPI 指标"},
    "移动端": {"viewport": "mobile", "style_desc": "移动端适配，窄布局（375-414px 宽），适合手机"},
    "后台": {"domain": "admin", "style_desc": "后台管理风格：侧边栏、数据表格、操作按钮"},
    "登录": {"domain": "auth", "style_desc": "登录/注册风格：居中卡片、表单输入框、提交按钮"},
}

# 复合风格检测
COMPOUND_STYLES = [
    ("电商活动", {"domain": "ecommerce", "hasBadge": True, "hasCTA": True}),
    ("优惠券", {"hasCoupon": True, "style_hint": "需要优惠券卡片样式：虚线边框、折扣数字突出显示"}),
    ("活动页", {"hasBanner": True, "hasCountdown": True, "style_hint": "需要活动横幅和倒计时元素"}),
    ("领取", {"hasClaimButton": True, "style_hint": "需要有突出的领取/立即抢购按钮"}),
]


# ============================================================
# 布局关键词映射
# ============================================================

LAYOUT_HINTS = {
    "侧边栏": "包含左侧导航侧边栏（240px 宽）",
    "顶栏": "包含顶部导航栏（64px 高）",
    "全宽": "使用全宽布局，不需要侧边栏",
    "两栏": "使用左右两栏布局",
    "三栏": "使用三栏网格布局",
    "居中": "内容居中排列",
    "网格": "使用网格布局排列元素",
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
    density: str | None = None
    viewport: str | None = None


def extract_constraints(prompt: str) -> DesignConstraints:
    """从自然语言 prompt 中提取所有设计约束"""
    constraints = DesignConstraints()

    # ── 1. 提取颜色 ──
    constraints.color_palette, constraints.color_name = _extract_color(prompt)

    # ── 2. 提取风格关键词 ──
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
            constraints.style_descriptions.append(info["style_desc"])

    # ── 3. 提取复合风格 ──
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
            if "style_hint" in info:
                constraints.style_descriptions.append(info["style_hint"])

    # ── 4. 提取布局提示 ──
    for keyword, hint in LAYOUT_HINTS.items():
        if keyword in prompt:
            constraints.layout_hints.append(hint)

    # ── 5. 如果没检测到圆角，给默认值 ──
    if constraints.border_radius is None:
        constraints.border_radius = 8  # 默认小圆角

    return constraints


def _extract_color(prompt: str) -> tuple[dict | None, str | None]:
    """从 prompt 中提取颜色约束"""
    # 按匹配优先级排序（长词优先，避免"粉红色"被"红"匹配）
    sorted_aliases = sorted(COLOR_ALIASES.items(), key=lambda x: len(x[0]), reverse=True)

    for alias, color_key in sorted_aliases:
        if alias in prompt:
            palette = COLOR_PALETTE_MAP.get(color_key)
            if palette:
                return palette, color_key

    return None, None


# ============================================================
# 增强 Prompt 构建器
# ============================================================

def build_enhanced_system_prompt(constraints: DesignConstraints) -> str:
    """根据提取的约束构建增强版 system prompt"""

    base = """你是一个专业的设计稿生成引擎。用户会用自然语言描述界面需求，你必须输出一个精确的 JSON 设计稿。

## 🚨 最高优先级规则

### 颜色规则（必须严格遵循）
"""

    # ── 颜色约束 ──
    if constraints.color_palette and constraints.color_name:
        cp = constraints.color_palette
        color_label = {"红": "红色", "蓝": "蓝色", "橙": "橙色", "绿": "绿色", "紫": "紫色",
                       "粉": "粉色", "金": "金色", "黑": "深色", "灰": "灰色", "白": "白色"}.get(constraints.color_name, constraints.color_name)

        base += f"""
用户指定了使用 **{color_label}** 作为主色调，你必须严格使用以下色板：

| 用途 | 颜色值 | 说明 |
|------|--------|------|
| **主色 (primary)** | `{cp['primary']}` | 按钮、重要元素、header 背景 |
| 主色浅色 | `{cp['primary_light']}` | hover 态、次要高亮 |
| 主色深色 | `{cp['primary_dark']}` | 按下态、深色变体 |
| 主色背景 | `{cp['primary_bg']}` | 浅色背景区域 |
| 强调色 (accent) | `{cp['accent']}` | 标签、徽章、特殊标记 |
| 页面背景 | `{cp['background']}` | 整体页面底色 |
| 卡片/面板 | `{cp['surface']}` | 卡片、弹窗背景 |
| 主文字色 | `{cp['text_primary']}` | 标题、正文 |
| 辅助文字色 | `{cp['text_secondary']}` | 说明文字、标签 |
| 边框色 | `{cp['border']}` | 分割线、卡片边框 |

⚠️ **禁止使用蓝色系颜色（#0052D9, #3D7FFF 等）作为主色，除非用户明确指定蓝色。**
⚠️ **所有按钮、header、重要装饰元素必须使用 primary 色 `{cp['primary']}`。**
"""
    else:
        base += """
如果用户没有指定颜色，默认使用品牌蓝色系（#0052D9）作为主色。
"""

    # ── 圆角约束 ──
    base += f"""
### 圆角规则
所有卡片、按钮、输入框的圆角统一为 **rx={constraints.border_radius}, ry={constraints.border_radius}**。
"""

    # ── 风格约束 ──
    if constraints.style_descriptions:
        base += "\n### 风格约束\n"
        for i, desc in enumerate(constraints.style_descriptions, 1):
            base += f"{i}. {desc}\n"

    # ── 布局约束 ──
    if constraints.layout_hints:
        base += "\n### 布局约束\n"
        for hint in constraints.layout_hints:
            base += f"- {hint}\n"

    # ── 电商活动专属元素 ──
    if constraints.has_coupon or constraints.has_banner or constraints.has_countdown:
        base += "\n### 页面专属元素\n"
        if constraints.has_coupon:
            base += "- **优惠券卡片**: 使用虚线边框、大号折扣数字、醒目的「立即领取」按钮，卡片背景用主色浅色\n"
        if constraints.has_banner:
            base += "- **活动横幅**: 全宽 banner，使用主色渐变背景，包含活动标题和装饰元素\n"
        if constraints.has_countdown:
            base += "- **倒计时**: 包含倒计时显示区域\n"
        if constraints.has_claim_button:
            base += "- **CTA按钮**: 页面需要有突出的行动号召按钮（如「立即领取」、「马上抢购」），使用主色\n"

    # ── 输出规范 ──
    base += """
## 输出规范

你必须返回一个 JSON 对象，格式如下：

```json
{
  "version": "6.0.0",
  "width": 1200,
  "height": 800,
  "elements": [
    {
      "id": "唯一ID",
      "type": "rect|text|circle|input|button",
      "left": 数字(像素),
      "top": 数字(像素),
      "width": 数字(像素),
      "height": 数字(像素),
      "fill": "#十六进制颜色",
      "stroke": "#十六进制颜色或空",
      "strokeWidth": 数字,
      "rx": 数字(圆角),
      "ry": 数字(圆角),
      "text": "文字内容(仅type=text时)",
      "fontSize": 数字(仅type=text时),
      "fontFamily": "Inter",
      "fontWeight": "normal|bold",
      "textAlign": "left|center|right",
      "opacity": 0-1,
      "componentType": "header|banner|coupon-card|button|text|badge|countdown|card"
    }
  ]
}
```

## 设计原则

1. 所有元素必须精确坐标定位（left/top/width/height），不使用 CSS 弹性布局
2. 画布固定 1200x800
3. 颜色必须使用上方色板中指定的值
4. 使用 Inter 字体
5. 充足的留白（间距 24-48px）
6. **组件必须语义化标记 componentType**
7. 生成 10-20 个元素，覆盖完整页面结构

## 页面结构

- 顶部：header 或 banner（高度 60-200px）
- 中间：主要内容区（优惠券卡片、表单、列表等）
- 底部：操作区或 footer

只输出 JSON，不要输出其他内容。"""
    return base


def build_enhanced_user_prompt(original_prompt: str, constraints: DesignConstraints) -> str:
    """构建增强版用户 prompt，附加提取的约束信息"""

    enhanced = original_prompt

    if constraints.color_palette and constraints.color_name:
        cp = constraints.color_palette
        color_label = {"红": "红色", "蓝": "蓝色", "橙": "橙色", "绿": "绿色", "紫": "紫色",
                       "粉": "粉色", "金": "金色", "黑": "深色", "灰": "灰色", "白": "白色"}.get(constraints.color_name, constraints.color_name)

        enhanced += f"""

【颜色约束 - 必须遵守】
- 页面主色: {cp['primary']}（{color_label}）
- 按钮/header背景: {cp['primary']}
- 卡片背景: {cp['surface']}
- 页面背景: {cp['background']}
- 不要使用其他色系的颜色作为主色
"""

    enhanced += f"\n【圆角约束】所有卡片和按钮 rx={constraints.border_radius}, ry={constraints.border_radius}"

    if constraints.has_coupon:
        enhanced += "\n【特殊要求】包含优惠券卡片（虚线边框、折扣数字突出）和领取按钮"

    return enhanced


# ============================================================
# 生成后色彩验证
# ============================================================

def validate_and_fix_colors(design: dict, constraints: DesignConstraints) -> dict:
    """
    验证生成的设计稿颜色是否符合约束
    如果主色不对，用启发式规则自动修正
    """
    if not constraints.color_palette:
        return design  # 没指定颜色，跳过验证

    cp = constraints.color_palette
    expected_primary = cp["primary"].upper()
    elements = design.get("elements", [])

    # 统计当前设计中的颜色使用
    color_usage = {}
    for el in elements:
        fill = (el.get("fill") or "").upper()
        if fill and fill.startswith("#"):
            color_usage[fill] = color_usage.get(fill, 0) + 1

    # 检查是否使用了正确的颜色
    primary_used = any(
        el.get("fill", "").upper() == expected_primary
        for el in elements
        if el.get("componentType") in ("header", "button", "banner")
    )

    if not primary_used:
        # 自动修正：找到 componentType 为 header/button/banner 的元素，替换颜色
        # 同时找到使用最多的颜色（可能是 AI 乱选的主色），替换为正确主色
        fixed_count = 0
        for el in elements:
            ct = el.get("componentType", "")
            current_fill = (el.get("fill") or "").upper()

            # header/banner/button → 主色
            if ct in ("header", "banner", "button", "badge"):
                if current_fill != expected_primary:
                    el["fill"] = cp["primary"]
                    fixed_count += 1

            # coupon-card: 只改边框，不改背景
            if ct == "coupon-card":
                if el.get("type") == "rect" and el.get("stroke"):
                    el["stroke"] = cp["primary"]
                    fixed_count += 1
                # 卡片背景保持白色
                if current_fill not in (cp["surface"].upper(), "#FFFFFF", "#FFF", ""):
                    el["fill"] = cp["surface"]

            # 普通卡片 → 白色表面
            if ct == "card" and el.get("type") == "rect":
                if current_fill not in (cp["surface"].upper(), "#FFFFFF", "#FFF"):
                    el["fill"] = cp["surface"]

        # 如果大部分大块元素用了错误颜色，替换最频繁的那个
        if fixed_count == 0 and color_usage:
            most_used = max(color_usage, key=color_usage.get)
            # 如果最常用的颜色不是我们色板中的任何一种
            palette_hexes = {v.upper() for v in cp.values() if v.startswith("#")}
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

            # header 中的文字应该是白色
            if ct == "header" and fill not in ("#FFFFFF", "#FFF"):
                el["fill"] = "#FFFFFF"

            # 主色背景上的文字应该是白色
            if fill == expected_primary and el.get("type") == "text":
                el["fill"] = "#FFFFFF"

    return design
