import { randomUUID } from "crypto";
import { mkdir, readFile, rename, writeFile } from "fs/promises";
import { homedir } from "os";
import { dirname, join } from "path";

const CONFIG_PATH = join(homedir(), ".openclaw", "openclaw.json");

export type AgentAllowResponse = {
  allow: string[];
  updated: boolean;
};

export type AgentAllowSyncResponse = {
  allow: string[];
  added: string[];
  updated: boolean;
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeAllowList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

async function loadConfig(): Promise<Record<string, unknown>> {
  const content = await readFile(CONFIG_PATH, "utf-8");
  const parsed: unknown = JSON.parse(content);
  if (!isObjectRecord(parsed)) {
    throw new Error("openclaw.json root must be an object");
  }
  return parsed;
}

async function writeConfigAtomic(config: Record<string, unknown>): Promise<void> {
  await mkdir(dirname(CONFIG_PATH), { recursive: true });

  const tempPath = `${CONFIG_PATH}.${process.pid}.${randomUUID()}.tmp`;
  const serialized = `${JSON.stringify(config, null, 2)}\n`;

  await writeFile(tempPath, serialized, "utf-8");
  await rename(tempPath, CONFIG_PATH);
}

export function parseAgentId(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  return trimmed ? trimmed : null;
}

export function parseAgentIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const normalized = new Set<string>();
  for (const item of input) {
    const parsed = parseAgentId(item);
    if (parsed) normalized.add(parsed);
  }
  return Array.from(normalized);
}

export async function updateAllow(
  agentId: string,
  operation: "add" | "remove"
): Promise<AgentAllowResponse> {
  const config = await loadConfig();

  const tools = isObjectRecord(config.tools) ? config.tools : {};
  const agentToAgent = isObjectRecord(tools.agentToAgent) ? tools.agentToAgent : {};
  const currentAllow = normalizeAllowList(agentToAgent.allow);

  let nextAllow: string[];
  if (operation === "add") {
    nextAllow = currentAllow.includes(agentId) ? currentAllow : [...currentAllow, agentId];
  } else {
    nextAllow = currentAllow.filter((id) => id !== agentId);
  }

  const updated = nextAllow.length !== currentAllow.length;
  const normalizedChanged = !Array.isArray(agentToAgent.allow);

  const nextConfig: Record<string, unknown> = {
    ...config,
    tools: {
      ...tools,
      agentToAgent: {
        ...agentToAgent,
        allow: nextAllow,
      },
    },
  };

  if (updated || normalizedChanged) {
    await writeConfigAtomic(nextConfig);
  }

  return {
    allow: nextAllow,
    updated: updated || normalizedChanged,
  };
}

export async function ensureAllowIncludes(agentIds: string[]): Promise<AgentAllowSyncResponse> {
  const normalizedIds = parseAgentIds(agentIds);
  if (normalizedIds.length === 0) {
    const config = await loadConfig();
    const tools = isObjectRecord(config.tools) ? config.tools : {};
    const agentToAgent = isObjectRecord(tools.agentToAgent) ? tools.agentToAgent : {};
    return {
      allow: normalizeAllowList(agentToAgent.allow),
      added: [],
      updated: false,
    };
  }

  const config = await loadConfig();

  const tools = isObjectRecord(config.tools) ? config.tools : {};
  const agentToAgent = isObjectRecord(tools.agentToAgent) ? tools.agentToAgent : {};
  const currentAllow = normalizeAllowList(agentToAgent.allow);
  const currentSet = new Set(currentAllow);

  const added: string[] = [];
  for (const agentId of normalizedIds) {
    if (!currentSet.has(agentId)) {
      currentSet.add(agentId);
      added.push(agentId);
    }
  }

  const nextAllow = Array.from(currentSet);
  const updated = added.length > 0;
  const normalizedChanged = !Array.isArray(agentToAgent.allow);

  const nextConfig: Record<string, unknown> = {
    ...config,
    tools: {
      ...tools,
      agentToAgent: {
        ...agentToAgent,
        allow: nextAllow,
      },
    },
  };

  if (updated || normalizedChanged) {
    await writeConfigAtomic(nextConfig);
  }

  return {
    allow: nextAllow,
    added,
    updated: updated || normalizedChanged,
  };
}
