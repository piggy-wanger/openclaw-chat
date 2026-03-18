"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { gateway, type ConnectionState } from "@/lib/gateway";
import { useSettings } from "./useSettings";

// 扩展连接状态，添加 error 状态
export type GatewayStatus = ConnectionState | "error";

// Gateway Hello 信息
export type GatewayHello = {
  serverVersion: string;
  protocolVersion: number;
  capabilities?: string[];
};

// Context 类型
type GatewayContextType = {
  client: typeof gateway;
  status: GatewayStatus;
  hello: GatewayHello | null;
  error: string | null;
  connect: (url?: string, token?: string) => Promise<void>;
  disconnect: () => void;
  isConnected: boolean;
};

// Context
const GatewayContext = createContext<GatewayContextType | null>(null);

// Provider
export function GatewayProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const [status, setStatus] = useState<GatewayStatus>("disconnected");
  const [hello, setHello] = useState<GatewayHello | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 连接到 Gateway
  const connect = useCallback(async (urlOverride?: string, tokenOverride?: string) => {
    // 使用传入的参数或 settings 中的值
    const url = urlOverride ?? settings.gatewayUrl;
    const token = tokenOverride ?? settings.gatewayToken;

    if (!url) {
      setError("Gateway URL is not configured");
      setStatus("error");
      return;
    }

    // 如果已连接或正在连接，先断开
    if (gateway.isConnected() || gateway.getConnectionState() === "connecting") {
      gateway.disconnect();
    }

    setError(null);
    setStatus("connecting");

    try {
      await gateway.connect({
        url,
        token: token || undefined,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to connect to Gateway";
      setError(message);
      setStatus("error");
      throw err;
    }
  }, [settings.gatewayUrl, settings.gatewayToken]);

  // 断开连接
  const disconnect = useCallback(() => {
    gateway.disconnect();
    setStatus("disconnected");
    setHello(null);
    setError(null);
  }, []);

  // 设置事件监听
  useEffect(() => {
    const handleHello = (data: GatewayHello) => {
      setHello(data);
      setStatus("connected");
      setError(null);
    };

    const handleDisconnect = (reason?: string) => {
      setStatus("disconnected");
      setHello(null);
      if (reason) {
        setError(`Disconnected: ${reason}`);
      }
    };

    const handleReconnect = () => {
      // 重连成功时，hello 事件会更新状态
    };

    const handleError = (err: Error) => {
      setError(err.message);
      setStatus("error");
    };

    // 注册事件监听
    gateway.on("hello", handleHello);
    gateway.on("disconnect", handleDisconnect);
    gateway.on("reconnect", handleReconnect);
    gateway.on("error", handleError);

    // 清理
    return () => {
      gateway.off("hello", handleHello);
      gateway.off("disconnect", handleDisconnect);
      gateway.off("reconnect", handleReconnect);
      gateway.off("error", handleError);
    };
  }, []);

  // 不自动连接，用户需手动点击"测试连接"

  // 组件卸载时断开连接
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const isConnected = status === "connected";

  return (
    <GatewayContext.Provider
      value={{
        client: gateway,
        status,
        hello,
        error,
        connect,
        disconnect,
        isConnected,
      }}
    >
      {children}
    </GatewayContext.Provider>
  );
}

// Hook
export function useGateway() {
  const context = useContext(GatewayContext);
  if (!context) {
    throw new Error("useGateway must be used within a GatewayProvider");
  }
  return context;
}
