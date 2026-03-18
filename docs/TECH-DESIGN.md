# OpenClaw Chat - Technical Design Document

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  Next.js Static Build                        │
├─────────────────────────────────────────────────────────────┤
│  Pages/App Router    │  Components    │  Hooks/Utils        │
│  - / (chat)          │  - ChatUI      │  - useGateway       │
│  - /settings         │  - Sidebar     │  - useChat          │
│                      │  - MessageList │  - useSession       │
│                      │  - InputArea   │  - useSettings      │
├─────────────────────────────────────────────────────────────┤
│  WebSocket Client Layer                                       │
│  - lib/gateway-client.ts (WebSocket RPC)                     │
│  - chat.send / chat.history / chat.abort                     │
│  - sessions.list / sessions.patch / sessions.reset           │
├─────────────────────────────────────────────────────────────┤
│  Local Storage                                                │
│  - Settings (Gateway URL, Token, UI preferences)             │
│  - Draft persistence                                          │
├─────────────────────────────────────────────────────────────┤
│  ◄─────────── WebSocket ───────────►                        │
│        OpenClaw Gateway (ws://127.0.0.1:18789)               │
└─────────────────────────────────────────────────────────────┘
```

**核心设计：前端直连 Gateway WebSocket，无需后端代理。**

## Technology Stack

### Frontend Framework

- **Next.js 16** - React framework with App Router (static export)
- **React 19** - UI library
- **TypeScript** - Type safety

### Styling

- **Tailwind CSS 4** - Utility-first CSS
- **shadcn/ui** - Component library
- **Lucide React** - Icons

### Communication

- **WebSocket** - 直连 OpenClaw Gateway
- **Protocol v3** - Gateway RPC 协议

### Data Storage

- **Gateway** - Session 和 Message 的权威数据源
- **localStorage** - 本地设置、草稿、UI 偏好

### State Management

- React Context + custom hooks
- localStorage for draft persistence

## OpenClaw Gateway WebSocket API

### 连接

```typescript
// WebSocket 握手参数
{
  url: "ws://127.0.0.1:18789",
  params: {
    auth: {
      token: "gateway-token"  // onboarding 时生成
    }
  },
  clientName: "openclaw-chat",
  clientVersion: "0.1.0",
  platform: "browser",
  caps: ["TOOL_EVENTS"],
  minProtocol: 3,
  maxProtocol: 3
}
```

### RPC 方法（请求/响应）

| 方法 | 参数 | 返回 | 用途 |
|------|------|------|------|
| `chat.send` | `{ sessionKey, message, thinking?, deliver?, timeoutMs?, idempotencyKey }` | `{ runId, status: "started" }` | 发送消息（非阻塞） |
| `chat.abort` | `{ sessionKey, runId }` | - | 中止当前回复 |
| `chat.history` | `{ sessionKey, limit }` | 消息历史数组 | 加载会话历史 |
| `sessions.list` | `{ limit?, activeMinutes?, agentId? }` | 会话列表 | 列出所有会话 |
| `sessions.patch` | `opts` | - | 更新会话（重命名等） |
| `sessions.reset` | `{ key, reason? }` | - | 重置/清空会话 |

### 事件流（服务端推送）

| 事件 | payload | 说明 |
|------|---------|------|
| `chat` | `{ sessionKey, runId, state, message?, errorMessage? }` | state: `delta`（流式文本）/ `final`（完成）/ `aborted` / `error` |
| `agent` | `{ runId, stream, data }` | stream: `tool`（phase: start/update/result）/ `lifecycle`（phase: start/end/error） |

### chat 事件 state 详解

- **`delta`**: 流式文本片段，`message` 包含当前增量文本
- **`final`**: 回复完成，`message` 包含完整回复对象
- **`aborted`**: 用户中止
- **`error`**: 出错，`errorMessage` 包含错误信息

### agent 事件 tool 详解

- **`phase: "start"`**: 工具调用开始，`data.args` 包含参数
- **`phase: "update"`**: 工具执行中，`data.partialResult` 包含部分结果
- **`phase: "result"`**: 工具执行完成，`data.result` 包含最终结果

## Component Structure

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   └── settings/
│       └── page.tsx
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── chat/
│   │   ├── ChatHeader.tsx
│   │   ├── MessageList.tsx
│   │   ├── MessageItem.tsx
│   │   ├── MarkdownRenderer.tsx
│   │   ├── InputArea.tsx
│   │   ├── ToolCallCard.tsx
│   │   └── ToolCallList.tsx
│   ├── sidebar/
│   │   ├── Sidebar.tsx
│   │   ├── SessionList.tsx
│   │   └── SessionItem.tsx
│   └── settings/
│       └── SettingsForm.tsx
├── hooks/
│   ├── useGateway.ts      # WebSocket 连接管理
│   ├── useChat.ts         # 聊天消息 + 流式响应
│   ├── useSession.ts      # 会话列表管理
│   ├── useSettings.ts     # 设置读写
│   └── useDraft.ts        # 草稿持久化
├── lib/
│   ├── utils.ts
│   ├── gateway-client.ts  # WebSocket RPC 客户端
│   ├── gateway-types.ts   # RPC 方法 + 事件类型定义
│   └── storage.ts         # localStorage 封装
└── db/                    # 保留，后续可做离线缓存
    ├── index.ts
    └── schema.ts
```

## Key Implementation Details

### Gateway Client (lib/gateway-client.ts)

```typescript
class GatewayClient {
  // 连接管理
  connect(url: string, token: string): void
  disconnect(): void
  reconnect(): void

  // RPC 方法
  chatSend(opts: ChatSendOpts): Promise<{ runId: string }>
  chatAbort(opts: ChatAbortOpts): Promise<void>
  chatHistory(opts: ChatHistoryOpts): Promise<ChatHistoryResponse>
  sessionsList(opts?: SessionsListOpts): Promise<Session[]>
  sessionsPatch(opts: SessionsPatchOpts): Promise<void>
  sessionsReset(key: string): Promise<void>

  // 事件订阅
  onChat(handler: (event: ChatEvent) => void): () => void
  onAgent(handler: (event: AgentEvent) => void): () => void
  onDisconnect(handler: () => void): () => void
}
```

### 消息流

1. 用户发送消息 → `chat.send({ sessionKey, message })`
2. Gateway 立即返回 `{ runId, status: "started" }`
3. AI 回复通过 `chat` 事件流式推送（`delta` → `final`）
4. 工具调用通过 `agent` 事件推送（`tool` stream）
5. 用户可随时调用 `chat.abort({ sessionKey, runId })` 中止

### Session Key 格式

- 主会话: `agent:<agentId>:main`
- 直聊: `agent:<agentId>:direct:<peerId>`
- 群聊: `agent:<agentId>:<channel>:group:<id>`

### Settings 存储

- Gateway URL + Token: localStorage（前端直连需要）
- UI 偏好（主题等）: localStorage
- Gateway 本身不存储 openclaw-chat 的 UI 设置

### Draft Session Flow

1. 用户创建新会话 → localStorage 存草稿
2. 用户输入消息 → localStorage 实时保存
3. 用户发送消息 → `chat.send()` → Gateway 创建/使用会话
4. 草稿清除，session 切换到 Gateway 管理的会话

## Deployment

### Build

```bash
npm run build  # 静态导出
```

### 部署方式

1. **静态托管**: build 产物可放任意静态服务器/CDN
2. **Gateway 托管**: 将 build 产物配置为 Gateway 的静态文件服务
3. **独立服务**: `npm run start` 跑 Next.js 服务

### Environment Variables

```
NEXT_PUBLIC_GATEWAY_URL=ws://127.0.0.1:18789  # 默认 Gateway 地址（可在 Settings 中修改）
```

## Security Considerations

- Token 存储在 localStorage（自部署场景可接受）
- XSS 防护: React 默认转义
- 连接 Gateway 时自动处理 pairing（本地连接自动批准）
- 不暴露服务端 API Key（直连模式无需后端存储 Key）
