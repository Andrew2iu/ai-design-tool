# AI Design Studio 代码质量修复报告

## 修复概览

本次修复针对之前代码审查中发现的严重、中等及若干小问题进行了处理，并验证了前后端核心流程可以正常构建和启动。

## 已修复问题

### 🔴 严重问题

#### 1. API Key 明文泄露
- **文件**: `backend/python/.env`
- **修复**: 将真实 DeepSeek API Key 替换为占位符 `your_api_key_here`
- **后续**: 请务必将 `.env` 中的 `your_api_key_here` 替换为你的真实 Key 后运行；项目根目录 `.gitignore` 已包含 `.env`，不会再误提交。

#### 2. DesignCanvas resize 事件监听器泄漏
- **文件**: `frontend/src/components/canvas/DesignCanvas.tsx`
- **修复**: 重构 canvas 初始化逻辑，将 resize 监听器的注册和清理统一放到 `useEffect` 的 cleanup 中；组件卸载时会移除监听器并 `dispose()` fabric canvas，避免内存泄漏。
- **副作用**: 同时移除了不再需要的 `useCallback` 导入。

#### 3. docker-compose 中 MCP 服务配置错误
- **文件**: `docker-compose.yml`、`backend/node/Dockerfile`（新建）
- **修复**: 由于当前 Node MCP Server 使用 `StdioServerTransport`，不监听 TCP 端口，无法作为 docker-compose 网络服务运行，已将该服务注释掉并补充说明。
- **新建**: `backend/node/Dockerfile`，方便后续手动构建镜像。

### 🟡 中等问题

#### 4. ChatPanel 死代码和按钮逻辑
- **文件**: `frontend/src/components/chat/ChatPanel.tsx`
- **修复**:
  - 删除未使用的 `api` 导入。
  - 将“查看设计稿”按钮的点击行为改为：`setCanvasMode('preview')` + `toggleRightPanel()`，即关闭右侧面板并切换到画布预览模式。

#### 5. Fabric.js 类型定义版本不匹配
- **文件**: `frontend/package.json`
- **修复**: 移除 `@types/fabric@^5.3.9`，因为 Fabric 6.x 已内置 TypeScript 类型定义，继续使用旧版类型会导致编译/运行时类型不一致。
- **验证**: 重新执行 `npm install` 后，`npm run build` 通过。

#### 6. `start.bat` 硬编码 Python 路径
- **文件**: `start.bat`
- **修复**: 将绝对路径 `C:\Users\28782\...\python.exe` 改为通用 `python` 命令，并增加虚拟环境/依赖提示。

#### 7. Vite 路径别名缺失
- **文件**: `frontend/vite.config.ts`
- **修复**: 添加 `resolve.alias: { '@': path.resolve(__dirname, './src') }`，与 `tsconfig.json` 中的 `@/*` 配置保持一致。

### 🟢 额外小优化

#### 8. Python 导入位置优化
- **文件**: `backend/python/app/services/codegen_service.py`
- **修复**: 将函数内部的 `import re` / `import json` 移到文件顶部。

#### 9. 设计服务 KeyError 风险
- **文件**: `backend/python/app/services/design_service.py`
- **修复**:
  - 将合规检查中直接访问 `el1["top"]` / `el2["top"]` 的代码改为 `el.get("top", 0)`，避免设计元素字段缺失时抛出 `KeyError`。
  - 将函数内部的 `import re` 移到文件顶部。

## 验证结果

### 前端
- `npm install` 成功，移除了 `@types/fabric` 相关包。
- `npm run build` 成功：TypeScript 类型检查通过，Vite 生产构建成功。
- 产出文件：`dist/index.html`、`dist/assets/index-*.css`、`dist/assets/index-*.js`。

### 后端
- `py_compile` 检查通过：主要 Python 文件（`main.py`、`routes.py`、`config.py`、`ai_service.py`、`design_service.py`、`codegen_service.py`）无语法错误。
- 使用 `uvicorn main:app --host 127.0.0.1 --port 8000` 启动成功。
- 测试接口 `GET /api/design/systems` 返回正常：
  ```json
  {"systems":[{"id":"brand-design-token-23v1","name":"默认品牌设计系统 v23"}]}
  ```

## 仍保留的建议（未在本次改动中处理）

1. **数据库/缓存/对象存储**: `docker-compose.yml` 中启动了 PostgreSQL、Redis、MinIO，但当前业务代码完全没有使用，建议后续接入或移除以节省资源。
2. **MCP Server 网络服务化**: 如果希望 MCP Server 在 Docker 中作为服务运行，需要改用 `SSEServerTransport` 或 `StreamableHTTPServerTransport` 并引入 Express 等 HTTP 框架。当前保留为本地 stdio 模式。
3. **前端产物体积**: 构建产物主 JS 文件超过 500KB，建议后续配置 `rollupOptions.manualChunks` 进行代码分割。
4. **安全审计**: `npm audit` 报告 4 个 high severity 漏洞，建议运行 `npm audit fix` 修复依赖。
5. **健康检查接口**: 当前后端没有 `/health` 接口，建议后续添加。

## 运行前必读

1. **配置 API Key**: 在 `backend/python/.env` 中把 `DEEPSEEK_API_KEY=your_api_key_here` 替换为你的真实 Key。
2. **启动后端**: 进入 `backend/python`，激活虚拟环境后执行 `python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload`。
3. **启动前端**: 进入 `frontend` 执行 `npm run dev`。
4. **一键启动（Windows）**: 双击 `start.bat`（需确保后端 Python 环境已准备好）。

---

*报告生成时间*: 2026-06-29
