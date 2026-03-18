# OpenClaw Chat 开发工作流 v2

> 严格遵循文章中的完整工作流：worktree 隔离 + tmux 可干预 + cron 监控 + 多 Agent Review + CI 验证

---

## 角色分工

| 角色 | 谁 | 职责 |
|------|-----|------|
| 编排层（Zoe） | 庸鹿（我） | 拆解需求、写 prompt、派 Agent、监控状态、审查 Review、失败重试 |
| 执行层 | Claude Code（ACP） | 写代码、跑测试、提交 PR |
| Review 层 | Codex（ACP） | Code Review，发现问题直接在 PR 评论 |
| 人类 | 旧青年 | 人工 Review 合并、关键决策、提供 API 信息 |

> 分工理由（来自文章实践）：
> - Claude Code 前端能力强，权限问题少，适合执行代码编写
> - Codex 擅长发现边界情况、逻辑错误、竞态条件，误报率低，适合审查
> - 编排+执行+审查三层分离，互相独立

---

## 前置准备

### Step 0: 初始化 Git 仓库
```
cd /home/bowie/projects/openclaw-chat
git init
# 创建 .gitignore（Next.js 标准）
# 创建 README.md
# 初始提交
# 创建 main 分支（如有需要）
```

### Step 0.5: tmux Agent 持久工作空间

tmux 是 Agent 的**持久载体**，不是一次性任务窗口：

| tmux session | 用途 | 生命周期 |
|---|---|---|
| `claude-executor` | Claude Code 执行层 | 永久保留，复用 |
| `codex-reviewer` | Codex Review 层 | 永久保留，复用 |

**规则：**
- 每个 Agent 一个固定 tmux session，不要每个任务建新的
- Agent 跑完任务后 tmux session 自然退出，下次直接 `tmux send-keys` 发新指令
- 中途可 `tmux attach` 查看进度、`tmux send-keys` 干预
- 不需要手动 `tmux kill-session`，不需要把清理 tmux 当流程步骤
- Step 8 清理只做 `git worktree remove` + `git branch -d`

---

## 完整工作流（8 步）

### Step 1: 需求理解与拆解

每个 Phase 开始前：
1. 我阅读 PRD + TECH-DESIGN 中对应部分
2. 拆解成 1-3 个独立任务
3. 每个任务有明确的 **验收标准**
4. 生成精确的 Codex prompt（包含目标、技术要求、文件路径、验收标准）

**与文章一致：零解释成本。** 因为 PRD/TECH-DESIGN/WORKFLOW 都在我记忆里，不需要每次重复背景。

### Step 2: 启动代理

**每个任务独立隔离：**

```bash
# 1. 从 main 创建 worktree + 分支
cd /home/bowie/projects/openclaw-chat
git worktree add ../openclaw-chat-phase2a -b feat/phase2a-db-api origin/master

# 2. 在 worktree 中安装依赖
cd ../openclaw-chat-phase2a
npm install

# 3. 在已有的 claude-executor tmux session 中执行
tmux send-keys -t claude-executor "cd /home/bowie/projects/openclaw-chat-phase2a && claude -p '...prompt...' --print --permission-mode bypassPermissions" Enter
```

**关键特性：**
- 每个 Agent 在独立 worktree 工作，不互相干扰
- Claude Code 用 `--print --permission-mode bypassPermissions` 全自动执行
- tmux 会话可中途干预：走偏了直接 `tmux send-keys` 纠正
- Agent 只拿到完成该任务需要的最小上下文（不过度塞信息）

### Step 3: 自动监控

设置 cron 任务，每 10 分钟检查所有 Codex 代理状态：

```
检查内容（100% 确定性，不费 token）：
- tmux 会话是否还活着？
- 是否有新 commit？
- 是否创建了 PR？
- build 是否通过？
- 如果失败：是否需要重启？（最多重试 3 次）
```

**监控实现方式：**
- OpenClaw cron job，每 10 分钟执行
- 检查客观事实（git log、gh pr list、tmux has-session）
- 只在需要人工介入时通知旧青年
- 状态记录到 `docs/agent-status.json`

### Step 4: Agent 创建 PR

Agent 完成后：
```bash
cd /home/bowie/projects/openclaw-chat-phase2a
# 更新 TASKS.md 标记完成项（在 worktree 中，跟功能代码一起提交）
vi docs/TASKS.md
git add .
git commit -m "feat: ..."
git push origin feat/phase2a-db-api
gh pr create --fill
```

**⚠️ TASKS.md 必须在 worktree 中更新并跟功能代码一起提交推 PR，不要在 merge 后单独更新。**

**⚠️ 注意：PR 创建不等于完成。** "完成"的定义是全部通过下方所有检查。

### Step 5: 自动化 Code Review

PR 创建后，在已有的 codex-reviewer tmux session 中启动 Code Review：

```bash
# 在已有的 codex-reviewer tmux session 中执行
tmux send-keys -t codex-reviewer "cd /home/bowie/projects/openclaw-chat-phase2a && codex exec '...prompt...'" Enter
```

