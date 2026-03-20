import { NextResponse } from "next/server";
import { db, groups, groupMembers } from "@/db";
import { desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { ErrorResponse } from "@/lib/types";

type GroupMemberInput = {
  agentId: string;
  name: string;
  emoji?: string;
  sessionKey?: string;
};

type CreateGroupRequest = {
  name: string;
  avatar?: string;
  members?: GroupMemberInput[];
};

type GroupsListResponse = {
  groups: Array<{
    id: string;
    name: string;
    avatar: string | null;
    createdAt: number;
    updatedAt: number;
  }>;
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

// GET /api/groups - Get all groups
export async function GET(): Promise<NextResponse<GroupsListResponse | ErrorResponse>> {
  try {
    const allGroups = await db.select().from(groups).orderBy(desc(groups.updatedAt));

    return NextResponse.json({
      groups: allGroups.map((group) => ({
        id: group.id,
        name: group.name,
        avatar: group.avatar,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching groups:", error);
    return NextResponse.json(
      { error: "Failed to fetch groups", status: 500 },
      { status: 500 }
    );
  }
}

// POST /api/groups - Create a new group
export async function POST(request: Request): Promise<NextResponse<GroupResponse | ErrorResponse>> {
  try {
    const body = (await request.json()) as CreateGroupRequest;

    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: "name is required", status: 400 },
        { status: 400 }
      );
    }

    const now = Date.now();
    const groupId = nanoid();
    const newGroup = {
      id: groupId,
      name: body.name.trim(),
      avatar: body.avatar ?? null,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(groups).values(newGroup);

    const members = body.members ?? [];
    if (members.some((member) => !member.agentId?.trim() || !member.name?.trim())) {
      return NextResponse.json(
        { error: "members[].agentId and members[].name are required", status: 400 },
        { status: 400 }
      );
    }

    if (members.length > 0) {
      await db.insert(groupMembers).values(
        members.map((member, index) => ({
          id: nanoid(),
          groupId,
          agentId: member.agentId.trim(),
          name: member.name.trim(),
          emoji: member.emoji ?? null,
          sessionKey: member.sessionKey ?? null,
          role: "member" as const,
          order: index,
          createdAt: now,
        }))
      );
    }

    return NextResponse.json({
      group: newGroup,
    });
  } catch (error) {
    console.error("Error creating group:", error);
    return NextResponse.json(
      { error: "Failed to create group", status: 500 },
      { status: 500 }
    );
  }
}
