import { NextResponse } from "next/server";
import { db, agents } from "@/db";
import type { ErrorResponse } from "@/lib/types";

export const runtime = "nodejs";

type GatewayAgent = {
  id: string;
  model?: string;
  workspace?: string;
  identity?: {
    name?: string;
    emoji?: string;
    avatar?: string;
  };
};

type SyncResponse = {
  success: boolean;
  count: number;
};

// POST /api/agents/sync - Frontend sends Gateway agent list, we write to SQLite
export async function POST(
  req: Request
): Promise<NextResponse<SyncResponse | ErrorResponse>> {
  try {
    const body = (await req.json()) as {
      agents?: GatewayAgent[];
      defaultModel?: string;
    };

    const list = body.agents ?? [];
    const defaultModel = body.defaultModel ?? "";
    const now = Date.now();

    for (const agent of list) {
      if (!agent?.id) continue;
      db.insert(agents)
        .values({
          id: agent.id,
          name: agent.identity?.name || agent.id,
          model: agent.model || defaultModel || null,
          emoji: agent.identity?.emoji || null,
          avatar: agent.identity?.avatar || null,
          workspace: agent.workspace || null,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: agents.id,
          set: {
            name: agent.identity?.name || agent.id,
            model: agent.model || defaultModel || null,
            emoji: agent.identity?.emoji || null,
            avatar: agent.identity?.avatar || null,
            workspace: agent.workspace || null,
            updatedAt: now,
          },
        })
        .run();
    }

    return NextResponse.json({ success: true, count: list.length });
  } catch (error) {
    console.error("[agents/sync] Error:", error);
    return NextResponse.json(
      { error: "Failed to sync agents" },
      { status: 500 }
    );
  }
}
