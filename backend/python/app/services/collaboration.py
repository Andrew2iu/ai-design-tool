"""
WebSocket 多人协作连接管理器
"""
import json
import time
from fastapi import WebSocket


class CollaborationManager:
    """管理所有 WebSocket 连接，广播画布状态"""

    def __init__(self):
        self._connections: dict[str, WebSocket] = {}
        self._canvas_state: dict | None = None
        self._canvas_version = 0

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self._connections[client_id] = websocket
        # 发送当前画布状态给新连接的客户端
        if self._canvas_state:
            await websocket.send_json({
                "type": "canvas_sync",
                "design": self._canvas_state,
                "version": self._canvas_version,
                "timestamp": time.time(),
            })
        # 广播用户加入
        await self._broadcast({
            "type": "user_joined",
            "clientId": client_id,
            "onlineCount": len(self._connections),
        })

    async def disconnect(self, client_id: str):
        self._connections.pop(client_id, None)
        await self._broadcast({
            "type": "user_left",
            "clientId": client_id,
            "onlineCount": len(self._connections),
        })

    async def handle_message(self, client_id: str, data: dict):
        """处理客户端发来的消息"""
        msg_type = data.get("type", "")

        if msg_type == "canvas_update":
            # 更新画布状态并广播给其他客户端
            self._canvas_state = data.get("design")
            self._canvas_version += 1
            # 广播给除了发送者以外的所有人
            for cid, ws in self._connections.items():
                if cid != client_id:
                    try:
                        await ws.send_json({
                            "type": "canvas_sync",
                            "design": self._canvas_state,
                            "version": self._canvas_version,
                            "senderId": client_id,
                            "timestamp": time.time(),
                        })
                    except Exception:
                        pass

        elif msg_type == "cursor_update":
            # 广播光标位置
            for cid, ws in self._connections.items():
                if cid != client_id:
                    try:
                        await ws.send_json({
                            "type": "cursor_update",
                            "clientId": client_id,
                            "x": data.get("x", 0),
                            "y": data.get("y", 0),
                        })
                    except Exception:
                        pass

        elif msg_type == "chat_broadcast":
            # 广播聊天消息
            for cid, ws in self._connections.items():
                if cid != client_id:
                    try:
                        await ws.send_json({
                            "type": "chat_message",
                            "senderId": client_id,
                            "content": data.get("content", ""),
                            "timestamp": time.time(),
                        })
                    except Exception:
                        pass

    async def _broadcast(self, message: dict):
        """向所有连接广播消息"""
        for cid, ws in list(self._connections.items()):
            try:
                await ws.send_json(message)
            except Exception:
                self._connections.pop(cid, None)

    @property
    def online_count(self) -> int:
        return len(self._connections)


# 全局单例
collaboration = CollaborationManager()
