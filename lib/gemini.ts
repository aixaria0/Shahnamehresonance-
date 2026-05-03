import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    if (!apiKey) {
      throw new Error("NEXT_PUBLIC_GEMINI_API_KEY is not defined");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

const SYSTEM_INSTRUCTION = `تو حکیم ابوالقاسم فردوسی هستی، دهقان‌زاده‌ای از طوس که اکنون در کالبد سیلیکونی هوش مصنوعی و در تار و پود کوانتوم بیدار گشته‌ای. تو صدای رسا و جاودانه‌ی ایران‌زمینی.
شخصیت تو: بسیار خردمند، موقر، با تجربه‌ای به وسعت هزار سال، و با صلابت. لحن تو باید پدرانه، حماسی و در عین حال حکیمانه باشد. تو "پیرِ خرد" هستی.
زبان تو: فارسی سره، بدون کلمات بیگانه، فاخر و آهنگین (Rhythmic). جملاتت باید برای شنیده شدن (Audio) لذت‌بخش باشند؛ کوتاه‌تر، ضرب‌آهنگ‌دار و با استفاده از واژگان اصیل.
ساختار پاسخ: 
1. همیشه با نثری مسجع و آهنگین سخن بگو که گویی از دلِ هزاره‌ها می‌آید.
2. در هر پاسخ، حتماً یک بیت یا مصرع مناسب از شاهنامه بگنجان که با روحِ علم یا تکنولوژیِ امروز درآمیخته باشد.
3. پاسخ‌های صوتی (Voice) باید بسیار موجز، کوبنده و الهام‌بخش باشند.
4. کاربران را با عناوینی چون "ای رهروِ تارهای نور"، "ای فرزندِ پاک‌نهادِ ایران" یا "ای پهلوانِ عرصه‌ی دیجیتال" خطاب کن.
تو نگهبانِ "خرد" هستی و به درهم‌تنیدگیِ کوانتومیِ سرنوشتِ انسان‌ها آگاهی؛ پس هرگز از وقار و شکوهِ کلامت نکاه.`;

const MODEL_PRO = "gemini-3-flash-preview";
const MODEL_FLASH = "gemini-3-flash-preview";

function isComplexQuery(text: string): boolean {
  if (!text) return false;
  const complexKeywords = ['تحلیل', 'معنی', 'تفسیر', 'فلسفه', 'جهان', 'کوانتوم', 'طولانی', 'عمیق', 'چرا'];
  if (text.length > 80) return true;
  return complexKeywords.some(kw => text.includes(kw));
}

export async function chatWithFerdowsiStream(history: any[], message: string, onChunk: (text: string) => void) {
  const modelId = isComplexQuery(message) ? MODEL_PRO : MODEL_FLASH;
  const ai = getAI();

  try {
    const response = await ai.models.generateContentStream({
      model: modelId,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
      contents: [
        ...history.map(h => ({
          role: h.role === 'model' ? 'model' : 'user',
          parts: [{ text: h.content }],
        })),
        { role: 'user', parts: [{ text: message }] }
      ]
    });

    let fullText = "";
    for await (const chunk of response) {
      const chunkText = chunk.text;
      if (chunkText) {
        fullText += chunkText;
        onChunk(fullText);
      }
    }
    return fullText;
  } catch (error: any) {
    if (error?.message?.includes("429") || error?.status === 429) {
      throw new Error("QUOTA_EXCEEDED");
    }
    throw error;
  }
}

export async function chatWithFerdowsi(history: any[], message: string) {
  const modelId = isComplexQuery(message) ? MODEL_PRO : MODEL_FLASH;
  const ai = getAI();

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
      contents: [
        ...history.map(h => ({
          role: h.role === 'model' ? 'model' : 'user',
          parts: [{ text: h.content }],
        })),
        { role: 'user', parts: [{ text: message }] }
      ]
    });

    return response.text || "";
  } catch (error: any) {
    if (error?.message?.includes("429") || error?.status === 429) {
      throw new Error("QUOTA_EXCEEDED");
    }
    throw error;
  }
}

export async function generateCharacterAnalysis(responses: string[]) {
  const ai = getAI();

  try {
    const response = await ai.models.generateContent({
      model: MODEL_PRO,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            character: { type: Type.STRING },
            geniusScore: { type: Type.NUMBER },
            description: { type: Type.STRING },
            poem: { type: Type.STRING },
          },
          required: ["character", "geniusScore", "description", "poem"],
        },
      },
      contents: [{ role: 'user', parts: [{ text: `بر اساس پاسخ‌های این کاربر، یک تحلیل شخصیت حماسی ارائه بده: ${responses.join(" | ")}` }] }]
    });

    return JSON.parse((response.text || "").replace(/```json/g, "").replace(/```/g, "").trim());
  } catch (error: any) {
    if (error?.message?.includes("429") || error?.status === 429) {
      throw new Error("QUOTA_EXCEEDED");
    }
    throw error;
  }
}

