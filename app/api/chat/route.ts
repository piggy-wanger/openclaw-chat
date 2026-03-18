import { NextResponse } from "next/server";
import { db, messages, sessions } from "@/db";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { ChatRequest, ChatResponse, ErrorResponse } from "@/lib/types";

// POST /api/chat - Send a message (non-streaming)
export async function POST(request: Request): Promise<NextResponse<ChatResponse | ErrorResponse>> {
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

    // Create user message
    const userMessage = {
      id: nanoid(),
      sessionId: body.sessionId,
      role: body.role || "user",
      content: body.content,
      createdAt: now,
    };

    // Create assistant message (mock)
    const assistantMessage = {
      id: nanoid(),
      sessionId: body.sessionId,
      role: "assistant",
      content: "这是模拟回复。Phase 4 将接入真实 OpenClaw 后端。",
      createdAt: now + 1, // Ensure it's after user message
    };

    // Save both messages
    await db.insert(messages).values(userMessage);
    await db.insert(messages).values(assistantMessage);

    // Update session's updatedAt
    await db
      .update(sessions)
      .set({ updatedAt: now })
      .where(eq(sessions.id, body.sessionId));

    return NextResponse.json({
      userMessage,
      assistantMessage,
    });
  } catch (error) {
    console.error("Error in chat:", error);
    return NextResponse.json(
      { error: "Failed to process chat message", status: 500 },
      { status: 500 }
    );
  }
}
