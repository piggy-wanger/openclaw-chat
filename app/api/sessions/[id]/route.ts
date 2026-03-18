import { NextResponse } from "next/server";
import { db, sessions, messages } from "@/db";
import { eq, asc } from "drizzle-orm";
import type { SessionWithMessagesResponse, SessionResponse, UpdateSessionRequest, ErrorResponse } from "@/lib/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/sessions/[id] - Get a session with its messages
export async function GET(
  _request: Request,
  { params }: RouteParams
): Promise<NextResponse<SessionWithMessagesResponse | ErrorResponse>> {
  try {
    const { id } = await params;

    // Get session
    const sessionResult = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);

    if (sessionResult.length === 0) {
      return NextResponse.json(
        { error: "Session not found", status: 404 },
        { status: 404 }
      );
    }

    const session = sessionResult[0];

    // Get messages for this session
    const sessionMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, id))
      .orderBy(asc(messages.createdAt));

    return NextResponse.json({
      session: {
        id: session.id,
        title: session.title,
        type: session.type,
        model: session.model,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
      messages: sessionMessages.map((m) => ({
        id: m.id,
        sessionId: m.sessionId,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching session:", error);
    return NextResponse.json(
      { error: "Failed to fetch session", status: 500 },
      { status: 500 }
    );
  }
}

// PATCH /api/sessions/[id] - Update a session
export async function PATCH(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<SessionResponse | ErrorResponse>> {
  try {
    const { id } = await params;
    const body = (await request.json()) as UpdateSessionRequest;

    // Check if session exists
    const existingSession = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);

    if (existingSession.length === 0) {
      return NextResponse.json(
        { error: "Session not found", status: 404 },
        { status: 404 }
      );
    }

    // Update session
    const updateData: { title?: string; model?: string; updatedAt: number } = {
      updatedAt: Date.now(),
    };

    if (body.title !== undefined) {
      updateData.title = body.title;
    }
    if (body.model !== undefined) {
      updateData.model = body.model;
    }

    await db.update(sessions).set(updateData).where(eq(sessions.id, id));

    // Fetch updated session
    const updatedSession = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);

    const session = updatedSession[0];

    return NextResponse.json({
      session: {
        id: session.id,
        title: session.title,
        type: session.type,
        model: session.model,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating session:", error);
    return NextResponse.json(
      { error: "Failed to update session", status: 500 },
      { status: 500 }
    );
  }
}

// DELETE /api/sessions/[id] - Delete a session
export async function DELETE(
  _request: Request,
  { params }: RouteParams
): Promise<NextResponse<{ success: boolean } | ErrorResponse>> {
  try {
    const { id } = await params;

    // Check if session exists
    const existingSession = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);

    if (existingSession.length === 0) {
      return NextResponse.json(
        { error: "Session not found", status: 404 },
        { status: 404 }
      );
    }

    // Delete session (messages will be deleted via CASCADE)
    await db.delete(sessions).where(eq(sessions.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting session:", error);
    return NextResponse.json(
      { error: "Failed to delete session", status: 500 },
      { status: 500 }
    );
  }
}
