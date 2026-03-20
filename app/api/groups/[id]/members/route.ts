import { NextResponse } from "next/server";
import { db, groups, groupMembers } from "@/db";
import { and, asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { ErrorResponse } from "@/lib/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

type MemberResponse = {
  member: {
    id: string;
    groupId: string;
    agentId: string;
    name: string;
    emoji: string | null;
    sessionKey: string | null;
    role: "member" | "admin";
    order: number;
    createdAt: number;
  };
};

type MembersListResponse = {
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
};

type CreateMemberRequest = {
  agentId: string;
  name: string;
  emoji?: string;
  sessionKey?: string;
  role?: "member" | "admin";
  order?: number;
};

type UpdateMemberRequest = {
  agentId: string;
  name?: string;
  emoji?: string;
  sessionKey?: string;
  role?: "member" | "admin";
  order?: number;
};

async function ensureGroupExists(groupId: string): Promise<boolean> {
  const groupResult = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  return groupResult.length > 0;
}

function isValidMemberRole(role: unknown): role is "member" | "admin" {
  return role === "member" || role === "admin";
}

// GET /api/groups/[id]/members - Get group members
export async function GET(
  _request: Request,
  { params }: RouteParams
): Promise<NextResponse<MembersListResponse | ErrorResponse>> {
  try {
    const { id } = await params;

    if (!(await ensureGroupExists(id))) {
      return NextResponse.json(
        { error: "Group not found", status: 404 },
        { status: 404 }
      );
    }

    const members = await db
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.groupId, id))
      .orderBy(asc(groupMembers.order), asc(groupMembers.createdAt));

    return NextResponse.json({ members });
  } catch (error) {
    console.error("Error fetching group members:", error);
    return NextResponse.json(
      { error: "Failed to fetch group members", status: 500 },
      { status: 500 }
    );
  }
}

// POST /api/groups/[id]/members - Add a member
export async function POST(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<MemberResponse | ErrorResponse>> {
  try {
    const { id } = await params;
    const body = (await request.json()) as CreateMemberRequest;

    if (!(await ensureGroupExists(id))) {
      return NextResponse.json(
        { error: "Group not found", status: 404 },
        { status: 404 }
      );
    }

    if (!body.agentId?.trim() || !body.name?.trim()) {
      return NextResponse.json(
        { error: "agentId and name are required", status: 400 },
        { status: 400 }
      );
    }

    if (body.role !== undefined && !isValidMemberRole(body.role)) {
      return NextResponse.json(
        { error: "role must be either 'member' or 'admin'", status: 400 },
        { status: 400 }
      );
    }

    const now = Date.now();

    const existingMember = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, id), eq(groupMembers.agentId, body.agentId.trim())))
      .limit(1);

    if (existingMember.length > 0) {
      return NextResponse.json(
        { error: "Member already exists in group", status: 409 },
        { status: 409 }
      );
    }

    const member = {
      id: nanoid(),
      groupId: id,
      agentId: body.agentId.trim(),
      name: body.name.trim(),
      emoji: body.emoji ?? null,
      sessionKey: body.sessionKey ?? null,
      role: body.role ?? ("member" as const),
      order: body.order ?? 0,
      createdAt: now,
    };

    await db.transaction(async (tx) => {
      await tx.insert(groupMembers).values(member);
      await tx.update(groups).set({ updatedAt: now }).where(eq(groups.id, id));
    });

    return NextResponse.json({ member });
  } catch (error) {
    console.error("Error adding group member:", error);
    return NextResponse.json(
      { error: "Failed to add group member", status: 500 },
      { status: 500 }
    );
  }
}

// PATCH /api/groups/[id]/members - Update a member by agentId
export async function PATCH(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<MemberResponse | ErrorResponse>> {
  try {
    const { id } = await params;
    const body = (await request.json()) as UpdateMemberRequest;

    if (!(await ensureGroupExists(id))) {
      return NextResponse.json(
        { error: "Group not found", status: 404 },
        { status: 404 }
      );
    }

    if (!body.agentId?.trim()) {
      return NextResponse.json(
        { error: "agentId is required", status: 400 },
        { status: 400 }
      );
    }

    const targetAgentId = body.agentId.trim();

    const existingMember = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, id), eq(groupMembers.agentId, targetAgentId)))
      .limit(1);

    if (existingMember.length === 0) {
      return NextResponse.json(
        { error: "Member not found", status: 404 },
        { status: 404 }
      );
    }

    const updateData: {
      name?: string;
      emoji?: string | null;
      sessionKey?: string | null;
      role?: "member" | "admin";
      order?: number;
    } = {};

    if (body.name !== undefined) {
      if (!body.name.trim()) {
        return NextResponse.json(
          { error: "name cannot be empty", status: 400 },
          { status: 400 }
        );
      }
      updateData.name = body.name.trim();
    }

    if (body.emoji !== undefined) {
      updateData.emoji = body.emoji;
    }
    if (body.sessionKey !== undefined) {
      updateData.sessionKey = body.sessionKey;
    }
    if (body.role !== undefined) {
      updateData.role = body.role;
    }
    if (body.order !== undefined) {
      updateData.order = body.order;
    }
    if (body.role !== undefined && !isValidMemberRole(body.role)) {
      return NextResponse.json(
        { error: "role must be either 'member' or 'admin'", status: 400 },
        { status: 400 }
      );
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update", status: 400 },
        { status: 400 }
      );
    }

    const now = Date.now();
    await db.transaction(async (tx) => {
      await tx
        .update(groupMembers)
        .set(updateData)
        .where(and(eq(groupMembers.groupId, id), eq(groupMembers.agentId, targetAgentId)));
      await tx.update(groups).set({ updatedAt: now }).where(eq(groups.id, id));
    });

    const updatedMember = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, id), eq(groupMembers.agentId, targetAgentId)))
      .limit(1);

    return NextResponse.json({ member: updatedMember[0] });
  } catch (error) {
    console.error("Error updating group member:", error);
    return NextResponse.json(
      { error: "Failed to update group member", status: 500 },
      { status: 500 }
    );
  }
}

// DELETE /api/groups/[id]/members?agentId=xxx - Remove a member
export async function DELETE(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<{ success: boolean } | ErrorResponse>> {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");

    if (!(await ensureGroupExists(id))) {
      return NextResponse.json(
        { error: "Group not found", status: 404 },
        { status: 404 }
      );
    }

    if (!agentId?.trim()) {
      return NextResponse.json(
        { error: "agentId is required", status: 400 },
        { status: 400 }
      );
    }

    const targetAgentId = agentId.trim();

    const existingMember = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, id), eq(groupMembers.agentId, targetAgentId)))
      .limit(1);

    if (existingMember.length === 0) {
      return NextResponse.json(
        { error: "Member not found", status: 404 },
        { status: 404 }
      );
    }

    await db
      .delete(groupMembers)
      .where(and(eq(groupMembers.groupId, id), eq(groupMembers.agentId, targetAgentId)));

    await db.update(groups).set({ updatedAt: Date.now() }).where(eq(groups.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting group member:", error);
    return NextResponse.json(
      { error: "Failed to delete group member", status: 500 },
      { status: 500 }
    );
  }
}
