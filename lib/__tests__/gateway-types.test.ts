import { describe, it, expect } from "vitest";
import type {
  ChatEvent,
  AgentEvent,
  ChatEventState,
  AgentEventStream,
  GatewayHello,
  RpcRequest,
  RpcResponse,
  EventMessage,
  SessionEntry,
  GatewayConnectionConfig,
  ConnectionState,
} from "../gateway-types";

describe("Gateway Types", () => {
  describe("ChatEvent", () => {
    it("should have correct structure for delta state", () => {
      const event: ChatEvent = {
        sessionKey: "session-1",
        runId: "run-1",
        state: "delta",
        message: "Hello world",
      };

      expect(event.sessionKey).toBe("session-1");
      expect(event.state).toBe("delta");
      expect(event.message).toBe("Hello world");
    });

    it("should have correct structure for error state", () => {
      const event: ChatEvent = {
        sessionKey: "session-1",
        runId: "run-1",
        state: "error",
        errorMessage: "Something went wrong",
      };

      expect(event.state).toBe("error");
      expect(event.errorMessage).toBe("Something went wrong");
    });

    it("should accept all valid ChatEventState values", () => {
      const states: ChatEventState[] = ["delta", "final", "aborted", "error"];

      states.forEach((state) => {
        const event: ChatEvent = {
          sessionKey: "session-1",
          runId: "run-1",
          state,
        };
        expect(event.state).toBe(state);
      });
    });
  });

  describe("AgentEvent", () => {
    it("should have correct structure for tool event", () => {
      const event: AgentEvent = {
        runId: "run-1",
        sessionKey: "session-1",
        stream: "tool",
        data: {
          name: "test-tool",
          args: { input: "test" },
          result: "success",
        },
      };

      expect(event.stream).toBe("tool");
      expect(event.data?.name).toBe("test-tool");
    });

    it("should accept all valid AgentEventStream values", () => {
      const streams: AgentEventStream[] = [
        "tool",
        "lifecycle",
        "assistant",
        "compaction",
      ];

      streams.forEach((stream) => {
        const event: AgentEvent = {
          runId: "run-1",
          stream,
        };
        expect(event.stream).toBe(stream);
      });
    });
  });

  describe("GatewayHello", () => {
    it("should have correct structure", () => {
      const hello: GatewayHello = {
        serverVersion: "1.0.0",
        protocolVersion: 3,
        capabilities: ["TOOL_EVENTS"],
      };

      expect(hello.serverVersion).toBe("1.0.0");
      expect(hello.protocolVersion).toBe(3);
      expect(hello.capabilities).toContain("TOOL_EVENTS");
    });
  });

  describe("RpcRequest", () => {
    it("should have correct structure", () => {
      const request: RpcRequest = {
        seq: 1,
        method: "chat.send",
        params: { sessionKey: "test", message: "Hello" },
      };

      expect(request.seq).toBe(1);
      expect(request.method).toBe("chat.send");
      expect(request.params).toHaveProperty("sessionKey");
    });
  });

  describe("RpcResponse", () => {
    it("should have correct structure for success", () => {
      const response: RpcResponse = {
        seq: 1,
        result: { runId: "run-1", status: "running" },
      };

      expect(response.seq).toBe(1);
      expect(response.result).toBeDefined();
    });

    it("should have correct structure for error", () => {
      const response: RpcResponse = {
        seq: 1,
        error: { code: -1, message: "Error" },
      };

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-1);
    });
  });

  describe("EventMessage", () => {
    it("should have correct structure for chat event", () => {
      const message: EventMessage = {
        event: "chat",
        payload: {
          sessionKey: "session-1",
          runId: "run-1",
          state: "delta",
        },
      };

      expect(message.event).toBe("chat");
    });

    it("should have correct structure for agent event", () => {
      const message: EventMessage = {
        event: "agent",
        payload: {
          runId: "run-1",
          stream: "tool",
        },
      };

      expect(message.event).toBe("agent");
    });
  });

  describe("SessionEntry", () => {
    it("should have correct structure", () => {
      const session: SessionEntry = {
        key: "session-key",
        sessionId: "session-1",
        title: "Test Session",
        model: "claude-3",
        updatedAt: Date.now(),
        origin: "user",
      };

      expect(session.key).toBe("session-key");
      expect(session.title).toBe("Test Session");
    });
  });

  describe("GatewayConnectionConfig", () => {
    it("should have correct structure", () => {
      const config: GatewayConnectionConfig = {
        url: "ws://localhost:8080",
        token: "test-token",
        password: "test-password",
      };

      expect(config.url).toBe("ws://localhost:8080");
      expect(config.token).toBe("test-token");
    });
  });

  describe("ConnectionState", () => {
    it("should accept all valid states", () => {
      const states: ConnectionState[] = [
        "disconnected",
        "connecting",
        "connected",
      ];

      states.forEach((state) => {
        const connectionState: ConnectionState = state;
        expect(connectionState).toBe(state);
      });
    });
  });
});
