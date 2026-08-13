import { z } from "zod";
import { nanoid } from "nanoid";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { transcribeAudio } from "./_core/voiceTranscription";
import { storagePut } from "./storage";
import {
  COURT_CHARACTERS,
  generateCourtReply,
  generateFortune,
  isCourtCharacter,
  sanitizeCourtTurns,
  validateAudioUpload,
} from "./court";
import {
  addCourtMessage,
  createCourtSession,
  getCourtSession,
  listCourtMessages,
  listCourtSessions,
  listFavoriteCharacters,
  renameCourtSession,
  saveFortune,
  toggleFavoriteCharacter,
} from "./db";

const characterSchema = z.enum(COURT_CHARACTERS);
const languageSchema = z.enum(["fa", "en"]);
const turnSchema = z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(2200) });

const stories = [
  {
    id: "rostam-sohrab",
    title: "رستم و سهراب",
    subtitle: "پیکارِ نادانی و بهای دیرشناختن",
    summary: "داستانِ پدر و پسری است که پیش از شناختِ یکدیگر رو‌در‌روی هم می‌ایستند. این روایت، نیرو را بدون آگاهی ناکافی می‌داند و بر ارزشِ نام، نشان و گفت‌وگو تأکید می‌کند.",
  },
  {
    id: "siavash",
    title: "سیاوش",
    subtitle: "پاکی در آتشِ آزمایش",
    summary: "سیاوش با راستی و خویشتن‌داری از آزمونِ آتش می‌گذرد، اما در جهانِ بدگمانی و سیاست، بی‌گناهی به‌تنهایی پناهِ کامل نیست. داستان او یادآورِ پاس‌داشتِ وفاداری و سنجشِ قدرت است.",
  },
  {
    id: "zal-rudabeh",
    title: "زال و رودابه",
    subtitle: "پیوندی که مرزها را دگرگون می‌کند",
    summary: "این عشق میان دو خاندانِ رقیب با گفت‌وگو، جسارت و خردِ میانجیان به سرانجام می‌رسد. روایت نشان می‌دهد که تبار، هنگامی که خرد و مهر حاضر است، نمی‌تواند سرنوشت را به‌تنهایی تعیین کند.",
  },
] as const;

function extensionForMime(mimeType: string) {
  return ({ "audio/webm": "webm", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/ogg": "ogg", "audio/x-m4a": "m4a" } as Record<string, string>)[mimeType] ?? "webm";
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  court: router({
    characters: publicProcedure.query(() => COURT_CHARACTERS),
    stories: publicProcedure.query(() => stories),
    chat: publicProcedure.input(z.object({
      character: characterSchema,
      language: languageSchema,
      message: z.string().min(1).max(2200),
      history: z.array(turnSchema).max(12).optional(),
      sessionId: z.number().int().positive().optional(),
    })).mutation(async ({ ctx, input }) => {
      let history = sanitizeCourtTurns(input.history ?? []);
      if (input.sessionId) {
        if (!ctx.user) throw new Error("برای نگه‌داشتن گفت‌وگو نخست وارد حساب شوید.");
        const session = await getCourtSession(ctx.user.id, input.sessionId);
        if (!session) throw new Error("این گفت‌وگو در دیوان شما یافت نشد.");
        const stored = await listCourtMessages(input.sessionId);
        history = sanitizeCourtTurns(stored.map(item => ({ role: item.role, content: item.content })));
        await addCourtMessage({ sessionId: input.sessionId, role: "user", content: input.message });
      }
      const reply = await generateCourtReply({ character: input.character, language: input.language, message: input.message, history });
      if (input.sessionId) await addCourtMessage({ sessionId: input.sessionId, role: "assistant", content: reply });
      return { reply };
    }),
    fortune: publicProcedure.input(z.object({ question: z.string().min(2).max(900), language: languageSchema })).mutation(async ({ ctx, input }) => {
      const result = await generateFortune(input);
      try {
        await saveFortune({ ...input, ...result, userId: ctx.user?.id });
      } catch (error) {
        console.warn("[Court] Fortune persistence skipped", error);
      }
      return result;
    }),
    storyCommentary: publicProcedure.input(z.object({ storyId: z.string().min(1), question: z.string().max(900).optional(), language: languageSchema })).mutation(async ({ input }) => {
      const story = stories.find(item => item.id === input.storyId);
      if (!story) throw new Error("داستان در دفترِ شاهنامه پیدا نشد.");
      return {
        commentary: await generateCourtReply({
          character: "simorgh",
          language: input.language,
          history: [],
          message: `Offer concise context and a thoughtful present-day reflection on this Shahnameh tale: ${story.title}. Summary: ${story.summary}. Reader's focus: ${input.question || "What can this story teach us today?"}`,
        }),
      };
    }),
    voice: publicProcedure.input(z.object({ audioBase64: z.string().min(20), mimeType: z.string().min(3) })).mutation(async ({ ctx, input }) => {
      const audio = validateAudioUpload(input);
      const key = `court-voice/${ctx.user?.id ?? "guest"}/${nanoid()}.${extensionForMime(input.mimeType)}`;
      const uploaded = await storagePut(key, audio, input.mimeType);
      const audioUrl = uploaded.url.startsWith("http")
        ? uploaded.url
        : new URL(uploaded.url, `${ctx.req.protocol}://${ctx.req.get("host")}`).toString();
      const transcription = await transcribeAudio({ audioUrl, language: "fa", prompt: "Persian Shahnameh court conversation. Preserve Persian names such as Rostam, Zal, Simorgh, and Kay Khosrow." });
      if ("error" in transcription) {
        throw new Error(transcription.error);
      }
      return { text: transcription.text, language: transcription.language };
    }),
    sessions: router({
      list: protectedProcedure.query(({ ctx }) => listCourtSessions(ctx.user.id)),
      create: protectedProcedure.input(z.object({ title: z.string().max(180).optional(), character: characterSchema, language: languageSchema })).mutation(({ ctx, input }) =>
        createCourtSession({ userId: ctx.user.id, title: input.title || "گفت‌وگوی تازه", character: input.character, language: input.language })
      ),
      messages: protectedProcedure.input(z.object({ sessionId: z.number().int().positive() })).query(async ({ ctx, input }) => {
        const session = await getCourtSession(ctx.user.id, input.sessionId);
        if (!session) throw new Error("این گفت‌وگو در دیوان شما یافت نشد.");
        return listCourtMessages(input.sessionId);
      }),
      rename: protectedProcedure.input(z.object({ sessionId: z.number().int().positive(), title: z.string().min(1).max(180) })).mutation(async ({ ctx, input }) => {
        await renameCourtSession(ctx.user.id, input.sessionId, input.title);
        return { success: true };
      }),
    }),
    favorites: router({
      list: protectedProcedure.query(({ ctx }) => listFavoriteCharacters(ctx.user.id)),
      toggle: protectedProcedure.input(z.object({ character: characterSchema })).mutation(async ({ ctx, input }) => ({
        isFavorite: await toggleFavoriteCharacter(ctx.user.id, input.character),
      })),
    }),
  }),
});

export type AppRouter = typeof appRouter;
