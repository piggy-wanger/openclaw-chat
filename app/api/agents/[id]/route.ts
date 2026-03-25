import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, agents } from "@/db";
import type { ErrorResponse } from "@/lib/types";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT /api/agents/[id] - Update agent in SQLite (called by frontend after Gateway update)
export async function PUT(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<{ success: boolean } | ErrorResponse>> {
  try {
    const { id } = await params;
    const body = await request.json() as {
      name?: string;
      model?: string;
      emoji?: string;
      avatar?: string;
      workspace?: string;
    };

    await db.update(agents).set({
      name: body.name ?? undefined,
      model: body.model ?? undefined,
      emoji: body.emoji ?? undefined,
      avatar: body.avatar ?? undefined,
      workspace: body.workspace ?? undefined,
      updatedAt: Date.now(),
    }).where(eq(agents.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating agent:", error);
    return NextResponse.json({ error: "Failed to update agent" }, { status: 500 });
  }
}

// DELETE /api/agents/[id] - Delete agent from SQLite (called by frontend after Gateway delete)
export async function DELETE(
  _request: Request,
  { params }: RouteParams
): Promise<NextResponse<{ success: boolean } | ErrorResponse>> {
  try {
    const { id } = await params;
    await db.delete(agents).where(eq(agents.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting agent:", error);
    return NextResponse.json({ error: "Failed to delete agent" }, { status: 500 });
  }
}
