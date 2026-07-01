from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
import time
from app.core.config import get_ai_provider_info, set_ai_provider
from app.services.ai_service import generate_design_variants, refine_design, generate_suggestions
from app.services.design_service import (
    check_design_compliance,
    get_design_systems,
    get_design_system,
    create_design_system,
    update_design_system,
    delete_design_system,
)

router = APIRouter(prefix="/api")


# ---------- AI 提供商信息 ----------

@router.get("/ai/providers")
async def list_ai_providers():
    """列出可用的AI模型提供商及当前选择"""
    return get_ai_provider_info()


class SwitchProviderRequest(BaseModel):
    provider: str


@router.put("/ai/providers")
async def switch_ai_provider(req: SwitchProviderRequest):
    """切换AI模型提供商"""
    try:
        new_provider = set_ai_provider(req.provider)
        return {"current": new_provider, "available": get_ai_provider_info()["available"]}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


class GenerateRequest(BaseModel):
    prompt: str
    designSystem: str | None = None
    constraints: dict | None = None


class RefineRequest(BaseModel):
    prompt: str
    currentDesign: dict


class ComplianceRequest(BaseModel):
    design: dict
    designSystem: str | None = None


class DesignSystemCreate(BaseModel):
    name: str
    colors: dict | None = None
    typography: dict | None = None
    spacing: int = 8
    borderRadius: int = 8


class DesignSystemUpdate(BaseModel):
    name: str
    colors: dict
    typography: dict
    spacing: int
    borderRadius: int


class CodeGenRequest(BaseModel):
    design: dict


# ---------- AI 设计生成 ----------

@router.post("/ai/generate")
async def generate_design(req: GenerateRequest):
    try:
        result = generate_design_variants(req.prompt, req.designSystem)

        # 自动更新画布状态，供 MCP Server 获取真实数据
        _canvas_store["design"] = result["design"]

        compliance_response = None
        if result.get("compliance"):
            c = result["compliance"]
            compliance_response = {
                "overallScore": c["overall_score"],
                "checks": c["checks"],
                "timestamp": int(time.time() * 1000),
            }

        return {
            "design": result["design"],
            "alternatives": result.get("alternatives", []),
            "suggestions": result.get("suggestions", []),
            "compliance": compliance_response,
            "autoFix": result.get("autoFix"),
            "tokens": result.get("tokens", 0),
            "timeMs": result.get("timeMs", 0),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai/refine")
async def refine_design_endpoint(req: RefineRequest):
    try:
        result = refine_design(req.prompt, req.currentDesign)

        # 自动更新画布状态
        _canvas_store["design"] = result["design"]

        return {
            "design": result["design"],
            "suggestions": [],
            "tokens": result.get("tokens", 0),
            "timeMs": result.get("time_ms", 0),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------- 代码生成 ----------

@router.post("/code/generate")
async def generate_code(req: CodeGenRequest):
    from app.services.codegen_service import generate_code
    try:
        result = generate_code(req.design, "react")
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------- 设计规范检查 ----------

@router.post("/design/check-compliance")
async def compliance_check(req: ComplianceRequest):
    result = check_design_compliance(req.design, req.designSystem)
    return {
        "overallScore": result["overall_score"],
        "checks": result["checks"],
        "timestamp": 0,  # 后续可用 time.time()
    }


@router.get("/design/systems")
async def list_design_systems():
    systems = get_design_systems()
    return {"systems": systems}


@router.get("/design/systems/{system_id}")
async def get_design_system_endpoint(system_id: str):
    ds = get_design_system(system_id)
    return {"system": {"id": system_id, **ds}}


@router.post("/design/systems")
async def create_design_system_endpoint(req: DesignSystemCreate):
    data = create_design_system(req.model_dump(exclude_unset=True))
    return {"system": data}


@router.put("/design/systems/{system_id}")
async def update_design_system_endpoint(system_id: str, req: DesignSystemUpdate):
    data = update_design_system(system_id, req.model_dump())
    if data is None:
        raise HTTPException(status_code=404, detail="设计系统不存在或为内置系统，无法修改")
    return {"system": data}


@router.delete("/design/systems/{system_id}")
async def delete_design_system_endpoint(system_id: str):
    if not delete_design_system(system_id):
        raise HTTPException(status_code=404, detail="设计系统不存在或为内置系统，无法删除")
    return {"success": True}


# ---------- 聊天历史（内存） ----------

chat_history: list[dict] = []


@router.get("/chat/history")
async def get_chat_history():
    return {"messages": chat_history[-50:]}  # 最近 50 条


# ---------- 健康检查 ----------

@router.get("/health")
async def health_check():
    return {"status": "ok", "version": "1.0.0"}


# ---------- 画布状态（供 MCP Server 获取真实数据） ----------

# 运行时存储最新设计稿，MCP Server 通过 HTTP 请求获取
# 用字典包装避免 global 变量重载问题
_canvas_store: dict = {"design": {}}


@router.get("/design/current-state")
async def get_current_design_state():
    """获取当前设计画布的最新状态（MCP Server 使用此端点获取真实数据）"""
    if not _canvas_store["design"]:
        # 如果没有最新设计稿，返回默认模板
        from app.services.ai_service import _generate_fallback_design
        from app.services.prompt_builder import DesignConstraints
        _canvas_store["design"] = _generate_fallback_design("默认设计稿", DesignConstraints())
    return {"design": _canvas_store["design"]}


@router.put("/design/current-state")
async def update_current_design_state(design: dict = Body(...)):
    """更新当前设计画布状态（前端每次生成/编辑设计稿后调用）"""
    _canvas_store["design"] = design
    return {"success": True, "elementCount": len(design.get("elements", []))}
