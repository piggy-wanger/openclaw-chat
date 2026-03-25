import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, sessions } from "@/db";
import type { ErrorResponse } from "@/lib/types";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

type UpdateSessionBody = {
  displayName?: string;
  title?: string;
  model?: string;
};

// PUT /api/sessions/[id] - Update session in SQLite
export async function PUT(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<{ success: boolean } | ErrorResponse>> {
  try {
    const { id } = await params;
    const body = (await request.json()) as UpdateSessionBody;
    const normalizedDisplayName = body.displayName?.trim() || body.title?.trim();

    await db
      .update(sessions)
      .set({
        displayName: normalizedDisplayName || null,
        model: body.model?.trim() || null,
        updatedAt: Date.now(),
      })
      .where(eq(sessions.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating session:", error);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}

// DELETE /api/sessions/[id] - Delete session from SQLite
export async function DELETE(
  _request: Request,
  { params }: RouteParams
): Promise<NextResponse<{ success: boolean } | ErrorResponse>> {
  try {
    const { id } = await params;
    await db.delete(sessions).where(eq(sessions.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting session:", error);
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}
