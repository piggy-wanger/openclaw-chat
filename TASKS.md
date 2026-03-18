# OpenClaw Chat - 开发任务清单

<<<<<<< HEAD
## Phase 6.2 - Documentation ✅

### 1. README.md 重写 ✅
- [x] 项目简介
- [x] 截图占位符
- [x] 功能特性列表
- [x] 技术栈
- [x] 快速开始
- [x] 项目结构说明
- [x] 开发指南
- [x] 部署指南概要
- [x] 贡献指南
- [x] License

### 2. docs/ARCHITECTURE.md ✅
- [x] 架构图 (ASCII)
- [x] 前端直连 Gateway WebSocket 设计决策
- [x] 数据流说明
- [x] 组件层次
- [x] Hooks 职责
- [x] 与 Control UI 的关系

### 3. docs/DEPLOYMENT.md ✅
- [x] 前置条件
- [x] 构建步骤
- [x] 部署方式 1: Gateway 静态文件服务
- [x] 部署方式 2: 独立 Nginx
- [x] 部署方式 3: Vercel/Netlify
- [x] 环境变量说明
- [x] 常见问题

### 文件变更
- `README.md` - 重写
- `docs/ARCHITECTURE.md` - 新建
- `docs/DEPLOYMENT.md` - 新建
=======
## Phase 6.1 - Testing ✅

### 1. Vitest 配置 ✅
- [x] 创建 `vitest.config.ts`：配置 jsdom 环境、路径别名
- [x] 在 package.json 添加 test/test:run scripts
- [x] 创建 `lib/test/setup.ts` (import @testing-library/jest-dom)

### 2. Gateway Client 单元测试 ✅
- [x] `lib/__tests__/gateway-client.test.ts`
- [x] 测试 connect/disconnect
- [x] 测试 RPC request/response 匹配 (mock WebSocket)
- [x] 测试断线重连逻辑 (指数退避)
- [x] 测试事件订阅 (on/off/emit)

### 3. useSettings hook 测试 ✅
- [x] `hooks/__tests__/useSettings.test.tsx`
- [x] 测试 gatewayUrl/gatewayToken 读写
- [x] 测试 UI 偏好设置 (theme, sidebarCollapsed)
- [x] 测试 FontSize 运行时验证

### 4. 工具函数测试 ✅
- [x] `lib/__tests__/utils.test.ts`
- [x] 测试 cn() 合并类名

### 5. Gateway 类型测试 ✅
- [x] `lib/__tests__/gateway-types.test.ts`
- [x] 测试 ChatEvent/AgentEvent 类型结构

### 文件变更
- `vitest.config.ts` - 新建
- `lib/test/setup.ts` - 新建
- `lib/__tests__/gateway-client.test.ts` - 新建
- `lib/__tests__/utils.test.ts` - 新建
- `lib/__tests__/gateway-types.test.ts` - 新建
- `hooks/__tests__/useSettings.test.tsx` - 新建
- `package.json` - 添加 test scripts
>>>>>>> origin/master
- `TASKS.md` - 更新

---

## Phase 5.2 - UX 改进 ✅

### 1. 键盘快捷键 ✅
- [x] 创建 `hooks/useKeyboardShortcuts.tsx`
- [x] Ctrl+K 或 /：聚焦搜索
- [x] Ctrl+N：新建会话
- [x] Escape：关闭弹窗/侧边栏

### 2. 会话搜索/过滤 ✅
- [x] Sidebar 顶部搜索输入框
- [x] 实时按标题过滤
- [x] 无结果时显示「未找到会话」
- [x] 清除按钮

### 3. Error Toast ✅
- [x] app/layout.tsx 添加 Toaster
- [x] useChat error 变化时 toast.error

### 4. Loading 骨架屏 ✅
- [x] 会话列表加载时 Skeleton 占位
- [x] 消息列表加载时 Skeleton 占位

### 5. 空状态优化 ✅
- [x] 未连接：引导去 Settings
- [x] 无会话：开始新对话（含快捷键提示）
- [x] 无消息：发送第一条消息

### 文件变更
- `hooks/useKeyboardShortcuts.tsx` - 新建
- `components/sidebar/SessionList.tsx` - 添加搜索功能
- `components/sidebar/Sidebar.tsx` - 支持 ref 转发
- `components/chat/MessageList.tsx` - 添加骨架屏
- `app/layout.tsx` - 添加 Toaster
- `app/page.tsx` - 集成所有 UX 改进
- `TASKS.md` - 新建

---

## Phase 5.1 - 响应式布局 (已完成)

### 1. 移动端适配
- [x] 侧边栏响应式
- [x] Header 响应式
- [x] 消息列表响应式
- [x] 输入区域响应式

---

## Phase 4 - UI 对接 Gateway (已完成)

### 4.3 完整聊天流程
- [x] Gateway 连接状态
- [x] 会话列表展示
- [x] 消息收发
- [x] 工具调用展示
- [x] 流式响应

### 4.2 Hooks 层
- [x] useSettings
- [x] useGateway
- [x] useSession
- [x] useChat

### 4.1 基础 UI
- [x] Sidebar 组件
- [x] ChatHeader 组件
- [x] MessageList 组件
- [x] InputArea 组件
