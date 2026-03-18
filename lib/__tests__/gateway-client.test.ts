import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GatewayClient } from "../gateway-client";
import type { GatewayHello, RpcResponse, EventMessage } from "../gateway-types";

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  static instances: MockWebSocket[] = [];
  static lastInstance: MockWebSocket | null = null;

  url: string;
  readyState: number = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    MockWebSocket.lastInstance = this;
  }

  send = vi.fn();
  close = vi.fn();

  // Simulate server messages
  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event("open"));
  }

  simulateMessage(data: unknown): void {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }

  simulateClose(code = 1000, reason = ""): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason } as CloseEvent);
  }

  simulateError(): void {
    this.onerror?.(new Event("error"));
  }
}

describe("GatewayClient", () => {
  let client: GatewayClient;

  beforeEach(() => {
    // Stub WebSocket globally
    vi.stubGlobal("WebSocket", MockWebSocket);

    client = new GatewayClient();
    MockWebSocket.instances = [];
    MockWebSocket.lastInstance = null;
    vi.useFakeTimers();
  });

  afterEach(() => {
    client.disconnect();
    vi.useRealTimers();
    vi.clearAllMocks();

    // Unstub globals to restore original WebSocket
    vi.unstubAllGlobals();
  });

  describe("connect/disconnect", () => {
    it("should create WebSocket connection on connect", async () => {
      const connectPromise = client.connect({ url: "ws://localhost:8080" });

      expect(MockWebSocket.lastInstance).not.toBeNull();
      expect(MockWebSocket.lastInstance?.url).toContain("ws://localhost:8080");
      expect(client.getConnectionState()).toBe("connecting");

      // Simulate hello message to complete connection
      const hello: GatewayHello = {
        serverVersion: "1.0.0",
        protocolVersion: 3,
      };
      MockWebSocket.lastInstance?.simulateOpen();
      MockWebSocket.lastInstance?.simulateMessage(hello);

      await connectPromise;
      expect(client.isConnected()).toBe(true);
    });

    it("should disconnect properly", async () => {
      const connectPromise = client.connect({ url: "ws://localhost:8080" });
      const hello: GatewayHello = {
        serverVersion: "1.0.0",
        protocolVersion: 3,
      };
      MockWebSocket.lastInstance?.simulateOpen();
      MockWebSocket.lastInstance?.simulateMessage(hello);
      await connectPromise;

      client.disconnect();

      expect(MockWebSocket.lastInstance?.close).toHaveBeenCalled();
      expect(client.isConnected()).toBe(false);
      expect(client.getConnectionState()).toBe("disconnected");
    });

    it("should return existing promise if already connecting", async () => {
      const promise1 = client.connect({ url: "ws://localhost:8080" });
      const promise2 = client.connect({ url: "ws://localhost:8080" });

      expect(promise1).toBe(promise2);
    });

    it("should include query params in URL", async () => {
      client.connect({ url: "ws://localhost:8080", token: "test-token" });

      const url = MockWebSocket.lastInstance?.url;
      expect(url).toContain("clientName=openclaw-chat");
      expect(url).toContain("token=test-token");
      expect(url).toContain("minProtocol=3");
      expect(url).toContain("maxProtocol=3");
    });
  });

  describe("RPC request/response", () => {
    beforeEach(async () => {
      const connectPromise = client.connect({ url: "ws://localhost:8080" });
      const hello: GatewayHello = {
        serverVersion: "1.0.0",
        protocolVersion: 3,
      };
      MockWebSocket.lastInstance?.simulateOpen();
      MockWebSocket.lastInstance?.simulateMessage(hello);
      await connectPromise;
    });

    it("should send RPC request and handle success response", async () => {
      const sendPromise = client.chatSend({
        sessionKey: "test-session",
        message: "Hello",
      });

      // Verify request was sent
      expect(MockWebSocket.lastInstance?.send).toHaveBeenCalledWith(
        expect.stringContaining('"method":"chat.send"')
      );

      // Extract seq from the sent message
      const sentData = JSON.parse(
        (MockWebSocket.lastInstance?.send as ReturnType<typeof vi.fn>).mock.calls[0][0]
      );

      // Simulate response
      const response: RpcResponse = {
        seq: sentData.seq,
        result: { runId: "run-123", status: "running" },
      };
      MockWebSocket.lastInstance?.simulateMessage(response);

      const result = await sendPromise;
      expect(result).toEqual({ runId: "run-123", status: "running" });
    });

    it("should handle RPC error response", async () => {
      const sendPromise = client.chatSend({
        sessionKey: "test-session",
        message: "Hello",
      });

      const sentData = JSON.parse(
        (MockWebSocket.lastInstance?.send as ReturnType<typeof vi.fn>).mock.calls[0][0]
      );

      const response: RpcResponse = {
        seq: sentData.seq,
        error: { code: -1, message: "Test error" },
      };
      MockWebSocket.lastInstance?.simulateMessage(response);

      await expect(sendPromise).rejects.toThrow("Test error");
    });

    it("should reject request when not connected", async () => {
      client.disconnect();

      await expect(
        client.chatSend({ sessionKey: "test", message: "test" })
      ).rejects.toThrow("Not connected");
    });
  });

  describe("reconnection", () => {
    it("should attempt reconnection on unexpected disconnect", async () => {
      const connectPromise = client.connect({ url: "ws://localhost:8080" });
      const hello: GatewayHello = {
        serverVersion: "1.0.0",
        protocolVersion: 3,
      };
      MockWebSocket.lastInstance?.simulateOpen();
      MockWebSocket.lastInstance?.simulateMessage(hello);
      await connectPromise;

      // Simulate unexpected close
      MockWebSocket.lastInstance?.simulateClose(1006, "Connection lost");

      // Should schedule reconnect
      vi.advanceTimersByTime(1000);

      // New WebSocket should be created
      expect(MockWebSocket.instances.length).toBe(2);
    });

    it("should not reconnect after intentional disconnect", async () => {
      const connectPromise = client.connect({ url: "ws://localhost:8080" });
      const hello: GatewayHello = {
        serverVersion: "1.0.0",
        protocolVersion: 3,
      };
      MockWebSocket.lastInstance?.simulateOpen();
      MockWebSocket.lastInstance?.simulateMessage(hello);
      await connectPromise;

      client.disconnect();

      // Advance timers
      vi.advanceTimersByTime(5000);

      // No new WebSocket should be created
      expect(MockWebSocket.instances.length).toBe(1);
    });

    it("should use exponential backoff for reconnection", async () => {
      const connectPromise = client.connect({ url: "ws://localhost:8080" });
      const hello: GatewayHello = {
        serverVersion: "1.0.0",
        protocolVersion: 3,
      };
      MockWebSocket.lastInstance?.simulateOpen();
      MockWebSocket.lastInstance?.simulateMessage(hello);
      await connectPromise;

      // Simulate disconnect
      MockWebSocket.lastInstance?.simulateClose(1006, "Connection lost");

      // First reconnect should be after 1 second
      vi.advanceTimersByTime(999);
      expect(MockWebSocket.instances.length).toBe(1);

      vi.advanceTimersByTime(1);
      expect(MockWebSocket.instances.length).toBe(2);

      // Simulate another disconnect
      MockWebSocket.lastInstance?.simulateClose(1006, "Connection lost");

      // Second reconnect should be after 2 seconds
      vi.advanceTimersByTime(1999);
      expect(MockWebSocket.instances.length).toBe(2);

      vi.advanceTimersByTime(1);
      expect(MockWebSocket.instances.length).toBe(3);
    });
  });

  describe("event subscription", () => {
    beforeEach(async () => {
      const connectPromise = client.connect({ url: "ws://localhost:8080" });
      const hello: GatewayHello = {
        serverVersion: "1.0.0",
        protocolVersion: 3,
      };
      MockWebSocket.lastInstance?.simulateOpen();
      MockWebSocket.lastInstance?.simulateMessage(hello);
      await connectPromise;
    });

    it("should emit chat events", () => {
      const chatHandler = vi.fn();
      client.on("chat", chatHandler);

      const event: EventMessage = {
        event: "chat",
        payload: {
          sessionKey: "test",
          runId: "run-1",
          state: "delta",
          message: "Hello",
        },
      };
      MockWebSocket.lastInstance?.simulateMessage(event);

      expect(chatHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionKey: "test",
          runId: "run-1",
          state: "delta",
        })
      );
    });

    it("should emit agent events", () => {
      const agentHandler = vi.fn();
      client.on("agent", agentHandler);

      const event: EventMessage = {
        event: "agent",
        payload: {
          runId: "run-1",
          stream: "tool",
          data: { name: "test-tool" },
        },
      };
      MockWebSocket.lastInstance?.simulateMessage(event);

      expect(agentHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: "run-1",
          stream: "tool",
        })
      );
    });

    it("should unsubscribe with returned function", () => {
      const chatHandler = vi.fn();
      const unsubscribe = client.on("chat", chatHandler);

      unsubscribe();

      const event: EventMessage = {
        event: "chat",
        payload: {
          sessionKey: "test",
          runId: "run-1",
          state: "delta",
        },
      };
      MockWebSocket.lastInstance?.simulateMessage(event);

      expect(chatHandler).not.toHaveBeenCalled();
    });

    it("should emit disconnect event", () => {
      const disconnectHandler = vi.fn();
      client.on("disconnect", disconnectHandler);

      MockWebSocket.lastInstance?.simulateClose(1000, "Normal closure");

      expect(disconnectHandler).toHaveBeenCalled();
    });

    it("should emit hello event", async () => {
      // Disconnect and reconnect to test hello event
      client.disconnect();

      const helloHandler = vi.fn();
      const newClient = new GatewayClient();
      newClient.on("hello", helloHandler);

      const connectPromise = newClient.connect({ url: "ws://localhost:8080" });
      const hello: GatewayHello = {
        serverVersion: "1.0.0",
        protocolVersion: 3,
      };
      MockWebSocket.lastInstance?.simulateOpen();
      MockWebSocket.lastInstance?.simulateMessage(hello);
      await connectPromise;

      expect(helloHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          serverVersion: "1.0.0",
          protocolVersion: 3,
        })
      );

      newClient.disconnect();
    });

    it("should emit error event on WebSocket error", () => {
      const errorHandler = vi.fn();
      client.on("error", errorHandler);

      MockWebSocket.lastInstance?.simulateError();

      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
