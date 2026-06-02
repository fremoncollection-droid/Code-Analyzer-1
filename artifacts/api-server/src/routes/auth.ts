import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET ?? "mirrortech-dev-secret";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "mirrortech-dev-refresh-secret";

// PIN rate limiting: 3 failures = 5min lockout
const pinAttempts = new Map<string, { count: number; lockedUntil: number }>();

function getPinAttemptKey(userId: string, ip?: string) {
  return ip ? `${userId}@${ip}` : userId;
}

function checkPinLockout(userId: string, ip?: string): { locked: boolean; remainingMs?: number } {
  const key = getPinAttemptKey(userId, ip);
  const record = pinAttempts.get(key);
  if (!record) return { locked: false };
  const now = Date.now();
  if (record.lockedUntil > now) {
    return { locked: true, remainingMs: record.lockedUntil - now };
  }
  return { locked: false };
}

function recordPinFailure(userId: string, ip?: string) {
  const key = getPinAttemptKey(userId, ip);
  const record = pinAttempts.get(key);
  const now = Date.now();
  if (!record) {
    pinAttempts.set(key, { count: 1, lockedUntil: 0 });
  } else {
    record.count += 1;
    if (record.count >= 3) {
      record.lockedUntil = now + 5 * 60 * 1000;
    }
  }
}

function clearPinFailures(userId: string, ip?: string) {
  pinAttempts.delete(getPinAttemptKey(userId, ip));
}

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

router.post("/pin-login", async (req, res) => {
  const { username, pin } = req.body as { username?: string; pin?: string };
  if (!username || !pin) {
    res.status(400).json({ error: "username and pin required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const ip = req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || undefined;
  const lockout = checkPinLockout(user.id, ip);
  if (lockout.locked) {
    const mins = Math.ceil((lockout.remainingMs ?? 0) / 60000);
    res.status(429).json({ error: `Account locked. Try again in ${mins} minute(s).` });
    return;
  }

  if (!user.pinHash) {
    res.status(403).json({ error: "PIN not set for this user" });
    return;
  }

  const valid = await bcrypt.compare(pin, user.pinHash);
  if (!valid) {
    recordPinFailure(user.id, ip);
    const attempts = pinAttempts.get(getPinAttemptKey(user.id, ip));
    const remaining = attempts ? Math.max(0, 3 - attempts.count) : 2;
    res.status(401).json({ error: "Invalid PIN", remainingAttempts: remaining });
    return;
  }

  if (!user.isActive) {
    res.status(403).json({ error: "Account is disabled" });
    return;
  }

  clearPinFailures(user.id, ip);

  const { token, refreshToken } = generateTokens(user);
  req.log.info({ userId: user.id, role: user.role, method: "pin" }, "User logged in with PIN");

  res.json({
    token,
    refreshToken,
    user: { id: user.id, username: user.username, email: user.email, role: user.role, locationId: user.locationId, station: user.station },
  });
});

router.post("/manager-override", async (req, res) => {
  const { username, pin } = req.body as { username?: string; pin?: string };
  if (!username || !pin) {
    res.status(400).json({ error: "username and pin required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (user.role !== "manager" && user.role !== "admin") {
    res.status(403).json({ error: "Only manager or admin can override" });
    return;
  }

  if (!user.pinHash) {
    res.status(403).json({ error: "PIN not set for this user" });
    return;
  }

  const valid = await bcrypt.compare(pin, user.pinHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid PIN" });
    return;
  }

  if (!user.isActive) {
    res.status(403).json({ error: "Account is disabled" });
    return;
  }

  // Generate a short-lived override token (5 minutes)
  const overrideToken = jwt.sign(
    { id: user.id, username: user.username, role: user.role, type: "override" },
    JWT_SECRET,
    { expiresIn: "5m" }
  );

  req.log.info({ managerId: user.id, cashierId: (req as any).user?.id }, "Manager override granted");

  res.json({ overrideToken, managerId: user.id, managerName: user.username, expiresIn: "5m" });
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

  res.json({ id: user.id, username: user.username, email: user.email, role: user.role, locationId: user.locationId, station: user.station });
});

export default router;
