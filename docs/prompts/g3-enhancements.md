# G3.1-G3.3: 群组增强功能

## 目标

实现群组聊天增强功能：@提及（只触发指定 Agent）、Agent 间上下文共享（可选）、消息历史分页加载。

## 背景

项目已有：
- `components/chat/InputArea.tsx` — 已有 @mention 基础框架（mentionQuery、mentionStartPos、AtSign 图标），但 onSend 只传 content 字符串，没有传递被 @ 的 agent 信息
- `hooks/useGroupChat.tsx` — sendMessage(content) 广播给所有成员，fetchMessages() 一次性获取全部消息（无分页）
- `app/api/groups/[id]/messages/route.ts` — 已支持分页：`?limit=50&before=createdAt:id`，返回 `{ messages, hasMore, nextBefore }`
- `lib/types.ts` — GroupMessage 类型完整

## 要实现的文件

### 1. `hooks/useGroupChat.tsx` 修改 — @提及 + 消息分页

**@提及（G3.1）：**
- 修改 `sendMessage` 接口：`sendMessage(content: string, mentionedAgentIds?: string[])`
- 当 `mentionedAgentIds` 有值且非空时，只向这些 Agent 发送消息（遍历 members 时过滤）
- 当 `mentionedAgentIds` 为空或 undefined 时，广播给所有成员（保持现有行为）
- 更新 GroupChatContextType 中 sendMessage 的类型签名

**消息分页（G3.3）：**
- 修改 `fetchMessages` 接口：`fetchMessages(opts?: { loadMore?: boolean })`
- 新增 state：`hasMoreMessages: boolean`、`isLoadingMore: boolean`
- 初始 fetchMessages：不带分页参数，获取最新消息（默认 limit=50）
- loadMore 模式：使用当前最早消息的 createdAt:id 作为 before 参数，fetch 后将新消息 prepend 到现有列表前面
- API 返回 hasMore 时更新 hasMoreMessages state
- 暴露 `fetchMessages`、`hasMoreMessages`、`isLoadingMore` 到 context

### 2. `components/chat/InputArea.tsx` 修改 — @提及完成接入

**要求：**
- 已有 mention 相关 state 和弹出逻辑，需要完善：
  - 点击 mention 列表中的 Agent 时，将 `@AgentName` 插入到输入框对应位置
  - 提取消息中所有 `@AgentName` 匹配，发送时转换为 agentId 列表
  - 匹配逻辑：遍历 groupAgents，找到 name 与 @后文本匹配的 agent，收集 agentId
- 修改 `onSend` 调用：从 content 中提取 @提及的 agentIds，传递给 sendMessage
- 需要新增 prop `onSendWithMentions?: (content: string, mentionedAgentIds: string[]) => void`，或者修改现有 onSend 签名
- **推荐方案**：不改 onSend 签名（保持兼容），新增 `onSendWithMentions` prop，群组模式下使用

### 3. `components/chat/GroupMessageList.tsx` 修改 — 分页加载

**要求：**
- 新增 prop：`hasMoreMessages?: boolean`、`isLoadingMore?: boolean`、`onLoadMore?: () => void`
- 在消息列表顶部添加"加载更多"按钮或滚动到顶部自动加载
- 推荐方案：使用 IntersectionObserver 监听列表顶部元素，滚动到顶部时自动调用 onLoadMore
- 加载中显示 spinner

### 4. `app/page.tsx` 修改 — GroupChatArea 集成

**要求：**
- GroupChatArea 使用 onSendWithMentions 替代 onSend
- GroupMessageList 传入 hasMoreMessages、isLoadingMore、onLoadMore
- 将 useGroupChat 的 hasMoreMessages、isLoadingMore、fetchMessages(loadMore) 接入

### 5. Agent 间上下文共享（G3.2）— 预留设计

**要求：**
- 这个功能需要修改 sendMessage 的消息内容（拼接其他 Agent 的回复），但可能影响消息展示和 Gateway 上下文
- **暂不实现完整功能**，只在 useGroupChat.tsx 中添加注释说明预留扩展点：
  ```typescript
  // G3.2 预留：Agent 间上下文共享
  // 可选方案：发送消息时拼接前几条 Agent 回复作为上下文
  // const recentReplies = messages.filter(m => m.senderType === "agent").slice(-N);
  // const contextContent = recentReplies.map(r => `[${r.senderName}]: ${r.content}`).join("\n");
  // finalMessage = contextContent + "\n---\n" + content;
  ```

## 验收标准

1. npm run build 通过
2. @mention 正常工作：输入 @ 弹出成员列表，选择后插入文本，发送时只触发被 @ 的 Agent
3. 不 @ 时广播给所有成员（回归）
4. 消息分页：初始加载 50 条，滚动到顶部自动加载更多
5. 直接聊天不受影响
6. 不修改 API routes

## 约束

- 不修改 app/api/ 下的任何文件
- 不修改 db/ 下的任何文件
- 不修改 hooks/useChat.tsx（单 Agent 逻辑不变）
- @mention 匹配要容错：大小写不敏感，支持部分匹配