**Reviewer Prompt 模板：**
```
"Review PR #{pr_number} in {worktree}。
检查:
1. 逻辑错误、边界情况、竞态条件
2. 错误处理是否完善
3. 类型安全
4. 是否符合 TECH-DESIGN 规范
5. 性能问题（不必要渲染、内存泄漏等）
6. 安全问题
对每个发现的问题，用 JSON 数组输出 {severity,file,line,description}。
末尾输出 REVIEW_SUMMARY:PASS 或 REVIEW_SUMMARY:FAIL。"
```

**完成标准：**
- ✅ 所有 critical 和 major 问题被解决
- ✅ Codex reviewer 批准（无 critical 评论）

### Step 6: CI 测试

```bash
# 在 worktree 中运行
npm run build    # 构建通过
npm run lint     # Lint 通过
npm run test     # 单元测试（Phase 6 补充）
```

**额外规则（与文章一致）：**
- 如果 PR 改了 UI，必须在 PR 描述里附上截图，否则视为不完整

### Step 7: 人工 Review

所有自动检查通过后，通知旧青年：
```
"PR #{number} 准备好了，可以 review。
- CI 全绿 ✅
- Code Review 通过 ✅
- 截图: [如有]"
```

旧青年 Review 时间预期: 5-10 分钟。

### Step 8: 合并与清理

```bash
# 合并 PR
gh pr merge {pr_number} --merge

# 切回主仓库，拉取最新
cd /home/bowie/projects/openclaw-chat
git pull origin master

# 清理 worktree（tmux 保留，不清除）
git worktree remove ../openclaw-chat-phase2a
git branch -d feat/phase2a-db-api
```

合并后更新 TASKS.md 标记完成。

---

## 改进版 Ralph Loop（失败处理）

当 Agent 失败时，不重复同样 prompt：

```
❌ 坏例子（静态重试）:
"实现消息列表"

✅ 好例子（动态调整）:
"实现消息列表。上次用了 useMemo 但 key 不稳定
导致无限渲染。改用以下方案:
1. 消息 ID 用 nanoid 生成，不用 index
2. 列表渲染用 React.memo 包裹 MessageItem
3. 使用 useCallback 稳定回调引用"
```

**我能做这种调整是因为：**
- 我有完整的 PRD/TECH-DESIGN 上下文
- 我看到了 build/lint 的具体错误
- 我看了 Code Review 的反馈
- 我知道之前的 prompt 写了什么

**重试上限：3 次。** 3 次都失败则暂停，报告旧青年。

---

## 主动模式（Proactive Mode）

不只是等任务，主动找活干（与文章一致）：

```
阶段开始时:
1. 检查当前代码状态（git status, build 状态）
2. 检查是否有未完成的任务（TASKS.md）
3. 检查上次失败的原因（如果有）
4. 自动规划下一批任务
5. 开始执行
```

---

## 通信协议

| 事件 | 通知对象 | 方式 |
|------|---------|------|
| Phase 开始 | 旧青年 | 直接告知即将做什么 + 预估 |
| Agent 启动 | 内部 | 记录到 agent-status.json |
| 监控发现问题 | 旧青年 | 主动告知 |
| PR 创建 | 旧青年 | 通知 PR 链接 |
| Review 完成 | 旧青年 | 通知结果 |
| 等待人工 Review | 旧青年 | 提醒，附 PR 链接 |
| Phase 完成 | 旧青年 | 汇总报告 |
| 需要 API 信息 | 旧青年 | 暂停询问 |

---

## 状态追踪

### docs/agent-status.json
```json
{
  "agents": [
    {
      "id": "phase2a-db-api",
      "tmuxSession": "claude-phase2a",
      "worktree": "/home/bowie/projects/openclaw-chat-phase2a",
      "branch": "feat/phase2a-db-api",
      "status": "running",  // running | completed | failed | reviewing
      "prNumber": null,
      "startedAt": "2026-03-18T13:56:00+08:00",
      "retries": 0
    }
  ],
  "lastChecked": "2026-03-18T14:06:00+08:00"
}
```

### 监控 Cron Job
```
名称: openclaw-chat-agent-monitor
频率: 每 10 分钟
检查:
  1. 扫描 agent-status.json 中所有 agent
  2. 对每个 running agent:
     a. tmux has-session → 如果 false，标记 failed
     b. gh pr list --head {branch} → 如果有 PR，标记 reviewing
     c. git log --oneline -5 → 检查是否有新提交
  3. 对 failed agent:
     a. 检查 retries < 3
     b. 如果是，用改进 prompt 重启
     c. 如果不是，通知旧青年
  4. 更新 agent-status.json
  5. 如果有需要通知的事件，发送给旧青年
```

---

## 风险与应对

| 风险 | 应对 |
|------|------|
| Codex 在 tmux 中卡住 | cron 监控检测，kill 并重试 |
| Claude Code 在 tmux 中卡住 | cron 监控检测，kill 并重试 |
| worktree 冲突 | 每个任务独立分支，不共享 worktree |
| Codex 上下文丢失 | prompt 自包含，不依赖会话历史 |
| build 失败 | Ralph Loop 带错误信息重试 |
| WSL 环境兼容 | tmux + git worktree 在 WSL2 正常工作 |
| 没有 Claude Code/Gemini Reviewer | 先用 Codex reviewer，后续可扩展 |
