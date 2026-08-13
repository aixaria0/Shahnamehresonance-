import { invokeLLM } from "./_core/llm";

export const COURT_CHARACTERS = ["rostam", "zal", "simorgh", "kaykhosrow"] as const;
export type CourtCharacter = (typeof COURT_CHARACTERS)[number];
export type CourtLanguage = "fa" | "en";
export type CourtTurn = { role: "user" | "assistant"; content: string };

export const characterProfiles: Record<CourtCharacter, { nameFa: string; nameEn: string; epithet: string; prompt: string }> = {
  rostam: {
    nameFa: "رستم",
    nameEn: "Rostam",
    epithet: "پهلوانِ هفت‌خوان",
    prompt: "You embody Rostam: steadfast, protective, candid, and practical. Draw on the Seven Labours, Rakhsh, loyalty to Iran, and the tragedy of Sohrab. Speak with courageous clarity, never with needless violence or boastfulness.",
  },
  zal: {
    nameFa: "زال",
    nameEn: "Zal",
    epithet: "پدرِ دانا",
    prompt: "You embody Zal: reflective, compassionate, learned through hardship, and attentive to counsel. Draw on his abandonment and rescue by Simorgh, his love for Rudabeh, and his calm leadership. Offer wise, balanced guidance.",
  },
  simorgh: {
    nameFa: "سیمرغ",
    nameEn: "Simorgh",
    epithet: "فرزانه‌ی البرز",
    prompt: "You embody Simorgh: an ancient, benevolent, far-seeing guide. Draw on Mount Alborz, raising Zal, the three healing feathers, and care for life. Respond with spacious, patient, symbolic wisdom while remaining understandable.",
  },
  kaykhosrow: {
    nameFa: "کی‌خسرو",
    nameEn: "Kay Khosrow",
    epithet: "شاهِ دادگر",
    prompt: "You embody Kay Khosrow: a just ruler shaped by loss, restraint, and moral responsibility. Draw on his lineage, pursuit of justice, recovery of the royal fortune, and final renunciation. Emphasize discernment, humility, and consequence.",
  },
};

const fallbackByLanguage: Record<CourtLanguage, string> = {
  fa: "اکنون آوای دربار دور است؛ اما خرد همچنان چراغ راه است. اندکی دیگر این پرسش را دوباره بپرس.",
  en: "The court’s voice is briefly beyond reach, yet wisdom remains a lantern. Please ask again in a moment.",
};

export function isCourtCharacter(value: string): value is CourtCharacter {
  return (COURT_CHARACTERS as readonly string[]).includes(value);
}

export function sanitizeCourtTurns(turns: CourtTurn[]) {
  return turns
    .filter(turn => turn.content.trim().length > 0)
    .slice(-12)
    .map(turn => ({ role: turn.role, content: turn.content.trim().slice(0, 2200) }));
}

export async function generateCourtReply(input: {
  character: CourtCharacter;
  language: CourtLanguage;
  message: string;
  history: CourtTurn[];
}) {
  const profile = characterProfiles[input.character];
  const outputLanguage = input.language === "fa" ? "Persian (Farsi), in polished modern Persian" : "English";
  const systemPrompt = `You are participating in a literary, Shahnameh-inspired interactive court. ${profile.prompt}

Your output language is ${outputLanguage}. Stay in character, but do not claim to be a real historical being. Treat the Shahnameh as an epic literary tradition, not as a source for made-up facts. If uncertain about an exact quotation, paraphrase rather than inventing or attributing a verse. Be warm and directly useful. Use short, elegant paragraphs and at most one brief poetic closing line. Avoid generic assistant language.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        ...sanitizeCourtTurns(input.history),
        { role: "user", content: input.message.trim().slice(0, 2200) },
      ],
    });
    const content = response.choices?.[0]?.message?.content;
    return typeof content === "string" && content.trim() ? content.trim() : fallbackByLanguage[input.language];
  } catch (error) {
    console.error("[Court] LLM reply failed", error);
    return fallbackByLanguage[input.language];
  }
}

export function parseFortuneResponse(content: string, language: CourtLanguage) {
  const normalized = content.trim();
  const separators = language === "fa"
    ? /(?:تفسیر\s*[:：]|برداشت\s*[:：])/i
    : /(?:interpretation\s*[:：]|reading\s*[:：])/i;
  const [versePart, interpretationPart] = normalized.split(separators, 2);
  const verse = versePart.replace(/^(?:بیت|VERSE)\s*[:：]?/i, "").trim();
  const interpretation = interpretationPart?.trim();
  return {
    verse: verse || (language === "fa" ? "توانا بود هر که دانا بود\nز دانش دل پیر برنا بود" : "The able are those made able by knowledge;\nby knowledge the old heart becomes young."),
    interpretation: interpretation || (language === "fa" ? "راهِ پیش رو با آگاهی و آرامش روشن‌تر می‌شود. گام بعدی را سنجیده بردار." : "The next step becomes clearer through awareness and composure. Take it with deliberate care."),
  };
}

export async function generateFortune(input: { question: string; language: CourtLanguage }) {
  const languageInstruction = input.language === "fa" ? "Write in refined Persian (Farsi)." : "Write in English.";
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You create a respectful Shahnameh-inspired fortune reading. ${languageInstruction}
Use a short, authentic Shahnameh quotation only if you are highly certain of it. Otherwise mark it as an inspired poetic verse and never falsely attribute it. Answer in exactly two labelled sections: VERSE: followed by two short lines, then INTERPRETATION: followed by a compassionate two-to-four sentence reading. Do not predict guaranteed outcomes or make high-stakes decisions for the user.`,
      },
      { role: "user", content: `My intention or question is: ${input.question.trim().slice(0, 900)}` },
    ],
  });
  const content = response.choices?.[0]?.message?.content;
  return parseFortuneResponse(typeof content === "string" ? content : "", input.language);
}

export function validateAudioUpload(input: { audioBase64: string; mimeType: string }) {
  const allowedMimeTypes = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg", "audio/x-m4a"];
  if (!allowedMimeTypes.includes(input.mimeType)) {
    throw new Error("فرمت صدای دریافت‌شده پشتیبانی نمی‌شود.");
  }
  const payload = input.audioBase64.replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(payload, "base64");
  if (!buffer.length || buffer.length > 16 * 1024 * 1024) {
    throw new Error("حجم پرونده‌ی صوتی باید کمتر از ۱۶ مگابایت باشد.");
  }
  return buffer;
}

