import { NextResponse } from "next/server";
import { db, messages } from "@/db";
import { asc, eq } from "drizzle-orm";
import type { ErrorResponse } from "@/lib/types";

export const runtime = "nodejs";

type MessageRow = {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  toolCalls: string | null;
  runId: string | null;
  createdAt: number;
};

type MessagesListResponse = {
  messages: MessageRow[];
};

type PostMessageBody = {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  toolCalls?: string;
  runId?: string;
  createdAt: number;
};

// GET /api/messages?sessionId=xxx - Read messages from SQLite
export async function GET(
  request: Request
): Promise<NextResponse<MessagesListResponse | ErrorResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(asc(messages.createdAt));

    return NextResponse.json({ messages: rows });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

// POST /api/messages - Insert a single message
export async function POST(
  request: Request
): Promise<NextResponse<{ success: boolean } | ErrorResponse>> {
  try {
    const body = (await request.json()) as PostMessageBody;

    if (!body.id || !body.sessionId || !body.role || !body.content) {
      return NextResponse.json({ error: "id, sessionId, role, content are required" }, { status: 400 });
    }

    await db
      .insert(messages)
      .values({
        id: body.id,
        sessionId: body.sessionId,
        role: body.role,
        content: body.content,
        toolCalls: body.toolCalls || null,
        runId: body.runId || null,
        createdAt: body.createdAt,
      })
      .onConflictDoNothing();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error creating message:", error);
    return NextResponse.json({ error: "Failed to create message" }, { status: 500 });
  }
}
