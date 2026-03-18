import { describe, it, expect } from "vitest";
import { cn } from "../utils";

describe("cn utility function", () => {
  it("should merge class names", () => {
    const result = cn("foo", "bar");
    expect(result).toBe("foo bar");
  });

  it("should handle conditional classes", () => {
    const result = cn("base", true && "included", false && "excluded");
    expect(result).toBe("base included");
  });

  it("should handle undefined and null values", () => {
    const result = cn("base", undefined, null, "end");
    expect(result).toBe("base end");
  });

  it("should merge tailwind classes correctly", () => {
    // tailwind-merge should handle conflicting classes
    const result = cn("p-4", "p-6");
    expect(result).toBe("p-6");
  });

  it("should handle array of classes", () => {
    const result = cn(["foo", "bar"], "baz");
    expect(result).toBe("foo bar baz");
  });

  it("should handle object syntax", () => {
    const result = cn({
      active: true,
      disabled: false,
      highlighted: true,
    });
    expect(result).toBe("active highlighted");
  });

  it("should handle complex combinations", () => {
    const isActive = true;
    const isDisabled = false;
    const size = "large";

    const result = cn(
      "btn",
      "btn-primary",
      isActive && "active",
      isDisabled && "disabled",
      size === "large" && "btn-lg",
      { "btn-block": true }
    );

    expect(result).toContain("btn");
    expect(result).toContain("btn-primary");
    expect(result).toContain("active");
    expect(result).toContain("btn-lg");
    expect(result).toContain("btn-block");
    expect(result).not.toContain("disabled");
  });

  it("should override conflicting tailwind utilities", () => {
    const result = cn("text-red-500", "text-blue-500");
    expect(result).toBe("text-blue-500");
  });

  it("should handle responsive prefixes", () => {
    const result = cn("sm:p-4", "md:p-6", "lg:p-8");
    expect(result).toBe("sm:p-4 md:p-6 lg:p-8");
  });

  it("should handle empty input", () => {
    const result = cn();
    expect(result).toBe("");
  });
});
