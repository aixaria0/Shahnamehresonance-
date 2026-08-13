import {
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const courtSessions = mysqlTable(
  "court_sessions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    character: varchar("character", { length: 32 }).notNull(),
    language: mysqlEnum("language", ["fa", "en"]).default("fa").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    userUpdatedIndex: index("court_sessions_user_updated_idx").on(table.userId, table.updatedAt),
  })
);

export const courtMessages = mysqlTable(
  "court_messages",
  {
    id: int("id").autoincrement().primaryKey(),
    sessionId: int("sessionId").notNull(),
    role: mysqlEnum("role", ["user", "assistant"]).notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    sessionCreatedIndex: index("court_messages_session_created_idx").on(table.sessionId, table.createdAt),
  })
);

export const favoriteCharacters = mysqlTable(
  "favorite_characters",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    character: varchar("character", { length: 32 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    userCharacterUnique: uniqueIndex("favorite_characters_user_character_unique").on(table.userId, table.character),
  })
);

export const fortunes = mysqlTable(
  "fortunes",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId"),
    question: text("question").notNull(),
    verse: text("verse").notNull(),
    interpretation: text("interpretation").notNull(),
    language: mysqlEnum("language", ["fa", "en"]).default("fa").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    userCreatedIndex: index("fortunes_user_created_idx").on(table.userId, table.createdAt),
  })
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type CourtSession = typeof courtSessions.$inferSelect;
export type CourtMessage = typeof courtMessages.$inferSelect;

