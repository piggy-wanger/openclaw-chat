// Gateway WebSocket Client for OpenClaw Gateway Protocol v3

import type {
  AgentEvent,
  ChatAbortOpts,
  ChatEvent,
  ChatHistoryOpts,
  ChatSendOpts,
  ChatSendResult,
  ConnectionState,
  GatewayConnectionConfig,
  GatewayEventMap,
  GatewayHello,
  RpcRequest,
  RpcResponse,
  SessionEntry,
  SessionsListOpts,
  SessionsPatchOpts,
  EventMessage,
} from "./gateway-types";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

const DEFAULT_URL = "ws://127.0.0.1:18789";
const CLIENT_NAME = "openclaw-chat";
const CLIENT_VERSION = "0.1.0";
const MAX_RECONNECT_ATTEMPTS = 10;
const MAX_RECONNECT_DELAY = 30000;
const BASE_RECONNECT_DELAY = 1000;
const CONNECT_TIMEOUT = 10000;

export class GatewayClient {
  private ws: WebSocket | null = null;
  private config: GatewayConnectionConfig | null = null;
  private requestId = 0;
  private pendingRequests: Map<number, PendingRequest> = new Map();
  private listeners: Partial<GatewayEventMap> = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = MAX_RECONNECT_ATTEMPTS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectionState: ConnectionState = "disconnected";
  private readyResolve: (() => void) | null = null;
  private readyReject: ((error: Error) => void) | null = null;
  private readyPromise: Promise<void> = Promise.resolve();
  private intentionalDisconnect = false;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;

  // ==================== 连接管理 ====================

  /**
   * 连接到 Gateway
   */
  connect(config: GatewayConnectionConfig): Promise<void> {
    if (this.connectionState === "connected" || this.connectionState === "connecting") {
      return this.readyPromise;
    }

    this.config = config;
    this.intentionalDisconnect = false;
    this.connectionState = "connecting";
    this.readyPromise = new Promise((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });

    // 连接超时
    this.connectTimer = setTimeout(() => {
      if (this.connectionState === "connecting") {
        this.readyReject?.(new Error("Connection timed out"));
        this.readyReject = null;
        this.readyResolve = null;
        this.ws?.close();
        this.connectionState = "disconnected";
      }
    }, CONNECT_TIMEOUT);

    this.createWebSocket();

    return this.readyPromise;
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.intentionalDisconnect = true;
    this.cleanup();

    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }

