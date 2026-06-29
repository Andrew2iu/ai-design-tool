# AI Design Studio 第二轮开发报告

## 本轮目标

按照需求文档 **第5-8天** 的功能路线，补齐三个核心模块：
1. 设计规范系统（Design System Manager）
2. 组件库与拖拽到画布
3. MCP Server HTTP 化与前端接入

## 一、设计系统管理器（Design System Manager）

### 后端
- **文件**: `backend/python/app/services/design_service.py`
- 新增自定义设计系统内存存储 `CUSTOM_DESIGN_SYSTEMS`
- 新增 CRUD 函数：`get_design_system`、`create_design_system`、`update_design_system`、`delete_design_system`
- 内置设计系统不可修改/删除；自定义系统 id 自动生成

### API
- **文件**: `backend/python/app/api/routes.py`
- 新增端点：
  - `GET /api/design/systems` — 列出所有设计系统
  - `GET /api/design/systems/{id}` — 获取单个设计系统
  - `POST /api/design/systems` — 创建设计系统
  - `PUT /api/design/systems/{id}` — 更新自定义设计系统
  - `DELETE /api/design/systems/{id}` — 删除自定义设计系统
- `POST /api/design/check-compliance` 现在支持 `designSystem` 参数，按指定规范检查

### AI 生成注入
- **文件**: `backend/python/app/services/ai_service.py`
- `generate_design_json` 现在会读取指定设计系统的具体颜色、字体、间距、圆角，并写入 system prompt，强制 AI 按规范生成

### 前端
- **文件**: `frontend/src/components/design/DesignSystemPanel.tsx`
- 新增右侧面板：
  - 列出内置 + 自定义设计系统
  - 点击切换当前激活的设计系统
  - 可视化编辑：名称、品牌色（color picker）、标题/正文字体、基础间距、圆角
  - 创建新的自定义设计系统
  - 删除自定义设计系统

## 二、组件库与拖拽

### 前端组件库
- **文件**: `frontend/src/components/library/ComponentLibraryPanel.tsx`
- 新增左侧组件库边栏，内置组件：
  - 矩形、卡片、按钮、输入框、文本、图片占位
- 支持按名称搜索
- 组件可拖拽（HTML5 drag）

### 画布接收拖拽
- **文件**: `frontend/src/components/canvas/DesignCanvas.tsx`
- 监听 `onDragOver` / `onDrop`
- 使用 Fabric.js `getPointer` 计算放置坐标
- 通过 `addCanvasElement` 将组件添加到 `currentDesign`
- 无设计稿时拖拽会自动创建空白画布

### Store
- **文件**: `frontend/src/stores/appStore.ts`
- 新增 `addCanvasElement` action，自动为新元素生成 UUID
- 当 `currentDesign` 不存在时，自动创建 1200x800 空白画布

### 布局调整
- **文件**: `frontend/src/App.tsx`
- 主布局改为：左侧组件库 → 中间画布 → 右侧面板

## 三、MCP Server HTTP 化

### 后端改造
- **文件**: `backend/node/src/index.ts`
- 从 `StdioServerTransport` 改为 `express` + `SSEServerTransport`
- 暴露端点：
  - `GET /sse` — SSE 连接入口
  - `POST /messages?sessionId=xxx` — JSON-RPC 消息通道
  - `GET /health` — 健康检查
- 支持 CORS，前端可直接访问

### 依赖
- **文件**: `backend/node/package.json`
- 新增 `express`、`cors` 及对应类型定义
- 已运行 `npm install` 和 `npm run build` 验证成功

### Docker 编排
- **文件**: `docker-compose.yml`
- 重新启用 `mcp-server` 服务，映射端口 `3001:3001`
- 更新注释说明当前为 HTTP/SSE 模式

### 前端 MCP 调试面板
- **文件**: `frontend/src/components/mcp/MCPPanel.tsx`
- 新增右侧面板：
  - 自动通过 EventSource 连接 `/mcp/sse`
  - 解析 sessionId 后可通过 JSON-RPC 调用工具
  - 提供按钮：列出工具、获取设计上下文、提取 Design Tokens、生成 React 代码
  - 实时显示调用日志

### 代理配置
- **文件**: `frontend/vite.config.ts`
- 新增 `/mcp` 代理到 `http://localhost:3001`，并 rewrite 去掉 `/mcp` 前缀

## 四、验证结果

### 前端构建
- 命令：`npm run build`
- 结果：✅ 通过
- 产物：dist/index.html + assets

### MCP Server 构建与运行
- 命令：`npm install && npm run build`
- 结果：✅ 通过
- 启动：`node dist/index.js`
- 验证：`curl http://127.0.0.1:3001/health` → `{"status":"ok","version":"1.0.0"}` ✅

### Python 后端语法
- 命令：`py_compile` 检查主要文件
- 结果：✅ 通过

## 五、启动方式

### 开发模式（推荐）

```bash
# 1. 启动 Python 后端
cd backend/python
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# 2. 启动 MCP 服务（新窗口）
cd backend/node
npm run build
node dist/index.js

# 3. 启动前端（新窗口）
cd frontend
npm run dev
```

### Docker Compose 一键启动

```bash
docker-compose up --build
```

注意：
- `backend/python/.env` 中的 `DEEPSEEK_API_KEY` 需要替换为真实 Key，AI 生成、合规检查等功能才能正常工作。
- PostgreSQL/Redis/MinIO/Jaeger 仍在 docker-compose 中启动，但当前业务代码尚未接入，仅作为基础设施占位。

## 六、已知限制与后续建议

1. **设计系统持久化**：当前使用内存存储，重启后端会丢失自定义设计系统。建议后续接入 PostgreSQL。
2. **画布编辑同步**：拖拽组件添加到 store 后，Fabric canvas 会重新 render。后续建议实现双向同步（修改画布元素 → 更新 store）。
3. **MCP 实时设计上下文**：当前 MCP server 使用模拟设计状态。建议与前端 store 或后端 Python 打通，获取真实设计稿。
4. **代码产物体积**：主 JS 包约 530KB，建议后续配置 `rollupOptions.manualChunks` 做代码分割。

## 七、新增/修改文件清单

### 后端
- `backend/python/app/services/design_service.py`
- `backend/python/app/services/ai_service.py`
- `backend/python/app/api/routes.py`
- `backend/node/package.json`
- `backend/node/src/index.ts`
- `docker-compose.yml`

### 前端
- `frontend/package.json`
- `frontend/vite.config.ts`
- `frontend/src/services/api.ts`
- `frontend/src/stores/appStore.ts`
- `frontend/src/components/design/DesignSystemPanel.tsx`（新建）
- `frontend/src/components/library/ComponentLibraryPanel.tsx`（新建）
- `frontend/src/components/mcp/MCPPanel.tsx`（新建）
- `frontend/src/components/canvas/DesignCanvas.tsx`
- `frontend/src/components/layout/Toolbar.tsx`
- `frontend/src/App.tsx`

---

*报告生成时间*: 2026-06-29
