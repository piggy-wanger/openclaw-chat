import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db, sessions } from "@/db";
import type { ErrorResponse } from "@/lib/types";

export const runtime = "nodejs";

type SessionRow = {
  id: string;
  displayName: string | null;
  readableKey: string | null;
  sessionName: string | null;
  agentId: string | null;
  type: "direct" | "group";
  createdAt: number;
  updatedAt: number;
};

type SessionsListResponse = {
  sessions: SessionRow[];
};

type CreateSessionBody = {
  id: string;
  displayName?: string;
  readableKey?: string;
  sessionName?: string;
  agentId?: string;
  type: "direct" | "group";
  model?: string;
};

// GET /api/sessions - Read sessions from SQLite
export async function GET(): Promise<NextResponse<SessionsListResponse | ErrorResponse>> {
  try {
    const rows = await db
      .select()
      .from(sessions)
      .orderBy(desc(sessions.updatedAt), desc(sessions.id));

    return NextResponse.json({ sessions: rows });
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }
}

// POST /api/sessions - Upsert one session into SQLite
export async function POST(
  request: Request
): Promise<NextResponse<{ success: boolean } | ErrorResponse>> {
  try {
    const body = (await request.json()) as CreateSessionBody;

    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    if (!body.type) {
      return NextResponse.json({ error: "type is required" }, { status: 400 });
    }

    const now = Date.now();
    const normalizedDisplayName = body.displayName?.trim() || null;
    const normalizedSessionName = body.sessionName?.trim() || null;

    await db
      .insert(sessions)
      .values({
        id: body.id,
        displayName: normalizedDisplayName || normalizedSessionName || null,
        readableKey: body.readableKey?.trim() || null,
        sessionName: normalizedSessionName,
        agentId: body.agentId?.trim() || null,
        type: body.type,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: sessions.id,
        set: {
          displayName: normalizedDisplayName || normalizedSessionName || null,
          readableKey: body.readableKey?.trim() || null,
          sessionName: normalizedSessionName,
          agentId: body.agentId?.trim() || null,
          type: body.type,
          updatedAt: now,
        },
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error creating session:", error);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}
