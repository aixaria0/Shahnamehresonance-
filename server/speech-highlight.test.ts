import { describe, expect, it } from "vitest";
import { getSpeechWords, getWordIndexAtCharacter, normalizeSpeechText } from "../client/src/lib/speechHighlight";

describe("speech-boundary highlighting", () => {
  it("normalizes markdown before the response is spoken and highlighted", () => {
    expect(normalizeSpeechText("**درود**، [شاهنامه](https://example.com) > اکنون")).toBe("درود، شاهنامه اکنون");
  });

  it("maps speech boundary character positions to visible words", () => {
    const text = "توانا بود هر که دانا بود";
    expect(getSpeechWords(text).map(word => word.text)).toEqual(["توانا", "بود", "هر", "که", "دانا", "بود"]);
    expect(getWordIndexAtCharacter(text, 0)).toBe(0);
    expect(getWordIndexAtCharacter(text, 7)).toBe(1);
    expect(getWordIndexAtCharacter(text, 10)).toBe(2);
  });

  it("uses a safe final-word fallback when a browser reports a late boundary", () => {
    expect(getWordIndexAtCharacter("خرد راهنماست", 999)).toBe(1);
    expect(getWordIndexAtCharacter("", 0)).toBeNull();
  });
});
