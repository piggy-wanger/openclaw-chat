import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, agents } from "@/db";
import { getServerGatewayClient } from "@/lib/server/gateway-server";
import type { ErrorResponse } from "@/lib/types";

export const runtime = "nodejs";

type AgentRow = {
  id: string;
  name: string | null;
  model: string | null;
  emoji: string | null;
  avatar: string | null;
  workspace: string | null;
  createdAt: number;
  updatedAt: number;
};

type AgentsListResponse = {
  agents: AgentRow[];
};

type CreateAgentRequest = {
  id?: string;
  displayName?: string;
  model?: string;
  emoji?: string;
  avatar?: string;
  workspace?: string;
};

type AgentResponse = {
  agent: AgentRow;
};

// GET /api/agents - Read agents from SQLite
export async function GET(): Promise<NextResponse<AgentsListResponse | ErrorResponse>> {
  try {
    const rows = await db.select().from(agents).orderBy(desc(agents.updatedAt), desc(agents.id));

    return NextResponse.json({
      agents: rows.map((row) => ({
        id: row.id,
        name: row.name,
        model: row.model,
        emoji: row.emoji,
        avatar: row.avatar,
        workspace: row.workspace,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching agents:", error);
    return NextResponse.json(
      { error: "Failed to fetch agents", status: 500 },
      { status: 500 }
    );
  }
}

// POST /api/agents - Create via Gateway then write SQLite
export async function POST(request: Request): Promise<NextResponse<AgentResponse | ErrorResponse>> {
  try {
    const body = (await request.json()) as CreateAgentRequest;

    const id = body.id?.trim();
    const model = body.model?.trim();
    const displayName = body.displayName?.trim();
    const emoji = body.emoji?.trim();
    const avatar = body.avatar?.trim();
    const workspace = body.workspace?.trim();

    if (!id) {
      return NextResponse.json(
        { error: "id is required", status: 400 },
        { status: 400 }
      );
    }

    if (!model) {
      return NextResponse.json(
        { error: "model is required", status: 400 },
        { status: 400 }
      );
    }

    const gateway = await getServerGatewayClient();

    const createResult = await gateway.agentsCreate({
      name: id,
      workspace: workspace || `~/.openclaw/workspace-${id}`,
      emoji: emoji || undefined,
      avatar: avatar || undefined,
    });

    await gateway.agentsUpdate({
      agentId: createResult.agentId,
      name: displayName || id,
      model,
      emoji: emoji || undefined,
      avatar: avatar || undefined,
      workspace: workspace || undefined,
    });

    const now = Date.now();
    await db.insert(agents).values({
      id: createResult.agentId,
      name: displayName || id,
      model,
      emoji: emoji || null,
      avatar: avatar || null,
      workspace: workspace || createResult.workspace || null,
      createdAt: now,
      updatedAt: now,
    });

    const inserted = await db.select().from(agents).where(eq(agents.id, createResult.agentId)).limit(1);
    if (inserted.length === 0) {
      throw new Error("Agent created but not found in SQLite");
    }
    const row = inserted[0];

    return NextResponse.json({
      agent: {
        id: row.id,
        name: row.name,
        model: row.model,
        emoji: row.emoji,
        avatar: row.avatar,
        workspace: row.workspace,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error creating agent:", error);
    return NextResponse.json(
      { error: "Failed to create agent", status: 500 },
      { status: 500 }
    );
  }
}
