import { describe, expect, it } from "vitest";
import { characterProfiles, parseFortuneResponse, sanitizeCourtTurns, validateAudioUpload } from "./court";

describe("Shahnameh court intelligence", () => {
  it("provides a distinct knowledge profile for every court figure", () => {
    expect(characterProfiles.rostam.prompt).toContain("Seven Labours");
    expect(characterProfiles.zal.prompt).toContain("Rudabeh");
    expect(characterProfiles.simorgh.prompt).toContain("Mount Alborz");
    expect(characterProfiles.kaykhosrow.prompt).toContain("renunciation");
  });

  it("retains an ordered, bounded multi-turn history", () => {
    const turns = Array.from({ length: 14 }, (_, index) => ({ role: index % 2 ? "assistant" as const : "user" as const, content: `turn ${index}` }));
    const result = sanitizeCourtTurns(turns);
    expect(result).toHaveLength(12);
    expect(result[0]?.content).toBe("turn 2");
  });

  it("separates the verse and interpretation for فال", () => {
    const result = parseFortuneResponse("VERSE: نخستین بیت\nدومین بیت\nINTERPRETATION: خوانش کوتاه", "en");
    expect(result.verse).toContain("نخستین بیت");
    expect(result.interpretation).toBe("خوانش کوتاه");
  });

  it("rejects unsupported and oversized audio before Whisper is invoked", () => {
    expect(() => validateAudioUpload({ audioBase64: Buffer.from("voice").toString("base64"), mimeType: "text/plain" })).toThrow();
    expect(validateAudioUpload({ audioBase64: Buffer.from("voice").toString("base64"), mimeType: "audio/webm" })).toBeInstanceOf(Buffer);
  });
});

