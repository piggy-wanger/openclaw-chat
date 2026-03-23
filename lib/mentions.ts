export type MentionableAgent = {
  id: string;
  name: string;
};

const MENTION_REGEX = /@([^\s@]+)/g;
const TRAILING_PUNCTUATION_REGEX = /[.,!?;:，。！？；：、)）\]】}>》"“”'’`]+$/g;

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function stripTrailingPunctuation(value: string): string {
  return value.replace(TRAILING_PUNCTUATION_REGEX, "");
}

export function createMentionLookup(agents: MentionableAgent[]): Map<string, string> {
  const lookup = new Map<string, string>();

  for (const agent of agents) {
    const normalizedId = normalizeToken(agent.id);
    const normalizedName = normalizeToken(agent.name);

    if (normalizedId) {
      lookup.set(normalizedId, agent.id);
    }
    if (normalizedName) {
      lookup.set(normalizedName, agent.id);
    }
  }

  return lookup;
}

export function extractMentionedAgentIds(content: string, agents: MentionableAgent[]): string[] {
  if (!content.trim() || agents.length === 0) return [];

  const mentionLookup = createMentionLookup(agents);
  const mentionedIds = new Set<string>();

  for (const match of content.matchAll(MENTION_REGEX)) {
    const rawMention = match[1] ?? "";
    const mentionCore = stripTrailingPunctuation(rawMention);
    const normalizedMention = normalizeToken(mentionCore);
    if (!normalizedMention) continue;

    const agentId = mentionLookup.get(normalizedMention);
    if (agentId) {
      mentionedIds.add(agentId);
    }
  }

  return Array.from(mentionedIds);
}

export function matchMentionToken(
  rawToken: string,
  mentionLookup: Map<string, string>
): { agentId: string; core: string; suffix: string } | null {
  const core = stripTrailingPunctuation(rawToken);
  const normalized = normalizeToken(core);
  if (!normalized) return null;

  const agentId = mentionLookup.get(normalized);
  if (!agentId) return null;

  return {
    agentId,
    core,
    suffix: rawToken.slice(core.length),
  };
}
