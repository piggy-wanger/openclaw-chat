import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, cleanup, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

// Mock useSettings at top level
vi.mock("../useSettings", () => ({
  useSettings: () => ({
    settings: {
      gatewayUrl: "ws://localhost:8080",
      gatewayToken: "test-token",
    },
  }),
}));

// Use vi.hoisted to create mock functions before vi.mock is hoisted
const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  isConnected: vi.fn(() => true),
  getConnectionState: vi.fn(() => "connected"),
  on: vi.fn(() => vi.fn()),
  off: vi.fn(),
  chatSend: vi.fn(),
  chatAbort: vi.fn(),
  chatHistory: vi.fn(),
}));

vi.mock("@/lib/gateway", () => ({
  gateway: mocks,
}));

// Import after mocks
import { ChatProvider, useChat } from "../useChat";
import { GatewayProvider } from "../useGateway";

function TestComponent() {
  const chat = useChat();
  return (
    <div>
      <span data-testid="loading">{String(chat.loading)}</span>
      <span data-testid="isStreaming">{String(chat.isStreaming)}</span>
      <span data-testid="streamContent">{chat.streamContent}</span>
      <span data-testid="error">{chat.error || ""}</span>
      <span data-testid="messagesCount">{chat.messages.length}</span>
      <span data-testid="toolCallsCount">{chat.toolCalls.length}</span>
      <button
        data-testid="sendMessage"
        onClick={() => chat.sendMessage("Hello, world!")}
      >
        Send Message
      </button>
      <button data-testid="abortStream" onClick={() => chat.abortStream()}>
        Abort Stream
      </button>
      <button data-testid="fetchMessages" onClick={() => chat.fetchMessages()}>
        Fetch Messages
      </button>
    </div>
  );
}

function renderWithProviders(ui: ReactNode, sessionId: string | null = "test-session") {
  return render(
    <GatewayProvider>
      <ChatProvider sessionId={sessionId}>{ui}</ChatProvider>
    </GatewayProvider>
  );
}

