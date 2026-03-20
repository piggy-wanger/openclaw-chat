import { NextResponse } from "next/server";
import { db, groups, groupMessages } from "@/db";
import { and, desc, eq, lt, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { ErrorResponse } from "@/lib/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

type MessagesListResponse = {
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
  pagination: {
    limit: number;
    hasMore: boolean;
    nextBefore: string | null;
  };
};

type CreateGroupMessageRequest = {
  senderType: "user" | "agent";
  senderId?: string;
  senderName?: string;
  senderEmoji?: string;
  role: "user" | "assistant";
  content: string;
  runId?: string;
  toolCalls?: string | Record<string, unknown> | Array<unknown>;
};

type GroupMessageResponse = {
  message: {
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
  };
};

async function ensureGroupExists(groupId: string): Promise<boolean> {
  const groupResult = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  return groupResult.length > 0;
}

function isValidSenderType(senderType: unknown): senderType is "user" | "agent" {
  return senderType === "user" || senderType === "agent";
}

function isValidMessageRole(role: unknown): role is "user" | "assistant" {
  return role === "user" || role === "assistant";
}

function parseBeforeCursor(beforeRaw: string | null): { createdAt: number; id: string } | null {
  if (!beforeRaw) {
    return null;
  }

  const [createdAtRaw, idRaw] = beforeRaw.split(":");
  const createdAt = Number.parseInt(createdAtRaw ?? "", 10);
  if (Number.isNaN(createdAt) || !idRaw) {
    return null;
  }

  return { createdAt, id: idRaw };
}

// GET /api/groups/[id]/messages?limit=50&before=createdAt:id - Paginated messages
export async function GET(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<MessagesListResponse | ErrorResponse>> {
  try {
    const { id } = await params;

    if (!(await ensureGroupExists(id))) {
      return NextResponse.json(
        { error: "Group not found", status: 404 },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limitRaw = Number.parseInt(searchParams.get("limit") ?? "50", 10);
    const beforeRaw = searchParams.get("before");

    const limit = Number.isNaN(limitRaw) ? 50 : Math.min(Math.max(limitRaw, 1), 100);
    const before = parseBeforeCursor(beforeRaw);

    if (beforeRaw && !before) {
      return NextResponse.json(
        { error: "before must be in format 'createdAt:id'", status: 400 },
        { status: 400 }
      );
    }

    const rows = before
      ? await db
          .select()
          .from(groupMessages)
          .where(
            and(
              eq(groupMessages.groupId, id),
              or(
                lt(groupMessages.createdAt, before.createdAt),
                and(eq(groupMessages.createdAt, before.createdAt), lt(groupMessages.id, before.id))
              )
            )
          )
          .orderBy(desc(groupMessages.createdAt), desc(groupMessages.id))
          .limit(limit + 1)
      : await db
          .select()
          .from(groupMessages)
          .where(eq(groupMessages.groupId, id))
          .orderBy(desc(groupMessages.createdAt), desc(groupMessages.id))
          .limit(limit + 1);

    const hasMore = rows.length > limit;
    const pageRows = rows.slice(0, limit).sort((a, b) => {
      if (a.createdAt !== b.createdAt) {
        return a.createdAt - b.createdAt;
      }
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

    return NextResponse.json({
      messages: pageRows,
      pagination: {
        limit,
        hasMore,
        nextBefore: pageRows.length > 0 ? `${pageRows[0].createdAt}:${pageRows[0].id}` : null,
      },
    });
  } catch (error) {
    console.error("Error fetching group messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch group messages", status: 500 },
      { status: 500 }
    );
  }
}

// POST /api/groups/[id]/messages - Send message to group
export async function POST(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<GroupMessageResponse | ErrorResponse>> {
  try {
    const { id } = await params;
    const body = (await request.json()) as CreateGroupMessageRequest;

    if (!(await ensureGroupExists(id))) {
      return NextResponse.json(
        { error: "Group not found", status: 404 },
        { status: 404 }
      );
    }

    if (!body.senderType || !body.role || !body.content?.trim()) {
      return NextResponse.json(
        { error: "senderType, role and content are required", status: 400 },
        { status: 400 }
      );
    }
    if (!isValidSenderType(body.senderType)) {
      return NextResponse.json(
        { error: "senderType must be either 'user' or 'agent'", status: 400 },
        { status: 400 }
      );
    }
    if (!isValidMessageRole(body.role)) {
      return NextResponse.json(
        { error: "role must be either 'user' or 'assistant'", status: 400 },
        { status: 400 }
      );
    }

    const now = Date.now();

    const message = {
      id: nanoid(),
      groupId: id,
      senderType: body.senderType,
      senderId: body.senderId ?? null,
      senderName: body.senderName ?? null,
      senderEmoji: body.senderEmoji ?? null,
      role: body.role,
      content: body.content,
      runId: body.runId ?? null,
      toolCalls:
        body.toolCalls === undefined
          ? null
          : typeof body.toolCalls === "string"
            ? body.toolCalls
            : JSON.stringify(body.toolCalls),
      createdAt: now,
    };

    await db.transaction(async (tx) => {
      await tx.insert(groupMessages).values(message);
      await tx.update(groups).set({ updatedAt: now }).where(eq(groups.id, id));
    });

    return NextResponse.json({ message });
  } catch (error) {
    console.error("Error creating group message:", error);
    return NextResponse.json(
      { error: "Failed to create group message", status: 500 },
      { status: 500 }
    );
  }
}
