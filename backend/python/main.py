"""
AI Design Studio — FastAPI 后端入口
面向2026的AI原生产品设计工具
"""
import time
import uuid
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router as api_router
from app.services.collaboration import collaboration

app = FastAPI(
    title="AI Design Studio",
    description="面向2026的AI原生产品设计工具 - 后端服务",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


# ---------- 可观测性中间件 ----------

@app.middleware("http")
async def observability_middleware(request, call_next):
    """记录每个请求的耗时和状态"""
    start = time.time()
    response = await call_next(request)
    elapsed = (time.time() - start) * 1000
    # 结构化日志输出
    print(
        f"[OBSERVE] {request.method} {request.url.path} "
        f"→ {response.status_code} | {elapsed:.1f}ms"
    )
    response.headers["X-Response-Time-Ms"] = f"{elapsed:.1f}"
    return response


# ---------- WebSocket 协作端点 ----------

@app.websocket("/ws/{client_id}")
async def websocket_collaboration(websocket: WebSocket, client_id: str):
    client_id = client_id or f"user-{uuid.uuid4().hex[:8]}"
    await collaboration.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_json()
            await collaboration.handle_message(client_id, data)
    except WebSocketDisconnect:
        await collaboration.disconnect(client_id)
    except Exception:
        await collaboration.disconnect(client_id)


@app.websocket("/ws")
async def websocket_anonymous(websocket: WebSocket):
    client_id = f"user-{uuid.uuid4().hex[:8]}"
    await collaboration.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_json()
            await collaboration.handle_message(client_id, data)
    except WebSocketDisconnect:
        await collaboration.disconnect(client_id)
    except Exception:
        await collaboration.disconnect(client_id)


# ---------- 健康检查 ----------

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "version": "1.0.0",
        "collaboration": {"online": collaboration.online_count},
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
