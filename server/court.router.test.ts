import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  createCourtSession: vi.fn(),
  listCourtSessions: vi.fn(),
  listFavoriteCharacters: vi.fn(),
  toggleFavoriteCharacter: vi.fn(),
}));

vi.mock("./db", () => ({
  addCourtMessage: vi.fn(),
  createCourtSession: dbMocks.createCourtSession,
  getCourtSession: vi.fn(),
  listCourtMessages: vi.fn(),
  listCourtSessions: dbMocks.listCourtSessions,
  listFavoriteCharacters: dbMocks.listFavoriteCharacters,
  renameCourtSession: vi.fn(),
  saveFortune: vi.fn(),
  toggleFavoriteCharacter: dbMocks.toggleFavoriteCharacter,
}));

vi.mock("./court", () => ({
  COURT_CHARACTERS: ["rostam", "zal", "simorgh", "kaykhosrow"],
  generateCourtReply: vi.fn(),
  generateFortune: vi.fn(),
  isCourtCharacter: vi.fn(),
  sanitizeCourtTurns: vi.fn((turns: unknown[]) => turns),
  validateAudioUpload: vi.fn(),
}));

const { appRouter } = await import("./routers");

function authenticatedContext(): TrpcContext {
  return {
    user: {
      id: 42, openId: "court-test-user", name: "Court Test", email: null,
      loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {}, get: () => "court.test" } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as TrpcContext["res"],
  };
}

describe("court persistence routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a persisted session for the authenticated owner", async () => {
    dbMocks.createCourtSession.mockResolvedValue({ id: 9, userId: 42, title: "نخستین سخن", character: "rostam", language: "fa" });
    const caller = appRouter.createCaller(authenticatedContext());
    const result = await caller.court.sessions.create({ title: "نخستین سخن", character: "rostam", language: "fa" });
    expect(result).toMatchObject({ id: 9, userId: 42, character: "rostam" });
    expect(dbMocks.createCourtSession).toHaveBeenCalledWith(expect.objectContaining({ userId: 42, title: "نخستین سخن" }));
  });

  it("returns only the current user’s session collection", async () => {
    dbMocks.listCourtSessions.mockResolvedValue([{ id: 4, userId: 42, title: "دیوانِ من" }]);
    const caller = appRouter.createCaller(authenticatedContext());
    const result = await caller.court.sessions.list();
    expect(result).toEqual([{ id: 4, userId: 42, title: "دیوانِ من" }]);
    expect(dbMocks.listCourtSessions).toHaveBeenCalledWith(42);
  });

  it("toggles a favorite character against the authenticated user", async () => {
    dbMocks.toggleFavoriteCharacter.mockResolvedValue(true);
    const caller = appRouter.createCaller(authenticatedContext());
    await expect(caller.court.favorites.toggle({ character: "simorgh" })).resolves.toEqual({ isFavorite: true });
    expect(dbMocks.toggleFavoriteCharacter).toHaveBeenCalledWith(42, "simorgh");
  });
});
