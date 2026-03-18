# OpenClaw Chat 完整执行方案

> 基于《OpenClaw + Claude Code 超强教程》工作流 + PRD + TECH-DESIGN
> 最后更新: 2026-03-18

---

## 一、项目目标

在 https://github.com/piggy-wanger/openclaw-chat 上构建一个现代 Web 聊天前端，通过 WebSocket 直连 OpenClaw Gateway，支持流式响应、工具调用可视化、Markdown 渲染等能力。

### 技术栈

- **Next.js 16** + App Router + React 19 + TypeScript 严格模式
- **Tailwind CSS 4** + **shadcn/ui** + Lucide React
- **WebSocket** 直连 OpenClaw Gateway（Protocol v3）
- react-markdown + remark-gfm + rehype-highlight（Markdown/代码高亮）
- nanoid、date-fns

### 架构决策

- **前端直连 Gateway（方案 A）**：无需后端代理，架构简单，部署灵活
- **Gateway 为权威数据源**：Session/Message 由 Gateway 管理，前端只做展示
- **本地 SQLite 降级**：保留 schema，后续可做离线缓存

---

## 二、基础设施（已就位）

| 项目 | 状态 |
|------|------|
| GitHub 仓库 | ✅ https://github.com/piggy-wanger/openclaw-chat |
| Git 配置 | ✅ piggy-wanger，master 分支 |
| tmux | ✅ 持久 session: claude-executor, codex-reviewer |
| gh CLI | ✅ 已登录，权限完整 |
| Claude Code | ✅ v2.1.77 |
| Codex CLI | ✅ v0.115.0，模型 gpt-5.3-codex |
| Gateway | ✅ 运行中，ws://127.0.0.1:18789 |

---

## 三、Phase 拆解

### Phase 1: Bootstrap ✅ (PR #1)

项目初始化，Next.js 16 + shadcn/ui + 目录结构。

### Phase 2: Core Infrastructure ✅ (PR #2, #3, #4)

数据库层 + API Routes + State Hooks。
> 注意：Phase 2 的 HTTP API routes 在直连 Gateway 模式下不再作为主要数据通道，保留供后续离线缓存使用。

### Phase 3: UI Components ✅ (PR #5, #6, #7)

Layout + Sidebar + Chat Area + Tool Call Cards。

---

### Phase 4: Gateway Integration（3 个任务，串行）

#### 任务 4.1: Gateway Client（lib/gateway-client.ts）

- WebSocket 连接管理（connect/disconnect/reconnect）
- Protocol v3 握手（auth token、clientName、caps 等）
- RPC 方法封装：chat.send、chat.abort、chat.history、sessions.list、sessions.patch、sessions.reset
- 事件订阅系统：onChat、onAgent、onDisconnect
- 断线重连（exponential backoff）
- 类型定义（lib/gateway-types.ts）
- **验收**: 能连接本地 Gateway，调用 chat.history 返回数据
- **分支**: `feat/phase4a-gateway-client`

#### 任务 4.2: Hooks 重构（对接 Gateway）

- **useGateway**: WebSocket 连接生命周期管理，暴露 client 实例
- **useSession**: 从 `sessions.list` 获取会话列表，`sessions.patch` 更新会话
- **useChat**: `chat.send` 发消息，监听 `chat` 事件处理 delta/final/aborted/error，`chat.abort` 中止
- **useSettings**: 存取 Gateway URL + Token（localStorage）
- 移除对本地 HTTP API routes 的依赖
- **验收**: 连接 Gateway 后能发送消息并收到流式回复
- **分支**: `feat/phase4b-hooks`

#### 任务 4.3: UI 对接 + 完整聊天流程

- 将 Phase 3 的 UI 组件对接 Gateway hooks
- Session 列表从 Gateway 加载（`sessions.list`）
- 消息从 Gateway 加载（`chat.history`）
- 流式回复实时渲染（`chat` 事件 delta）
- 工具调用可视化（`agent` 事件 tool stream）
- 新建会话 → 发送首条消息 → 自动创建 Gateway session
- 错误处理：连接失败提示、发送失败重试
- Settings 页：配置 Gateway URL + Token + 连接测试
- 更新 TASKS.md
- **验收**: 完整的连接→发消息→流式回复→工具调用流程
- **分支**: `feat/phase4c-integration`

---

### Phase 5: Settings & Polish（2 个任务，可并行）

#### 任务 5.1: Settings 页面完善

- 连接测试功能（ping Gateway）
- 默认模型选择
- UI 偏好（主题等）
- 会话管理（重命名、删除通过 sessions.patch/reset）
- **分支**: `feat/phase5a-settings`

#### 任务 5.2: UX 改进

- 键盘快捷键
- 会话搜索/过滤
- Error Toast 提示
- Loading 骨架屏
- 空状态优化
- **分支**: `feat/phase5b-polish`

---

### Phase 6: Testing & Documentation（后续）

- 单元测试
- 集成测试
- E2E 测试
- 部署指南
- 用户指南

---

## 四、执行节奏

| Phase | 任务数 | 状态 |
|-------|--------|------|
| Phase 1 | 1 | ✅ 完成 |
| Phase 2 | 3 | ✅ 完成 |
| Phase 3 | 3 | ✅ 完成 |
| Phase 4 | 3 | ⬅️ 即将开始 |
| Phase 5 | 2 | 待定 |
| Phase 6 | - | 后续 |

---

## 五、风险与应对

| 风险 | 应对 |
|------|------|
| Claude Code 在 tmux 中卡住 | cron 监控检测，kill 并重试 |
| worktree 冲突 | 每个任务独立分支 |
| WebSocket 连接不稳定 | 断线重连 + exponential backoff |
| Gateway 协议更新 | minProtocol/maxProtocol 兼容 |
| Codex sandbox 无法 build | 不在 Codex 中跑 build，本地验证 |
