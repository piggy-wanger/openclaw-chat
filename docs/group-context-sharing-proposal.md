# 群组上下文共享方案 — 庸鹿

> 创建时间：2026-03-23
> 状态：待确认

---

## 一、核心思路

SQLite 作为持久存储（已有），新增 API 让 agent 按需查询群组完整聊天记录，不污染 Gateway session 历史。

---

## 二、API 设计

### GET `/api/groups/[id]/messages/export`

**参数：**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | path | string | 是 | 群组 ID |
| format | query | string | 否 | `text`（默认）或 `json` |
| maxTokenChars | query | number | 否 | 返回内容最大字符数，默认 30000 |

**返回格式（text）：**

```
[群组消息记录] 群组：{群名} | 共 50 条消息

[2026-03-22 22:30:15] 🧑 用户:
你好，大家觉得这个方案怎么样？

[2026-03-22 22:30:18] 🦌 庸鹿(main):
我觉得方案可行，但需要注意...

[2026-03-22 22:30:25] 💻 Coder(coder):
我补充一下技术细节...
```

**返回格式（json）：**

```json
{
  "groupId": "xxx",
  "groupName": "技术讨论",
  "totalMessages": 50,
  "returnedMessages": 50,
  "truncated": false,
  "messages": [
    {
      "sender": "🧑 用户",
      "senderId": "user",
      "content": "...",
      "time": "2026-03-22 22:30:15"
    }
  ]
}
```

**截断策略：** 从最早的消息开始截断，保留最新的消息（最新的最可能被引用）。返回体标注 `truncated: true/false`。

---

## 三、初始化 Prompt

```
你现在是一个群组成员。

群组名称：「{群名}」
群组成员：{emoji 名字}(agentId)、{emoji 名字}(agentId) ...
你的身份：{emoji 名字}({agentId})

群组的完整聊天记录保存在本地数据库中。当你需要了解之前的讨论内容时，可以使用以下命令查询：

GET /api/groups/{groupId}/messages/export

参数说明：
- format=text：返回纯文本格式（推荐阅读）
- format=json：返回 JSON 格式（适合程序处理）
- maxTokenChars=30000：返回内容的最大字符数（默认 30000）

使用建议：
- 当用户提到"之前说的"、"刚才讨论的"等需要回顾上下文时，主动查询
- 当你需要引用其他成员的观点时，查询确认后再回答
- 如果查询结果被截断（显示 truncated: true），说明消息较多，优先关注最近的内容

上下文管理提醒：
- 你的 session 有上下文窗口限制，如果感觉上下文过长，请使用 /compact 命令压缩历史
- 不要把查询到的全部历史粘贴到回复中，只提取相关内容回答
```

---

## 四、Agent 触发机制

**不主动注入，完全由 agent 自主决定何时查询。** 通过 prompt 引导：

- 用户提到"之前说的"、"刚才"、"回顾一下" → agent 应该查询
- 用户 @多个 agent 讨论同一话题 → agent 应该查询其他 agent 的观点
- agent 不确定上下文时 → 保守查询，不带历史回答

---

## 五、Token 预算控制

- `maxTokenChars` 参数限制返回内容的字符数（默认 30000，约 7500 token）
- API 返回时在末尾标注 `truncated: true/false`
- 超出预算时从头部截断旧消息，保留新消息
- agent 在回复中不粘贴全部查询结果，只引用相关部分

---

## 六、Compact 提醒

- 在初始化 prompt 中已包含 `/compact` 命令说明
- 每次发消息时不拼接历史（当前已实现），不增加额外 context
- OpenClaw 自动 compaction 兜底

---

## 七、文件改动清单

| 文件 | 操作 |
|------|------|
| `app/api/groups/[id]/messages/export/route.ts` | **新增** — 导出 API |
| `hooks/useGroupChat.tsx` | **修改** — 更新初始化 prompt |

---

## 八、实现步骤

1. 新增 `export/route.ts`，实现 GET 查询，支持 text/json 两种格式
2. 实现 `maxTokenChars` 截断逻辑（从头部截断旧消息，保留新消息）
3. 更新 `initializeGroupContext` 中的 prompt，加入查询工具说明
4. 测试：创建群组 → 发几条消息 → @agent 问"之前讨论了什么" → 验证 agent 是否查询并引用历史

---

## 九、风险和注意事项

- **Agent 不一定遵守 prompt** — 有些模型可能不会主动查询，需要测试各 agent 的行为
- **查询结果是 HTTP 请求** — agent 需要有执行 HTTP 请求的能力（exec curl 或 web_fetch 工具）
- **查询结果塞回复会膨胀 context** — prompt 中明确告诉 agent 不要粘贴全部结果
- **大群聊导出可能较慢** — 如果群聊超过 1000 条消息，需要考虑查询性能
