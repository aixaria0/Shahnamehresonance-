import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  courtMessages,
  courtSessions,
  favoriteCharacters,
  fortunes,
  InsertUser,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("پایگاه داده در دسترس نیست. لطفاً اندکی دیگر دوباره تلاش کنید.");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listCourtSessions(userId: number) {
  const db = await requireDb();
  return db.select().from(courtSessions).where(eq(courtSessions.userId, userId)).orderBy(desc(courtSessions.updatedAt));
}

export async function createCourtSession(input: { userId: number; title: string; character: string; language: "fa" | "en" }) {
  const db = await requireDb();
  const result = await db.insert(courtSessions).values({
    userId: input.userId,
    title: input.title.trim().slice(0, 180) || "گفت‌وگوی تازه",
    character: input.character,
    language: input.language,
  });
  const insertId = Number((result as unknown as { insertId?: number; 0?: { insertId?: number } }).insertId ?? (result as unknown as { 0?: { insertId?: number } })[0]?.insertId);
  const session = await db.select().from(courtSessions).where(eq(courtSessions.id, insertId)).limit(1);
  return session[0];
}

export async function getCourtSession(userId: number, sessionId: number) {
  const db = await requireDb();
  const result = await db.select().from(courtSessions).where(and(eq(courtSessions.id, sessionId), eq(courtSessions.userId, userId))).limit(1);
  return result[0];
}

export async function listCourtMessages(sessionId: number) {
  const db = await requireDb();
  return db.select().from(courtMessages).where(eq(courtMessages.sessionId, sessionId)).orderBy(courtMessages.createdAt);
}

export async function addCourtMessage(input: { sessionId: number; role: "user" | "assistant"; content: string }) {
  const db = await requireDb();
  await db.insert(courtMessages).values({ sessionId: input.sessionId, role: input.role, content: input.content.trim().slice(0, 5000) });
  await db.update(courtSessions).set({ updatedAt: new Date() }).where(eq(courtSessions.id, input.sessionId));
}

export async function renameCourtSession(userId: number, sessionId: number, title: string) {
  const db = await requireDb();
  await db.update(courtSessions).set({ title: title.trim().slice(0, 180), updatedAt: new Date() }).where(and(eq(courtSessions.id, sessionId), eq(courtSessions.userId, userId)));
}

export async function listFavoriteCharacters(userId: number) {
  const db = await requireDb();
  return db.select().from(favoriteCharacters).where(eq(favoriteCharacters.userId, userId)).orderBy(desc(favoriteCharacters.createdAt));
}

export async function toggleFavoriteCharacter(userId: number, character: string) {
  const db = await requireDb();
  const found = await db.select().from(favoriteCharacters).where(and(eq(favoriteCharacters.userId, userId), eq(favoriteCharacters.character, character))).limit(1);
  if (found[0]) {
    await db.delete(favoriteCharacters).where(eq(favoriteCharacters.id, found[0].id));
    return false;
  }
  await db.insert(favoriteCharacters).values({ userId, character });
  return true;
}

export async function saveFortune(input: { userId?: number; question: string; verse: string; interpretation: string; language: "fa" | "en" }) {
  const db = await requireDb();
  await db.insert(fortunes).values(input);
}

