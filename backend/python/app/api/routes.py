from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
import time
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
