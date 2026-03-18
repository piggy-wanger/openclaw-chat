# OpenClaw Chat - Product Requirements Document

## Overview

OpenClaw Chat is a modern chat frontend application designed to connect with OpenClaw backend services. It provides a clean, intuitive interface for AI-powered conversations with support for both direct chats and group chats.

## Target Users

- Users of OpenClaw backend services who need a web-based chat interface
- Teams collaborating through AI-assisted group conversations
- Individuals managing multiple AI chat sessions

## Core Features

### 1. Session Management

- **Session Types**
  - Direct chats (1:1 conversations with AI)
  - Group chats (multi-participant conversations, grouped under unified "群聊" section)

- **Session Operations**
  - Create new sessions
  - Rename sessions
  - Delete sessions
  - Archive sessions (future consideration)

- **Draft Sessions**
  - New sessions start as drafts
  - Drafts persist in localStorage
  - Drafts upgrade to real sessions on first successful message send

### 2. Messaging

- **Message Types**
  - User messages
  - Assistant responses (with streaming support)
  - System messages

- **Message Features**
  - Streaming tool-call card visualization
  - Code block syntax highlighting
  - Markdown rendering
  - Message timestamps

### 3. Model Selection

- Session-level model switching only
- Available models configured via backend
- Model selection persisted per session

### 4. Settings Management

- Application-level settings
- Backup created before each settings write
- Settings include:
  - Default model preference
  - UI preferences
  - API configuration

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

- Ordinary Node.js service deployment
- No Docker requirement
- SQLite for data persistence

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
