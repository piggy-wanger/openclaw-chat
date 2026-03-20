import { NextResponse } from "next/server";
import { db, groups, groupMessages } from "@/db";
import { and, eq } from "drizzle-orm";
import type { ErrorResponse } from "@/lib/types";

interface RouteParams {
  params: Promise<{ id: string; msgId: string }>;
}

// DELETE /api/groups/[id]/messages/[msgId] - Delete a group message
export async function DELETE(
  _request: Request,
  { params }: RouteParams
): Promise<NextResponse<{ success: boolean } | ErrorResponse>> {
  try {
    const { id, msgId } = await params;

    const groupResult = await db.select().from(groups).where(eq(groups.id, id)).limit(1);
    if (groupResult.length === 0) {
      return NextResponse.json(
        { error: "Group not found", status: 404 },
        { status: 404 }
      );
    }

    const messageResult = await db
      .select()
      .from(groupMessages)
      .where(and(eq(groupMessages.groupId, id), eq(groupMessages.id, msgId)))
      .limit(1);

    if (messageResult.length === 0) {
      return NextResponse.json(
        { error: "Message not found", status: 404 },
        { status: 404 }
      );
    }

    await db
      .delete(groupMessages)
      .where(and(eq(groupMessages.groupId, id), eq(groupMessages.id, msgId)));

    await db.update(groups).set({ updatedAt: Date.now() }).where(eq(groups.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting group message:", error);
    return NextResponse.json(
      { error: "Failed to delete group message", status: 500 },
      { status: 500 }
    );
  }
}
