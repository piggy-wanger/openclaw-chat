import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { SettingsProvider, useSettings, type FontSize } from "../useSettings";
import type { ReactNode } from "react";

// Helper component to test the hook
function TestComponent({
  onSettings,
}: {
  onSettings?: (settings: ReturnType<typeof useSettings>) => void;
}) {
  const settings = useSettings();
  onSettings?.(settings);
  return (
    <div>
      <span data-testid="gatewayUrl">{settings.settings.gatewayUrl}</span>
      <span data-testid="gatewayToken">{settings.settings.gatewayToken}</span>
      <span data-testid="theme">{settings.settings.theme}</span>
      <span data-testid="sidebarCollapsed">
        {String(settings.settings.sidebarCollapsed)}
      </span>
      <span data-testid="messageFontSize">
        {settings.settings.messageFontSize}
      </span>
      <span data-testid="codeFontSize">{settings.settings.codeFontSize}</span>
      <button
        data-testid="setGatewayUrl"
        onClick={() => settings.setSettings({ gatewayUrl: "ws://new-url" })}
      >
        Set Gateway URL
      </button>
      <button
        data-testid="setGatewayToken"
        onClick={() => settings.setSettings({ gatewayToken: "new-token" })}
      >
        Set Gateway Token
      </button>
      <button
        data-testid="setTheme"
        onClick={() => settings.setSettings({ theme: "light" })}
      >
        Set Theme
      </button>
      <button
        data-testid="setSidebarCollapsed"
        onClick={() => settings.setSettings({ sidebarCollapsed: true })}
      >
        Set Sidebar Collapsed
      </button>
      <button
        data-testid="setMessageFontSize"
        onClick={() => settings.setSettings({ messageFontSize: "large" })}
      >
        Set Message Font Size
      </button>
      <button
        data-testid="setCodeFontSize"
        onClick={() => settings.setSettings({ codeFontSize: "small" })}
      >
        Set Code Font Size
      </button>
      <button data-testid="reset" onClick={() => settings.resetSettings()}>
        Reset
      </button>
    </div>
  );
}

function renderWithProvider(ui: ReactNode) {
  return render(<SettingsProvider>{ui}</SettingsProvider>);
}

