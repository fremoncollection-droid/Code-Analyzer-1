import { Router } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import path from "path";
import fs from "fs";

const router = Router();

router.get("/settings", async (_req, res) => {
  const rows = await db.select().from(settingsTable);
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  // Ensure defaults
  if (!settings.app_name) settings.app_name = "MirrorTech POS";
  if (!settings.vat_rate) settings.vat_rate = "15";

  // Check for uploaded logo file
  const uploadsDir = path.resolve(process.cwd(), "public", "uploads");
  const logoPath = path.join(uploadsDir, "logo.png");
  if (fs.existsSync(logoPath)) {
    settings.logo_url = "/api/uploads/logo.png";
  }

  res.json(settings);
});

export default router;
