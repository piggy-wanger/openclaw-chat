import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, agents } from "@/db";
import { getServerGatewayClient } from "@/lib/server/gateway-server";
import type { ErrorResponse } from "@/lib/types";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

type UpdateAgentRequest = {
  displayName?: string;
  model?: string;
  emoji?: string;
  avatar?: string;
  workspace?: string;
};

type AgentResponse = {
  agent: {
    id: string;
    name: string | null;
    model: string | null;
    emoji: string | null;
    avatar: string | null;
    workspace: string | null;
    createdAt: number;
    updatedAt: number;
  };
};

// PUT /api/agents/[id] - Update via Gateway then update SQLite
export async function PUT(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<AgentResponse | ErrorResponse>> {
  try {
    const { id } = await params;
    const body = (await request.json()) as UpdateAgentRequest;

    const existing = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Agent not found", status: 404 },
        { status: 404 }
      );
    }

    const model = body.model?.trim();
    if (!model) {
      return NextResponse.json(
        { error: "model is required", status: 400 },
        { status: 400 }
      );
    }

    const displayName = body.displayName?.trim();
    const emoji = body.emoji?.trim();
    const avatar = body.avatar?.trim();
    const workspace = body.workspace?.trim();

    const gateway = await getServerGatewayClient();
    await gateway.agentsUpdate({
      agentId: id,
      name: displayName || undefined,
      model,
      emoji: emoji || undefined,
      avatar: avatar || undefined,
      workspace: workspace || undefined,
    });

    await db.update(agents).set({
      name: displayName || null,
      model,
      emoji: emoji || null,
      avatar: avatar || null,
      workspace: workspace || existing[0].workspace || null,
      updatedAt: Date.now(),
    }).where(eq(agents.id, id));

    const updated = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
    const row = updated[0];

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
    console.error("Error updating agent:", error);
    return NextResponse.json(
      { error: "Failed to update agent", status: 500 },
      { status: 500 }
    );
  }
}

// DELETE /api/agents/[id] - Delete via Gateway then delete SQLite row
export async function DELETE(
  _request: Request,
  { params }: RouteParams
): Promise<NextResponse<{ success: boolean } | ErrorResponse>> {
  try {
    const { id } = await params;

    const existing = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Agent not found", status: 404 },
        { status: 404 }
      );
    }

    const gateway = await getServerGatewayClient();
    await gateway.agentsDelete(id);

    await db.delete(agents).where(eq(agents.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting agent:", error);
    return NextResponse.json(
      { error: "Failed to delete agent", status: 500 },
      { status: 500 }
    );
  }
}

