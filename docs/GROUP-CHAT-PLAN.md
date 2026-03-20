# 群组功能开发方案（Room 模型）

> 基于 Room 模型实现多 Agent 群组聊天功能
> 创建时间：2026-03-20
> 状态：待确认

---

## 一、背景

openclaw-chat 当前只支持单 Agent 直接聊天。用户需要在一个会话中同时和多个 Agent 交互（如同时咨询庸鹿和 Claude），因此需要开发群组功能。

### 1.1 现状

**已有的部分：**
- ✅ `CreateGroupDialog.tsx` — UI 层（选群名 + 多选 Agent）
- ✅ `SessionList.tsx` — 已分 "直接聊天" 和 "群聊" 两组展示
- ✅ `useSession.tsx` — `createGroupSession()` 已有占位实现（仅本地，未与 Gateway 交互）
- ✅ `db/schema.ts` — session 表已有 `type: "direct" | "group"` 字段

**核心缺失：**
- ❌ 群组消息路由：消息只发给第一个 Agent，其他 Agent 完全无感知
- ❌ Gateway 没有群组概念：session 是单 Agent 的，没有"一个消息同时发给多个 Agent"的原生能力
- ❌ 消息回复合并：多个 Agent 的回复无法在同一会话中统一展示
- ❌ 群组成员管理：创建后无法编辑/添加/移除 Agent

### 1.2 参考实现

主流平台（Telegram / WhatsApp / Discord / 飞书）的群组架构核心一致：

```
群组（Room）= 一个消息容器
消息 = { 发送者, 内容, 所在群组 }
发送 = 往群组容器里扔一条消息
接收 = 从群组容器里拉取所有消息
```

**群组不是 N 个 1v1 会话的聚合，而是一个独立的消息空间（Room）。**

### 1.3 Gateway 约束

OpenClaw Gateway 中 Session 的定位：

```
Session = 一个持续性的对话上下文，1:1 绑定一个 Agent

职责：
├── 维护对话历史（消息列表）
├── 维护上下文窗口（注入 system prompt + history 给 LLM）
├── 绑定 Agent（决定用哪个 system prompt、哪些 tools、哪个 model）
└── 绑定 Channel（哪来的消息：webchat / telegram / whatsapp...）
```

sessionKey 格式：`agent:{agentId}:{name}[:{nanoid}]`

**Gateway 只认识 Session，不认识"群组"。消息必须通过 Session 发送，Gateway 通过 sessionKey 前缀路由到对应 Agent。**

因此 openclaw-chat 的群组功能必须在**客户端层**实现 Room 模型——一个群组 = 一个本地 Room + N 个 Gateway Session。

---

## 二、架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────┐
│  openclaw-chat 前端（Room 模型）                       │
│                                                     │
│  GroupChatProvider                                  │
│    ├── state: groupMessages[]                      │
│    ├── state: streamingMap (agentId → streamState)  │
│    │                                                │
│    │  sendMessage(text)                             │
│    │    → 1. 写入 group_messages (role: user)       │
│    │    → 2. 遍历 group_members                     │
│    │    → 3. 对每个 member 并发调用:                 │
│    │       client.chatSend({                       │
│    │         sessionKey: member.sessionKey,         │
│    │         message: text                          │
│    │       })                                       │
│    │                                                │
│    │  onChat(event) / onAgent(event)                │
│    │    → 匹配 event.sessionKey → 找到 sender       │
│    │    → 写入 group_messages (role: assistant)      │
│    │    → 更新 streamingMap                        │
│                                                     │
├─────────────────────────────────────────────────────┤
│  OpenClaw Gateway（单 Session 单 Agent）               │
│                                                     │
│  session: agent:main:group-abc123  → main agent    │
│  session: agent:claude:group-abc123 → claude agent  │
│  session: agent:codex:group-abc123  → codex agent   │
└─────────────────────────────────────────────────────┘
```

### 2.2 数据流

**发送消息：**
```
用户输入 "帮我分析这段代码"
  ↓
写入 group_messages: { senderType: "user", role: "user", content: "帮我分析这段代码" }
  ↓
并发调用：
  ├── chatSend({ sessionKey: "agent:main:group-xxx", message: "帮我分析这段代码" })
  ├── chatSend({ sessionKey: "agent:claude:group-xxx", message: "帮我分析这段代码" })
  └── chatSend({ sessionKey: "agent:codex:group-xxx", message: "帮我分析这段代码" })
