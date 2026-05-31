import { Router } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticateToken, authorize } from "../middleware/auth";

const router = Router();

router.get("/", authenticateToken, async (_req, res) => {
  const rows = await db.select().from(settingsTable);
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  // Ensure default VAT rate exists
  if (!settings.vat_rate) settings.vat_rate = "15";
  res.json(settings);
});

router.put("/", authenticateToken, authorize("admin"), async (req, res) => {
  const body = req.body as Record<string, string | number>;
  for (const [key, value] of Object.entries(body)) {
    await db
      .insert(settingsTable)
      .values({ key, value: String(value) })
      .onConflictDoUpdate({
        target: settingsTable.key,
        set: { value: String(value), updatedAt: new Date() },
      });
  }
  const rows = await db.select().from(settingsTable);
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  res.json(settings);
});

export default router;
