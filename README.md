# ai-design-tool

基于 AI 的产品设计工具，通过自然语言描述快速生成可编辑的设计稿。

## 功能亮点

- **AI 生成设计稿**：输入一句话（如"红色调电商优惠券领取页面"），自动生成可视化设计稿
- **可视化画布**：基于 Fabric.js 的画布，支持拖拽、缩放、编辑组件
- **组件库**：内置常用 UI 组件，拖拽即可使用
- **设计系统**：统一管理颜色、字体、圆角等设计 Token
- **实时协作**：WebSocket 多人在线编辑
- **代码预览**：一键查看并预览生成的 React/Vue 代码
- **MCP 集成**：支持 Model Context Protocol 协议扩展

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite + TailwindCSS + Fabric.js 6 |
| 后端 | Python + FastAPI + uvicorn |
| AI | DeepSeek / OpenAI 兼容 API |
| MCP | Node.js + Express + SSE |
| 协作 | WebSocket |

## 快速开始

### 1. 安装依赖

```bash
# 前端
cd frontend
npm install

# Python 后端
cd ../backend/python
pip install -r requirements.txt

# MCP 服务
cd ../node
npm install
npm run build
```

### 2. 配置 API Key

编辑 `backend/python/.env`：

```env
DEEPSEEK_API_KEY=your_api_key_here
```

### 3. 一键启动

双击项目根目录的 `start.bat`，或分别启动三个服务：

```bash
# 后端（端口 8000）
cd backend/python
python -m uvicorn main:app --host 0.0.0.0 --port 8000

# MCP 服务（端口 3001）
cd backend/node
node dist/index.js

# 前端（端口 3000）
cd frontend
npm run dev
```

访问 http://localhost:3000 开始使用。

## 项目结构

```
.
├── frontend/          # React 前端
├── backend/
│   ├── python/        # FastAPI 后端 + AI 生成逻辑
│   └── node/          # MCP SSE 服务
├── docs/              # 项目文档
├── start.bat          # Windows 一键启动脚本
└── docker-compose.yml # Docker 部署配置
```

## 使用说明

1. 在左侧聊天面板输入设计需求
2. AI 生成设计稿后自动渲染到画布
3. 在右侧组件库拖拽添加新元素
4. 在顶部切换代码预览或设计系统面板

## 注意事项

- 需要配置有效的 DeepSeek API Key 才能使用 AI 生成功能
- 首次启动 MCP 服务前需要先执行 `npm run build`
- 端口 8000、3000、3001 需要保持空闲

## 许可证

MIT