```

**接收回复：**
```
Gateway 推送 chat/agent 事件
  ↓
根据 event.sessionKey 匹配 sender（哪个 member）
  ↓
assistant stream → 更新 streamingMap[senderId]
  ↓
chat final → 写入 group_messages: { senderType: "agent", senderId: "claude", role: "assistant", content: "..." }
```

### 2.3 SessionKey 命名规范

```
群组 Agent 的 SessionKey: agent:{agentId}:{groupId}

示例：
  agent:main:grp_abc123     ← 庸鹿
  agent:claude:grp_abc123   ← Claude
  agent:codex:grp_abc123    ← Codex
```

groupId 作为 sessionKey 的一部分，确保群组成员的 session 不会和其他会话冲突。

---

## 三、数据模型

### 3.1 新增表（Drizzle Schema）

```typescript
// 群组表（Room）
export const groups = sqliteTable("groups", {
  id:          text("id").primaryKey().$defaultFn(() => nanoid()),   // grp_xxxx
  name:        text("name").notNull(),                                // 群名
  avatar:      text("avatar"),                                        // 群头像 emoji
  createdAt:   integer("created_at").notNull().$defaultFn(() => Date.now()),
  updatedAt:   integer("updated_at").notNull().$defaultFn(() => Date.now()),
});

