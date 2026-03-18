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
  GatewayModel,
  RpcRequest,
  RpcResponse,
  SessionEntry,
  SessionsListOpts,
  SessionsPatchOpts,
  EventMessage,
  ChallengeEvent,
} from "./gateway-types";
import { GatewayRequestError } from "./gateway-types";
import { getOrCreateIdentity, signChallenge, buildAuthString } from "./device-identity";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

const DEFAULT_URL = "ws://127.0.0.1:18789";
const CLIENT_ID = "openclaw-control-ui";
const CLIENT_VERSION = "0.1.0";
const BASE_RECONNECT_DELAY = 800;
const MAX_RECONNECT_DELAY = 15000;
const CONNECT_TIMEOUT = 10000;

export class GatewayClient {
  private ws: WebSocket | null = null;
  private config: GatewayConnectionConfig | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private listeners: Partial<GatewayEventMap> = {};
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectionState: ConnectionState = "disconnected";
  private readyResolve: (() => void) | null = null;
  private readyReject: ((error: Error) => void) | null = null;
  private readyPromise: Promise<void> = Promise.resolve();
  private intentionalDisconnect = false;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private challengeResolve: ((nonce: string) => void) | null = null;

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
    this.flushPendingRequests("Connection closed");
  }

  /**
   * 清空所有 pending requests
   */
  private flushPendingRequests(reason: string): void {
    for (const [id, { reject }] of this.pendingRequests) {
      reject(new Error(reason));
      this.pendingRequests.delete(id);
    }
  }

  /**
   * 创建 WebSocket 连接
   */
  private createWebSocket(): void {
    if (!this.config) return;

    // URL 不带任何 query params
    const url = this.config.url || DEFAULT_URL;

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
   * 安排重连
   */
  private scheduleReconnect(): void {
    if (this.intentionalDisconnect) return;

    // 清空 pending requests
    this.flushPendingRequests("Connection lost, reconnecting");

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
    // WebSocket 已打开，等待 connect.challenge 事件
  }

  private onMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);

      // 处理 connect.challenge 事件
      if (data.type === "event" && data.event === "connect.challenge") {
        this.handleChallenge(data.payload as ChallengeEvent);
        return;
      }

      // 处理 RPC 响应
      if (data.type === "res") {
        this.handleRpcResponse(data as RpcResponse);
        return;
      }

      // 处理事件
      if (data.type === "event") {
        this.handleEvent(data as EventMessage);
        return;
      }
    } catch (error) {
      console.error("Failed to parse message:", error);
    }
  }

  private onClose(event: CloseEvent): void {
    const wasConnected = this.connectionState === "connected";
    const wasConnecting = this.connectionState === "connecting";
    this.connectionState = "disconnected";
    this.ws = null;

    // 清理所有待处理的请求，避免内存泄漏
    this.cleanup();

    // 如果是连接过程中被关闭，reject readyPromise 避免永久挂起
    if (wasConnecting && this.readyReject) {
      this.readyReject(new Error(`Connection closed: ${event.reason || `Code: ${event.code}`}`));
      this.readyReject = null;
      this.readyResolve = null;
    }

    if (wasConnected) {
      this.emit("disconnect", event.reason || `Code: ${event.code}`);
    }

    // 认证失败（1008）或配置错误不自动重连
    if (!this.intentionalDisconnect && event.code !== 1008) {
      this.scheduleReconnect();
    }
  }

  private onError(_event: Event): void {
    void _event;
    this.emit("error", new Error("WebSocket error"));
  }

  // ==================== 握手协议 ====================

  private handleChallenge(challenge: ChallengeEvent): void {
    // 如果 challengeResolve 存在，说明已经在等待 challenge
    if (this.challengeResolve) {
      this.challengeResolve(challenge.nonce);
      this.challengeResolve = null;
      return;
    }

    // 否则发起 connect RPC 请求
    this.sendConnectRequest(challenge.nonce);
  }

  private async sendConnectRequest(nonce: string): Promise<void> {
    if (!this.config) return;

    // 构建 auth 对象（只在 token 或 password 有值时才包含）
    const auth: { token?: string; password?: string } = {};
    if (this.config.token) {
      auth.token = this.config.token;
    }
    if (this.config.password) {
      auth.password = this.config.password;
    }

    const clientMode = "webchat";
    const role = "operator";
    const scopes = ["operator.admin", "operator.read"];

    const connectParams: Record<string, unknown> = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: CLIENT_ID,
        version: CLIENT_VERSION,
        platform: "web",
        mode: clientMode,
      },
      role,
      scopes,
      caps: ["tool-events"],
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      locale: typeof navigator !== "undefined" ? navigator.language : "en",
    };

    // 只在 auth 有内容时才添加
    if (Object.keys(auth).length > 0) {
      connectParams.auth = auth;
    }

    // 添加设备身份（ed25519 签名）
    try {
      const identity = await getOrCreateIdentity();
      if (identity) {
        const signedAt = Date.now();
        const authString = buildAuthString({
          deviceId: identity.deviceId,
          clientId: CLIENT_ID,
          clientMode,
          role,
          scopes,
          signedAtMs: signedAt,
          token: this.config.token ?? null,
          nonce,
        });

        const signature = await signChallenge(identity.privateKey, identity.publicKey, authString);

        connectParams.device = {
          id: identity.deviceId,
          publicKey: identity.publicKey,
          signature,
          signedAt,
          nonce,
        };
      } else {
        console.warn("Device identity not available (ed25519 not supported)");
      }
    } catch (error) {
      console.error("Failed to create device identity:", error);
    }

    try {
      // 使用内部方法发送 connect 请求，不检查连接状态
      const hello = await this.sendConnectRpc(connectParams);
      this.handleHello(hello as GatewayHello);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.readyReject?.(err);
      this.readyReject = null;
      this.readyResolve = null;
      this.ws?.close();
    }
  }

  /**
   * 发送 connect RPC 请求（内部方法，不检查连接状态）
   */
  private sendConnectRpc(params: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.ws) {
        reject(new Error("WebSocket not connected"));
        return;
      }

      const id = crypto.randomUUID();
      const rpcRequest: RpcRequest = { type: "req", id, method: "connect", params };

      this.pendingRequests.set(id, {
        resolve,
        reject,
      });

      try {
        this.ws.send(JSON.stringify(rpcRequest));
      } catch (error) {
        this.pendingRequests.delete(id);
        reject(error);
      }
    });
  }

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

  // ==================== 消息处理 ====================

  private handleRpcResponse(response: RpcResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) return;

    this.pendingRequests.delete(response.id);

    if (!response.ok && response.error) {
      pending.reject(
        new GatewayRequestError(
          response.error.code,
          response.error.message,
          response.error.details
        )
      );
    } else {
      pending.resolve(response.payload);
    }
  }

  private handleEvent(message: EventMessage): void {
    if (message.event === "chat") {
      this.emit("chat", message.payload as ChatEvent);
    } else if (message.event === "agent") {
      this.emit("agent", message.payload as AgentEvent);
    }
    // connect.challenge 已在 onMessage 中单独处理
  }

  // ==================== RPC 方法 ====================

  /**
   * 发送 RPC 请求（公开方法）
   */
  request<T = unknown>(method: string, params: Record<string, unknown>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.connectionState !== "connected") {
        reject(new Error("Not connected"));
        return;
      }

      const id = crypto.randomUUID();
      const rpcRequest: RpcRequest = { type: "req", id, method, params };

      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });

      try {
        this.ws.send(JSON.stringify(rpcRequest));
      } catch (error) {
        this.pendingRequests.delete(id);
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
   * 获取可用模型列表
   */
  async modelsList(): Promise<GatewayModel[]> {
    const result = await this.request<{ models?: GatewayModel[] }>("models.list", {});
    return Array.isArray(result?.models) ? result.models : [];
  }

  /**
   * 获取会话列表
   */
  async sessionsList(opts?: SessionsListOpts): Promise<SessionEntry[]> {
    const result = await this.request<{ sessions?: SessionEntry[] }>("sessions.list", opts || {});
    return Array.isArray(result?.sessions) ? result.sessions : [];
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