    this.connectionState = "disconnected";
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }

    // 拒绝所有待处理的请求
    for (const [seq, { reject }] of this.pendingRequests) {
      reject(new Error("Connection closed"));
      this.pendingRequests.delete(seq);
    }
  }

  /**
   * 创建 WebSocket 连接
   */
  private createWebSocket(): void {
    if (!this.config) return;

    const url = this.buildWebSocketUrl(this.config);

    try {
      this.ws = new WebSocket(url);
      this.ws.onopen = this.onOpen.bind(this);
      this.ws.onmessage = this.onMessage.bind(this);
      this.ws.onclose = this.onClose.bind(this);
      this.ws.onerror = this.onError.bind(this);
    } catch (error) {
      this.emit("error", error instanceof Error ? error : new Error(String(error)));
      this.scheduleReconnect();
    }
  }

  /**
   * 构建 WebSocket URL
   */
  private buildWebSocketUrl(config: GatewayConnectionConfig): string {
    const url = new URL(config.url || DEFAULT_URL);

    // 添加查询参数
    url.searchParams.set("clientName", CLIENT_NAME);
    url.searchParams.set("clientVersion", CLIENT_VERSION);
    url.searchParams.set("platform", "browser");
    url.searchParams.set("caps", "TOOL_EVENTS");
    url.searchParams.set("minProtocol", "3");
    url.searchParams.set("maxProtocol", "3");

    if (config.token) {
      url.searchParams.set("token", config.token);
    }

    return url.toString();
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(): void {
    if (this.intentionalDisconnect) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit("error", new Error("Max reconnect attempts reached"));
      return;
    }

    const delay = this.getReconnectDelay();
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnect();
    }, delay);
  }

  /**
   * 执行重连
   */
  private reconnect(): void {
    if (this.intentionalDisconnect) return;

    this.connectionState = "connecting";
    this.createWebSocket();
  }

  /**
   * 获取重连延迟（指数退避）
   */
  private getReconnectDelay(): number {
    const delay = BASE_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts);
    return Math.min(delay, MAX_RECONNECT_DELAY);
  }

  // ==================== WebSocket 生命周期 ====================

  private onOpen(): void {
    // WebSocket 已打开，等待 hello 消息
  }

  private onMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);

      // 处理 hello 消息
      if (data.serverVersion !== undefined) {
        this.handleHello(data as GatewayHello);
        return;
      }

      // 处理 RPC 响应
      if (data.seq !== undefined) {
        this.handleRpcResponse(data as RpcResponse);
        return;
      }

      // 处理事件
      if (data.event !== undefined) {
        this.handleEvent(data as EventMessage);
        return;
      }
    } catch (error) {
      console.error("Failed to parse message:", error);
    }
  }

  private onClose(event: CloseEvent): void {
    const wasConnected = this.connectionState === "connected";
    this.connectionState = "disconnected";
    this.ws = null;

    // 清理所有待处理的请求，避免内存泄漏
    this.cleanup();

    if (wasConnected) {
      this.emit("disconnect", event.reason || `Code: ${event.code}`);
    }

    if (!this.intentionalDisconnect) {
      this.scheduleReconnect();
    }
  }

  private onError(_event: Event): void {
    void _event; // Explicitly ignore unused parameter
    this.emit("error", new Error("WebSocket error"));
  }

  // ==================== 消息处理 ====================

  private handleHello(hello: GatewayHello): void {
    const wasReconnecting = this.reconnectAttempts > 0;
    this.connectionState = "connected";
    this.reconnectAttempts = 0;

    this.emit("hello", hello);

    // 如果是重连成功，emit reconnect 事件
    if (wasReconnecting) {
      this.emit("reconnect");
    }

    if (this.readyResolve) {
      this.readyResolve();
      this.readyResolve = null;
      this.readyReject = null;
    }
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
  }

  private handleRpcResponse(response: RpcResponse): void {
    const pending = this.pendingRequests.get(response.seq);
    if (!pending) return;

    this.pendingRequests.delete(response.seq);

    if (response.error) {
      pending.reject(new Error(response.error.message));
    } else {
      pending.resolve(response.result);
    }
  }

  private handleEvent(message: EventMessage): void {
    if (message.event === "chat") {
      this.emit("chat", message.payload as ChatEvent);
    } else if (message.event === "agent") {
      this.emit("agent", message.payload as AgentEvent);
    }
  }

  // ==================== RPC 方法 ====================

  /**
   * 发送 RPC 请求
   */
  private request<T = unknown>(method: string, params: Record<string, unknown>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.connectionState !== "connected") {
        reject(new Error("Not connected"));
        return;
      }

      const seq = ++this.requestId;
      const rpcRequest: RpcRequest = { seq, method, params };

      this.pendingRequests.set(seq, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });

      try {
        this.ws.send(JSON.stringify(rpcRequest));
      } catch (error) {
        this.pendingRequests.delete(seq);
        reject(error);
      }
    });
  }

  /**
   * 发送聊天消息
   */
  chatSend(opts: ChatSendOpts): Promise<ChatSendResult> {
    return this.request<ChatSendResult>("chat.send", opts as Record<string, unknown>);
  }

  /**
   * 中止聊天
   */
  chatAbort(opts: ChatAbortOpts): Promise<void> {
    return this.request("chat.abort", opts as Record<string, unknown>);
  }

  /**
   * 获取聊天历史
   */
  chatHistory(opts: ChatHistoryOpts): Promise<unknown[]> {
    return this.request("chat.history", opts as Record<string, unknown>);
  }

  /**
   * 获取会话列表
   */
  sessionsList(opts?: SessionsListOpts): Promise<SessionEntry[]> {
    return this.request<SessionEntry[]>("sessions.list", opts || {});
  }

  /**
   * 更新会话
   */
  sessionsPatch(opts: SessionsPatchOpts): Promise<void> {
    return this.request("sessions.patch", opts as Record<string, unknown>);
  }

  /**
   * 重置会话
   */
  sessionsReset(key: string, reason?: string): Promise<void> {
    return this.request("sessions.reset", { key, reason });
  }

  // ==================== 事件订阅 ====================

  /**
   * 订阅事件
   * @returns 取消订阅函数
   */
  on<K extends keyof GatewayEventMap>(
    event: K,
    handler: GatewayEventMap[K]
  ): () => void {
    this.listeners[event] = handler as (GatewayEventMap[K] & undefined);
    return () => this.off(event, handler);
  }

  /**
   * 取消订阅事件
   */
  off<K extends keyof GatewayEventMap>(
    event: K,
    handler: GatewayEventMap[K]
  ): void {
    if (this.listeners[event] === handler) {
      delete this.listeners[event];
    }
  }

  /**
   * 触发事件
   */
  private emit<K extends keyof GatewayEventMap>(
    event: K,
    ...args: Parameters<GatewayEventMap[K]>
  ): void {
    const handler = this.listeners[event];
    if (handler) {
      (handler as (...args: Parameters<GatewayEventMap[K]>) => void)(...args);
    }
  }

  // ==================== 状态查询 ====================

  /**
   * 是否已连接
   */
  isConnected(): boolean {
    return this.connectionState === "connected";
  }

  /**
   * 获取连接状态
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }
}
