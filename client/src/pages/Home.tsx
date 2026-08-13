import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { characterMeta, CharacterId, COURT_CHARACTERS, quickPrompts } from "@/lib/court";
import { completeCourtTour, hasCompletedCourtTour } from "@/lib/onboarding";
import { clearPlaybackPosition, readHighlightContrastPreference, readPlaybackPosition, saveHighlightContrastPreference, savePlaybackPosition } from "@/lib/playbackPersistence";
import { getSentenceIndexAtCharacter, getSpeechSentences, getSpeechWords, getWordIndexAtCharacter, normalizeSpeechText } from "@/lib/speechHighlight";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Streamdown } from "streamdown";
import {
  Accessibility, ArrowLeft, AudioLines, BookOpen, ChevronLeft, CircleHelp, CircleUserRound, Crown,
  Feather, Heart, Landmark, Loader2, LogOut, Menu, Mic, MicOff,
  PanelRight, Pause, Play, Plus, ScrollText, Send, Sparkles, Star, Volume2, WandSparkles, X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

type ChatMessage = { role: "user" | "assistant"; content: string };
type Fortune = { verse: string; interpretation: string };

const STORY_COVER_ART: Record<string, { symbol: string; motif: string; label: string }> = {
  "rostam-sohrab": { symbol: "⚔", motif: "✦", label: "نگاره‌ی پیکارِ رستم و سهراب" },
  siavash: { symbol: "♞", motif: "✧", label: "نگاره‌ی گذرِ سیاوش از آتش" },
  "zal-rudabeh": { symbol: "❦", motif: "☾", label: "نگاره‌ی دیدارِ زال و رودابه" },
};

const TOUR_STEPS = [
  { target: "characters", title: "اهلِ دربار را برگزینید", body: "هر چهره، لحن و نگاهِ خودش را دارد. با انتخابِ نام‌ها، گفت‌وگو رنگِ همان شخصیت را می‌گیرد." },
  { target: "messages", title: "سخن را در میان بگذارید", body: "پرسش یا نیتِ خود را بنویسید. پاسخ‌ها در دیوانِ گفتگو ثبت می‌شوند، اگر به دربار وارد شده باشید." },
  { target: "voice", title: "با آوا سخن بگویید", body: "دکمه‌ی میکروفن، گفتار شما را با Whisper به نوشتار تبدیل می‌کند. سپس آن را پیش از فرستادن بازبینی کنید." },
  { target: "accessibility", title: "پاسخ را بشنوید و بخوانید", body: "از کنترل‌های آوایی، کنتراستِ خوانش و برجسته‌سازی هم‌زمان واژه‌ها برای تجربه‌ای آرام‌تر استفاده کنید." },
] as const;

function PersisMark({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("persis-mark", className)}><span /><span /><span /></div>;
}

function CharacterSeal({ character, className }: { character: CharacterId; className?: string }) {
  const meta = characterMeta[character];
  return <div className={cn("character-seal", className)}><span>{meta.icon}</span></div>;
}

function NavBar() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const links = [
    ["آغاز", "#top"], ["دربار", "#court"], ["داستان‌ها", "#stories"], ["فال", "#fortune"],
  ];
  return (
    <header className="site-header">
      <nav className="nav-shell" aria-label="ناوبری اصلی">
        <a className="brand" href="#top" aria-label="رزونانس شاهنامه">
          <PersisMark />
          <span><strong>رزونانس</strong><em>دربارِ شاهنامه</em></span>
        </a>
        <div className="nav-links">
          {links.map(([label, href]) => <a key={href} href={href}>{label}</a>)}
        </div>
        <div className="nav-actions">
          {loading ? <Loader2 className="size-4 animate-spin text-amber-100/60" /> : isAuthenticated ? (
            <>
              <Link className="account-link" href="/profile"><CircleUserRound className="size-4" />{user?.name || "دیوانِ من"}</Link>
              <button onClick={() => logout()} className="icon-quiet" aria-label="خروج از حساب"><LogOut className="size-4" /></button>
            </>
          ) : <button onClick={() => startLogin()} className="button-gold button-small"><Crown className="size-4" />ورود به دیوان</button>}
          <button onClick={() => setOpen(!open)} className="mobile-menu" aria-label="باز کردن منو"><Menu className="size-5" /></button>
        </div>
      </nav>
      {open && <div className="mobile-nav">{links.map(([label, href]) => <a key={href} onClick={() => setOpen(false)} href={href}>{label}</a>)}</div>}
    </header>
  );
}

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterId>("simorgh");
  const [language, setLanguage] = useState<"fa" | "en">("fa");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [composer, setComposer] = useState("");
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [fortuneQuestion, setFortuneQuestion] = useState("");
  const [fortune, setFortune] = useState<Fortune | null>(null);
  const [storyCommentary, setStoryCommentary] = useState<Record<string, string>>({});
  const [expandedStory, setExpandedStory] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [speakingMessage, setSpeakingMessage] = useState<number | null>(null);
  const [pausedMessage, setPausedMessage] = useState<number | null>(null);
  const [speechCursor, setSpeechCursor] = useState<{ messageIndex: number; wordIndex: number; sentenceIndex: number } | null>(null);
  const [restoredPlayback, setRestoredPlayback] = useState<ReturnType<typeof readPlaybackPosition>>(null);
  const [highContrastHighlight, setHighContrastHighlight] = useState(false);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const sessionsQuery = trpc.court.sessions.list.useQuery(undefined, { enabled: isAuthenticated, refetchOnWindowFocus: false });
  const sessionMessagesQuery = trpc.court.sessions.messages.useQuery(
    { sessionId: activeSessionId ?? 0 },
    { enabled: Boolean(activeSessionId && isAuthenticated), refetchOnWindowFocus: false },
  );
  const favoritesQuery = trpc.court.favorites.list.useQuery(undefined, { enabled: isAuthenticated, refetchOnWindowFocus: false });
  const storiesQuery = trpc.court.stories.useQuery();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (sessionMessagesQuery.data) {
      setMessages(sessionMessagesQuery.data.map(message => ({ role: message.role, content: message.content })));
    }
  }, [sessionMessagesQuery.data]);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);
  useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);
  useEffect(() => { setHighContrastHighlight(readHighlightContrastPreference()); }, []);
  useEffect(() => { if (!hasCompletedCourtTour()) setTourStep(0); }, []);
  useEffect(() => {
    if (tourStep === null) return;
    document.querySelector(`[data-tour="${TOUR_STEPS[tourStep].target}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [tourStep]);
  useEffect(() => {
    const saved = readPlaybackPosition(activeSessionId);
    setRestoredPlayback(saved);
    if (!saved) return;
    const restoreTimer = window.setTimeout(() => messageRefs.current[saved.messageIndex]?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    return () => window.clearTimeout(restoreTimer);
  }, [activeSessionId, messages.length]);
  useEffect(() => {
    if (!speechCursor) return;
    const messageNode = messageRefs.current[speechCursor.messageIndex];
    const activeWord = messageNode?.querySelector<HTMLElement>(`[data-speech-word="${speechCursor.wordIndex}"]`);
    activeWord?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [speechCursor]);

  const createSession = trpc.court.sessions.create.useMutation({
    onSuccess: async () => { await utils.court.sessions.list.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const chatMutation = trpc.court.chat.useMutation({
    onSuccess: async (data) => {
      setMessages(current => [...current, { role: "assistant", content: data.reply }]);
      if (activeSessionId) await utils.court.sessions.list.invalidate();
    },
    onError: error => {
      toast.error(error.message || "پاسخی از دربار نرسید.");
      setMessages(current => current.slice(0, -1));
    },
  });
  const fortuneMutation = trpc.court.fortune.useMutation({
    onSuccess: data => setFortune(data),
    onError: error => toast.error(error.message || "فال اکنون گشوده نشد."),
  });
  const commentaryMutation = trpc.court.storyCommentary.useMutation({
    onSuccess: (data, variables) => setStoryCommentary(current => ({ ...current, [variables.storyId]: data.commentary })),
    onError: error => toast.error(error.message || "شرح داستان آماده نشد."),
  });
  const favoriteMutation = trpc.court.favorites.toggle.useMutation({
    onSuccess: () => utils.court.favorites.list.invalidate(),
    onError: error => toast.error(error.message),
  });
  const voiceMutation = trpc.court.voice.useMutation({
    onSuccess: data => {
      setComposer(current => current ? `${current}\n${data.text}` : data.text);
      toast.success("سخن شما با Whisper به نوشتار درآمد.");
    },
    onError: error => toast.error(error.message || "شنیدنِ آوا به پایان نرسید."),
  });

  const favouriteIds = useMemo(() => new Set(favoritesQuery.data?.map(item => item.character) ?? []), [favoritesQuery.data]);
  const selected = characterMeta[selectedCharacter];
  const isBusy = chatMutation.isPending || createSession.isPending;
  const activeTourTarget = tourStep === null ? null : TOUR_STEPS[tourStep]?.target;
  const closeTour = () => { completeCourtTour(); setTourStep(null); };
  const advanceTour = () => { if (tourStep === null || tourStep === TOUR_STEPS.length - 1) closeTour(); else setTourStep(tourStep + 1); };

  const toggleMessageSpeech = (content: string, messageIndex: number) => {
    if (!("speechSynthesis" in window)) {
      toast.error("مرورگر شما از پخشِ آوایی پشتیبانی نمی‌کند.");
      return;
    }
    const speech = window.speechSynthesis;
    if (speakingMessage === messageIndex) {
      if (speech.paused) {
        speech.resume();
        setPausedMessage(null);
      } else {
        speech.pause();
        setPausedMessage(messageIndex);
      }
      return;
    }
    const spokenText = normalizeSpeechText(content);
    const allWords = getSpeechWords(spokenText);
    if (!allWords.length) return;
    const savedPosition = readPlaybackPosition(activeSessionId);
    const resumeStart = savedPosition?.messageIndex === messageIndex ? Math.min(savedPosition.wordIndex, allWords.length - 1) : 0;
    const speechChunk = allWords.slice(resumeStart).map(word => word.text).join(" ");
    const utterance = new SpeechSynthesisUtterance(speechChunk);
    speech.cancel();
    utterance.lang = language === "fa" ? "fa-IR" : "en-US";
    utterance.rate = selected.voice.rate;
    utterance.pitch = selected.voice.pitch;
    const matchedVoice = speech.getVoices().find(voice => selected.voice.hints.some(hint => voice.name.toLowerCase().includes(hint.toLowerCase())));
    if (matchedVoice) utterance.voice = matchedVoice;
    const updateCursor = (wordIndex: number) => {
      const sentenceIndex = getSentenceIndexAtCharacter(spokenText, allWords[wordIndex]?.start ?? 0) ?? 0;
      const cursor = { messageIndex, wordIndex, sentenceIndex };
      setSpeechCursor(cursor);
      if (activeSessionId) {
        const position = { sessionId: activeSessionId, ...cursor, updatedAt: Date.now() };
        savePlaybackPosition(position);
        setRestoredPlayback(position);
      }
    };
    utterance.onstart = () => { setSpeakingMessage(messageIndex); setPausedMessage(null); updateCursor(resumeStart); };
    utterance.onboundary = event => {
      if (typeof event.charIndex !== "number") return;
      const chunkWordIndex = getWordIndexAtCharacter(speechChunk, event.charIndex);
      if (chunkWordIndex !== null) updateCursor(resumeStart + chunkWordIndex);
    };
    utterance.onend = () => { setSpeakingMessage(null); setPausedMessage(null); setSpeechCursor(null); clearPlaybackPosition(activeSessionId); setRestoredPlayback(null); };
    utterance.onerror = () => { setSpeakingMessage(null); setPausedMessage(null); setSpeechCursor(null); toast.error("پخشِ آوایی ناتمام ماند؛ دوباره بکوشید."); };
    speech.speak(utterance);
  };

  const sendMessage = async (raw?: string) => {
    const message = (raw ?? composer).trim();
    if (!message || isBusy) return;
    const outgoing = [...messages, { role: "user" as const, content: message }];
    setMessages(outgoing);
    setComposer("");
    let sessionId = activeSessionId ?? undefined;
    if (isAuthenticated && !sessionId) {
      try {
        const created = await createSession.mutateAsync({
          title: message.replace(/\s+/g, " ").slice(0, 46) || "گفت‌وگوی تازه",
          character: selectedCharacter,
          language,
        });
        sessionId = created.id;
        setActiveSessionId(created.id);
      } catch { setMessages(current => current.slice(0, -1)); return; }
    }
    chatMutation.mutate({ character: selectedCharacter, language, message, history: messages, sessionId });
  };

  const newConversation = () => {
    setActiveSessionId(null);
    setMessages([]);
    setComposer("");
    toast.success("تختِ گفت‌وگویی تازه آماده است.");
  };

  const selectSession = (session: { id: number; character: string; language: "fa" | "en" }) => {
    if (!COURT_CHARACTERS.includes(session.character as CharacterId)) return;
    setActiveSessionId(session.id);
    setSelectedCharacter(session.character as CharacterId);
    setLanguage(session.language);
    setMessages([]);
  };

  const toggleFavorite = (id: CharacterId) => {
    if (!isAuthenticated) { toast.message("برای نگه‌داشتن شخصیت‌های دلخواه، وارد دیوان شوید."); startLogin(); return; }
    favoriteMutation.mutate({ character: id });
  };

  const toggleRecording = async () => {
    if (isRecording && recorderRef.current) { recorderRef.current.stop(); return; }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      toast.error("این مرورگر از ضبط صدا پشتیبانی نمی‌کند."); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      recordedChunks.current = [];
      recorder.ondataavailable = event => { if (event.data.size) recordedChunks.current.push(event.data); };
      recorder.onerror = () => { setIsRecording(false); toast.error("ضبط صدا با خطا روبه‌رو شد."); };
      recorder.onstop = () => {
        setIsRecording(false);
        stream.getTracks().forEach(track => track.stop());
        const blob = new Blob(recordedChunks.current, { type: mimeType });
        if (!blob.size) return;
        const reader = new FileReader();
        reader.onloadend = () => voiceMutation.mutate({ audioBase64: String(reader.result), mimeType });
        reader.readAsDataURL(blob);
      };
      recorder.start();
      setIsRecording(true);
      toast.message("اکنون سخن بگویید؛ برای پایان دوباره دکمه را بزنید.");
    } catch {
      toast.error("دسترسی به میکروفون داده نشد.");
    }
  };

  return (
    <main id="top" className="royal-page">
      <NavBar />
      <section className="hero-section">
        <div className="hero-lattice" aria-hidden="true" />
        <div className="hero-constellation" aria-hidden="true"><i /><i /><i /><i /><i /></div>
        <div className="page-container hero-grid">
          <div className="hero-copy reveal-up">
            <div className="eyebrow"><Sparkles className="size-4" />روایت، خرد، گفتگو</div>
            <h1>به <em>دربارِ خرد</em><br />شاهنامه خوش آمدید</h1>
            <p>در جهانِ حماسه گام بگذارید؛ با خردِ پهلوانان سخن بگویید، فالِ خود را بگشایید و داستان‌هایی را بازخوانید که هنوز با جانِ امروز ما گفت‌وگو می‌کنند.</p>
            <div className="hero-cta-row">
              <a href="#court" className="button-gold"><Landmark className="size-5" />ورود به دربار<ArrowLeft className="size-4" /></a>
              <a href="#stories" className="button-ghost"><BookOpen className="size-5" />خواندنِ داستان‌ها</a>
              <button className="button-ghost tour-launch" onClick={() => setTourStep(0)}><CircleHelp className="size-5" />راهنمای دربار</button>
            </div>
            <div className="hero-stat-row">
              <div><strong>۴</strong><span>چهره‌ی اسطوره‌ای</span></div>
              <div><strong>۲</strong><span>زبان برای گفتگو</span></div>
              <div><strong>۱</strong><span>دیوانِ شخصی شما</span></div>
            </div>
          </div>
          <div className="hero-art reveal-up delay-1" aria-label="نگاره‌ی نمادین از سیمرغ و کتاب شاهنامه">
            <div className="moon-disc"><div className="moon-inscription">خِرَد</div></div>
            <div className="simorgh-silhouette">✦</div>
            <div className="orbital-ring ring-one" /><div className="orbital-ring ring-two" />
            <div className="hero-verse"><span>به نامِ خداوندِ جان و خرد</span><small>کِزین برتر اندیشه برنگذرد</small></div>
            <div className="hero-card hero-card-top"><Crown /><span>دربارِ هوشمند</span><small>گفت‌وگوی چندنوبتی</small></div>
            <div className="hero-card hero-card-bottom"><Feather /><span>فالِ شاهنامه</span><small>آیینِ نیت و تفسیر</small></div>
          </div>
        </div>
        <div className="hero-bottom-line" />
      </section>

      <section className="page-container court-section" id="court">
        <div className="section-heading">
          <div><span className="section-kicker">I. دربارِ هوشمند</span><h2>با چهره‌های افسانه‌ای<br /><em>هم‌سخن شوید</em></h2></div>
          <p>هر چهره، آوایی جداگانه دارد: از استواریِ رستم تا دیدِ دورِ سیمرغ. زبانِ گفت‌وگو را برگزینید و سخن آغاز کنید.</p>
        </div>
        <div className="court-layout">
          <aside className="court-aside">
            <div className="aside-heading"><span>اهلِ دربار</span>{isAuthenticated && <button onClick={newConversation} title="گفت‌وگوی تازه"><Plus className="size-4" /></button>}</div>
            <div className={cn("character-list", activeTourTarget === "characters" && "tour-target-active")} data-tour="characters">
              {COURT_CHARACTERS.map(id => {
                const item = characterMeta[id];
                const active = selectedCharacter === id;
                return <button key={id} onClick={() => { setSelectedCharacter(id); if (!activeSessionId) setMessages([]); }} className={cn("character-choice", active && "is-active")}>
                  <CharacterSeal character={id} /><span><strong>{item.name}</strong><small>{item.title}</small></span><ChevronLeft className="size-4 choice-arrow" />
                </button>;
              })}
            </div>
            <div className="session-divider"><span>دیوانِ گفت‌وگوها</span></div>
            {!isAuthenticated ? <button onClick={() => startLogin()} className="session-signin"><CircleUserRound className="size-4" />برای نگه‌داری گفتگوها وارد شوید</button> : sessionsQuery.isLoading ? <div className="session-loading"><Loader2 className="size-4 animate-spin" />در حال خواندن دیوان</div> : (
              <div className="session-list">
                {sessionsQuery.error ? <p className="session-error" role="status">دفترِ گفت‌وگوها اکنون گشوده نشد؛ اندکی دیگر دوباره بکوشید.</p> : sessionsQuery.data?.length ? sessionsQuery.data.slice(0, 5).map(session => <button className={cn("saved-session", activeSessionId === session.id && "is-current")} key={session.id} onClick={() => selectSession(session)}><ScrollText className="size-3.5" /><span>{session.title}</span></button>) : <p className="session-empty">هنوز سخنی در دیوان ثبت نشده است.</p>}
              </div>
            )}
            {isAuthenticated && favoritesQuery.error && <p className="session-error" role="status">برگزیده‌های شما اکنون در دسترس نیستند.</p>}
          </aside>

          <div className={cn("court-console", highContrastHighlight && "is-high-contrast")}>
            <div className="console-header">
              <div className="console-figure"><CharacterSeal character={selectedCharacter} /><div><span>اکنون در حضورِ</span><h3>{selected.name}</h3><small>{selected.title} · {selected.note}</small></div></div>
              <div className="console-actions">
                <div className="language-switch" aria-label="زبان گفتگو"><button onClick={() => setLanguage("fa")} className={cn(language === "fa" && "is-selected")}>FA</button><button onClick={() => setLanguage("en")} className={cn(language === "en" && "is-selected")}>EN</button></div>
                <button data-tour="accessibility" className={cn("contrast-toggle", highContrastHighlight && "is-active", activeTourTarget === "accessibility" && "tour-target-active")} onClick={() => { const next = !highContrastHighlight; setHighContrastHighlight(next); saveHighlightContrastPreference(next); }} aria-label="تغییر کنتراست برجسته‌سازی" aria-pressed={highContrastHighlight}><Accessibility className="size-4" /><span>کنتراست</span></button>
                <button className={cn("favorite-button", favouriteIds.has(selectedCharacter) && "is-favorite")} onClick={() => toggleFavorite(selectedCharacter)} aria-label="افزودن به برگزیده‌ها"><Heart className="size-4" fill={favouriteIds.has(selectedCharacter) ? "currentColor" : "none"} /></button>
              </div>
            </div>
            <div data-tour="messages" className={cn("court-messages", activeTourTarget === "messages" && "tour-target-active")} aria-live="polite">
              {!messages.length ? (
                <div className="court-empty"><div className="empty-shimmer"><CharacterSeal character={selectedCharacter} /></div><h3>{language === "fa" ? `سخنِ ${selected.name} در انتظارِ شماست` : `${selected.english} awaits your words`}</h3><p>{language === "fa" ? "پرسشی از راه، دل یا روزگار در میان بگذارید؛ پاسخ با صدای همین چهره شکل می‌گیرد." : "Ask about a path, a choice, or a hard season. The response will carry this character’s voice."}</p><div className="prompt-pills">{quickPrompts.map(prompt => <button key={prompt} onClick={() => sendMessage(prompt)}>{prompt}</button>)}</div></div>
              ) : messages.map((message, index) => {
                const spokenText = message.role === "assistant" ? normalizeSpeechText(message.content) : "";
                const sentenceCount = message.role === "assistant" ? getSpeechSentences(spokenText).length : 0;
                const isSpeakingThis = speakingMessage === index;
                const hasSavedPosition = restoredPlayback?.messageIndex === index && !isSpeakingThis;
                const currentSentence = Math.min((speechCursor?.sentenceIndex ?? 0) + 1, sentenceCount);
                const progressPercent = sentenceCount ? (currentSentence / sentenceCount) * 100 : 0;
                return (
                  <div key={`${message.role}-${index}`} ref={node => { messageRefs.current[index] = node; }} className={cn("message-row", message.role === "user" ? "from-user" : "from-court")}>
                    {message.role === "assistant" && <CharacterSeal character={selectedCharacter} className="message-seal" />}
                    <div className="message-bubble">
                      {message.role === "assistant" ? (
                        <>
                          {isSpeakingThis ? (
                            <>
                              <p className="speech-highlight-text" aria-label="متنِ در حال پخش">
                                {spokenText.split(/(\s+)/).map((piece, wordPosition, pieces) => {
                                  const wordIndex = pieces.slice(0, wordPosition).filter(item => item.trim()).length;
                                  return piece.trim() ? <span key={`${piece}-${wordPosition}`} data-speech-word={wordIndex} className={cn("speech-word", speechCursor?.messageIndex === index && speechCursor.wordIndex === wordIndex && "is-active", pausedMessage === index && "is-paused")}>{piece}</span> : piece;
                                })}
                              </p>
                              <div className="speech-progress" aria-live="polite"><span>جمله‌ی {currentSentence} از {sentenceCount}</span><div role="progressbar" aria-label="پیشرفتِ خوانش" aria-valuemin={0} aria-valuemax={Math.max(sentenceCount, 1)} aria-valuenow={currentSentence}><i style={{ width: `${progressPercent}%` }} /></div></div>
                            </>
                          ) : (
                            <>
                              <Streamdown>{message.content}</Streamdown>
                              {hasSavedPosition && <div className="speech-resume-marker"><Volume2 className="size-3.5" />خوانش از جمله‌ی {(restoredPlayback?.sentenceIndex ?? 0) + 1} بازمی‌گردد</div>}
                            </>
                          )}
                          <button className={cn("message-speech", isSpeakingThis && "is-speaking")} onClick={() => toggleMessageSpeech(message.content, index)} aria-label={isSpeakingThis ? (pausedMessage === index ? `ادامه‌ی صدای ${selected.name}` : `مکث در صدای ${selected.name}`) : `شنیدن با صدای ${selected.name}`}><Volume2 className="size-3.5" />{isSpeakingThis && pausedMessage !== index ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}<span>{isSpeakingThis ? (pausedMessage === index ? "ادامه‌ی صدا" : "مکث") : hasSavedPosition ? "ادامه‌ی خوانش" : `بشنو با ${selected.voice.label}`}</span></button>
                        </>
                      ) : <p>{message.content}</p>}
                    </div>
                  </div>
                );
              })}
              {isBusy && <div className="message-row from-court"><CharacterSeal character={selectedCharacter} className="message-seal" /><div className="message-bubble thinking"><i /><i /><i /></div></div>}
              <div ref={chatEndRef} />
            </div>
            <div className="composer-wrap">
              <textarea value={composer} onChange={event => setComposer(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder={language === "fa" ? `با ${selected.name} سخن بگویید...` : `Speak with ${selected.english}...`} rows={2} />
              <div className="composer-actions">
                <button data-tour="voice" onClick={toggleRecording} disabled={voiceMutation.isPending} className={cn("voice-button", isRecording && "is-recording", activeTourTarget === "voice" && "tour-target-active")} title="گفتن و تبدیل با Whisper">{voiceMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : isRecording ? <MicOff className="size-4" /> : <Mic className="size-4" />}<span>{isRecording ? "پایانِ شنیدن" : "گفتن با آوا"}</span></button>
                <button onClick={() => sendMessage()} disabled={!composer.trim() || isBusy} className="send-button" aria-label="فرستادن سخن">{isBusy ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}</button>
              </div>
              <p><AudioLines className="size-3.5" />تبدیلِ آوا با Whisper انجام می‌شود؛ با فشردن Enter، سخن فرستاده می‌شود.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="fortune-section" id="fortune">
        <div className="fortune-aurora" aria-hidden="true" />
        <div className="page-container fortune-grid">
          <div className="fortune-intro"><span className="section-kicker">II. فالِ شاهنامه</span><h2>نیت کن،<br /><em>طومار را بگشا</em></h2><p>فال، فرصتی برای اندیشیدن است؛ نه فرمانی برای آینده. نیت خود را با آرامش بنویس تا پاسخی شاعرانه و تفسیری سنجیده از دربار دریافت کنی.</p><div className="fortune-trust"><Star className="size-4" /><span>با پاسخی برآمده از جهانِ داستان و خرد</span></div></div>
          <div className="fortune-ritual">
            {!fortune ? <div className="fortune-form"><div className="scroll-crest"><WandSparkles className="size-6" /></div><label htmlFor="fortune-question">نیتِ خود را به طومار بسپارید</label><textarea id="fortune-question" value={fortuneQuestion} onChange={event => setFortuneQuestion(event.target.value)} rows={4} placeholder="آنچه این روزها دل‌تان را به خود خوانده است..." /><button disabled={fortuneQuestion.trim().length < 2 || fortuneMutation.isPending} onClick={() => fortuneMutation.mutate({ question: fortuneQuestion, language })} className="button-gold fortune-submit">{fortuneMutation.isPending ? <Loader2 className="size-5 animate-spin" /> : <ScrollText className="size-5" />}گشودنِ فال</button></div> : <div className="fortune-scroll"><div className="scroll-rod scroll-top" /><div className="scroll-inner"><div className="scroll-title"><Feather className="size-5" />فالِ شما</div><blockquote>{fortune.verse.split("\n").map((line, index) => <span key={index}>{line}</span>)}</blockquote><div className="scroll-rule" /><p>{fortune.interpretation}</p><button onClick={() => { setFortune(null); setFortuneQuestion(""); }} className="scroll-reset">فالِ دیگر</button></div><div className="scroll-rod scroll-bottom" /></div>}
          </div>
        </div>
      </section>

      <section className="page-container stories-section" id="stories">
        <div className="section-heading stories-heading"><div><span className="section-kicker">III. دفترِ داستان‌ها</span><h2>سه داستان،<br /><em>هزار لایه‌ی معنا</em></h2></div><p>روایت‌های بزرگ، تنها گذشته نیستند؛ ابزارهایی هستند برای دیدنِ روشن‌ترِ عشق، داوری، مرگ، دوستی و مسئولیت.</p></div>
        {storiesQuery.error ? <div className="collection-error"><BookOpen className="size-5" /><strong>دفترِ داستان‌ها هنوز گشوده نشد.</strong><span>لطفاً پس از چند لحظه دوباره صفحه را تازه کنید.</span></div> : <div className="story-grid">{storiesQuery.data?.map((story, index) => { const cover = STORY_COVER_ART[story.id]; return <article key={story.id} className={cn("story-card", `cover-${story.id}`, expandedStory === story.id && "is-expanded")}><div className="story-cover" role="img" aria-label={cover.label}><span className="cover-aura" /><span className="cover-motif">{cover.motif}</span><span className="cover-hero-symbol">{cover.symbol}</span><span className="cover-constellation">✦ · ✦ · ✦</span></div><div className="story-number">۰{index + 1}</div><div className="story-symbol">{index === 0 ? "⚔" : index === 1 ? "◈" : "❦"}</div><span className="story-subtitle">{story.subtitle}</span><h3>{story.title}</h3><p>{story.summary}</p><button onClick={() => { const next = expandedStory === story.id ? null : story.id; setExpandedStory(next); if (next && !storyCommentary[story.id]) commentaryMutation.mutate({ storyId: story.id, language }); }} className="story-action">{commentaryMutation.isPending && expandedStory === story.id ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{expandedStory === story.id ? "بستنِ شرح" : "گوش سپردن به سیمرغ"}</button>{expandedStory === story.id && storyCommentary[story.id] && <div className="story-commentary"><Streamdown>{storyCommentary[storyCommentary[story.id] ? story.id : story.id]}</Streamdown></div>}</article>; })}</div>}
      </section>

      <footer className="site-footer"><div className="page-container footer-inner"><div className="brand"><PersisMark /><span><strong>رزونانس</strong><em>دربارِ شاهنامه</em></span></div><p>نه بازگوییِ گذشته، که گفت‌وگو با خردِ آن.</p><a href="#top">بازگشت به آغاز <ArrowLeft className="size-4" /></a></div></footer>
      {tourStep !== null && <div className="court-tour" role="presentation"><div className="tour-shade" /><section className="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-description"><button onClick={closeTour} className="tour-close" aria-label="بستنِ راهنما"><X className="size-4" /></button><div className="tour-progress" aria-label={`گام ${tourStep + 1} از ${TOUR_STEPS.length}`}>{TOUR_STEPS.map((_, index) => <i key={index} className={cn(index <= tourStep && "is-complete")} />)}</div><span className="section-kicker">راهنمای نخستین دیدار · {tourStep + 1} از {TOUR_STEPS.length}</span><h2 id="tour-title">{TOUR_STEPS[tourStep].title}</h2><p id="tour-description">{TOUR_STEPS[tourStep].body}</p><div className="tour-actions"><button className="tour-skip" onClick={closeTour}>اکنون نه</button>{tourStep > 0 && <button className="button-ghost" onClick={() => setTourStep(tourStep - 1)}>پیشین</button>}<button className="button-gold" onClick={advanceTour}>{tourStep === TOUR_STEPS.length - 1 ? "آغازِ گفتگو" : "گامِ بعد"}<ArrowLeft className="size-4" /></button></div></section></div>}
    </main>
  );
}
