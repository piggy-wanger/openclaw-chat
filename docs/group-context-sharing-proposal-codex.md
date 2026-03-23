# 群组上下文共享方案 — Codex

> 创建时间：2026-03-23
> 状态：待确认

---

## 一、核心思路

群组的完整聊天记录持久化在 SQLite（group_messages 表）中。新增 API 让每个 agent 按需查询全量历史消息，通过初始化 prompt 告知 agent 如何使用该 API。不拼接到 sendMessage 的消息体中，避免污染 Gateway session 历史。

---

## 二、API 设计

### GET `/api/groups/[id]/history`

**参数：**

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| id | path | string | 是 | — | 群组 ID |
| format | query | string | 否 | `text` | `text` 或 `json` |
| senderId | query | string | 否 | — | 按成员 agentId 筛选 |
| keyword | query | string | 否 | — | 按关键词模糊搜索（SQLite LIKE） |
| before | query | number | 否 | — | 查询此时间戳之前的消息 |
| limit | query | number | 否 | 不限制 | 最大返回条数 |
| maxChars | query | number | 否 | 30000 | 返回内容最大字符数 |

**返回格式（text）：**

```
=== 群组「技术讨论」消息记录 ===
共 50 条消息 | 查询时间：2026-03-22 22:30:00

--- 用户 [2026-03-22 22:30:15] ---
你好，大家觉得这个方案怎么样？

--- 庸鹿(main) [2026-03-22 22:30:18] ---
我觉得方案可行，但需要注意...

--- Coder(coder) [2026-03-22 22:30:25] ---
我补充一下技术细节...
```

**返回格式（json）：**

```json
{
  "groupId": "xxx",
  "groupName": "技术讨论",
  "totalMessages": 50,
  "filteredMessages": 50,
  "truncated": false,
  "messages": [
    {
      "sender": "用户",
      "senderId": "user",
      "senderEmoji": "🧑",
      "content": "你好，大家觉得这个方案怎么样？",
      "time": "2026-03-22 22:30:15"
    }
  ]
}
```

**截断策略：**

- 按 `maxChars` 限制输出字符数
- 超出时从**最早的消息**开始截断，保留最新消息
- 返回体标注 `truncated: true` 和实际返回条数 `filteredMessages`
- toolCalls 字段默认不返回，避免 JSON 膨胀

---

## 三、初始化 Prompt 设计

```
你现在是一个群组成员。

群组名称：「{群名}」
群组成员：{emoji 名字}({agentId})、{emoji 名字}({agentId}) ...
你的身份：{emoji 名字}({agentId})

## 群组历史消息查询

群组的所有聊天记录存储在本地 SQLite 数据库中。你可以通过以下 API 查询完整历史消息：

GET /api/groups/{groupId}/history

查询参数：
- format=text（默认）或 format=json
- senderId=agentId（按成员筛选）
- keyword=关键词（全文搜索）
- before=时间戳（查询此时间之前的消息）
- maxChars=30000（返回内容字符上限，防止超出上下文）

使用规则：
1. 当用户的问题可能依赖之前的讨论时，你应该先查询历史再回答
2. 不要在回复中粘贴全部查询结果，只引用与当前问题相关的部分
3. 如果返回了 truncated=true，说明内容被截断，你可以缩小范围重新查询（比如用 senderId 或 keyword 筛选）

## 上下文管理

- 你的会话有上下文窗口限制。当你觉得上下文信息过多时，使用 /compact 命令进行压缩
- 查询历史后，只提取关键信息回答，不要将查询到的内容原样复制到回复中
```

---

## 四、Agent 触发机制

**Prompt 引导 + 自主判断：**

- 在 prompt 中明确列出"应该查询"的场景
- agent 根据用户消息语义判断是否需要查询
- 不在前端做拦截或自动注入

**补充建议：** 如果发现某些 agent 不主动查询，可以在 sendMessage 时加一个轻量提示（不改 message 内容，而是通过 Gateway chat.send 的 metadata 字段，如果支持的话）。否则只能依赖 prompt 引导。

---

## 五、Token 预算控制

- **API 层：** `maxChars` 参数限制输出字符数（默认 30000 ≈ 7500 tokens）
- **截断策略：** 从最早的消息开始截断，保留最新的
- **格式开销：** text 格式比 json 格式更紧凑
- **toolCalls 膨胀：** 默认不返回 toolCalls 字段，必要时再开启
- 返回体标注 `truncated: true/false` + `filteredMessages`（实际返回条数）

---

## 六、Compact 提醒

- 初始化 prompt 中告知 `/compact` 命令
- 提醒 agent 不要在回复中粘贴大量历史内容
- OpenClaw 自带的 auto-compaction 会在 session 接近上限时自动触发
- 可选增强：监听 Gateway 的 compaction 事件，在 UI 上给用户一个提示

---

## 七、文件改动清单

| 文件 | 操作 |
|------|------|
| `app/api/groups/[id]/history/route.ts` | **新增** — 查询 API |
| `hooks/useGroupChat.tsx` | **修改** — 更新初始化 prompt |
| `lib/types.ts` | **可选修改** — 新增 GroupHistoryMessage 类型 |

---

## 八、实现步骤

1. **新增 API** — `app/api/groups/[id]/history/route.ts`
   - 实现 GET handler，查询 group_messages 表
   - 支持 format、senderId、keyword、before、maxChars 参数
   - 实现 text 格式化输出和 json 格式化输出
   - 实现 maxChars 截断逻辑（从头部截断旧消息）
   - toolCalls 字段默认不返回

2. **更新初始化 prompt** — `hooks/useGroupChat.tsx`
   - 替换当前简单的 prompt 为包含查询工具说明的完整版
   - 确认初始化消息回复仍然被静默丢弃

3. **测试验证**
   - 创建群组，发 10+ 条消息
   - @agent 问"之前讨论了什么"
   - 验证 agent 是否调用 API 并正确引用历史
   - 测试不同 format 参数
   - 测试 maxChars 截断

4. **可选增强**
   - keyword 参数改用 FTS5 全文搜索（需要额外建索引）
   - 监听 Gateway compaction 事件在 UI 提示

---

## 九、风险和注意事项

- **Agent 是否会真的调用 HTTP API** — 取决于 agent 配置的 tools 权限。需要确认 agent 有 exec 或 web_fetch 等工具可以发 HTTP 请求
- **localhost API 可达性** — API 跑在 localhost:3000，agent 如果在沙箱中可能无法访问。需要确认 agent 的 exec 环境可以 curl localhost
- **prompt 遵从性** — 不同模型对 prompt 的遵从度不同，可能需要针对不同 agent 测试
- **SQLite 并发** — 查询是只读的，better-sqlite3 单线程模型不会有并发问题
- **大量消息导出性能** — 1000+ 条消息的格式化可能需要 100-200ms，可接受
- **查询期间数据快照** — 查询期间新消息写入可能导致"读到一半数据变化"，建议返回时附带 `snapshotLatestMessageId` 作为快照游标
- **排序稳定性** — 固定使用 `createdAt ASC, id ASC` 排序，避免 cursor 重复或漏消息
