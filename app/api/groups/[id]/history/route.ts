import { NextResponse } from "next/server";
import { and, asc, count, eq, like, lt } from "drizzle-orm";
import { db, groupMessages, groups } from "@/db";
import type { ErrorResponse } from "@/lib/types";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

type HistoryMessage = {
  sender: string;
  senderId: string;
  senderEmoji: string;
  content: string;
  time: string;
};

type GroupHistoryJsonResponse = {
  groupId: string;
  groupName: string;
  totalMessages: number;
  filteredMessages: number;
  truncated: boolean;
  messages: HistoryMessage[];
};

const CN_TIMEZONE = "Asia/Shanghai";

function formatCNTime(timestamp: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(timestamp));

  const partMap = new Map(parts.map((part) => [part.type, part.value]));
  return `${partMap.get("year")}-${partMap.get("month")}-${partMap.get("day")} ${partMap.get("hour")}:${partMap.get("minute")}:${partMap.get("second")}`;
}

function toNonEmpty(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function GET(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<string | GroupHistoryJsonResponse | ErrorResponse>> {
  try {
    const { id: groupId } = await params;

    const groupRows = await db
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .where(eq(groups.id, groupId))
      .limit(1);

    const group = groupRows[0];
    if (!group) {
      return NextResponse.json(
        { error: "Group not found", status: 404 },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") ?? "text";
    if (format !== "text" && format !== "json") {
      return NextResponse.json(
        { error: "format must be either 'text' or 'json'", status: 400 },
        { status: 400 }
      );
    }

    const senderId = toNonEmpty(searchParams.get("senderId"));
    const keyword = toNonEmpty(searchParams.get("keyword"));

    const beforeRaw = searchParams.get("before");
    const before = beforeRaw ? Number.parseInt(beforeRaw, 10) : null;
    if (beforeRaw && (before === null || Number.isNaN(before))) {
      return NextResponse.json(
        { error: "before must be a valid timestamp", status: 400 },
        { status: 400 }
      );
    }

    const maxCharsRaw = searchParams.get("maxChars");
    const parsedMaxChars = maxCharsRaw ? Number.parseInt(maxCharsRaw, 10) : 30000;
    if (Number.isNaN(parsedMaxChars)) {
      return NextResponse.json(
        { error: "maxChars must be a valid integer", status: 400 },
        { status: 400 }
      );
    }
    const maxChars = Math.max(parsedMaxChars, 0);

    const filters = [eq(groupMessages.groupId, groupId)];
    if (senderId) {
      filters.push(eq(groupMessages.senderId, senderId));
    }
    if (keyword) {
      filters.push(like(groupMessages.content, `%${keyword}%`));
    }
    if (before !== null) {
      filters.push(lt(groupMessages.createdAt, before));
    }

    const [totalRow] = await db
      .select({ total: count() })
      .from(groupMessages)
      .where(eq(groupMessages.groupId, groupId));

    const [filteredRow] = await db
      .select({ total: count() })
      .from(groupMessages)
      .where(and(...filters));

    const filteredMessages = filteredRow?.total ?? 0;

    const rows = await db
      .select({
        senderType: groupMessages.senderType,
        senderId: groupMessages.senderId,
        senderName: groupMessages.senderName,
        senderEmoji: groupMessages.senderEmoji,
        content: groupMessages.content,
        createdAt: groupMessages.createdAt,
      })
      .from(groupMessages)
      .where(and(...filters))
      .orderBy(asc(groupMessages.createdAt), asc(groupMessages.id));

    let charCount = 0;
    let keepFromIndex = rows.length;

    for (let i = rows.length - 1; i >= 0; i -= 1) {
      const nextCount = charCount + rows[i].content.length;
      if (nextCount > maxChars) {
        break;
      }
      charCount = nextCount;
      keepFromIndex = i;
    }

    const truncated = keepFromIndex > 0;
    const finalRows = rows.slice(keepFromIndex);

    const messages: HistoryMessage[] = finalRows.map((row) => {
      const isUser = row.senderType === "user";
      const sender = row.senderName?.trim() || (isUser ? "用户" : "智能体");
      const normalizedSenderId = row.senderId?.trim() || (isUser ? "user" : "unknown");
      const senderEmoji = row.senderEmoji?.trim() || (isUser ? "🧑" : "🤖");

      return {
        sender,
        senderId: normalizedSenderId,
        senderEmoji,
        content: row.content,
        time: formatCNTime(row.createdAt),
      };
    });

    if (format === "json") {
      return NextResponse.json({
        groupId,
        groupName: group.name,
        totalMessages: totalRow?.total ?? 0,
        filteredMessages,
        truncated,
        messages,
      });
    }

    const textBody = [
      `=== 群组「${group.name}」消息记录 ===`,
      `共 ${filteredMessages} 条消息`,
      "",
      ...messages.flatMap((message) => [
        `--- ${message.senderEmoji} ${message.sender}(${message.senderId}) [${message.time}] ---`,
        message.content,
        "",
      ]),
    ].join("\n");

    return new NextResponse(textBody, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Error fetching group history:", {
      message: err.message,
      stack: err.stack,
      cause: err.cause,
    });

    return NextResponse.json(
      { error: "Failed to fetch group history", status: 500 },
      { status: 500 }
    );
  }
}
