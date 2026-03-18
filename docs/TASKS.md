# OpenClaw Chat - Tasks Breakdown

## Phase 1: Bootstrap ✅ (PR #1)

- [x] Initialize Next.js project
- [x] Configure TypeScript
- [x] Set up Tailwind CSS
- [x] Install shadcn/ui
- [x] Configure Drizzle ORM + SQLite
- [x] Create documentation (PRD, Tech Design, Tasks)
- [x] Verify build and lint

## Phase 2: Core Infrastructure ✅ (PR #2, #3, #4)

### Database Setup ✅ (PR #2)
- [x] Create database migrations
- [x] Implement database initialization (via db:push)
- [x] Add seed data for testing (optional)

### API Routes ✅ (PR #3)
- [x] Implement `/api/sessions` CRUD
- [x] Implement `/api/chat` endpoint
- [x] Implement `/api/chat/stream` streaming endpoint
- [x] Implement `/api/settings` endpoints
- [x] Add error handling (basic)

### State Management ✅ (PR #4)
- [x] Create session store (useSession hook)
- [x] Create message store (useChat hook)
- [x] Create settings store (useSettings hook)
- [x] Implement localStorage draft persistence

## Phase 3: UI Components ✅ (PR #5, #6, #7)

### Layout ✅ (PR #5)
- [x] Create main layout with sidebar
- [x] Session list component
- [x] Session item with actions (rename, delete)
- [x] New session button
- [x] Chat header with agent/session/model info
- [x] Settings page scaffold
- [x] Implement responsive sidebar toggle
- [x] Add loading states

### Chat Area ✅ (PR #6)
- [x] Message list component (auto-scroll, user scroll detection)
- [x] Message item component
- [x] Input area with send button
- [x] Markdown rendering
- [x] Code block syntax highlighting + copy button
- [x] Streaming cursor animation

### Tool Call Cards ✅ (PR #7)
- [x] Tool call card component (collapsible, status icons)
- [x] Streaming state visualization (spinner, success/error)
- [x] Result display (formatted params + markdown result)
- [x] Collapsible accessibility (aria-controls, id)

## Phase 4: Gateway Integration

### Gateway Client ✅
- [x] WebSocket 连接管理（connect/disconnect/reconnect）
- [x] Protocol v3 握手（auth token, clientName, caps）
- [x] RPC 方法封装（chat.send, chat.abort, chat.history, sessions.list, sessions.patch, sessions.reset）
- [x] 事件订阅系统（chat delta/final/error, agent tool/lifecycle）
- [x] 类型定义（gateway-types.ts）

### Hooks 重构
- [ ] useGateway: WebSocket 连接生命周期
- [ ] useSession: 对接 sessions.list/sessions.patch
- [ ] useChat: 对接 chat.send + chat 事件流
- [ ] useSettings: Gateway URL + Token 存取
- [ ] 移除对 HTTP API routes 的依赖

### Chat Flow 对接
- [ ] Session 列表从 Gateway 加载
- [ ] 消息从 Gateway 加载（chat.history）
- [ ] 流式回复实时渲染（chat delta 事件）
- [ ] 工具调用可视化（agent tool 事件）
- [ ] Settings 页：Gateway URL + Token + 连接测试
- [ ] 错误处理 + 断线重连

## Phase 5: Settings & Polish

### Settings Page
- [ ] Settings form UI
- [ ] Model preferences
- [ ] API configuration
- [ ] Backup before save logic (file-based)

### UX Improvements
- [ ] Keyboard shortcuts
- [ ] Session search/filter
- [ ] Loading indicators (basic)
- [ ] Error toasts

## Phase 6: Testing & Documentation

### Testing
- [ ] Unit tests for utilities
- [ ] Component tests
- [ ] Integration tests for API routes
- [ ] E2E tests for critical flows

### Documentation
- [ ] API documentation
- [ ] Component storybook
- [ ] Deployment guide
- [ ] User guide

---

## Priority Order

1. ~~**Phase 1** - Bootstrap~~ ✅
2. ~~**Phase 2** - Core Infrastructure~~ ✅
3. ~~**Phase 3** - UI Components~~ ✅
4. **Phase 4** - OpenClaw Integration (required for value) ⬅️ NEXT
5. **Phase 5** - Settings & Polish (enhances experience)
6. **Phase 6** - Testing & Documentation (quality assurance)

## Dependencies

- Phase 1 → Phase 2 (scaffold needed first)
- Phase 2 → Phase 3 (API routes needed for UI)
- Phase 3 → Phase 4 (UI needed for integration)
- Phase 4 → Phase 5 (Integration needed for settings)

## Estimated Effort

| Phase | Complexity | Notes |
|-------|------------|-------|
| Phase 1 | Low | Scaffold only |
| Phase 2 | Medium | Core data layer + Single Chat MVP |
| Phase 3 | Medium-High | UI complexity |
| Phase 4 | High | External integration |
| Phase 5 | Medium | Polish features |
| Phase 6 | Medium | Quality assurance |