describe("useChat", () => {
  let mockHandlers: Record<string, (...args: unknown[]) => void> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mockHandlers = {};

    // Setup on handler to capture event handlers
    mocks.on.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      mockHandlers[event] = handler;
      return () => {
        delete mockHandlers[event];
      };
    });

    // Default mock return values
    mocks.isConnected.mockReturnValue(true);
    mocks.chatSend.mockResolvedValue({ runId: "run-123", status: "running" });
    mocks.chatAbort.mockResolvedValue(undefined);
    mocks.chatHistory.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  // Helper to simulate gateway connection
  async function simulateConnectedGateway() {
    // Trigger hello event to set connected state in GatewayProvider
    act(() => {
      mockHandlers.hello?.({ serverVersion: "1.0.0", protocolVersion: 3 });
    });
  }

  describe("context error handling", () => {
    it("should throw error when used outside ChatProvider", () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(() =>
        render(
          <GatewayProvider>
            <TestComponent />
          </GatewayProvider>
        )
      ).toThrow("useChat must be used within a ChatProvider");

      consoleError.mockRestore();
    });
  });

  describe("sendMessage", () => {
    it("should call chatSend with correct parameters", async () => {
      renderWithProviders(<TestComponent />);
      await simulateConnectedGateway();

      act(() => {
        screen.getByTestId("sendMessage").click();
      });

      await waitFor(() => {
        expect(mocks.chatSend).toHaveBeenCalledWith({
          sessionKey: "test-session",
          message: "Hello, world!",
        });
      });
    });

    it("should set isStreaming to true when sending", async () => {
      renderWithProviders(<TestComponent />);
      await simulateConnectedGateway();

      act(() => {
        screen.getByTestId("sendMessage").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("isStreaming").textContent).toBe("true");
      });
    });

    it("should not send empty message", async () => {
      function EmptyMessageComponent() {
        const chat = useChat();
        return (
          <button
            data-testid="sendEmpty"
            onClick={() => chat.sendMessage("   ")}
          >
            Send Empty
          </button>
        );
      }

      renderWithProviders(<EmptyMessageComponent />);
      await simulateConnectedGateway();

      act(() => {
        screen.getByTestId("sendEmpty").click();
      });

      expect(mocks.chatSend).not.toHaveBeenCalled();
    });

    it("should set error on send failure", async () => {
      mocks.chatSend.mockRejectedValue(new Error("Send failed"));

      renderWithProviders(<TestComponent />);
      await simulateConnectedGateway();

      act(() => {
        screen.getByTestId("sendMessage").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("error").textContent).toBe("Send failed");
      });
    });
  });

  describe("abortStream", () => {
    it("should call chatAbort with correct parameters", async () => {
      renderWithProviders(<TestComponent />);
      await simulateConnectedGateway();

      // Start streaming first
      act(() => {
        screen.getByTestId("sendMessage").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("isStreaming").textContent).toBe("true");
      });

      // Abort
      act(() => {
        screen.getByTestId("abortStream").click();
      });

      await waitFor(() => {
        expect(mocks.chatAbort).toHaveBeenCalledWith({
          sessionKey: "test-session",
          runId: "run-123",
        });
      });
    });

    it("should reset streaming state after abort", async () => {
      renderWithProviders(<TestComponent />);
      await simulateConnectedGateway();

      // Start streaming
      act(() => {
        screen.getByTestId("sendMessage").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("isStreaming").textContent).toBe("true");
      });

      // Abort
      act(() => {
        screen.getByTestId("abortStream").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("isStreaming").textContent).toBe("false");
        expect(screen.getByTestId("streamContent").textContent).toBe("");
      });
    });
  });

  describe("chat events", () => {
    it("should handle delta event and append content", async () => {
      renderWithProviders(<TestComponent />);
      await simulateConnectedGateway();

      // Simulate delta event
      act(() => {
        mockHandlers.chat?.({
          sessionKey: "test-session",
          runId: "run-123",
          state: "delta",
          message: "Hello",
        });
      });

      expect(screen.getByTestId("streamContent").textContent).toBe("Hello");

      // Another delta
      act(() => {
        mockHandlers.chat?.({
          sessionKey: "test-session",
          runId: "run-123",
          state: "delta",
          message: " there",
        });
      });

      expect(screen.getByTestId("streamContent").textContent).toBe("Hello there");
    });

    it("should ignore events for different session", async () => {
      renderWithProviders(<TestComponent />);
      await simulateConnectedGateway();

      act(() => {
        mockHandlers.chat?.({
          sessionKey: "other-session",
          runId: "run-123",
          state: "delta",
          message: "Hello",
        });
      });

      expect(screen.getByTestId("streamContent").textContent).toBe("");
    });

    it("should handle final event", async () => {
      mocks.chatHistory.mockResolvedValue([]);

      renderWithProviders(<TestComponent />);
      await simulateConnectedGateway();

      // Start streaming
      act(() => {
        screen.getByTestId("sendMessage").click();
      });

      // Simulate final event
      act(() => {
        mockHandlers.chat?.({
          sessionKey: "test-session",
          runId: "run-123",
          state: "final",
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId("isStreaming").textContent).toBe("false");
        expect(screen.getByTestId("streamContent").textContent).toBe("");
      });
    });

    it("should handle error event", async () => {
      renderWithProviders(<TestComponent />);
      await simulateConnectedGateway();

      // Start streaming
      act(() => {
        screen.getByTestId("sendMessage").click();
      });

      // Simulate error event
      act(() => {
        mockHandlers.chat?.({
          sessionKey: "test-session",
          runId: "run-123",
          state: "error",
          errorMessage: "Something went wrong",
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId("error").textContent).toBe("Something went wrong");
        expect(screen.getByTestId("isStreaming").textContent).toBe("false");
      });
    });
  });

  describe("tool call events", () => {
    it("should handle tool event and create tool call", async () => {
      renderWithProviders(<TestComponent />);
      await simulateConnectedGateway();

      // Start streaming to set runId
      act(() => {
        screen.getByTestId("sendMessage").click();
      });

      // Simulate tool event
      act(() => {
        mockHandlers.agent?.({
          runId: "run-123",
          stream: "tool",
          data: {
            toolCallId: "tool-1",
            name: "read_file",
            args: { path: "/test.txt" },
            phase: "running",
          },
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId("toolCallsCount").textContent).toBe("1");
      });
    });

    it("should ignore tool events for different run", async () => {
      renderWithProviders(<TestComponent />);
      await simulateConnectedGateway();

      // Start streaming with run-123
      act(() => {
        screen.getByTestId("sendMessage").click();
      });

      // Event for different run - but without a current runId set,
      // the filter won't work. Let's wait for streaming to be true first
      await waitFor(() => {
        expect(screen.getByTestId("isStreaming").textContent).toBe("true");
      });

      // Now currentRunIdRef should be set to "run-123"
      // Event for run-456 should be ignored
      act(() => {
        mockHandlers.agent?.({
          runId: "run-456",
          stream: "tool",
          data: {
            toolCallId: "tool-1",
            name: "read_file",
            phase: "running",
          },
        });
      });

      // Should not add tool call since runId doesn't match
      expect(screen.getByTestId("toolCallsCount").textContent).toBe("0");
    });
  });

  describe("fetchMessages", () => {
    it("should fetch and set messages", async () => {
      mocks.chatHistory.mockResolvedValue([
        { id: "msg-1", role: "user", content: "Hello", createdAt: 1000 },
        { id: "msg-2", role: "assistant", content: "Hi!", createdAt: 2000 },
      ]);

      renderWithProviders(<TestComponent />);
      await simulateConnectedGateway();

      act(() => {
        screen.getByTestId("fetchMessages").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("messagesCount").textContent).toBe("2");
        expect(screen.getByTestId("loading").textContent).toBe("false");
      });
    });

    it("should not fetch when not connected", async () => {
      // Don't call simulateConnectedGateway() - leave gateway disconnected
      renderWithProviders(<TestComponent />);

      act(() => {
        screen.getByTestId("fetchMessages").click();
      });

      // Should clear messages and not call API
      expect(mocks.chatHistory).not.toHaveBeenCalled();
    });
  });
});
