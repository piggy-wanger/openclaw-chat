export type MentionableAgent = {
  id: string;
  name: string;
};

const MENTION_REGEX = /[@＠]([^\s@＠]+)/g;
const TRAILING_PUNCTUATION_REGEX = /[.,!?;:，。！？；：、)）\]】}>》"“”'’`]+$/g;
export const MENTION_HIGHLIGHT_START = "[[[MENTION_START]]]";
export const MENTION_HIGHLIGHT_END = "[[[MENTION_END]]]";

export type ParsedMention = {
  raw: string;
  text: string;
  value: string;
  suffix: string;
  start: number;
};

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function stripTrailingPunctuation(value: string): string {
  return value.replace(TRAILING_PUNCTUATION_REGEX, "");
}

export function parseMentions(text: string): ParsedMention[] {
  if (!text.trim()) return [];

  const mentions: ParsedMention[] = [];
  for (const match of text.matchAll(MENTION_REGEX)) {
    const rawMentionBody = match[1] ?? "";
    const core = stripTrailingPunctuation(rawMentionBody);
    if (!core) continue;

    const start = match.index ?? -1;
    if (start < 0) continue;

    const suffix = rawMentionBody.slice(core.length);
    mentions.push({
      raw: `@${rawMentionBody}`,
      text: `@${core}`,
      value: core,
      suffix,
      start,
    });
  }

  return mentions;
}

export function highlightMentions(text: string): string {
  const mentions = parseMentions(text);
  if (mentions.length === 0) return text;

  let cursor = 0;
  let result = "";

  for (const mention of mentions) {
    const rawEnd = mention.start + mention.raw.length;
    result += text.slice(cursor, mention.start);
    result += `${MENTION_HIGHLIGHT_START}${mention.text}${MENTION_HIGHLIGHT_END}${mention.suffix}`;
    cursor = rawEnd;
  }

  result += text.slice(cursor);
  return result;
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

  for (const mention of parseMentions(content)) {
    const normalizedMention = normalizeToken(mention.value);
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
