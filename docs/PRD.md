# OpenClaw Chat - Product Requirements Document

## Overview

OpenClaw Chat is a modern chat frontend that connects directly to OpenClaw Gateway via WebSocket. It provides a clean, intuitive interface for AI-powered conversations with streaming responses, tool-call visualization, and Markdown rendering.

## Architecture

- **Frontend**: Next.js static build, runs in the browser
- **Communication**: WebSocket 直连 OpenClaw Gateway (Protocol v3)
- **Data Source**: Gateway 管理所有 Session 和 Message
- **Local Storage**: Settings、drafts、UI preferences

## Target Users

- Users of OpenClaw who want a modern web-based chat UI
- Users managing multiple AI chat sessions via Gateway

## Core Features

### 1. Session Management

- **Session Types**
  - 主会话（Gateway main session）
  - Direct chats
  - Group chats

- **Session Operations**
  - 从 Gateway 加载会话列表（`sessions.list`）
  - 新建会话（首条消息自动创建）
  - 重命名会话（`sessions.patch`）
  - 删除/重置会话（`sessions.reset`）

- **Draft Sessions**
  - New sessions start as drafts
  - Drafts persist in localStorage
  - Drafts upgrade to real sessions on first successful message send

### 2. Messaging

- **Message Types**
  - User messages
  - Assistant responses（流式 streaming）
  - System messages
  - Tool call cards（实时可视化）

- **Message Features**
  - Streaming tool-call card visualization（start → update → result）
  - Code block syntax highlighting + copy button
  - Markdown rendering（GFM tables, links etc）
  - Message timestamps

### 3. Model Selection

- Session-level model switching only
- Available models configured via backend
- Model selection persisted per session

### 4. Settings Management

- Gateway 连接配置（URL + Token）
- 连接测试
- UI preferences（localStorage）

## Non-Functional Requirements

### Performance

- Fast initial load (< 3s on broadband)
- Smooth message streaming
- Responsive UI during operations

### Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Desktop and tablet layouts
- No mobile-first requirement for Phase 1

### Deployment

- 静态构建（`npm run build`），可托管在任何静态服务器
- 或通过 Gateway 提供静态文件服务
- 无需 Node.js 运行时（纯静态）

## Out of Scope (Phase 1)

- Authentication/authorization
- Real-time collaboration features
- File upload/attachment
- Voice/video integration
- Mobile-specific layouts

## Success Metrics

- Successful project bootstrap and documentation
- Functional scaffold with all dependencies
- Clear technical design for implementation phases
