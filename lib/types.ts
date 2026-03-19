// Type definitions for OpenClaw Chat API

export type Session = {
  id: string;
  title: string;
  type: string;
  model: string;
  createdAt: number;
  updatedAt: number;
};

export type Message = {
  id: string;
  sessionId: string;
  role: string;
  content: string | ContentBlock[];
  createdAt: number;
};

export type Setting = {
  key: string;
  value: string;
  updatedAt: number;
};

// API Response Types
export type SessionsListResponse = {
  sessions: Session[];
};

export type SessionResponse = {
  session: Session;
};

export type SessionWithMessagesResponse = {
  session: Session;
  messages: Message[];
};

export type ChatRequest = {
  sessionId: string;
  content: string;
  role?: "user";
};

export type ChatResponse = {
  userMessage: Message;
  assistantMessage: Message;
};

export type SettingsResponse = {
  settings: Record<string, string>;
};

export type SettingsRequest = {
  settings: Record<string, string>;
};

export type CreateSessionRequest = {
  title?: string;
  type?: "direct" | "group";
  model?: string;
};

export type UpdateSessionRequest = {
  title?: string;
  model?: string;
};

export type ErrorResponse = {
  error: string;
  status: number;
};

// Tool Call Types
export type ToolCallStatus = "running" | "success" | "error";

export type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status: ToolCallStatus;
  result?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
};

// Extended Message type with tool calls
export type MessageWithToolCalls = Message & {
  toolCalls?: ToolCall[];
};

// Content Block Types for parsing message content arrays
export type TextContentBlock = {
  type: "text";
  text: string;
};

export type ThinkingContentBlock = {
  type: "thinking";
  thinking: string;
};

export type ToolUseContentBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
};

export type ToolResultContentBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  name?: string;
  isError?: boolean;
};

export type ToolCallContentBlock = {
  type: "tool_call";
  id: string;
  function: {
    name: string;
    arguments: string;
  };
};

export type ContentBlock =
  | TextContentBlock
  | ThinkingContentBlock
  | ToolUseContentBlock
  | ToolResultContentBlock
  | ToolCallContentBlock;

// Parsed tool block for display (combines tool_use with matching tool_result)
export type ParsedToolBlock = {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
};
