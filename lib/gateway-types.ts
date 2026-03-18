// Type definitions for OpenClaw Gateway WebSocket Protocol v3

// RPC 方法参数和返回值
export type ChatSendOpts = {
  sessionKey: string;
  message: string;
  thinking?: string;
  deliver?: boolean;
  timeoutMs?: number;
  idempotencyKey?: string;
};

export type ChatSendResult = {
  runId: string;
  status: string;
};

export type ChatAbortOpts = {
  sessionKey: string;
  runId?: string;
};

export type ChatHistoryOpts = {
  sessionKey: string;
  limit?: number;
};

export type SessionsListOpts = {
  limit?: number;
  activeMinutes?: number;
  includeGlobal?: boolean;
  includeUnknown?: boolean;
  includeDerivedTitles?: boolean;
  includeLastMessage?: boolean;
  agentId?: string;
};

export type SessionEntry = {
  key: string;
  sessionId: string;
  title?: string;
  model?: string;
  updatedAt?: number;
  origin?: string;
};

export type SessionsPatchOpts = {
  key: string;
  title?: string;
  archived?: boolean;
  pinned?: boolean;
};

// 事件类型
export type ChatEventState = "delta" | "final" | "aborted" | "error";

export type ChatEvent = {
  sessionKey: string;
  runId: string;
  state: ChatEventState;
  message?: string | object;
  errorMessage?: string;
};

export type AgentEventStream = "tool" | "lifecycle" | "assistant" | "compaction";

export type AgentEventData = {
  phase?: string;
  toolCallId?: string;
  name?: string;
  args?: Record<string, unknown>;
  partialResult?: unknown;
  result?: unknown;
  isError?: boolean;
};

export type AgentEvent = {
  runId: string;
  sessionKey?: string;
  stream: AgentEventStream;
  data?: AgentEventData;
};

// 连接配置
export type GatewayConnectionConfig = {
  url: string; // e.g. "ws://127.0.0.1:18789"
  token?: string;
  password?: string;
};

// Challenge 事件
export type ChallengeEvent = {
  nonce: string;
};

// Gateway Hello 消息（connect 响应的 payload）
export type GatewayHello = {
  serverVersion: string;
  protocolVersion: number;
  capabilities?: string[];
  auth?: {
    method: string;
    user?: {
      id: string;
      name?: string;
    };
  };
  snapshot?: unknown;
};

// RPC 请求格式
export type RpcRequest = {
  type: "req";
  id: string; // UUID
  method: string;
  params: Record<string, unknown>;
};

// RPC 响应格式
export type RpcResponse = {
  type: "res";
  id: string; // UUID
  ok: boolean;
  payload?: unknown;
  error?: {
    code: string;
    message: string;
    details?: object;
  };
};

// 事件消息格式
export type EventMessage = {
  type: "event";
  event: "chat" | "agent" | "connect.challenge";
  payload: ChatEvent | AgentEvent | ChallengeEvent;
  seq?: number;
};

// GatewayRequestError 类
export class GatewayRequestError extends Error {
  code: string;
  details?: object;

  constructor(code: string, message: string, details?: object) {
    super(message);
    this.name = "GatewayRequestError";
    this.code = code;
    this.details = details;
  }
}

// GatewayClient 事件回调
export type GatewayEventMap = {
  chat: (event: ChatEvent) => void;
  agent: (event: AgentEvent) => void;
  disconnect: (reason?: string) => void;
  reconnect: () => void;
  error: (error: Error) => void;
  hello: (hello: GatewayHello) => void;
};

// 连接状态
export type ConnectionState = "disconnected" | "connecting" | "connected";
