# TASKS.md - 群组功能开发任务清单

> 基于 docs/GROUP-CHAT-PLAN.md | 工作流参考 docs/WORKFLOW.md
> 最后更新: 2026-03-20

## Phase G0: 数据层 + 基础消息收发

### G0.1-G0.3: Schema + 迁移 + 类型

- **分支**: `feat/group-p0-schema`
- **Worktree**: `/home/bowie/projects/openclaw-chat-group-p0-schema`
- **状态**: 待开始
- **任务**:
  - [ ] 在 `db/schema.ts` 新增 `groups`、`group_members`、`group_messages` 表及 relations
  - [ ] 生成并执行数据库迁移
  - [ ] 在 `lib/types.ts` 新增 `Group`、`GroupMember`、`GroupMessage` 类型
- **验收标准**: `npm run build` 通过，新表可通过 drizzle-kit 生成迁移文件
- **Prompt 关键信息**: 参考 docs/GROUP-CHAT-PLAN.md 的数据模型章节

### G0.4-G0.6: API Routes

- **分支**: `feat/group-p0-api`
- **Worktree**: `/home/bowie/projects/openclaw-chat-group-p0-api`
- **状态**: 待开始
- **前置**: G0.1-G0.3 已合并
- **任务**:
  - [ ] `app/api/groups/route.ts` — 创建、列表
  - [ ] `app/api/groups/[id]/route.ts` — 详情、更新、删除
  - [ ] `app/api/groups/[id]/members/route.ts` — 成员 CRUD
  - [ ] `app/api/groups/[id]/messages/route.ts` — 消息 CRUD
- **验收标准**: API 可通过 curl 测试，CRUD 完整

### G0.7-G0.8: GroupChatProvider + 页面集成

- **分支**: `feat/group-p0-hook`
- **Worktree**: `/home/bowie/projects/openclaw-chat-group-p0-hook`
- **状态**: 待开始
- **前置**: G0.4-G0.6 已合并
- **任务**:
  - [ ] `hooks/useGroupChat.tsx` — 核心逻辑：消息广播 + 事件监听 + 流式状态管理
  - [ ] `app/page.tsx` — 群组会话走 GroupChatProvider
- **验收标准**: 在群组中发消息，所有成员 Agent 均收到并回复，回复合并展示在群消息流中

---

## Phase G1: UI 展示

### G1.1-G1.5: 群组 UI

- **分支**: `feat/group-p1-ui`
- **Worktree**: `/home/bowie/projects/openclaw-chat-group-p1-ui`
- **状态**: 待开始
- **前置**: G0 已完成
- **任务**:
  - [ ] `GroupMessageItem.tsx` — sender 头像 + 名字 + 颜色标签
  - [ ] 多 Agent 并发流式展示
  - [ ] 群组 ChatHeader
  - [ ] 侧边栏接入群组数据
  - [ ] 群组会话页面完整流程
- **验收标准**: 群组 UI 完整可用，多 Agent 回复可区分

---

## Phase G2: 群组管理

### G2.1-G2.3

- **分支**: `feat/group-p2-settings`
- **Worktree**: `/home/bowie/projects/openclaw-chat-group-p2-settings`
- **状态**: 待开始
- **前置**: G1 已完成

---

## Phase G3: 增强功能

### G3.1-G3.3

- **状态**: 待开始
- **前置**: G2 已完成
