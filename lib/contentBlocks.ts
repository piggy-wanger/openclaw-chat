import type { ContentBlock, ParsedToolBlock } from "./types";

/**
 * Extract text content from a content array or string
 * Used for streaming and simple text extraction
 */
export function extractTextContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((block) => block?.type === "text" && typeof block?.text === "string")
      .map((block) => block.text)
      .join("\n");
  }
  return JSON.stringify(content);
}

/**
 * Parse raw content into typed ContentBlock array
 * Returns null if content is a string (legacy format)
 */
export function parseContentBlocks(content: unknown): ContentBlock[] | null {
  if (typeof content === "string") return null;
  if (!Array.isArray(content)) return null;
  if (content.length === 0) return null;

  // Check if it looks like content blocks
  const firstBlock = content[0];
  if (!firstBlock || typeof firstBlock !== "object") return null;

  // Validate and return as ContentBlock array
  return content.filter((block): block is ContentBlock => {
    if (!block || typeof block !== "object") return false;
    const type = (block as Record<string, unknown>).type;
    return typeof type === "string";
  });
}

/**
 * Check if content is in block array format
 */
export function isBlockContent(content: unknown): content is ContentBlock[] {
  return parseContentBlocks(content) !== null;
}

/**
 * Parse tool blocks from content array
 * Combines tool_use with matching tool_result into ParsedToolBlock
 */
export function parseToolBlocks(content: ContentBlock[]): ParsedToolBlock[] {
  const toolBlocks: ParsedToolBlock[] = [];

  for (const block of content) {
    if (block.type === "tool_use") {
      toolBlocks.push({ id: block.id, name: block.name, input: block.input });
    } else if (block.type === "tool_call") {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(block.function.arguments); } catch { args = { raw: block.function.arguments }; }
      toolBlocks.push({ id: block.id, name: block.function.name, input: args });
    } else if (block.type === "toolCall") {
      // OpenClaw 自定义格式（camelCase），arguments 已经是对象
      toolBlocks.push({ id: block.id, name: block.name, input: block.arguments ?? {} });
    }
  }

  // Second pass: match tool_result with tool_use
  for (const block of content) {
    if (block.type === "tool_result") {
      const matchingTool = toolBlocks.find((t) => t.id === block.tool_use_id);
      if (matchingTool) {
        matchingTool.result = typeof block.content === "string"
          ? block.content
          : JSON.stringify(block.content);
        if (block.isError) {
          matchingTool.isError = true;
        }
      } else {
        // Orphaned result - create standalone block if name is available
        if (block.name) {
          toolBlocks.push({
            id: block.tool_use_id,
            name: block.name,
            input: {},
            result: typeof block.content === "string"
              ? block.content
              : JSON.stringify(block.content),
            isError: block.isError,
          });
        }
      }
    }
  }

  return toolBlocks;
}

/**
 * Check if content has any tool blocks
 */
export function hasToolBlocks(content: ContentBlock[]): boolean {
  return content.some(
    (block) => block.type === "tool_use" || block.type === "tool_call" || block.type === "toolCall"
  );
}

/**
 * Get only text blocks from content
 */
export function getTextBlocks(content: ContentBlock[]): string[] {
  return content
    .filter((block): block is { type: "text"; text: string } => block.type === "text")
    .map((block) => block.text);
}

/**
 * Get combined text from content blocks
 */
export function getCombinedText(content: ContentBlock[]): string {
  return getTextBlocks(content).join("\n");
}
