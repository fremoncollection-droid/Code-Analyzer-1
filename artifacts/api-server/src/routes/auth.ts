import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET ?? "mirrortech-dev-secret";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "mirrortech-dev-refresh-secret";

function generateTokens(user: { id: string; username: string; email: string; role: string; locationId: string | null }) {
  const payload = { id: user.id, username: user.username, email: user.email, role: user.role, locationId: user.locationId };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });
  const refreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: "7d" });
  return { token, refreshToken };
}

router.post("/login", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ error: "username and password required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (!user.isActive) {
    res.status(403).json({ error: "Account is disabled" });
    return;
  }

  const { token, refreshToken } = generateTokens(user);
  req.log.info({ userId: user.id, role: user.role }, "User logged in");

  res.json({
    token,
    refreshToken,
    user: { id: user.id, username: user.username, email: user.email, role: user.role, locationId: user.locationId },
  });
});

router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) {
    res.status(400).json({ error: "refreshToken required" });
    return;
  }

  let payload: { id: string };
  try {
    payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { id: string };
  } catch {
    res.status(401).json({ error: "Invalid refresh token" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.id)).limit(1);
  if (!user || !user.isActive) {
    res.status(401).json({ error: "User not found or disabled" });
    return;
  }

  const tokens = generateTokens(user);
  res.json({ ...tokens, user: { id: user.id, username: user.username, email: user.email, role: user.role, locationId: user.locationId } });
});

router.get("/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  let payload: { id: string };
  try {
    payload = jwt.verify(token, JWT_SECRET) as { id: string };
  } catch {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.id)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ id: user.id, username: user.username, email: user.email, role: user.role, locationId: user.locationId });
});

export default router;
