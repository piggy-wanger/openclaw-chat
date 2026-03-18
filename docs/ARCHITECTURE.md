# OpenClaw Chat - Architecture

## 概述

OpenClaw Chat 是一个纯前端应用，通过 WebSocket 直连 OpenClaw Gateway，实现 AI 聊天功能。

## 架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Browser                                    │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    OpenClaw Chat (React)                       │  │
│  │                                                                │  │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐   │  │
│  │  │   Sidebar   │    │ ChatHeader  │    │   MessageList   │   │  │
│  │  │             │    │             │    │                 │   │  │
│  │  │ SessionList │    │ ModelSelect │    │  MessageItem    │   │  │
│  │  │ SessionItem │    │             │    │  ToolCallCard   │   │  │
│  │  └──────┬──────┘    └──────┬──────┘    └────────┬────────┘   │  │
│  │         │                  │                    │             │  │
│  │         └──────────────────┼────────────────────┘             │  │
│  │                            │                                  │  │
│  │  ┌─────────────────────────▼─────────────────────────────┐   │  │
│  │  │                    Context Providers                   │   │  │
│  │  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │   │  │
│  │  │  │ GatewayProv │ │ SessionProv │ │ ChatProvider│      │   │  │
│  │  │  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘      │   │  │
│  │  │         │               │               │              │   │  │
│  │  │  ┌──────▼───────────────▼───────────────▼──────┐       │   │  │
│  │  │  │                 Hooks Layer                  │       │   │  │
│  │  │  │  useGateway  useSession  useChat  useSettings│       │   │  │
│  │  │  └──────────────────────┬──────────────────────┘       │   │  │
│  │  └─────────────────────────┼─────────────────────────────┘   │  │
│  └────────────────────────────┼─────────────────────────────────┘  │
│                               │                                     │
│                    WebSocket  │                                     │
│                               │                                     │
└───────────────────────────────┼─────────────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────────────┐
│                     OpenClaw Gateway                                   │
│                                                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │   Session   │  │    Chat     │  │    Agent    │  │   Config    │  │
│  │   Manager   │  │   Engine    │  │   Runtime   │  │   Manager   │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────────────┘  │
│         │                │                │                          │
│         └────────────────┼────────────────┘                          │
│                          │                                           │
│                          ▼                                           │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │                      AI Provider (Claude)                      │   │
│  └───────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────┘
```

## 设计决策

### 前端直连 Gateway WebSocket

**决策**: 前端通过 WebSocket 直接连接 OpenClaw Gateway，不经过中间 API 服务器。

**理由**:

1. **简化架构** - 无需维护独立的后端服务
2. **实时性** - WebSocket 提供双向实时通信
3. **低延迟** - 减少中间层，降低通信延迟
4. **一致性** - 与 Gateway Protocol 保持一致
5. **部署简单** - 可作为纯静态资源部署

**权衡**:

- 浏览器需要能够直接访问 Gateway（需要网络可达）
- 跨域问题需要通过 Gateway 配置解决

## 数据流

### 发送消息流程

```
┌─────────┐     ┌───────────┐     ┌────────────┐     ┌──────────┐     ┌─────────┐
│  User   │────▶│ InputArea │────▶│  useChat   │────▶│  Gateway │────▶│   AI    │
│ Input   │     │ Component │     │   Hook     │     │  Client  │     │         │
└─────────┘     └───────────┘     └────────────┘     └──────────┘     └────┬────┘
     │                │                  │                 │               │
     │                │                  │                 │               │
     │                │    sendMessage() │                 │               │
     │                │─────────────────▶│                 │               │
     │                │                  │                 │               │
     │                │                  │   chat.send()   │               │
     │                │                  │────────────────▶│               │
     │                │                  │                 │               │
     │                │                  │                 │  RPC Request  │
     │                │                  │                 │──────────────▶│
     │                │                  │                 │               │
```

### 接收响应流程

```
┌─────────┐     ┌───────────┐     ┌────────────┐     ┌──────────┐     ┌─────────┐
│ Message │◀────│ Message   │◀────│  useChat   │◀────│  Gateway │◀────│   AI    │
│  List   │     │   Item    │     │   Hook     │     │  Client  │     │         │
└─────────┘     └───────────┘     └────────────┘     └──────────┘     └─────────┘
     │                │                  │                 │               │
     │                │                  │                 │  Event Stream │
     │                │                  │                 │◀──────────────│
     │                │                  │                 │               │
     │                │                  │  chat/agent     │               │
     │                │                  │    event        │               │
     │                │                  │◀────────────────│               │
     │                │                  │                 │               │
     │                │  state update    │                 │               │
     │                │◀─────────────────│                 │               │
     │                │                  │                 │               │
     │   re-render    │                  │                 │               │
     │◀───────────────│                  │                 │               │
     │                │                  │                 │               │
```

### 事件类型

| 事件 | 来源 | 说明 |
|------|------|------|
| `hello` | Gateway | 连接建立后的握手信息 |
| `chat` | Gateway | 聊天消息事件 (delta/final/aborted/error) |
| `agent` | Gateway | Agent 事件 (tool/lifecycle/assistant/compaction) |
| `disconnect` | Gateway Client | 连接断开 |
| `reconnect` | Gateway Client | 重连成功 |
| `error` | Gateway Client | 连接错误 |

## 组件层次

```
Providers (layout.tsx)
├── ThemeProvider
├── SettingsProvider
└── GatewayProvider
    └── Page (page.tsx)
        ├── ConnectionStatus
        └── SessionProvider
            └── ChatProvider
                ├── Sidebar
                │   └── SessionList
                │       └── SessionItem
                ├── ChatHeader
                │   └── ModelSelect
                ├── MessageList
                │   └── MessageItem
                │       ├── MarkdownRenderer
                │       └── ToolCallList
                │           └── ToolCallCard
                └── InputArea
```

## Hooks 职责

| Hook | 职责 |
|------|------|
| `useSettings` | 管理应用设置（Gateway URL、Token、字体大小等） |
| `useGateway` | 管理 WebSocket 连接、状态、事件分发 |
| `useSession` | 管理会话列表（获取、创建、更新、删除） |
| `useChat` | 管理消息（获取历史、发送消息、流式响应、工具调用） |
| `useKeyboardShortcuts` | 注册全局键盘快捷键 |

## 与 Control UI 的关系

OpenClaw Chat 和 OpenClaw Control UI 是两个独立的前端应用：

| 特性 | OpenClaw Chat | OpenClaw Control UI |
|------|---------------|---------------------|
| 目标用户 | 终端用户 | 管理员 |
| 主要功能 | AI 聊天 | 系统配置、监控 |
| 访问方式 | 公开访问 | 需要管理员权限 |
| 部署方式 | 独立部署或 Gateway 静态文件 | 通常与 Gateway 一起部署 |

两者共享相同的 OpenClaw Gateway 后端，但功能互补：
- **Chat**: 专注于聊天体验
- **Control**: 专注于系统管理

## 安全考虑

1. **Token 存储** - Gateway Token 存储在浏览器 localStorage，仅用于 WebSocket 认证
2. **无服务器存储** - 不经过中间服务器，减少数据泄露风险
3. **HTTPS/WSS** - 生产环境应使用安全连接
4. **CORS** - Gateway 需要配置允许前端域名
