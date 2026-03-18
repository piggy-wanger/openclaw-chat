import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { mkdirSync, existsSync } from "fs";
import { join } from "path";
import * as schema from "./schema";

// Database file path
const DATA_DIR = join(process.cwd(), "data");
const DB_PATH = join(DATA_DIR, "chat.db");

// Create data directory if it doesn't exist
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// Create SQLite connection
const sqlite = new Database(DB_PATH);

// Initialize Drizzle ORM
export const db = drizzle(sqlite, { schema });

// Export schema
export * from "./schema";
