import { describe, expect, it } from "vitest";
import { characterMeta, COURT_CHARACTERS } from "../client/src/lib/court";

describe("legendary court voice profiles", () => {
  it("assigns a complete and distinct speech signature to every court figure", () => {
    const signatures = COURT_CHARACTERS.map(character => {
      const profile = characterMeta[character].voice;
      expect(profile.label).toBeTruthy();
      expect(profile.hints.length).toBeGreaterThan(0);
      expect(profile.rate).toBeGreaterThanOrEqual(0.5);
      expect(profile.rate).toBeLessThanOrEqual(2);
      expect(profile.pitch).toBeGreaterThanOrEqual(0);
      expect(profile.pitch).toBeLessThanOrEqual(2);
      return `${profile.rate}:${profile.pitch}`;
    });
    expect(new Set(signatures).size).toBe(COURT_CHARACTERS.length);
  });

  it("keeps the Simorgh voice more elevated and measured than Rostam’s voice", () => {
    expect(characterMeta.simorgh.voice.pitch).toBeGreaterThan(characterMeta.rostam.voice.pitch);
    expect(characterMeta.simorgh.voice.rate).toBeLessThan(characterMeta.zal.voice.rate);
  });
});
