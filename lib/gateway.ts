// Gateway WebSocket Client 单例导出

import { GatewayClient } from "./gateway-client";

/**
 * 全局 Gateway 客户端实例（单例模式）
 * 整个应用共享同一个 WebSocket 连接
 */
export const gateway = new GatewayClient();

// 重新导出类型
export type {
  ChatSendOpts,
  ChatSendResult,
  ChatAbortOpts,
  ChatHistoryOpts,
  SessionsListOpts,
  SessionEntry,
  SessionsPatchOpts,
  ChatEvent,
  ChatEventState,
  AgentEvent,
  AgentEventStream,
  AgentEventData,
  GatewayConnectionConfig,
  GatewayHello,
  ConnectionState,
  GatewayEventMap,
} from "./gateway-types";

export { GatewayClient } from "./gateway-client";
