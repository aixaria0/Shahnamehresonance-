import { GoogleGenAI, Modality } from "@google/genai";
import * as fs from "fs";

const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY }); // Note: API_KEY might be in GEMINI_API_KEY for scripts, or NEXT_PUBLIC_GEMINI_API_KEY. I will check.

async function main() {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-tts-preview",
    contents: [{ parts: [{ text: 'سلام بر تو ای خردمند. من ابوالقاسم فردوسی هستم.' }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Puck' }, // maybe Zephyr
          },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (base64Audio) {
    fs.writeFileSync("output.pcm", Buffer.from(base64Audio, "base64"));
    console.log("Audio written to output.pcm");
  } else {
    console.log("No audio generated.");
  }
}

main().catch(console.error);