// 群成员表（Agent 参与者）
export const groupMembers = sqliteTable("group_members", {
  id:          text("id").primaryKey().$defaultFn(() => nanoid()),
  groupId:     text("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  agentId:     text("agent_id").notNull(),                            // Gateway 中的 agent id
  name:        text("name").notNull(),                                // 显示名
  emoji:       text("emoji"),                                         // 显示 emoji
  sessionKey:  text("session_key"),                                   // 该 agent 在 Gateway 中的 sessionKey
  role:        text("role").notNull().default("member"),              // "admin" | "member"
  order:       integer("order").notNull().default(0),                 // 排序
  createdAt:   integer("created_at").notNull().$defaultFn(() => Date.now()),
}, (table) => [
  uniqueIndex("group_member_unique").on(table.groupId, table.agentId),
]);

// 群消息表（Room 统一消息流）
export const groupMessages = sqliteTable("group_messages", {
  id:          text("id").primaryKey().$defaultFn(() => nanoid()),
  groupId:     text("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  senderType:  text("sender_type").notNull(),                         // "user" | "agent"
  senderId:    text("sender_id"),                                     // user: null; agent: agentId
  senderName:  text("sender_name"),                                   // 显示名
  senderEmoji: text("sender_emoji"),                                  // 显示 emoji
  role:        text("role").notNull(),                                 // "user" | "assistant"
  content:     text("content").notNull(),                             // 同 messages.content 格式
  runId:       text("run_id"),                                        // 对应 Gateway runId（用于 abort）
  toolCalls:   text("tool_calls"),                                    // JSON 序列化的 ToolCall[]
  createdAt:   integer("created_at").notNull().$defaultFn(() => Date.now()),
});

// Relations
export const groupsRelations = relations(groups, ({ many }) => ({
  members:  many(groupMembers),
  messages: many(groupMessages),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, {
    fields: [groupMembers.groupId],
    references: [groups.id],
  }),
}));

export const groupMessagesRelations = relations(groupMessages, ({ one }) => ({
  group: one(groups, {
    fields: [groupMessages.groupId],
    references: [groups.id],
  }),
}));
```

### 3.2 TypeScript 类型

```typescript
// lib/types.ts 新增

export type Group = {
  id: string;
  name: string;
  avatar?: string;
  memberCount: number;
  createdAt: number;
  updatedAt: number;
};

export type GroupMember = {
  id: string;
  groupId: string;
  agentId: string;
  name: string;
  emoji?: string;
  sessionKey: string;
  role: "admin" | "member";
  order: number;
  createdAt: number;
};

export type GroupMessage = {
  id: string;
  groupId: string;
  senderType: "user" | "agent";
  senderId?: string;
  senderName?: string;
  senderEmoji?: string;
  role: "user" | "assistant";
  content: string | ContentBlock[];
  runId?: string;
  toolCalls?: ToolCall[];
  createdAt: number;
};
```

---

## 四、核心组件设计

### 4.1 GroupChatProvider（`hooks/useGroupChat.tsx`）

核心 hook，管理群组消息的收发和状态。

```typescript
type GroupChatContextType = {
  // 群组信息
  group: Group | null;
  members: GroupMember[];

  // 消息
  messages: GroupMessage[];
  loading: boolean;

  // 流式状态：每个 Agent 独立的流式状态
  streamingMap: Map<string, {
    isStreaming: boolean;
    content: string;
    runId: string | null;
  }>;

  // 操作
  sendMessage: (content: string) => Promise<void>;
  abortStream: (agentId?: string) => Promise<void>;  // abort 指定 agent 或全部

  // 群组管理
  addMember: (agentId: string) => Promise<void>;
  removeMember: (agentId: string) => Promise<void>;
  updateGroup: (updates: { name?: string; avatar?: string }) => Promise<void>;
};
```

**关键实现要点：**

1. **事件分发**：监听 Gateway 的 chat/agent 事件，通过 `event.sessionKey` 匹配到对应的 `groupMember`，提取 sender 信息
2. **并发 streaming**：`streamingMap` 为每个 Agent 维护独立的流式状态，UI 可同时显示多个 Agent 在输入
3. **Abort**：支持 abort 单个 Agent（通过其 `runId`）或 abort 全部
4. **消息持久化**：所有群消息写入 `group_messages` 表（本地 SQLite）

### 4.2 消息渲染

**群组消息 vs 直接聊天消息：**

```
直接聊天：
  [用户消息]
  [AI 回复]

群组聊天：
  [用户消息]
  [🦌 庸鹿 的回复]    ← 带头像 + 名字标签
  [🤖 Claude 的回复]  ← 带头像 + 名字标签，可能与庸鹿并发
  [🔧 Codex 的回复]   ← 带头像 + 名字标签
```

**流式状态展示：**

```
🦌 庸鹿 正在输入... ████████░░
🤖 Claude 正在输入... ██████████（已完成，显示完整回复）
🔧 Codex 等待中...
```

### 4.3 输入区域扩展

支持 `@提及`：

- 输入 `@` 弹出成员列表
- 选择 `@庸鹿` 后，只触发庸鹿回复（可选功能，P3）
- 不 @ 则默认触发全部成员

---

## 五、API 设计

### 5.1 群组 CRUD

```
POST   /api/groups                          创建群组
GET    /api/groups                          获取群组列表
GET    /api/groups/[id]                     获取群组详情
PATCH  /api/groups/[id]                     更新群组（名称、头像）
DELETE /api/groups/[id]                     删除群组
```

### 5.2 成员管理

```
GET    /api/groups/[id]/members             获取成员列表
POST   /api/groups/[id]/members             添加成员
DELETE /api/groups/[id]/members/[agentId]   移除成员
PATCH  /api/groups/[id]/members/[agentId]   更新成员（role、order）
```

### 5.3 消息

```
GET    /api/groups/[id]/messages            获取消息列表（分页）
POST   /api/groups/[id]/messages            发送消息（写入本地 + 广播 Gateway）
DELETE /api/groups/[id]/messages/[msgId]    删除消息
```

---

## 六、开发任务拆分

### P0：数据层 + 基础消息收发（核心）

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 0.1 | Schema 定义 | `db/schema.ts` | 新增 `groups`、`group_members`、`group_messages` 表及 relations |
| 0.2 | 数据库迁移 | `db/migrate.ts` | 生成并执行迁移 |
| 0.3 | TypeScript 类型 | `lib/types.ts` | 新增 `Group`、`GroupMember`、`GroupMessage` 类型 |
| 0.4 | 群组 API | `app/api/groups/route.ts` | 创建、列表、详情、更新、删除 |
| 0.5 | 成员 API | `app/api/groups/[id]/members/route.ts` | 成员 CRUD |
| 0.6 | 消息 API | `app/api/groups/[id]/messages/route.ts` | 消息 CRUD |
| 0.7 | GroupChatProvider | `hooks/useGroupChat.tsx`（新建） | 核心逻辑：消息广播 + 事件监听 + 流式状态管理 |
| 0.8 | 页面路由 | `app/page.tsx` | 群组会话走 `GroupChatProvider` 而非 `ChatProvider` |

### P1：UI 展示

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 1.1 | 群消息渲染组件 | `components/chat/GroupMessageItem.tsx`（新建） | sender 头像 + 名字 + 颜色标签 |
| 1.2 | 多 Agent 并发流式 | `hooks/useGroupChat.tsx` | 每个 Agent 独立显示流式进度 |
| 1.3 | 群组 ChatHeader | `components/chat/ChatHeader.tsx` | 显示群名 + 成员头像列表 + 设置入口 |
| 1.4 | 侧边栏接入 | `components/sidebar/SessionList.tsx` | 群组列表接入真实数据（框架已有） |
| 1.5 | 群组会话页面 | `app/page.tsx` 或 `app/groups/[id]/page.tsx` | 群组消息列表 + 输入区域 |

### P2：群组管理

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 2.1 | 群组设置对话框 | `components/dialogs/GroupSettingsDialog.tsx`（新建） | 编辑群名、管理成员 |
| 2.2 | CreateGroupDialog 接入 | `components/dialogs/CreateGroupDialog.tsx` | 改为调用真实 API |
| 2.3 | 成员状态 | `hooks/useGroupChat.tsx` | 显示 Agent 在线/离线状态 |

### P3：增强功能

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 3.1 | @提及 | `components/chat/InputArea.tsx` + `hooks/useGroupChat.tsx` | @某 Agent 只触发该 Agent |
| 3.2 | Agent 间上下文共享 | `hooks/useGroupChat.tsx` | 可选将其他 Agent 回复注入当前 Agent 上下文 |
| 3.3 | 消息历史分页 | API + UI | 本地 SQLite 持久化，支持翻页加载 |

---

## 七、风险与注意事项

### 7.1 并发 Streaming

群组中 N 个 Agent 同时回复时，Gateway 会发 N 组 `chat`/`agent` 事件。前端需要：
- 正确根据 `event.sessionKey` 区分来源
- 避免状态混乱（使用 Map 而非单个 state）
- UI 层正确处理多个流式输出同时展示

### 7.2 SessionKey 冲突

群组成员的 `sessionKey` 命名为 `agent:{agentId}:{groupId}`，需确保：
- groupId 足够唯一（nanoid 生成）
- 同一个 Agent 加入多个群组时 sessionKey 不冲突

### 7.3 上下文隔离

每个 Agent 在 Gateway 有独立的 session，**彼此看不到对方的回复**。如果需要 Agent 间协作：
- P3 阶段实现：在前端拼接其他 Agent 的回复到消息中
- 或在 Gateway 端通过 `sessions_send` 让 Agent 间通信（更复杂）

### 7.4 Gateway 连接断开

群组依赖 Gateway 连接。断开时：
- 无法发送消息
- 已有的消息从本地 SQLite 加载展示（离线查看）

---

## 八、文件改动清单

### 新增文件

```
db/schema.ts                                  ← 扩展（新增 3 张表）
app/api/groups/route.ts                       ← 新增
app/api/groups/[id]/route.ts                  ← 新增
app/api/groups/[id]/members/route.ts          ← 新增
app/api/groups/[id]/messages/route.ts         ← 新增
hooks/useGroupChat.tsx                        ← 新增（核心）
components/chat/GroupMessageItem.tsx           ← 新增
components/dialogs/GroupSettingsDialog.tsx     ← 新增
```

### 修改文件

```
hooks/useSession.tsx                          ← createGroupSession 改为调真实 API
app/page.tsx                                  ← 群组会话走 GroupChatProvider
components/sidebar/SessionList.tsx            ← 接入群组真实数据
components/sidebar/SessionItem.tsx            ← 群组 item 显示成员数
components/chat/ChatHeader.tsx                ← 群组 Header
components/chat/InputArea.tsx                 ← 支持 @提及
components/chat/MessageList.tsx               ← 支持群消息渲染
components/dialogs/CreateGroupDialog.tsx      ← 接入真实 API
lib/types.ts                                  ← 新增 Group 相关类型
lib/storage.ts                                ← 新增群组存储操作
```

### 无需改动

```
lib/gateway-client.ts                         ← 无需改动，chatSend/chatHistory 已够用
lib/gateway-types.ts                          ← 无需改动，事件已带 sessionKey
Gateway 端                                   ← 无需改动
```

---

*最后更新：2026-03-20*
