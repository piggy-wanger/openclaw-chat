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
  isConnected: vi.fn(() => false),
  getConnectionState: vi.fn(() => "disconnected"),
  on: vi.fn(() => vi.fn()),
  off: vi.fn(),
}));

vi.mock("@/lib/gateway", () => ({
  gateway: mocks,
}));

// Import after mocks
import { GatewayProvider, useGateway, type GatewayHello } from "../useGateway";

function TestComponent() {
  const gateway = useGateway();
  return (
    <div>
      <span data-testid="status">{gateway.status}</span>
      <span data-testid="isConnected">{String(gateway.isConnected)}</span>
      <span data-testid="error">{gateway.error || ""}</span>
      <span data-testid="hello">{JSON.stringify(gateway.hello)}</span>
      <button
        data-testid="connect"
        onClick={() => gateway.connect("ws://custom-url", "custom-token")}
      >
        Connect
      </button>
      <button data-testid="disconnect" onClick={() => gateway.disconnect()}>
        Disconnect
      </button>
    </div>
  );
}

function renderWithProvider(ui: ReactNode) {
  return render(<GatewayProvider>{ui}</GatewayProvider>);
}

describe("useGateway", () => {
  let mockHandlers: Record<string, (...args: unknown[]) => void> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mockHandlers = {};

    // Reset mock return values
    mocks.isConnected.mockReturnValue(false);
    mocks.getConnectionState.mockReturnValue("disconnected");

    // Setup on handler to capture event handlers
    mocks.on.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      mockHandlers[event] = handler;
      return () => mocks.off(event, handler);
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe("context error handling", () => {
    it("should throw error when used outside provider", () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(() => render(<TestComponent />)).toThrow(
        "useGateway must be used within a GatewayProvider"
      );

      consoleError.mockRestore();
    });
  });

  describe("connection lifecycle", () => {
    it("should provide initial disconnected state", () => {
      renderWithProvider(<TestComponent />);

      expect(screen.getByTestId("status").textContent).toBe("disconnected");
      expect(screen.getByTestId("isConnected").textContent).toBe("false");
    });

    it("should call gateway.connect with settings on mount", async () => {
      mocks.connect.mockResolvedValue(undefined);

      renderWithProvider(<TestComponent />);

      await waitFor(() => {
        expect(mocks.connect).toHaveBeenCalledWith({
          url: "ws://localhost:8080",
          token: "test-token",
        });
      });
    });

    it("should call disconnect and reset state", async () => {
      renderWithProvider(<TestComponent />);

      act(() => {
        screen.getByTestId("disconnect").click();
      });

      expect(mocks.disconnect).toHaveBeenCalled();
      expect(screen.getByTestId("status").textContent).toBe("disconnected");
      expect(screen.getByTestId("hello").textContent).toBe("null");
    });
  });

  describe("event subscription cleanup", () => {
    it("should register event listeners on mount", () => {
      renderWithProvider(<TestComponent />);

      expect(mocks.on).toHaveBeenCalledWith("hello", expect.any(Function));
      expect(mocks.on).toHaveBeenCalledWith("disconnect", expect.any(Function));
      expect(mocks.on).toHaveBeenCalledWith("reconnect", expect.any(Function));
      expect(mocks.on).toHaveBeenCalledWith("error", expect.any(Function));
    });

    it("should call off on unmount", () => {
      const { unmount } = renderWithProvider(<TestComponent />);

      unmount();

      expect(mocks.off).toHaveBeenCalled();
    });
  });

  describe("event handling", () => {
    it("should update status and hello on hello event", async () => {
      renderWithProvider(<TestComponent />);

      const helloData: GatewayHello = {
        serverVersion: "1.0.0",
        protocolVersion: 3,
        capabilities: ["tools"],
      };

      act(() => {
        mockHandlers.hello?.(helloData);
      });

      expect(screen.getByTestId("status").textContent).toBe("connected");
      expect(screen.getByTestId("isConnected").textContent).toBe("true");
      expect(JSON.parse(screen.getByTestId("hello").textContent || "{}")).toEqual(helloData);
    });

    it("should update status on disconnect event", async () => {
      renderWithProvider(<TestComponent />);

      // First set to connected
      act(() => {
        mockHandlers.hello?.({ serverVersion: "1.0.0", protocolVersion: 3 });
      });

      expect(screen.getByTestId("status").textContent).toBe("connected");

      // Then disconnect
      act(() => {
        mockHandlers.disconnect?.("Connection lost");
      });

      expect(screen.getByTestId("status").textContent).toBe("disconnected");
      expect(screen.getByTestId("hello").textContent).toBe("null");
      expect(screen.getByTestId("error").textContent).toBe("Disconnected: Connection lost");
    });

    it("should update status and error on error event", async () => {
      renderWithProvider(<TestComponent />);

      act(() => {
        mockHandlers.error?.(new Error("Connection failed"));
      });

      expect(screen.getByTestId("status").textContent).toBe("error");
      expect(screen.getByTestId("error").textContent).toBe("Connection failed");
    });
  });

  describe("unmount cleanup", () => {
    it("should disconnect on unmount", () => {
      const { unmount } = renderWithProvider(<TestComponent />);

      unmount();

      expect(mocks.disconnect).toHaveBeenCalled();
    });
  });
});
