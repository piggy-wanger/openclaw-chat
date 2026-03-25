import { NextResponse } from "next/server";
import { db, messages } from "@/db";
import type { ErrorResponse } from "@/lib/types";

export const runtime = "nodejs";

type SyncMessageInput = {
  id: string;
  role: string;
  content: string;
  toolCalls?: string;
  runId?: string;
  createdAt: number;
};

type SyncRequest = {
  sessionId: string;
  messages: SyncMessageInput[];
};

type SyncResponse = {
  success: boolean;
  count: number;
};

// POST /api/messages/sync - Batch upsert messages from Gateway
export async function POST(
  req: Request
): Promise<NextResponse<SyncResponse | ErrorResponse>> {
  try {
    const body = (await req.json()) as SyncRequest;

    if (!body.sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    const sessionId = body.sessionId;
    const messageList = body.messages;

    // Batch insert with INSERT OR IGNORE
    for (const msg of messageList) {
      if (!msg.id) continue;

      db.insert(messages)
        .values({
          id: msg.id,
          sessionId,
          role: msg.role || "user",
          content: msg.content || "",
          toolCalls: msg.toolCalls || null,
          runId: msg.runId || null,
          createdAt: msg.createdAt || Date.now(),
        })
        .onConflictDoNothing()
        .run();
    }

    return NextResponse.json({ success: true, count: messageList.length });
  } catch (error) {
    console.error("[messages/sync] Error:", error);
    return NextResponse.json({ error: "Failed to sync messages" }, { status: 500 });
  }
}
