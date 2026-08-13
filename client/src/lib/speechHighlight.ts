export type SpeechWord = { text: string; start: number; end: number };
export type SpeechSentence = { text: string; start: number; end: number };

export function normalizeSpeechText(content: string) {
  return content
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/[*_#>`]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([،؛,.!?])/g, "$1")
    .trim();
}

export function getSpeechWords(content: string): SpeechWord[] {
  const text = normalizeSpeechText(content);
  return Array.from(text.matchAll(/\S+/g)).map(match => ({
    text: match[0],
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
}

export function getWordIndexAtCharacter(content: string, characterIndex: number) {
  const words = getSpeechWords(content);
  if (!words.length || characterIndex < 0) return null;
  const index = words.findIndex(word => characterIndex >= word.start && characterIndex < word.end);
  if (index >= 0) return index;
  const nextIndex = words.findIndex(word => word.start > characterIndex);
  return nextIndex >= 0 ? nextIndex : words.length - 1;
}

export function getSpeechSentences(content: string): SpeechSentence[] {
  const text = normalizeSpeechText(content);
  return Array.from(text.matchAll(/[^.!?؟]+[.!?؟]*/g))
    .map(match => ({ text: match[0].trim(), start: match.index ?? 0, end: (match.index ?? 0) + match[0].length }))
    .filter(sentence => sentence.text.length > 0);
}

export function getSentenceIndexAtCharacter(content: string, characterIndex: number) {
  const sentences = getSpeechSentences(content);
  if (!sentences.length || characterIndex < 0) return null;
  const index = sentences.findIndex(sentence => characterIndex >= sentence.start && characterIndex < sentence.end);
  if (index >= 0) return index;
  const nextIndex = sentences.findIndex(sentence => sentence.start > characterIndex);
  return nextIndex >= 0 ? nextIndex : sentences.length - 1;
}