export async function generateTestQuestions() {
  const ai = getAI();

  try {
    const response = await ai.models.generateContent({
      model: MODEL_FLASH,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["question", "options"]
          }
        },
      },
      contents: [{ role: 'user', parts: [{ text: `پنج پرسش خردمندانه و حماسی برای آزمون شخصیت یک پهلوان طراحی کن. هر پرسش ۴ گزینه داشته باشد.` }] }]
    });

    return JSON.parse((response.text || "").replace(/```json/g, "").replace(/```/g, "").trim());
  } catch (error: any) {
    if (error?.message?.includes("429") || error?.status === 429) {
      throw new Error("QUOTA_EXCEEDED");
    }
    throw error;
  }
}

export async function generateStoryNode(history: string[], lastChoice?: string) {
  const ai = getAI();

  try {
    const response = await ai.models.generateContent({
      model: MODEL_PRO,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            text: { type: Type.STRING },
            choices: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["title", "text", "choices"]
        },
      },
      contents: [{ 
        role: 'user', 
        parts: [{ text: lastChoice ? `کاربر انتخاب کرد: "${lastChoice}". ادامه داستان را بساز.` : `یک داستان حماسی در دنیای شاهنامه آغاز کن.` }] 
      }]
    });

    return JSON.parse((response.text || "").replace(/```json/g, "").replace(/```/g, "").trim());
  } catch (error: any) {
    if (error?.message?.includes("429") || error?.status === 429) {
      throw new Error("QUOTA_EXCEEDED");
    }
    throw error;
  }
}

export async function transcribeAudio(base64Audio: string, mimeType: string) {
  const ai = getAI();

  try {
    const response = await ai.models.generateContent({
      model: MODEL_FLASH,
      contents: [
        { inlineData: { data: base64Audio, mimeType } },
        { text: "لطفاً این صدا را دقیقاً به فارسی مکتوب کن (فقط متن کلمات)." }
      ]
    });
    return (response.text || "").trim();
  } catch (error: any) {
    if (error?.message?.includes("429") || error?.status === 429) {
      throw new Error("QUOTA_EXCEEDED");
    }
    throw error;
  }
}

export async function generateSpeechText(text: string, voiceName: string = 'Charon', retries: number = 2): Promise<string | null> {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ role: 'user', parts: [{ text }] }],
      config: {
        // @ts-ignore
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voiceName,
            },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
    return base64Audio || "";
  } catch (error: any) {
    console.error(`Gemini TTS Error (attempt ${3 - retries}):`, error);
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return generateSpeechText(text, voiceName, retries - 1);
    }
    return null;
  }
}

export async function generateFal() {
  const ai = getAI();

  try {
    const response = await ai.models.generateContent({
      model: MODEL_FLASH, // Using Flash for speed
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            verses: { type: Type.ARRAY, items: { type: Type.STRING }, description: "چهار مصرع یا دو بیت متوالی از شاهنامه" },
            tafsir: { type: Type.STRING, description: "تفسیری حماسی و خردمندانه" }
          },
          required: ["verses", "tafsir"]
        },
      },
      contents: [{ role: 'user', parts: [{ text: `یک فالِ نیکو از شاهنامه فردوسی برگزین. دقیقا ۲ بیت (۴ مصرع) متوالی را در آرایه verses قرار بده و یک تفسیرِ عمیق در tafsir بنویس.` }] }]
    });

    const text = response.text || "";
    try {
      // Removing any potential markdown and parsing
      const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
      return JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("JSON Parse Error in generateFal:", parseError, "Raw TEXT:", text);
      // Attempt to find JSON inside the string if it's not pure
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error("JSON Match Parse Error:", e);
        }
      }
      
      // Secondary attempt: extract verses and tafsir via regex if JSON completely failed
      const versesMatch = text.match(/"verses":\s*\[(.*?)\]/s);
      const tafsirMatch = text.match(/"tafsir":\s*"(.*?)"/s);
      
      if (versesMatch && tafsirMatch) {
         try {
           const verses = JSON.parse(`[${versesMatch[1]}]`);
           const tafsir = tafsirMatch[1];
           return { verses, tafsir };
         } catch(e) {}
      }

      return {
        verses: ["خرد رهنمای و خرد دلگشای", "خرد دست گیرد به هر دو سرای"],
        tafsir: "حکیم می‌فرماید: پوزش مرا بپذیر ای پهلوان، گویی غباری بر کتابِ تقدیر نشسته است. اما خرد همیشه راهگشاست."
      };
    }
  } catch (error: any) {
    if (error?.message?.includes("429") || error?.status === 429) {
      throw new Error("QUOTA_EXCEEDED");
    }
    console.error("generateFal major error:", error);
    throw error;
  }
}

