import { afterEach, describe, expect, it, vi } from "vitest";
import { completeCourtTour, hasCompletedCourtTour } from "../client/src/lib/onboarding";

afterEach(() => vi.unstubAllGlobals());

describe("first-visit court tour", () => {
  it("is safely incomplete when browser storage is unavailable", () => {
    expect(hasCompletedCourtTour()).toBe(false);
  });

  it("does not throw when tour completion storage is unavailable", () => {
    expect(() => completeCourtTour()).not.toThrow();
  });

  it("persists the completion choice and suppresses the repeat tour", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });

    expect(hasCompletedCourtTour()).toBe(false);
    completeCourtTour();
    expect(hasCompletedCourtTour()).toBe(true);
  });
});
