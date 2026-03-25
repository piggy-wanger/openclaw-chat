import { NextResponse } from "next/server";
import { db, agents } from "@/db";
import { getServerGatewayClient } from "@/lib/server/gateway-server";
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

// POST /api/agents/sync - Pull from Gateway config.get and fully overwrite SQLite agents table
export async function POST(): Promise<NextResponse<SyncResponse | ErrorResponse>> {
  try {
    const gateway = await getServerGatewayClient();
    const result = await gateway.configGet();
    const config = result.config as {
      agents?: {
        list?: GatewayAgent[];
        defaults?: {
          model?: {
            primary?: string;
          };
        };
      };
    };

    const list = config.agents?.list ?? [];
    const defaultModel = config.agents?.defaults?.model?.primary ?? "";
    const now = Date.now();

    db.transaction((tx) => {
      tx.delete(agents).run();
      if (list.length > 0) {
        tx.insert(agents).values(
          list.map((agent) => ({
            id: agent.id,
            name: agent.identity?.name || agent.id,
            model: agent.model || defaultModel || null,
            emoji: agent.identity?.emoji || null,
            avatar: agent.identity?.avatar || null,
            workspace: agent.workspace || null,
            createdAt: now,
            updatedAt: now,
          }))
        ).run();
      }
    });

    return NextResponse.json({
      success: true,
      count: list.length,
    });
  } catch (error) {
    console.error("Error syncing agents:", error);
    return NextResponse.json(
      { error: "Failed to sync agents", status: 500 },
      { status: 500 }
    );
  }
}

