import { NextResponse } from "next/server";
import {
  ensureAllowIncludes,
  parseAgentId,
  parseAgentIds,
  updateAllow,
  type AgentAllowResponse,
  type AgentAllowSyncResponse,
} from "@/lib/server/agent-allow";

export const runtime = "nodejs";

type ErrorResponse = {
  error: string;
  status: number;
};

type AgentAllowRequest = {
  agentId?: string;
  agentIds?: string[];
};

async function getBody(request: Request): Promise<AgentAllowRequest> {
  try {
    return (await request.json()) as AgentAllowRequest;
  } catch {
    return {};
  }
}

export async function POST(
  request: Request
): Promise<NextResponse<AgentAllowResponse | AgentAllowSyncResponse | ErrorResponse>> {
  try {
    const body = await getBody(request);
    const agentIds = parseAgentIds(body.agentIds);

    if (agentIds.length > 0) {
      const result = await ensureAllowIncludes(agentIds);
      return NextResponse.json(result);
    }

    const agentId = parseAgentId(body.agentId);

    if (!agentId) {
      return NextResponse.json(
        { error: "agentId is required", status: 400 },
        { status: 400 }
      );
    }

    const result = await updateAllow(agentId, "add");
    return NextResponse.json(result);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Failed to add agent to tools.agentToAgent.allow:", err);
    return NextResponse.json(
      { error: "Failed to update tools.agentToAgent.allow", status: 500 },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request): Promise<NextResponse<AgentAllowResponse | ErrorResponse>> {
  try {
    const body = await getBody(request);
    const agentId = parseAgentId(body.agentId);

    if (!agentId) {
      return NextResponse.json(
        { error: "agentId is required", status: 400 },
        { status: 400 }
      );
    }

    const result = await updateAllow(agentId, "remove");
    return NextResponse.json(result);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Failed to remove agent from tools.agentToAgent.allow:", err);
    return NextResponse.json(
      { error: "Failed to update tools.agentToAgent.allow", status: 500 },
      { status: 500 }
    );
  }
}
