import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
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

// Export schema object
export const schema = {
  sessions,
  messages,
  settings,
  sessionsRelations,
  messagesRelations,
};
