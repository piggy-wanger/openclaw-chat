import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db, agents } from "@/db";
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

type AgentsListResponse = { agents: AgentRow[] };

// GET /api/agents - Read agents from SQLite
export async function GET(): Promise<NextResponse<AgentsListResponse | ErrorResponse>> {
  try {
    const rows = await db.select().from(agents).orderBy(desc(agents.updatedAt), desc(agents.id));
    return NextResponse.json({ agents: rows });
  } catch (error) {
    console.error("Error fetching agents:", error);
    return NextResponse.json({ error: "Failed to fetch agents" }, { status: 500 });
  }
}

// POST /api/agents - Write agent to SQLite (called by frontend after Gateway create)
export async function POST(request: Request): Promise<NextResponse<{ success: boolean } | ErrorResponse>> {
  try {
    const body = await request.json() as {
      id: string;
      name?: string;
      model?: string;
      emoji?: string;
      avatar?: string;
      workspace?: string;
    };

    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const now = Date.now();
    await db.insert(agents).values({
      id: body.id,
      name: body.name || null,
      model: body.model || null,
      emoji: body.emoji || null,
      avatar: body.avatar || null,
      workspace: body.workspace || null,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: agents.id,
      set: {
        name: body.name || null,
        model: body.model || null,
        emoji: body.emoji || null,
        avatar: body.avatar || null,
        workspace: body.workspace || null,
        updatedAt: now,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error creating agent:", error);
    return NextResponse.json({ error: "Failed to create agent" }, { status: 500 });
  }
}
