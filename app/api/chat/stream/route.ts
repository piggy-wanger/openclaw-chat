import { NextResponse } from "next/server";
import { db, messages, sessions } from "@/db";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { ChatRequest, ErrorResponse } from "@/lib/types";

// POST /api/chat/stream - Send a message (streaming mock)
export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as ChatRequest;

    // Validate request
    if (!body.sessionId || !body.content) {
      return NextResponse.json(
        { error: "sessionId and content are required", status: 400 },
        { status: 400 }
      );
    }

    // Check if session exists
    const sessionExists = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, body.sessionId))
      .limit(1);

    if (sessionExists.length === 0) {
      return NextResponse.json(
        { error: "Session not found", status: 404 },
        { status: 404 }
      );
    }

    const now = Date.now();

    // Create and save user message
    const userMessage = {
      id: nanoid(),
      sessionId: body.sessionId,
      role: "user",
      content: body.content,
      createdAt: now,
    };

    await db.insert(messages).values(userMessage);

    // Update session's updatedAt
    await db
      .update(sessions)
      .set({ updatedAt: now })
      .where(eq(sessions.id, body.sessionId));

    // Mock assistant response
    const mockResponse = "这是模拟回复。Phase 4 将接入真实 OpenClaw 后端。";

    // Create a ReadableStream for SSE
    const encoder = new TextEncoder();
    let fullContent = "";

    const stream = new ReadableStream({
      async start(controller) {
        // Stream each character
        for (let i = 0; i < mockResponse.length; i++) {
          const char = mockResponse[i];
          fullContent += char;

          // SSE format: data: {"content": "..."}\n\n
          const data = JSON.stringify({ content: char });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));

          // Small delay to simulate streaming
          await new Promise((resolve) => setTimeout(resolve, 50));
        }

        // Save assistant message after streaming completes
        const assistantMessage = {
          id: nanoid(),
          sessionId: body.sessionId,
          role: "assistant",
          content: fullContent,
          createdAt: Date.now(),
        };

        await db.insert(messages).values(assistantMessage);

        // Update session's updatedAt again
        await db
          .update(sessions)
          .set({ updatedAt: Date.now() })
          .where(eq(sessions.id, body.sessionId));

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error in chat stream:", error);
    return NextResponse.json(
      { error: "Failed to process chat stream", status: 500 },
      { status: 500 }
    );
  }
}
