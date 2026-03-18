# OpenClaw Chat - Technical Design Document

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js Application                     │
├─────────────────────────────────────────────────────────────┤
│  Pages/App Router    │  Components    │  Hooks/Utils        │
│  - / (chat)          │  - ChatUI      │  - useChat          │
│  - /settings         │  - Sidebar     │  - useSession       │
│  - /sessions/[id]    │  - MessageList │  - useSettings      │
│                      │  - InputArea   │                     │
├─────────────────────────────────────────────────────────────┤
│  State Management (Zustand/React Context)                   │
│  - Session state                                             │
│  - Message cache                                             │
│  - UI state                                                  │
├─────────────────────────────────────────────────────────────┤
│  Data Layer                                                  │
│  - Drizzle ORM                                               │
│  - SQLite Database                                           │
│  - API Routes                                                │
├─────────────────────────────────────────────────────────────┤
│  External Services                                           │
│  - OpenClaw Backend API                                      │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend Framework

- **Next.js 16** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type safety

### Styling

- **Tailwind CSS 4** - Utility-first CSS
- **shadcn/ui** - Component library
- **Lucide React** - Icons

### Data Layer

- **Drizzle ORM** - Type-safe ORM
- **better-sqlite3** - SQLite driver
- **SQLite** - Database

### State Management

- React Context for simple state
- Custom hooks for business logic
- localStorage for draft persistence

## Database Schema

### Sessions Table

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'direct',  -- 'direct' | 'group'
  model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### Messages Table

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,  -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

### Settings Table

```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
```

## API Design

### Internal API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sessions` | GET | List all sessions |
| `/api/sessions` | POST | Create new session |
| `/api/sessions/[id]` | GET | Get session with messages |
| `/api/sessions/[id]` | PATCH | Update session |
| `/api/sessions/[id]` | DELETE | Delete session |
| `/api/chat` | POST | Send message (streaming) |
| `/api/settings` | GET | Get all settings |
| `/api/settings` | PUT | Update settings |

### OpenClaw Backend Integration

- Streaming responses via Server-Sent Events or chunked responses
- Tool-call data formatting and display
- Error handling and retry logic

## Component Structure

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   ├── sessions/
│   │   └── [id]/
│   │       └── page.tsx
│   ├── settings/
│   │   └── page.tsx
│   └── api/
│       ├── sessions/
│       │   └── route.ts
│       ├── chat/
│       │   └── route.ts
│       └── settings/
│           └── route.ts
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── chat/
│   │   ├── ChatContainer.tsx
│   │   ├── MessageList.tsx
│   │   ├── MessageItem.tsx
│   │   ├── ToolCallCard.tsx
│   │   └── InputArea.tsx
│   ├── sidebar/
│   │   ├── Sidebar.tsx
│   │   ├── SessionList.tsx
│   │   └── SessionItem.tsx
│   └── settings/
│       └── SettingsForm.tsx
├── hooks/
│   ├── useChat.ts
│   ├── useSession.ts
│   └── useSettings.ts
├── lib/
│   ├── utils.ts
│   ├── api.ts
│   └── storage.ts
└── db/
    ├── index.ts
    └── schema.ts
```

## Key Implementation Details

### Draft Session Flow

1. User creates new session -> stored in localStorage as draft
2. User types message -> persists to localStorage
3. User sends message -> API call to OpenClaw
4. On success -> migrate draft to database session
5. Clear localStorage draft

### Settings Backup

Before any settings write:
1. Read current settings
2. Write to backup file (`.settings-backup.json`)
3. Proceed with settings update
4. On failure, restore from backup

### Streaming Tool Calls

Tool-call cards render progressively as:
1. Tool name appears immediately
2. Arguments stream in real-time
3. Result appears when complete
4. Visual state transitions (pending → running → complete)

## Deployment

### Build

```bash
npm run build
```

### Production Start

```bash
npm run start
```

### Environment Variables

```
OPENCLAW_API_URL=your_backend_url
OPENCLAW_API_KEY=your_api_key
```

## Security Considerations

- API keys stored server-side only
- Input sanitization for user messages
- SQL injection prevention via Drizzle ORM
- XSS prevention via React's default escaping
