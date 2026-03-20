import { NextResponse } from "next/server";
import { db, groups, groupMembers, groupMessages } from "@/db";
import { asc, desc, eq } from "drizzle-orm";
import type { ErrorResponse } from "@/lib/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

type GroupDetailResponse = {
  group: {
    id: string;
    name: string;
    avatar: string | null;
    createdAt: number;
    updatedAt: number;
  };
  members: Array<{
    id: string;
    groupId: string;
    agentId: string;
    name: string;
    emoji: string | null;
    sessionKey: string | null;
    role: "member" | "admin";
    order: number;
    createdAt: number;
  }>;
  messages: Array<{
    id: string;
    groupId: string;
    senderType: "user" | "agent";
    senderId: string | null;
    senderName: string | null;
    senderEmoji: string | null;
    role: "user" | "assistant";
    content: string;
    runId: string | null;
    toolCalls: string | null;
    createdAt: number;
  }>;
};

type UpdateGroupRequest = {
  name?: string;
  avatar?: string;
};

type GroupResponse = {
  group: {
    id: string;
    name: string;
    avatar: string | null;
    createdAt: number;
    updatedAt: number;
  };
};

// GET /api/groups/[id] - Get group details with members and last 20 messages
export async function GET(
  _request: Request,
  { params }: RouteParams
): Promise<NextResponse<GroupDetailResponse | ErrorResponse>> {
  try {
    const { id } = await params;

    const groupResult = await db.select().from(groups).where(eq(groups.id, id)).limit(1);

    if (groupResult.length === 0) {
      return NextResponse.json(
        { error: "Group not found", status: 404 },
        { status: 404 }
      );
    }

    const group = groupResult[0];

    const members = await db
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.groupId, id))
      .orderBy(asc(groupMembers.order), asc(groupMembers.createdAt));

    const latestMessages = await db
      .select()
      .from(groupMessages)
      .where(eq(groupMessages.groupId, id))
      .orderBy(desc(groupMessages.createdAt))
      .limit(20);

    const messages = latestMessages.sort((a, b) => a.createdAt - b.createdAt);

    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        avatar: group.avatar,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
      },
      members,
      messages,
    });
  } catch (error) {
    console.error("Error fetching group:", error);
    return NextResponse.json(
      { error: "Failed to fetch group", status: 500 },
      { status: 500 }
    );
  }
}

// PATCH /api/groups/[id] - Update group
export async function PATCH(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<GroupResponse | ErrorResponse>> {
  try {
    const { id } = await params;
    const body = (await request.json()) as UpdateGroupRequest;

    const existingGroup = await db.select().from(groups).where(eq(groups.id, id)).limit(1);

    if (existingGroup.length === 0) {
      return NextResponse.json(
        { error: "Group not found", status: 404 },
        { status: 404 }
      );
    }

    const updateData: { name?: string; avatar?: string | null; updatedAt: number } = {
      updatedAt: Date.now(),
    };

    if (body.name !== undefined) {
      if (!body.name.trim()) {
        return NextResponse.json(
          { error: "name cannot be empty", status: 400 },
          { status: 400 }
        );
      }
      updateData.name = body.name.trim();
    }

    if (body.avatar !== undefined) {
      updateData.avatar = body.avatar;
    }

    if (body.name === undefined && body.avatar === undefined) {
      return NextResponse.json(
        { error: "No fields to update", status: 400 },
        { status: 400 }
      );
    }

    await db.update(groups).set(updateData).where(eq(groups.id, id));

    const updatedGroup = await db.select().from(groups).where(eq(groups.id, id)).limit(1);
    const group = updatedGroup[0];

    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        avatar: group.avatar,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating group:", error);
    return NextResponse.json(
      { error: "Failed to update group", status: 500 },
      { status: 500 }
    );
  }
}

// DELETE /api/groups/[id] - Delete group
export async function DELETE(
  _request: Request,
  { params }: RouteParams
): Promise<NextResponse<{ success: boolean } | ErrorResponse>> {
  try {
    const { id } = await params;

    const existingGroup = await db.select().from(groups).where(eq(groups.id, id)).limit(1);

    if (existingGroup.length === 0) {
      return NextResponse.json(
        { error: "Group not found", status: 404 },
        { status: 404 }
      );
    }

    await db.delete(groups).where(eq(groups.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting group:", error);
    return NextResponse.json(
      { error: "Failed to delete group", status: 500 },
      { status: 500 }
    );
  }
}
