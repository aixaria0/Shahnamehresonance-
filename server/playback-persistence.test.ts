import { describe, expect, it } from "vitest";
import { getSentenceIndexAtCharacter, getSpeechSentences } from "../client/src/lib/speechHighlight";
import { clearPlaybackPosition, readHighlightContrastPreference, readPlaybackPosition, saveHighlightContrastPreference, savePlaybackPosition } from "../client/src/lib/playbackPersistence";

describe("sentence-aware playback and persistence", () => {
  it("segments Persian and English response text into speaking sentences", () => {
    const text = "خرد چراغ راه است. پس با آرامش گام بردار؟ Now begin.";
    expect(getSpeechSentences(text).map(sentence => sentence.text)).toEqual(["خرد چراغ راه است.", "پس با آرامش گام بردار؟", "Now begin."]);
    expect(getSentenceIndexAtCharacter(text, 20)).toBe(1);
  });

  it("fails safely when local storage is unavailable during per-session playback persistence", () => {
    expect(readPlaybackPosition(7)).toBeNull();
    expect(() => savePlaybackPosition({ sessionId: 7, messageIndex: 2, wordIndex: 4, sentenceIndex: 1, updatedAt: Date.now() })).not.toThrow();
    expect(() => clearPlaybackPosition(7)).not.toThrow();
    expect(readHighlightContrastPreference()).toBe(false);
    expect(() => saveHighlightContrastPreference(true)).not.toThrow();
  });
});
