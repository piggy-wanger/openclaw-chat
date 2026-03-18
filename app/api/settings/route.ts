import { NextResponse } from "next/server";
import { db, settings } from "@/db";
import { eq } from "drizzle-orm";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { SettingsResponse, SettingsRequest, ErrorResponse } from "@/lib/types";

const DATA_DIR = join(process.cwd(), "data");
const BACKUP_FILE = join(DATA_DIR, ".settings-backup.json");

// GET /api/settings - Get all settings
export async function GET(): Promise<NextResponse<SettingsResponse | ErrorResponse>> {
  try {
    const allSettings = await db.select().from(settings);

    const settingsMap: Record<string, string> = {};
    for (const setting of allSettings) {
      settingsMap[setting.key] = setting.value;
    }

    return NextResponse.json({ settings: settingsMap });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings", status: 500 },
      { status: 500 }
    );
  }
}

// PUT /api/settings - Update settings
export async function PUT(request: Request): Promise<NextResponse<SettingsResponse | ErrorResponse>> {
  try {
    const body = (await request.json()) as SettingsRequest;

    if (!body.settings || typeof body.settings !== "object") {
      return NextResponse.json(
        { error: "settings object is required", status: 400 },
        { status: 400 }
      );
    }

    // Ensure data directory exists
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }

    // Backup current settings
    try {
      const currentSettings = await db.select().from(settings);
      const backupData: Record<string, string> = {};
      for (const setting of currentSettings) {
        backupData[setting.key] = setting.value;
      }
      writeFileSync(BACKUP_FILE, JSON.stringify(backupData, null, 2), "utf-8");
    } catch (backupError) {
      console.error("Warning: Failed to backup settings:", backupError);
      // Continue with update even if backup fails
    }

    // Upsert each setting
    const now = Date.now();
    for (const [key, value] of Object.entries(body.settings)) {
      // Check if setting exists
      const existing = await db
        .select()
        .from(settings)
        .where(eq(settings.key, key))
        .limit(1);

      if (existing.length > 0) {
        // Update existing setting
        await db
          .update(settings)
          .set({ value, updatedAt: now })
          .where(eq(settings.key, key));
      } else {
        // Insert new setting
        await db.insert(settings).values({
          key,
          value,
          updatedAt: now,
        });
      }
    }

    // Fetch all updated settings
    const allSettings = await db.select().from(settings);
    const settingsMap: Record<string, string> = {};
    for (const setting of allSettings) {
      settingsMap[setting.key] = setting.value;
    }

    return NextResponse.json({ settings: settingsMap });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings", status: 500 },
      { status: 500 }
    );
  }
}
