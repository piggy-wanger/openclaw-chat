import { NextResponse } from "next/server";
import { db, sessions, settings } from "@/db";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { CreateSessionRequest, SessionResponse, SessionsListResponse, ErrorResponse } from "@/lib/types";

// GET /api/sessions - Get all sessions
export async function GET(): Promise<NextResponse<SessionsListResponse | ErrorResponse>> {
  try {
    const allSessions = await db
      .select()
      .from(sessions)
      .orderBy(desc(sessions.updatedAt));

    return NextResponse.json({
      sessions: allSessions.map((s) => ({
        id: s.id,
        title: s.title,
        type: s.type,
        model: s.model,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch sessions", status: 500 },
      { status: 500 }
    );
  }
}

// POST /api/sessions - Create a new session
export async function POST(request: Request): Promise<NextResponse<SessionResponse | ErrorResponse>> {
  try {
    const body = (await request.json()) as CreateSessionRequest;

    // Get default model from settings or use default
    let defaultModel = "claude-sonnet-4-6";
    try {
      const modelSetting = await db
        .select()
        .from(settings)
        .where(eq(settings.key, "defaultModel"))
        .limit(1);

      if (modelSetting.length > 0) {
        defaultModel = modelSetting[0].value;
      }
    } catch {
      // Ignore error if settings table is empty
    }

    const now = Date.now();
    const newSession = {
      id: nanoid(),
      title: body.title || "新会话",
      type: body.type || "direct",
      model: body.model || defaultModel,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(sessions).values(newSession);

    return NextResponse.json({
      session: newSession,
    });
  } catch (error) {
    console.error("Error creating session:", error);
    return NextResponse.json(
      { error: "Failed to create session", status: 500 },
      { status: 500 }
    );
  }
}
