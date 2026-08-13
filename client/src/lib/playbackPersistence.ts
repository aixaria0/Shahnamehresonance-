const PLAYBACK_POSITION_KEY = "shahnameh-court-playback-position";
const HIGHLIGHT_CONTRAST_KEY = "shahnameh-court-highlight-contrast";

export type PlaybackPosition = {
  sessionId: number;
  messageIndex: number;
  wordIndex: number;
  sentenceIndex: number;
  updatedAt: number;
};

type PlaybackStore = Record<string, PlaybackPosition>;

function safeStorage() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readPlaybackStore(): PlaybackStore {
  try {
    const raw = safeStorage()?.getItem(PLAYBACK_POSITION_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<PlaybackPosition>;
    if (Number.isInteger(parsed.sessionId)) return { [String(parsed.sessionId)]: parsed as PlaybackPosition };
    return parsed as PlaybackStore;
  } catch {
    return {};
  }
}

export function readPlaybackPosition(sessionId: number | null): PlaybackPosition | null {
  if (!sessionId) return null;
  const position = readPlaybackStore()[String(sessionId)];
  if (!position || !Number.isInteger(position.messageIndex) || !Number.isInteger(position.wordIndex) || !Number.isInteger(position.sentenceIndex)) return null;
  return position;
}

export function savePlaybackPosition(position: PlaybackPosition) {
  try {
    const store = { ...readPlaybackStore(), [String(position.sessionId)]: position };
    safeStorage()?.setItem(PLAYBACK_POSITION_KEY, JSON.stringify(store));
  } catch {}
}

export function clearPlaybackPosition(sessionId: number | null) {
  if (!sessionId) return;
  try {
    const store = readPlaybackStore();
    delete store[String(sessionId)];
    const storage = safeStorage();
    if (!Object.keys(store).length) storage?.removeItem(PLAYBACK_POSITION_KEY);
    else storage?.setItem(PLAYBACK_POSITION_KEY, JSON.stringify(store));
  } catch {}
}

export function readHighlightContrastPreference() {
  try {
    return safeStorage()?.getItem(HIGHLIGHT_CONTRAST_KEY) === "high";
  } catch {
    return false;
  }
}

export function saveHighlightContrastPreference(enabled: boolean) {
  try {
    safeStorage()?.setItem(HIGHLIGHT_CONTRAST_KEY, enabled ? "high" : "standard");
  } catch {}
}