describe("useSettings", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  describe("gatewayUrl/gatewayToken read/write", () => {
    it("should return default values when localStorage is empty", () => {
      renderWithProvider(<TestComponent />);

      expect(screen.getByTestId("gatewayUrl").textContent).toBe(
        "ws://127.0.0.1:18789"
      );
      expect(screen.getByTestId("gatewayToken").textContent).toBe("");
    });

    it("should read values from localStorage", () => {
      localStorage.setItem("openclaw_gateway_url", "ws://custom-url:9000");
      localStorage.setItem("openclaw_gateway_token", "existing-token");

      renderWithProvider(<TestComponent />);

      expect(screen.getByTestId("gatewayUrl").textContent).toBe(
        "ws://custom-url:9000"
      );
      expect(screen.getByTestId("gatewayToken").textContent).toBe(
        "existing-token"
      );
    });

    it("should update gatewayUrl and persist to localStorage", () => {
      renderWithProvider(<TestComponent />);

      act(() => {
        screen.getByTestId("setGatewayUrl").click();
      });

      expect(screen.getByTestId("gatewayUrl").textContent).toBe("ws://new-url");
      expect(localStorage.getItem("openclaw_gateway_url")).toBe("ws://new-url");
    });

    it("should update gatewayToken and persist to localStorage", () => {
      renderWithProvider(<TestComponent />);

      act(() => {
        screen.getByTestId("setGatewayToken").click();
      });

      expect(screen.getByTestId("gatewayToken").textContent).toBe("new-token");
      expect(localStorage.getItem("openclaw_gateway_token")).toBe("new-token");
    });
  });

  describe("UI preferences", () => {
    it("should update theme", () => {
      renderWithProvider(<TestComponent />);

      act(() => {
        screen.getByTestId("setTheme").click();
      });

      expect(screen.getByTestId("theme").textContent).toBe("light");
      expect(localStorage.getItem("openclaw_theme")).toBe("light");
    });

    it("should update sidebarCollapsed", () => {
      renderWithProvider(<TestComponent />);

      act(() => {
        screen.getByTestId("setSidebarCollapsed").click();
      });

      expect(screen.getByTestId("sidebarCollapsed").textContent).toBe("true");
      expect(localStorage.getItem("openclaw_sidebar_collapsed")).toBe("true");
    });
  });

  describe("FontSize runtime validation", () => {
    it("should use valid FontSize from localStorage", () => {
      localStorage.setItem("openclaw_message_font_size", "large");
      localStorage.setItem("openclaw_code_font_size", "small");

      renderWithProvider(<TestComponent />);

      expect(screen.getByTestId("messageFontSize").textContent).toBe("large");
      expect(screen.getByTestId("codeFontSize").textContent).toBe("small");
    });

    it("should fall back to default for invalid FontSize", () => {
      localStorage.setItem("openclaw_message_font_size", "invalid");
      localStorage.setItem("openclaw_code_font_size", "also-invalid");

      renderWithProvider(<TestComponent />);

      // Should fall back to "medium" (default)
      expect(screen.getByTestId("messageFontSize").textContent).toBe("medium");
      expect(screen.getByTestId("codeFontSize").textContent).toBe("medium");
    });

    it("should update messageFontSize", () => {
      renderWithProvider(<TestComponent />);

      act(() => {
        screen.getByTestId("setMessageFontSize").click();
      });

      expect(screen.getByTestId("messageFontSize").textContent).toBe("large");
      expect(localStorage.getItem("openclaw_message_font_size")).toBe("large");
    });

    it("should update codeFontSize", () => {
      renderWithProvider(<TestComponent />);

      act(() => {
        screen.getByTestId("setCodeFontSize").click();
      });

      expect(screen.getByTestId("codeFontSize").textContent).toBe("small");
      expect(localStorage.getItem("openclaw_code_font_size")).toBe("small");
    });

    it("should accept all valid FontSize values", () => {
      const validSizes: FontSize[] = ["small", "medium", "large"];

      for (const size of validSizes) {
        localStorage.clear();
        localStorage.setItem("openclaw_message_font_size", size);

        renderWithProvider(<TestComponent />);
        expect(screen.getByTestId("messageFontSize").textContent).toBe(size);

        // Clean up after each iteration
        cleanup();
      }
    });
  });

  describe("resetSettings", () => {
    it("should reset all settings to defaults", () => {
      // Set some custom values
      localStorage.setItem("openclaw_gateway_url", "ws://custom");
      localStorage.setItem("openclaw_gateway_token", "token");
      localStorage.setItem("openclaw_theme", "light");
      localStorage.setItem("openclaw_sidebar_collapsed", "true");
      localStorage.setItem("openclaw_message_font_size", "large");
      localStorage.setItem("openclaw_code_font_size", "small");

      renderWithProvider(<TestComponent />);

      act(() => {
        screen.getByTestId("reset").click();
      });

      expect(screen.getByTestId("gatewayUrl").textContent).toBe(
        "ws://127.0.0.1:18789"
      );
      expect(screen.getByTestId("gatewayToken").textContent).toBe("");
      expect(screen.getByTestId("theme").textContent).toBe("dark");
      expect(screen.getByTestId("sidebarCollapsed").textContent).toBe("false");
      expect(screen.getByTestId("messageFontSize").textContent).toBe("medium");
      expect(screen.getByTestId("codeFontSize").textContent).toBe("medium");
    });
  });

  describe("context error handling", () => {
    it("should throw error when used outside provider", () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(() => render(<TestComponent />)).toThrow(
        "useSettings must be used within a SettingsProvider"
      );

      consoleError.mockRestore();
    });
  });
});
