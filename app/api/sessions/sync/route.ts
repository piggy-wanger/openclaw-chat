import { NextResponse } from "next/server";
import { db, sessions } from "@/db";
import type { ErrorResponse } from "@/lib/types";

export const runtime = "nodejs";

type SyncSessionInput = {
  id: string;
  displayName?: string;
  readableKey?: string;
  sessionName?: string;
  agentId?: string;
  type: "direct" | "group";
  model?: string;
  createdAt?: number;
  updatedAt?: number;
};

type SyncResponse = {
  success: boolean;
  count: number;
};

// POST /api/sessions/sync - Frontend sends Gateway sessions list, then full-sync into SQLite
export async function POST(
  req: Request
): Promise<NextResponse<SyncResponse | ErrorResponse>> {
  try {
    const body = (await req.json()) as { sessions?: SyncSessionInput[] };
    const list = Array.isArray(body.sessions) ? body.sessions : [];
    const now = Date.now();

    db.transaction((tx) => {
      tx.delete(sessions).run();

      if (list.length > 0) {
        tx.insert(sessions)
          .values(
            list
              .filter((item) => Boolean(item?.id))
              .map((item) => {
                const sessionName = item.sessionName?.trim() || null;
                const displayName = item.displayName?.trim() || sessionName || null;
                return {
                  id: item.id,
                  displayName,
                  readableKey: item.readableKey?.trim() || null,
                  sessionName,
                  agentId: item.agentId?.trim() || null,
                  type: item.type || "direct",
                  model: item.model?.trim() || null,
                  createdAt:
                    typeof item.createdAt === "number" && Number.isFinite(item.createdAt)
                      ? item.createdAt
                      : now,
                  updatedAt:
                    typeof item.updatedAt === "number" && Number.isFinite(item.updatedAt)
                      ? item.updatedAt
                      : now,
                };
              })
          )
          .run();
      }
    });

    return NextResponse.json({ success: true, count: list.length });
  } catch (error) {
    console.error("[sessions/sync] Error:", error);
    return NextResponse.json({ error: "Failed to sync sessions" }, { status: 500 });
  }
}
