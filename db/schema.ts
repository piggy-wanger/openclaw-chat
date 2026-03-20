import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { nanoid } from "nanoid";

// Sessions table
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  title: text("title").notNull(),
  type: text("type").notNull().default("direct"), // "direct" | "group"
  model: text("model").notNull().default("claude-sonnet-4-6"),
  createdAt: integer("created_at").notNull().$defaultFn(() => Date.now()),
  updatedAt: integer("updated_at").notNull().$defaultFn(() => Date.now()),
});

// Messages table
export const messages = sqliteTable("messages", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // "user" | "assistant" | "system"
  content: text("content").notNull(),
  createdAt: integer("created_at").notNull().$defaultFn(() => Date.now()),
});

// Settings table
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at").notNull().$defaultFn(() => Date.now()),
});

// Groups table
export const groups = sqliteTable("groups", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  name: text("name").notNull(),
  avatar: text("avatar"),
  createdAt: integer("created_at").notNull().$defaultFn(() => Date.now()),
  updatedAt: integer("updated_at").notNull().$defaultFn(() => Date.now()),
});

// Group members table
export const groupMembers = sqliteTable(
  "group_members",
  {
    id: text("id").primaryKey().$defaultFn(() => nanoid()),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    agentId: text("agent_id").notNull(),
    name: text("name").notNull(),
    emoji: text("emoji"),
    sessionKey: text("session_key"),
    role: text("role").notNull().default("member"),
    order: integer("order").notNull().default(0),
    createdAt: integer("created_at").notNull().$defaultFn(() => Date.now()),
  },
  (table) => ({
    groupAgentUniqueIdx: uniqueIndex("group_members_group_id_agent_id_unique").on(
      table.groupId,
      table.agentId
    ),
  })
);

// Group messages table
export const groupMessages = sqliteTable("group_messages", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  groupId: text("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  senderType: text("sender_type").notNull(),
  senderId: text("sender_id"),
  senderName: text("sender_name"),
  senderEmoji: text("sender_emoji"),
  role: text("role").notNull(),
  content: text("content").notNull(),
  runId: text("run_id"),
  toolCalls: text("tool_calls"),
  createdAt: integer("created_at").notNull().$defaultFn(() => Date.now()),
});

// Relations
export const sessionsRelations = relations(sessions, ({ many }) => ({
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  session: one(sessions, {
    fields: [messages.sessionId],
    references: [sessions.id],
  }),
}));

export const groupsRelations = relations(groups, ({ many }) => ({
  members: many(groupMembers),
  messages: many(groupMessages),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, {
    fields: [groupMembers.groupId],
    references: [groups.id],
  }),
}));

export const groupMessagesRelations = relations(groupMessages, ({ one }) => ({
  group: one(groups, {
    fields: [groupMessages.groupId],
    references: [groups.id],
  }),
}));

// Export schema object
export const schema = {
  sessions,
  messages,
  settings,
  groups,
  groupMembers,
  groupMessages,
  sessionsRelations,
  messagesRelations,
  groupsRelations,
  groupMembersRelations,
  groupMessagesRelations,
};
