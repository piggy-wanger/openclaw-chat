修复以下 Codex + Gemini review 发现的 6 个问题，一次性全部修复：

[M1] SessionItem N+1 请求 — components/sidebar/SessionItem.tsx
问题：每个群组 SessionItem 独立 fetch /api/groups/{id}/members，N 个群组就 N 个请求。
修复：将 members fetch 提升到 SessionList.tsx 层面。SessionList 批量获取所有群组 session 的 members（可以并发），通过 props 传给 SessionItem。SessionItem 移除自己的 useEffect fetch，改为从 props 接收 groupMembers?: GroupMember[]。

[M2] parseToolCalls 不兼容 Gateway schema — components/chat/GroupMessageItem.tsx
问题：parseToolCalls 只认 { id, name, arguments, status }，但群消息 toolCalls 来自 AgentEvent.data（字段是 toolCallId, args, phase, result, isError）。
修复：parseToolCalls 同时接受两种格式。当 id 不存在时，用 toolCallId 作为 id；当 arguments 不存在时，用 args；当 status 不存在时，将 phase "result" 映射为 "success"，"start"/"running" 映射为 "running"；额外读取 result 和 isError 字段。

[m3] hashHue 函数重复 — components/chat/GroupMessageItem.tsx + GroupMessageList.tsx
修复：将 hashHue 提取到 lib/utils.ts（或新建 lib/colorUtils.ts），两个文件从同一处 import。

[m4] streaming key 不稳定 — components/chat/GroupMessageList.tsx
问题：key 用 ${agent.agentId}-${agent.runId || "stream"}，runId 从 null 变为实际值时 key 变化导致 React 重建组件。
修复：key 改为只用 agent.agentId（每个 agent 在同一时刻只有一个活跃 stream）。

[m5] hasEverConnected 逻辑被移除 — app/page.tsx
问题：MainContent 中 hasEverConnected ref 被删，Gateway 快速断连时体验可能闪烁。
修复：恢复 hasEverConnected ref 和相关逻辑（参考 origin/master 中 MainContent 的实现）。

[m6] MessageListSkeleton 被移除 — app/page.tsx
问题：初始加载时缺骨架屏。
修复：恢复 MessageListSkeleton 组件定义，并在 GroupChatArea 的消息加载状态中使用。

修复后确保 npm run build 通过，然后 git add -A && git commit -m "fix(group): 修复 Codex+Gemini review 发现的 6 个问题" && git push
