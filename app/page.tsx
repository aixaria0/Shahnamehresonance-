'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, 
  Brain, 
  BookOpen, 
  Scroll, 
  Mic, 
  Send, 
  ChevronLeft, 
  Bookmark, 
  Share2,
  Volume2,
  History,
  LogOut,
  Trash2,
  CheckCircle2,
  X,
  AlertTriangle,
  Feather,
  RefreshCw
} from 'lucide-react';
import { LatticeBackground } from '@/components/LatticeBackground';
import { FerdowsiAvatar } from '@/components/FerdowsiAvatar';
import { chatWithFerdowsi, chatWithFerdowsiStream, generateCharacterAnalysis, generateTestQuestions, generateStoryNode, transcribeAudio, generateFal, generateSpeechText } from '@/lib/gemini';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  onAuthStateChanged, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  deleteDoc,
  FirebaseUser,
  handleFirestoreError,
  OperationType
} from '@/lib/firebase';

type View = 'home' | 'chat' | 'test' | 'story' | 'manuscript' | 'manuscript_manager' | 'voice' | 'fal';

export default function ResonanceShahnameh() {
  const [isIframe, setIsIframe] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [view, setView] = useState<View>('home');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [messages, setMessages] = useState<{ role: 'user' | 'model'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTTSActive, setIsTTSActive] = useState(true);

  const voiceModes = {
    aram:   { rate: 0.65, pitch: 0.68, volume: 0.95, label: "آرام (Calm)" },
    hamasi: { rate: 0.82, pitch: 0.78, volume: 0.97, label: "حماسی (Epic)" },
    hakim:  { rate: 0.75, pitch: 0.72, volume: 0.96, label: "حکیمانه (Sage)" },
    sheeri: { rate: 0.68, pitch: 0.75, volume: 0.94, label: "شاعرانه (Poetic)" }
  };
  const [voiceConfig, setVoiceConfig] = useState(voiceModes.hakim);
  const [selectedPersona, setSelectedPersona] = useState<string>('auto');
  const [visualizerStyle, setVisualizerStyle] = useState<'pulse' | 'bars' | 'wave' | 'ambient'>('pulse');

  const pronunciationFix: Record<string, string> = {
    "رستم": "رُسْتَم", "سهراب": "سُهْراب", "اسفندیار": "اِسْفَنْدیار",
    "بیژن": "بیْژن", "منیژه": "مَنیژه", "سیاوش": "سیاوَش",
    "تهمینه": "تَهمینه", "زال": "زال", "رودابه": "رودابه",
    "کیکاووس": "کیْکاووس", "کیخسرو": "کیْخُسرو", "کیومرث": "کیومَرث",
    "جمشید": "جَمشید", "فریدون": "فِریدون", "منوچهر": "مَنوچِهر",
    "نوذر": "نوذَر", "گودرز": "گودرز", "پیران": "پیران",
    "افراسیاب": "اَفراسیاب", "سام": "سام", "نریمان": "نریمان",
    "فردوسی": "فِردوسی", "ابوالقاسم": "اَبوالقاسم",
    "شاهنامه": "شاهنامه", "ایران": "ایْران", "توران": "توْران",
    "سیستان": "سیستان", "مازندران": "مازَنْدَران", "زابل": "زابل",
    "پهلوان": "پَهلِوان", "دلاور": "دِلاوَر", "حماسه": "حَماسه",
    "نبرد": "نَبَرد", "رزم": "رَزم", "بزم": "بَزم", "شاعر": "شاعِر",
    "حکیم": "حَکیم", "ابوالقاسم فردوسی": "اَبوالقاسمِ فِردوسی",
    "خرد": "خِرَد", "جهان": "جَهان", "سپهر": "سِپِهر", "یزدان": "یَزدان"
  };

  // Store utterances globally to avoid garbage collection bug in some browsers
  const utterancesRef = useRef<SpeechSynthesisUtterance[]>([]);

  const speakAsFerdowsi = (text: string, configOverrides?: { rate: number, pitch: number, volume: number }) => {
    if (!('speechSynthesis' in window) || !isTTSActive) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    stopAudioAnalysis();
    
    // Store utterances globally to prevent garbage collection bug
    const currentUtterances: SpeechSynthesisUtterance[] = [];
    utterancesRef.current = currentUtterances;

    let cleanText = text.replace(/[*#]/g, '');
    Object.keys(pronunciationFix).forEach(word => {
      const regex = new RegExp(word, 'gi');
      cleanText = cleanText.replace(regex, pronunciationFix[word]);
    });

    const sentences = cleanText.split(/[.!؟\n]/).filter(s => s.trim().length > 3);

    const speakSentence = (index: number) => {
      if (index >= sentences.length) {
        setIsPlayingVoice(false);
        setAudioVolume(0);
        return;
      }
      if (utterancesRef.current !== currentUtterances) return; 

      const utterance = new SpeechSynthesisUtterance(sentences[index].trim());
      utterance.lang = 'fa-IR';
      utterance.rate = configOverrides?.rate || voiceConfig.rate;
      utterance.pitch = configOverrides?.pitch || voiceConfig.pitch;
      utterance.volume = configOverrides?.volume || voiceConfig.volume;

      utterance.onstart = () => {
        setIsPlayingVoice(true);
        const simulateVisuals = () => {
          if (!synth.speaking) {
            setAudioVolume(0);
            return;
          }
          setAudioVolume(Math.random() * 60 + 40); 
          animationFrameRef.current = requestAnimationFrame(simulateVisuals);
        };
        simulateVisuals();
      };

      utterance.onend = () => {
        setTimeout(() => speakSentence(index + 1), 300);
      };

      utterance.onerror = (e) => {
        console.error('Speech synthesis error', e);
        setIsPlayingVoice(false);
        setAudioVolume(0);
      };

      utterancesRef.current.push(utterance);
      synth.speak(utterance);
    };

    if (sentences.length > 0) {
      speakSentence(0);
    }
  };

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const startMediaRecorder = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      visualizerStreamRef.current = stream;
      startAudioAnalysis(stream);
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsListening(false);
        setIsTranscribing(true);
        stopAudioAnalysis();
        showNotification('در حال تبدیل صدا به متن...', 'info');

        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64data = (reader.result as string).split(',')[1];
            try {
              const text = await transcribeAudio(base64data, mediaRecorder.mimeType);
              if (text && text.trim()) {
                setInput(prev => prev + (prev.trim() ? ' ' : '') + text.trim());
                showNotification('صدا با موفقیت تبدیل شد.', 'success');
              } else {
                showNotification('صدایی تشخیص داده نشد.', 'info');
              }
            } catch (e) {
              console.error('Transcription error:', e);
              showNotification('خطا در ارتباط با سرور تبدیل صدا.', 'error');
            } finally {
              setIsTranscribing(false);
            }
          };
        } catch (e) {
          console.error('Blob error', e);
          setIsTranscribing(false);
          showNotification('خطا در پردازش فایل صوتی.', 'error');
        }
      };

      mediaRecorder.start();
      setIsListening(true);
      showNotification('در حال ضبط... (توسط هوش مصنوعی) برای پایان کلیک کنید.', 'info');
    } catch (err) {
      console.error('Mic error for fallback:', err);
      showNotification('عدم دسترسی به میکروفون.', 'error');
    }
  };

  const handleMicClick = async () => {
    if (isTranscribing) {
      showNotification('لطفاً صبر کنید تا صدای قبلی تبدیل شود...', 'info');
      return;
    }

    if (isListening) {
      // Stop whichever is recording
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      stopAudioAnalysis();
      setIsListening(false);
      return;
    }

    // Check if the browser natively supports SpeechRecognition
    const HasNativeRecognition = (('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window)) && !isIframe;

    if (HasNativeRecognition) {
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        visualizerStreamRef.current = stream;
        startAudioAnalysis(stream);
      } catch (err) {
        console.error('Microphone permission denied', err);
        if (isIframe) {
          showNotification('دسترسی به میکروفون میسر نیست. لطفاً برنامه را در تب جدید باز کنید.', 'error');
        } else {
          showNotification('دسترسی به میکروفون داده نشده است.', 'error');
        }
        return;
      }

      if (!recognitionRef.current) {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        
        recognition.lang = 'fa-IR';
        // false is significantly more stable on Android and avoids streaming timeouts/network errors
        recognition.interimResults = false; 
        recognition.continuous = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setIsListening(true);
          showNotification('حکیم سراپا گوش است...', 'info');
        };

        recognition.onresult = (event: any) => {
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            }
          }
          if (finalTranscript) {
            setInput(prev => prev + (prev.trim() ? ' ' : '') + finalTranscript);
          }
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
          stopAudioAnalysis();
          
          if (event.error === 'not-allowed') {
            const isIframe = window !== window.parent;
            if (isIframe) {
              showNotification('برای استفاده از میکروفون، برنامه را در تب جدید باز کنید.', 'error');
            } else {
              showNotification('دسترسی رد شد. لطفاً اجازه دسترسی صادر کنید.', 'error');
            }
          } else if (event.error === 'network') {
            console.log('Native recognition network error, falling back to Gemini transcription...');
            // In case of native network error (common in Firefox/Brave), fallback to Gemini AI Recorder
            startMediaRecorder();
          } else if (event.error === 'no-speech') {
            showNotification('صدایی شنیده نشد.', 'info');
          } else if (event.error === 'audio-capture') {
            showNotification('میکروفونی یافت نشد یا غیرفعال است.', 'error');
          } else if (event.error !== 'aborted') {
            showNotification('خطا در شنیدن صدای شما.', 'error');
          }
        };

        recognition.onend = () => {
          // If mediaRecorder is active, we fell back, so do not set isListening to false here.
          if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
            stopAudioAnalysis();
            setIsListening(false);
          }
        };

        recognitionRef.current = recognition;
      }

      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error('Failed to start native recognition', e);
        stopAudioAnalysis();
      }
    } else {
      // Direct Fallback if SpeechRecognition is entirely missing
      startMediaRecorder();
    }
  };
  const [testStep, setTestStep] = useState(0);
  const [testResponses, setTestResponses] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [storyNode, setStoryNode] = useState(0);
  const [storyHistory, setStoryHistory] = useState<number[]>([0]);
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [isStoryNavOpen, setIsStoryNavOpen] = useState(false);
  const [savedProtocols, setSavedProtocols] = useState<any[]>([]);

  // Dynamic Test & Story State
  const [testQuestions, setTestQuestions] = useState<{question: string, options: string[]}[]>([]);
  const [isLoadingTest, setIsLoadingTest] = useState(false);
  
  const [storyNodeData, setStoryNodeData] = useState<{title: string, text: string, choices: string[]} | null>(null);
  const [isLoadingStory, setIsLoadingStory] = useState(false);
  const [storyTextHistory, setStoryTextHistory] = useState<{title: string, text: string}[]>([]);
  
  const [falData, setFalData] = useState<{verses: string[], tafsir: string} | null>(null);
  const [isGeneratingFal, setIsGeneratingFal] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<string | null>(null);
  const [voiceResponse, setVoiceResponse] = useState('');
  const audioContextRef = useRef<AudioContext | null>(null);

  const [audioVolume, setAudioVolume] = useState<number>(0);
  const [audioData, setAudioData] = useState<Uint8Array>(new Uint8Array(0));
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const audioContextRefForMic = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const visualizerStreamRef = useRef<MediaStream | null>(null);

  const startAudioAnalysis = (streamOrSource: MediaStream | AudioNode, ctx?: AudioContext) => {
    try {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      
      let analyser: AnalyserNode;
      const audioCtx = ctx || audioContextRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
      
      if (streamOrSource instanceof MediaStream) {
        audioContextRefForMic.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(streamOrSource);
        analyser = audioCtx.createAnalyser();
        source.connect(analyser);
      } else {
        analyser = audioCtx.createAnalyser();
        streamOrSource.connect(analyser);
        analyser.connect(audioCtx.destination);
      }
      
      analyser.fftSize = 256;
      analyzerRef.current = analyser;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateVolume = () => {
        if (!analyzerRef.current) return;
        analyzerRef.current.getByteFrequencyData(dataArray);
        setAudioData(new Uint8Array(dataArray));
        
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        setAudioVolume(average);
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } catch (e) {
      console.error("Audio analysis failed", e);
    }
  };

  const stopAudioAnalysis = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRefForMic.current && audioContextRefForMic.current.state !== 'closed') {
      audioContextRefForMic.current.close().catch(() => {});
      audioContextRefForMic.current = null;
    }
    if (visualizerStreamRef.current) {
      visualizerStreamRef.current.getTracks().forEach(t => t.stop());
      visualizerStreamRef.current = null;
    }
    analyzerRef.current = null;
    setAudioVolume(0);
    setAudioData(new Uint8Array(0));
  };

  const playPcmAudio = async (base64Audio: string) => {
    try {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      const binaryString = window.atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = audioCtx;
      
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const pcm16 = new Int16Array(bytes.buffer);
      const audioBuffer = audioCtx.createBuffer(1, pcm16.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < pcm16.length; i++) {
        channelData[i] = pcm16[i] / 32768.0;
      }
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = voiceConfig.rate;
      
      // Hook up visualizer for playback
      startAudioAnalysis(source, audioCtx);
      
      source.onended = () => {
        setIsPlayingVoice(false);
        stopAudioAnalysis();
      };
      source.start();
      setIsPlayingVoice(true);
    } catch (e) {
      console.error("Failed to play audio", e);
      setIsPlayingVoice(false);
      stopAudioAnalysis();
    }
  };

  const handleSpeak = async (text: string, id: string = 'global') => {
    if (isPlayingVoice) {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      setIsPlayingVoice(false);
      stopAudioAnalysis();
      return;
    }
    
    setIsGeneratingAudio(id);
    try {
      const audioBase64 = await generateSpeechText(text, 'Charon');
      if (audioBase64) {
        await playPcmAudio(audioBase64);
      } else {
        speakAsFerdowsi(text);
      }
    } catch (e) {
      console.error(e);
      speakAsFerdowsi(text);
    } finally {
      setIsGeneratingAudio(null);
    }
  };

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auth Listener
  useEffect(() => {
    setMounted(true);
    setIsIframe(window !== window.parent);
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        // Sync story state from Firestore
        const storyPath = `users/${u.uid}/story/state`;
        const storyRef = doc(db, storyPath);
        getDoc(storyRef).then(snap => {
          if (snap.exists()) {
            const data = snap.data();
            setStoryNode(data.currentNodeId || 0);
            setStoryHistory(data.history || [0]);
            setBookmarks(data.bookmarks || []);
            if (data.dynamicStoryNodeData) {
              setStoryNodeData(data.dynamicStoryNodeData);
            }
            if (data.dynamicStoryHistory) {
              setStoryTextHistory(data.dynamicStoryHistory);
            }
          }
        }).catch(error => {
          handleFirestoreError(error, OperationType.GET, storyPath);
        });

        // Sync protocols from Firestore
        const protocolsPath = `users/${u.uid}/protocols`;
        const protocolsRef = collection(db, protocolsPath);
        const q = query(protocolsRef, orderBy('createdAt', 'desc'));
        const unsubProtocols = onSnapshot(q, (snap) => {
          const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setSavedProtocols(items);
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, protocolsPath);
        });
        return () => unsubProtocols();
      } else {
        setSavedProtocols([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const showNotification = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000); // 4000ms helps read long error messages
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      showNotification('خوش آمدید ای پهلوان');
    } catch (error) {
      console.error(error);
    }
  };

  const handleLogout = () => {
    auth.signOut();
    setView('home');
    showNotification('به امید دیدار دوباره', 'info');
  };

  const syncStoryState = async (
    node: number, 
    history: number[], 
    bms: number[],
    dynamicNodeData?: any,
    dynamicHistory?: any[]
  ) => {
    if (!user) return;
    const storyPath = `users/${user.uid}/story/state`;
    try {
      await setDoc(doc(db, storyPath), {
        currentNodeId: node,
        history: history,
        bookmarks: bms,
        dynamicStoryNodeData: dynamicNodeData || null,
        dynamicStoryHistory: dynamicHistory || [],
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, storyPath);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (view === 'test' && testQuestions.length === 0) {
      setIsLoadingTest(true);
      generateTestQuestions().then(qs => {
        setTestQuestions(qs);
        setIsLoadingTest(false);
      }).catch(e => {
        console.error(e);
        if (e.message === "QUOTA_EXCEEDED") {
           showNotification('سهمیه هوش مصنوعی به پایان رسیده است. لطفا بعدا تلاش کنید.', 'error');
        } else {
           showNotification('خطا در بارگزاری آزمون پهلوانی.', 'error');
        }
        setIsLoadingTest(false);
      });
    }
    
    if (view === 'story' && !storyNodeData) {
      setIsLoadingStory(true);
      generateStoryNode([]).then(node => {
        setStoryNodeData(node);
        setIsLoadingStory(false);
        if (user && storyTextHistory.length === 0) {
          syncStoryState(storyNode, storyHistory, bookmarks, node, []);
        }
      }).catch(e => {
        console.error(e);
        if (e.message === "QUOTA_EXCEEDED") {
           showNotification('سهمیه هوش مصنوعی به پایان رسیده است. لطفا بعدا تلاش کنید.', 'error');
        } else {
           showNotification('خطا در بارگزاری داستان هفت‌خوان.', 'error');
        }
        setIsLoadingStory(false);
      });
    }
  }, [view]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user' as const, content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      // Create a temporary placeholder for the streaming message
      setMessages(prev => [...prev, { role: 'model', content: '' }]);
      
      const response = await chatWithFerdowsiStream(messages, input, (streamedText) => {
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].content = streamedText;
          return newMessages;
        });
      });
      // No need to set again, the stream callback handles it
    } catch (error: any) {
      console.error(error);
      if (error.message === "QUOTA_EXCEEDED") {
        const quotaMsg = 'ای پهلوان، گویی امواجِ خردِ کیهانی موقتاً فروکش کرده‌اند. اندکی درنگ کن تا این چشمه دوباره بجوشد.';
        showNotification('سهمیه ارتباط با حکیم موقتاً به پایان رسیده است.', 'error');
        setMessages(prev => [...prev, { role: 'model', content: quotaMsg }]);
      } else {
        setMessages(prev => [...prev, { role: 'model', content: 'پوزش می‌طلبم، راه ارتباطی با خرد بسته شده است.' }]);
      }
    } finally {
      setIsTyping(false);
    }
  };

  const handleVoiceMessage = async (text: string) => {
    if (!text.trim()) return;
    setInput('');
    setVoiceResponse('');
    if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
    }
    setIsPlayingVoice(false);
    setIsTyping(true);

    try {
      const moodPrompt = selectedPersona === 'auto' 
        ? "در ابتدای پاسخ خود یکی از این برچسب‌ها را دقیقاً با فرمت [آرام]، [حماسی]، [حکیمانه]، یا [شاعرانه] بنویس. سپس پاسخ خود را در یک یا دو جمله کوتاه بیان کن" 
        : `پاسخ خود را با لحنی متناسب با شخصیت ${voiceModes[selectedPersona as keyof typeof voiceModes]?.label || 'حکیمانه'} در یک یا دو جمله کوتاه بیان کن`;

      const voicePrompt = `${text}\n\n[حالت صوتی: ${moodPrompt}]`;
      let response = await chatWithFerdowsi([], voicePrompt);

      let detectedMood = selectedPersona === 'auto' ? 'hakim' : selectedPersona;
      
      if (selectedPersona === 'auto') {
        if (response.includes('[آرام]')) detectedMood = 'aram';
        else if (response.includes('[حماسی]')) detectedMood = 'hamasi';
        else if (response.includes('[حکیمانه]')) detectedMood = 'hakim';
        else if (response.includes('[شاعرانه]')) detectedMood = 'sheeri';
        
        response = response.replace(/\[(آرام|حماسی|حکیمانه|شاعرانه)\]/g, '').trim();
      }

      const activeConfig = voiceModes[detectedMood as keyof typeof voiceModes] || voiceModes.hakim;
      setVoiceConfig(activeConfig);
      setVoiceResponse(response);
      
      try {
        const audioBase64 = await generateSpeechText(response, 'Charon');
        if (audioBase64) {
          playPcmAudio(audioBase64);
        } else {
          speakAsFerdowsi(response, activeConfig);
        }
      } catch (voiceError) {
        console.error('TTS Error:', voiceError);
        speakAsFerdowsi(response, activeConfig);
      }
      
      showNotification('حکیم پاسخ داد.', 'success');
    } catch (error: any) {
      console.error(error);
      if (error.message === "QUOTA_EXCEEDED") {
         showNotification('سهمیه حکیم به پایان رسیده است.', 'error');
         setVoiceResponse("ای رهرو، چشمه‌ی کلام من موقتاً خشکیده است. زمانی دیگر بازآی تا دوباره سخن بگویم.");
      } else {
         showNotification('خطا در ارتباط با سرور. لطفاً دوباره تلاش کنید.', 'error');
      }
    } finally {
      setIsTyping(false);
    }
  };

  const handleTestResponse = (response: string) => {
    const newResponses = [...testResponses, response];
    setTestResponses(newResponses);
    if (testStep < testQuestions.length - 1) {
      setTestStep(prev => prev + 1);
    } else {
      performAnalysis(newResponses);
    }
  };

  const performAnalysis = async (responses: string[]) => {
    setIsTyping(true);
    try {
      const result = await generateCharacterAnalysis(responses);
      setAnalysis(result);
      const protocol = { 
        type: 'test', 
        data: result, 
        date: new Date().toLocaleDateString('fa-IR'),
        createdAt: new Date().toISOString()
      };
      
      if (user) {
        const protocolsPath = `users/${user.uid}/protocols`;
        try {
          await setDoc(doc(collection(db, protocolsPath)), protocol);
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, protocolsPath);
        }
      } else {
        setSavedProtocols(prev => [{ ...protocol, id: Date.now().toString() }, ...prev]);
      }
      
      setView('manuscript');
      showNotification('تحلیل شخصیت در گنجینه ذخیره شد');
    } catch (error: any) {
      console.error(error);
      if (error.message === "QUOTA_EXCEEDED") {
         showNotification('سهمیه هوش مصنوعی به پایان رسیده است. لطفا بعدا تلاش کنید.', 'error');
      } else {
         showNotification('خطا در تحلیل شخصیت.', 'error');
      }
    } finally {
      setIsTyping(false);
    }
  };

  const renderHome = () => (
    <div className="flex flex-col items-center justify-center min-h-[90vh] space-y-8 p-4 md:p-6 pb-10">
      <div className="absolute top-4 left-4 z-50">
        <span className="text-xl md:text-2xl font-bold text-royal-gold uppercase tracking-widest font-sans drop-shadow-[0_0_10px_rgba(230,138,0,0.5)] select-none">
          AixAria
        </span>
      </div>

      <div className="absolute top-4 md:top-6 right-4 md:right-6 z-50">
        {user ? (
          <div className="flex items-center space-x-2 rtl:space-x-reverse glass-panel p-1.5 pr-3 rounded-full border border-royal-gold/30">
            <span className="gold-text text-xs font-bold hidden sm:inline">{user.displayName}</span>
            <img src={user.photoURL || ''} alt="User" className="w-7 h-7 rounded-full border border-royal-gold" />
            <button onClick={handleLogout} className="p-1.5 text-royal-turquoise hover:text-royal-gold transition-colors">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button 
            onClick={handleLogin}
            className="glass-panel px-5 py-1.5 rounded-full border border-royal-gold/30 gold-text hover:bg-royal-gold/10 transition-all font-bold text-sm"
          >
            ورود به دربار
          </button>
        )}
      </div>
      
      <motion.div 
        animate={{ 
          scale: [1, 1.02, 1],
          filter: [
            "drop-shadow(0 0 20px rgba(230,138,0,0.4))", 
            "drop-shadow(0 0 60px rgba(26,63,37,0.7))", 
            "drop-shadow(0 0 20px rgba(230,138,0,0.4))"
          ]
        }} 
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="relative quantum-ring p-2 mt-8 md:mt-0"
      >
        <div className="absolute inset-0 bg-quantum-purple/10 blur-3xl rounded-full mix-blend-screen" />
        {mounted && <FerdowsiAvatar size={isIframe ? 150 : 200} audioVolume={audioVolume} />}
      </motion.div>

      <div className="text-center space-y-8">
        <h1 className="text-5xl md:text-7xl font-bold quantum-glow tracking-widest font-nastaliq leading-snug">
          رزونانس شاهنامه
        </h1>
        <p className="text-royal-turquoise/90 text-md md:text-xl font-medium tracking-widest quantum-data opacity-90 pb-4">
          [ کوانتومِ حکمتِ باستان در کالبدِ سیلیکون ]
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:gap-6 w-full max-w-lg px-2">
        <MenuButton 
          icon={<MessageSquare className="w-5 h-5 md:w-6 md:h-6" />} 
          label="پیکِ خرد (گفتگو)" 
          onClick={() => setView('chat')} 
        />
        <MenuButton 
          icon={<Mic className="w-5 h-5 md:w-6 md:h-6" />} 
          label="بانگِ حکیم (صدا)" 
          onClick={() => setView('voice')} 
        />
        <MenuButton 
          icon={<Brain className="w-5 h-5 md:w-6 md:h-6" />} 
          label="آزمونِ پهلوانی (آنالیز)" 
          onClick={() => setView('test')} 
        />
        <MenuButton 
          icon={<BookOpen className="w-5 h-5 md:w-6 md:h-6" />} 
          label="هفت‌خوان (داستان)" 
          onClick={() => setView('story')} 
        />
        <MenuButton 
          icon={<Feather className="w-5 h-5 md:w-6 md:h-6" />} 
          label="جامِ جم (فال)" 
          onClick={() => { setView('fal'); setFalData(null); }} 
        />
        <MenuButton 
          icon={<Scroll className="w-5 h-5 md:w-6 md:h-6" />} 
          label="گنجورِ اسرار (گنجینه)" 
          onClick={() => setView('manuscript')} 
        />
      </div>

      <div className="mt-8 text-center px-4 w-full max-w-lg">
        <p className="inline-block glass-panel px-6 py-2 rounded-full border-royal-turquoise/20 text-royal-turquoise/90 text-sm md:text-base leading-relaxed tracking-wide font-amiri font-bold drop-shadow-md">
          این برنامه توسط <strong className="text-royal-gold">آریا فانی</strong> برای آگاهی بخشیدن در مورد تمدن ایران و آریایی ساخته شده است
        </p>
      </div>
    </div>
  );

  const renderChat = () => (
    <div className="flex flex-col h-[90vh] p-4 relative z-10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4 rtl:space-x-reverse">
          <button onClick={() => setView('home')} className="p-2 hover:bg-quantum-purple/20 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6 text-quantum-purple" />
          </button>
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <FerdowsiAvatar size={40} audioVolume={audioVolume} />
            <span className="quantum-glow font-bold font-nastaliq text-xl">حکیم ابوالقاسم فردوسی</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-4 rtl:space-x-reverse">
           <div className="flex items-center space-x-2 rtl:space-x-reverse bg-royal-black/40 px-3 py-1.5 rounded-full border border-royal-turquoise/20">
              <Volume2 className="w-4 h-4 text-royal-turquoise" />
              <input 
                type="range" 
                min="0.5" 
                max="1.5" 
                step="0.1" 
                value={voiceConfig.rate}
                onChange={(e) => setVoiceConfig({...voiceConfig, rate: parseFloat(e.target.value)})}
                className="w-20 accent-royal-gold h-1 cursor-pointer"
                title="Voice Rate"
              />
              <span className="text-[10px] text-royal-turquoise min-w-[20px]">{voiceConfig.rate}x</span>
           </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 mb-4 px-2 custom-scrollbar scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }}>
        {messages.length === 0 && (
          <div className="text-center text-royal-turquoise/50 mt-20 italic quantum-data">
            &quot;بپرس از من هر آنچه در دل داری، ای جوینده‌ی خرد...&quot;
          </div>
        )}
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10, filter: 'blur(5px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] p-5 rounded-2xl text-xl leading-relaxed relative group backdrop-blur-md ${
              m.role === 'user' 
                ? 'bg-quantum-purple/10 border border-quantum-purple/30 text-white shadow-[0_0_15px_rgba(157,0,255,0.2)]' 
                : 'bg-royal-gold/5 border border-royal-turquoise/30 text-royal-turquoise shadow-[0_0_20px_rgba(0,240,255,0.15)]'
            }`}>
              {m.content}
              {m.role === 'model' && (
                <div className="absolute -left-12 bottom-2 flex flex-col space-y-2">
                   <button 
                    onClick={() => handleSpeak(m.content, `chat-${i}`)}
                    className={`p-3 rounded-full glass-panel border border-royal-turquoise/30 hover:bg-royal-turquoise/10 transition-all shadow-lg ${
                      isGeneratingAudio === `chat-${i}` ? 'animate-spin' : ''
                    }`}
                  >
                    <Volume2 className={`w-5 h-5 ${isGeneratingAudio === `chat-${i}` ? 'text-royal-turquoise' : 'text-royal-turquoise/70'}`} />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-royal-gold/5 border border-royal-turquoise/30 p-4 rounded-2xl animate-pulse text-royal-turquoise/50 quantum-data">
              ...دریافتِ اسرارِ زمان...
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="relative flex items-center space-x-2 rtl:space-x-reverse mt-2">
        <motion.input
          whileFocus={{ scale: 1.01, borderColor: '#e68a00', boxShadow: '0 0 20px rgba(230, 138, 0, 0.2)' }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="سخنی بگو..."
          className="flex-1 bg-royal-black/50 border border-quantum-purple/40 rounded-full py-4 px-6 focus:outline-none text-white transition-all font-amiri text-lg backdrop-blur-md placeholder-quantum-purple/40 shadow-inner"
          dir="rtl"
        />
        <motion.button 
          whileHover={{ scale: 1.1, backgroundColor: '#e68a00', boxShadow: '0 0 20px rgba(230,138,0,0.8)' }}
          whileTap={{ scale: 0.9 }}
          onClick={handleSendMessage} 
          className="p-4 bg-quantum-purple rounded-full text-white hover:bg-quantum-purple/80 transition-all shadow-[0_0_20px_rgba(26,63,37,0.6)]"
        >
          <Send className="w-5 h-5" />
        </motion.button>
      </div>
    </div>
  );

  const renderTest = () => {
    if (isLoadingTest || testQuestions.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 space-y-8">
          <div className="glass-panel p-8 rounded-3xl manuscript-border animate-pulse text-royal-gold">
            حکیم در حال اندیشه و طرح پرسش‌های خردمندانه است...
          </div>
        </div>
      );
    }

    const currentQ = testQuestions[testStep];

    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 space-y-8">
        <div className="w-full max-w-md glass-panel p-8 rounded-3xl manuscript-border">
          <div className="flex justify-between items-center mb-6">
            <span className="gold-text">گام {testStep + 1} از {testQuestions.length}</span>
            <div className="h-1 w-32 bg-royal-gold/20 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-royal-gold" 
                initial={{ width: 0 }}
                animate={{ width: `${((testStep + 1) / testQuestions.length) * 100}%` }}
              />
            </div>
          </div>
          
          <h2 className="text-3xl font-bold gold-text mb-8 text-center leading-relaxed font-nastaliq relative">
            {currentQ?.question}
            <button 
              onClick={() => handleSpeak(currentQ?.question || '', 'test-q')}
              className={`absolute -left-10 top-0 p-2 rounded-full glass-panel border border-royal-gold/20 hover:bg-royal-gold/10 transition-all ${
                isGeneratingAudio === 'test-q' ? 'animate-spin' : ''
              }`}
            >
              <Volume2 className={`w-4 h-4 ${isGeneratingAudio === 'test-q' ? 'text-royal-gold' : 'text-royal-gold/50'}`} />
            </button>
          </h2>

          <div className="space-y-4">
            {currentQ?.options.map((opt, i) => (
              <motion.button
                key={i}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleTestResponse(opt)}
                className="w-full p-4 text-right rounded-xl border border-royal-turquoise/20 hover:border-royal-turquoise bg-royal-turquoise/5 text-royal-turquoise transition-all"
              >
                {opt}
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderStory = () => {
    if (isLoadingStory || !storyNodeData) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 space-y-8">
          <div className="glass-panel p-8 rounded-3xl manuscript-border animate-pulse text-royal-gold">
            حکیم در حال نگارش ادامه‌ی داستان است...
          </div>
        </div>
      );
    }

    const handleChoice = async (choiceText: string) => {
      setIsLoadingStory(true);
      const currentHistory = [...storyTextHistory, { title: storyNodeData.title, text: storyNodeData.text }];
      setStoryTextHistory(currentHistory);
      
      try {
        const historyStrings = currentHistory.map(h => h.text);
        const nextNode = await generateStoryNode(historyStrings, choiceText);
        setStoryNodeData(nextNode);
        
        // Auto-sync story progress to Firestore
        if (user) {
          syncStoryState(storyNode, storyHistory, bookmarks, nextNode, currentHistory);
        }
      } catch (error) {
        console.error(error);
        showNotification('خطا در ادامه‌ی داستان', 'info');
      } finally {
        setIsLoadingStory(false);
      }
    };

    const handleBack = () => {
      // In a dynamic story, going back might mean reverting to the last generated node if we stored them,
      // but since we only store text history, we can't easily go back without re-generating or storing full nodes.
      // For now, let's just show a notification that time flows forward.
      showNotification('در این داستان، زمان تنها به پیش می‌رود...', 'info');
    };

    const toggleBookmark = () => {
      // Bookmarks in dynamic story could save the current text to manuscript
      showNotification('این بخش در گنجینه ثبت شد (به زودی)');
    };

    return (
      <div className="flex flex-col h-[90vh] p-6 relative overflow-hidden">
        {/* Story Header */}
        <div className="flex justify-between items-center mb-8 z-20">
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setView('home')} 
            className="p-2 glass-panel rounded-full"
          >
            <ChevronLeft className="w-6 h-6 gold-text" />
          </motion.button>
          
          <div className="flex space-x-2 rtl:space-x-reverse">
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleBack}
              className="p-2 glass-panel rounded-lg text-royal-turquoise"
            >
              <History className="w-5 h-5" />
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleBookmark}
              className="p-2 glass-panel rounded-lg text-royal-gold/50"
            >
              <Bookmark className="w-5 h-5 fill-current" />
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsStoryNavOpen(!isStoryNavOpen)}
              className="p-2 glass-panel rounded-lg text-royal-gold"
            >
              <Scroll className="w-5 h-5" />
            </motion.button>
          </div>
        </div>

        {/* Story Content */}
        <div className="flex-1 flex flex-col items-center justify-center space-y-12 z-10">
          <AnimatePresence mode="wait">
            <motion.div 
              key={storyNodeData.title}
              initial={{ opacity: 0, y: 20, rotateX: -10 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              exit={{ opacity: 0, y: -20, rotateX: 10 }}
              className="glass-panel p-10 rounded-3xl manuscript-border max-w-xl text-center shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative"
            >
              <button 
                onClick={() => handleSpeak(`${storyNodeData.title}. ${storyNodeData.text}`, 'story')}
                className="absolute top-4 left-4 p-3 rounded-full glass-panel border border-royal-gold/20 hover:bg-royal-gold/10 transition-all"
              >
                <Volume2 className={`w-6 h-6 ${isGeneratingAudio === 'story' ? 'animate-pulse gold-text' : 'text-royal-gold/50'}`} />
              </button>
              <h3 className="text-3xl font-bold gold-text mb-6 font-nastaliq">{storyNodeData.title}</h3>
              <p className="text-royal-turquoise text-2xl leading-relaxed italic font-medium font-amiri">
                {storyNodeData.text}
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="grid grid-cols-1 gap-4 w-full max-w-md">
            {storyNodeData.choices.map((choice, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ scale: 1.02, backgroundColor: 'rgba(0, 206, 209, 0.1)', borderColor: '#00ced1' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleChoice(choice)}
                className="p-5 glass-panel border-royal-turquoise/30 rounded-2xl text-royal-turquoise transition-all text-lg font-bold text-right flex justify-between items-center"
              >
                <span>{choice}</span>
                <ChevronLeft className="w-5 h-5 opacity-50" />
              </motion.button>
            ))}
          </div>
        </div>

        {/* Story Navigation Drawer */}
        <AnimatePresence>
          {isStoryNavOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsStoryNavOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm z-30"
              />
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                className="absolute top-0 right-0 h-full w-72 bg-royal-black border-l border-royal-gold/30 z-40 p-6 flex flex-col space-y-8 shadow-[-20px_0_50px_rgba(0,0,0,0.5)]"
              >
                <div className="flex justify-between items-center">
                  <h3 className="gold-text font-bold text-xl">تاریخچه‌ی سفر</h3>
                  <button onClick={() => setIsStoryNavOpen(false)} className="text-royal-gold/50 hover:text-royal-gold">
                    <ChevronLeft className="w-6 h-6 rotate-180" />
                  </button>
                </div>

                <div className="space-y-6 overflow-y-auto custom-scrollbar pr-2 scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <section>
                    <div className="space-y-2">
                      {storyTextHistory.length === 0 && <p className="text-royal-gold/20 text-sm italic">هنوز سفری آغاز نشده...</p>}
                      {storyTextHistory.map((node, idx) => (
                        <div
                          key={idx}
                          className="w-full text-right p-3 rounded-xl border border-royal-gold/10 bg-royal-black text-royal-gold/60 text-sm flex justify-between items-center"
                        >
                          <span className="opacity-30 text-[10px]">{idx + 1}</span>
                          <span>{node.title}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const [playingProtocol, setPlayingProtocol] = useState<number | null>(null);

  const renderManuscript = () => (
    <div className="flex flex-col h-[90vh] p-6">
      <div className="flex items-center justify-between mb-8 rtl:space-x-reverse">
        <div className="flex items-center space-x-4 rtl:space-x-reverse">
          <button onClick={() => setView('home')} className="p-2 glass-panel rounded-full">
            <ChevronLeft className="w-6 h-6 gold-text" />
          </button>
          <h2 className="text-3xl font-bold gold-text font-nastaliq">گنجینه‌ی خرد</h2>
        </div>
        <button 
          onClick={() => setView('manuscript_manager')}
          className="px-4 py-2 glass-panel rounded-full border border-royal-turquoise/30 text-royal-turquoise text-sm hover:bg-royal-turquoise/10 transition-all font-bold"
        >
          مدیریت گنجینه
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pb-20 scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }}>
        {savedProtocols.length === 0 && (
          <div className="text-center text-royal-turquoise/30 mt-20">
            هنوز گنجینه‌ای ذخیره نکرده‌ای...
          </div>
        )}
        {savedProtocols.map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ 
              scale: 1.02, 
              borderColor: 'rgba(212, 175, 55, 0.5)',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)' 
            }}
            transition={{ delay: i * 0.1 }}
            className="glass-panel p-6 rounded-3xl manuscript-border relative overflow-hidden transition-colors"
          >
            <div className="absolute top-0 right-0 p-2 bg-royal-gold/10 rounded-bl-xl text-[10px] gold-text">
              {p.date}
            </div>
            {p.type === 'test' && (
              <div className="space-y-4">
                <div className="flex items-center space-x-3 rtl:space-x-reverse">
                  <div className="w-12 h-12 rounded-full bg-royal-gold/20 flex items-center justify-center">
                    <Brain className="w-6 h-6 gold-text" />
                  </div>
                  <div>
                    <h3 className="gold-text font-bold text-lg">تحلیل شخصیت: {p.data.character}</h3>
                    <p className="text-royal-turquoise text-sm">امتیاز نبوغ: {p.data.geniusScore}</p>
                  </div>
                </div>
                <p className="text-royal-turquoise/80 leading-relaxed font-amiri text-lg">{p.data.description}</p>
                <div className="p-4 bg-royal-black/50 rounded-xl border border-royal-gold/20 text-center italic gold-text relative group">
                  <button 
                    onClick={() => handleSpeak(`${p.data.description}. ${p.data.poem}`, `protocol-${i}`)}
                    className="absolute -left-2 -top-2 p-2 rounded-full glass-panel border border-royal-gold/20"
                  >
                    <Volume2 className="w-4 h-4 gold-text" />
                  </button>
                  {p.data.poem}
                </div>
                
                {playingProtocol === i && (
                  <div className="flex items-center justify-center space-x-1 h-8 rtl:space-x-reverse">
                    {[...Array(12)].map((_, j) => (
                      <motion.div
                        key={j}
                        className="w-1 bg-royal-turquoise"
                        animate={{ height: [4, 24, 4] }}
                        transition={{ duration: 0.5, repeat: Infinity, delay: j * 0.05 }}
                      />
                    ))}
                  </div>
                )}

                <div className="flex justify-end space-x-2 rtl:space-x-reverse">
                  <button 
                    onClick={() => handleSpeak(`${p.data.description}. حکیم فرمود: ${p.data.poem}`, `ms-${i}`)}
                    className={`p-2 rounded-lg transition-all ${isGeneratingAudio === `ms-${i}` ? 'bg-royal-gold text-royal-black' : 'text-royal-turquoise hover:bg-royal-turquoise/10'}`}
                  >
                    <Volume2 className={`w-5 h-5 ${isGeneratingAudio === `ms-${i}` ? 'animate-pulse' : ''}`} />
                  </button>
                  <button className="p-2 text-royal-gold hover:bg-royal-gold/10 rounded-lg">
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );

  const renderManuscriptManager = () => {
    const handleDelete = async (id: string) => {
      if (!user) {
        setSavedProtocols(prev => prev.filter(p => p.id !== id));
        return;
      }
      const protocolPath = `users/${user.uid}/protocols/${id}`;
      try {
        await deleteDoc(doc(db, protocolPath));
        showNotification('آیتم با موفقیت حذف شد', 'info');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, protocolPath);
      }
    };

    return (
      <div className="flex flex-col h-[90vh] p-6">
        <div className="flex items-center space-x-4 mb-8 rtl:space-x-reverse">
          <button onClick={() => setView('manuscript')} className="p-2 glass-panel rounded-full">
            <ChevronLeft className="w-6 h-6 gold-text" />
          </button>
          <h2 className="text-3xl font-bold gold-text font-nastaliq">مدیریت گنجینه</h2>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pb-20 scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }}>
          {savedProtocols.length === 0 && (
            <div className="text-center text-royal-turquoise/30 mt-20">گنجینه‌ای برای مدیریت وجود ندارد...</div>
          )}
          {savedProtocols.map((p, i) => (
            <motion.div
              key={p.id || i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel p-4 rounded-2xl border border-royal-gold/20 flex items-center justify-between"
            >
              <div className="flex items-center space-x-4 rtl:space-x-reverse">
                <div className="w-10 h-10 rounded-full bg-royal-gold/10 flex items-center justify-center">
                  {p.type === 'test' ? <Brain className="w-5 h-5 gold-text" /> : <Volume2 className="w-5 h-5 gold-text" />}
                </div>
                <div>
                  <h4 className="gold-text font-bold text-sm">{p.type === 'test' ? `تحلیل: ${p.data.character}` : 'پروتکل صوتی'}</h4>
                  <p className="text-royal-turquoise/50 text-xs">{p.date}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <button 
                  onClick={() => handleSpeak(p.type === 'test' ? `${p.data.character}: ${p.data.description}` : 'پروتکل صوتی', `msm-${i}`)}
                  className={`p-2 rounded-lg transition-all ${isGeneratingAudio === `msm-${i}` ? 'bg-royal-gold/20 text-royal-gold' : 'text-royal-turquoise hover:bg-royal-turquoise/10'}`}
                >
                  <Volume2 className={`w-5 h-5 ${isGeneratingAudio === `msm-${i}` ? 'animate-pulse' : ''}`} />
                </button>
                <button 
                  onClick={() => handleDelete(p.id)}
                  className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  };

  const renderVoice = () => (
    <div className="flex flex-col h-[90vh] p-4 text-center">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4 rtl:space-x-reverse mb-8">
          <button onClick={() => setView('home')} className="p-2 hover:bg-royal-gold/10 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6 gold-text" />
          </button>
          <div className="flex space-x-2 rtl:space-x-reverse gold-text text-xs">
            <button 
              onClick={() => setVisualizerStyle('pulse')} 
              className={`px-3 py-1 rounded-full border border-royal-gold/30 transition-all ${visualizerStyle === 'pulse' ? 'bg-royal-gold text-royal-black shadow-[0_0_10px_rgba(212,175,55,0.5)]' : 'hover:bg-royal-gold/10'}`}
            >تپش</button>
            <button 
              onClick={() => setVisualizerStyle('bars')} 
              className={`px-3 py-1 rounded-full border border-royal-gold/30 transition-all ${visualizerStyle === 'bars' ? 'bg-royal-gold text-royal-black shadow-[0_0_10px_rgba(212,175,55,0.5)]' : 'hover:bg-royal-gold/10'}`}
            >میله</button>
            <button 
              onClick={() => setVisualizerStyle('wave')} 
              className={`px-3 py-1 rounded-full border border-royal-gold/30 transition-all ${visualizerStyle === 'wave' ? 'bg-royal-gold text-royal-black shadow-[0_0_10px_rgba(212,175,55,0.5)]' : 'hover:bg-royal-gold/10'}`}
            >موج</button>
            <button 
              onClick={() => setVisualizerStyle('ambient')} 
              className={`px-3 py-1 rounded-full border border-royal-gold/30 transition-all ${visualizerStyle === 'ambient' ? 'bg-royal-gold text-royal-black shadow-[0_0_10px_rgba(212,175,55,0.5)]' : 'hover:bg-royal-gold/10'}`}
            >هاله</button>
          </div>
        </div>
        <span className="gold-text font-bold text-lg font-nastaliq">کلامی از حکیم</span>
        <div className="flex items-center space-x-2 rtl:space-x-reverse bg-royal-gold/10 px-4 py-1.5 rounded-full border border-royal-gold/30 gold-text text-sm font-bold shadow-[0_0_15px_rgba(212,175,55,0.1)]">
          حالت: حکیم (هوشمند)
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center space-y-12">
          <div className="relative rounded-full">
            {(isListening || isPlayingVoice) && (
              <>
                {visualizerStyle === 'pulse' && (
                  <motion.div 
                    animate={{ 
                      opacity: 0.3 + (audioVolume / 255) * 0.7, 
                      filter: `blur(${10 + (audioVolume/255)*20}px)`,
                      scale: 1 + (audioVolume / 255) * 0.3
                    }}
                    className="absolute inset-0 bg-royal-gold rounded-full blur-xl -z-10"
                  />
                )}
                
                {visualizerStyle === 'bars' && audioData.length > 0 && (isListening || isPlayingVoice) && (
                   <div className="absolute inset-x-0 -bottom-12 flex justify-center items-end space-x-1 h-12 pointer-events-none">
                      {Array.from(audioData).filter((_, i) => i % 4 === 0).map((v, i) => (
                        <motion.div 
                          key={i}
                          animate={{ height: `${(v / 255) * 100}%` }}
                          className="w-1 bg-royal-gold rounded-t-full shadow-[0_0_8px_rgba(212,175,55,0.5)]"
                        />
                      ))}
                   </div>
                )}

                {visualizerStyle === 'wave' && (isListening || isPlayingVoice) && (
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="absolute -inset-8 pointer-events-none -z-10"
                  >
                    <svg viewBox="0 0 100 100" className="w-full h-full opacity-30">
                      <motion.circle 
                        cx="50" cy="50" 
                        animate={{ r: 40 + (audioVolume / 255) * 10 }}
                        className="fill-none stroke-royal-turquoise stroke-[0.5]"
                      />
                      <motion.circle 
                        cx="50" cy="50" 
                        animate={{ r: 45 + (audioVolume / 255) * 5 }}
                        className="fill-none stroke-royal-turquoise stroke-[0.2]"
                      />
                    </svg>
                  </motion.div>
                )}

                {visualizerStyle === 'ambient' && (isListening || isPlayingVoice) && (
                  <div className="absolute -inset-10 -z-10 flex items-center justify-center pointer-events-none">
                    <motion.div 
                      animate={{ 
                        scale: [1, 1.2, 1],
                        opacity: [0.1, 0.3, 0.1],
                        rotate: [0, 90, 180, 270, 360]
                      }}
                      transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                      className="w-full h-full bg-gradient-to-r from-royal-gold/20 via-royal-turquoise/20 to-royal-gold/20 rounded-full blur-3xl"
                    />
                  </div>
                )}
              </>
            )}
            <FerdowsiAvatar size={200} audioVolume={audioVolume} />
          </div>

        <div className="h-24 w-full flex items-center justify-center">
          {input.trim() ? (
            <p className="text-royal-turquoise text-lg italic bg-royal-turquoise/10 p-4 rounded-xl border border-royal-turquoise/30 max-w-lg w-full shadow-inner">
              &quot;{input}&quot;
            </p>
          ) : (
            <p className="text-royal-turquoise/50 text-sm">
              بر روی میکروفون کلیک کنید و با حکیم سخن بگویید...
            </p>
          )}
        </div>

        <div className="flex items-center justify-center space-x-4 rtl:space-x-reverse relative">
          {isListening && (
            <motion.div 
              className="absolute inset-0 pointer-events-none flex justify-center items-center"
              animate={{ opacity: 0.5 + (audioVolume / 255) * 0.5 }}
            >
              <div className="w-16 h-16 rounded-full border-2 border-royal-gold/50 absolute" style={{ transform: `scale(${1 + (audioVolume / 100)})` }}></div>
              <div className="w-16 h-16 rounded-full border border-royal-gold/30 absolute" style={{ transform: `scale(${1.2 + (audioVolume / 80)})` }}></div>
            </motion.div>
          )}
          
          <motion.button 
            whileHover={!isListening ? { scale: 1.1, borderColor: '#00ced1', backgroundColor: 'rgba(0, 206, 209, 0.1)' } : {}}
            whileTap={{ scale: 0.9 }}
            onClick={handleMicClick}
            className={`p-6 border-2 rounded-full transition-all relative z-10 ${
              isListening ? 'bg-royal-gold/20 border-royal-gold text-royal-gold shadow-[0_0_30px_rgba(212,175,55,0.5)]' 
              : isTranscribing ? 'bg-royal-gold/20 border-royal-gold text-royal-gold opacity-50 cursor-wait shadow-[0_0_20px_rgba(212,175,55,0.3)]'
              : 'glass-panel border-royal-turquoise/50 text-royal-turquoise hover:shadow-[0_0_20px_rgba(0,206,209,0.2)]'
            }`}
          >
            {isTranscribing ? <Brain className="w-10 h-10 animate-pulse" /> : <Mic className="w-10 h-10" />}
          </motion.button>

          <AnimatePresence>
            {input.trim() && !isTranscribing && !isTyping && (
              <motion.button 
                initial={{ opacity: 0, scale: 0.5, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.5, x: 20 }}
                whileHover={{ scale: 1.1, backgroundColor: '#f9e297' }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleVoiceMessage(input)} 
                className="p-5 bg-royal-gold rounded-full text-royal-black hover:bg-royal-gold/80 transition-all shadow-[0_0_20px_rgba(212,175,55,0.4)]"
              >
                <Send className="w-8 h-8" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {isTyping && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-royal-gold/70 animate-pulse font-nastaliq text-xl"
          >
            حکیم در حال تأمل است...
          </motion.div>
        )}

        {voiceResponse && !isTyping && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl bg-royal-gold/10 border border-royal-gold/30 rounded-3xl p-10 relative overflow-hidden shadow-[0_0_40px_rgba(212,175,55,0.2)]"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-royal-gold/5 rounded-full blur-3xl"></div>
            <div className="relative z-10 flex flex-col items-center">
              <div className="flex items-center space-x-3 rtl:space-x-reverse mb-8">
                <motion.div
                  animate={isPlayingVoice ? { scale: [1, 1.2, 1], rotate: [0, 5, -5, 0] } : {}}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  <Volume2 className={`w-10 h-10 ${isPlayingVoice ? 'text-royal-turquoise' : 'text-royal-gold/50'}`} />
                </motion.div>
                <span className="gold-text font-bold text-3xl font-nastaliq">پاسخِ حکیمانه‌ی فردوسی</span>
              </div>
              <p className="text-royal-turquoise text-3xl leading-relaxed font-amiri whitespace-pre-wrap text-center">
                {voiceResponse}
              </p>
              
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleSpeak(voiceResponse, 're-play')}
                className="mt-8 p-3 glass-panel border border-royal-gold/30 rounded-full text-royal-gold hover:bg-royal-gold/10 transition-all flex items-center space-x-2 rtl:space-x-reverse"
              >
                <Volume2 className="w-5 h-5" />
                <span className="text-sm font-bold">شنیدنِ دوباره</span>
              </motion.button>
            </div>
            
            {/* Visualizer bars */}
            {isPlayingVoice && (
              <div className="absolute bottom-0 left-0 right-0 h-1/3 opacity-20 pointer-events-none flex items-end justify-center space-x-1 rtl:space-x-reverse">
                {[...Array(20)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-2 bg-royal-turquoise rounded-t-sm"
                    animate={{ height: ["10%", "100%", "20%"] }}
                    transition={{
                      duration: 0.5 + Math.random() * 0.5,
                      repeat: Infinity,
                      repeatType: "reverse",
                      ease: "easeInOut",
                    }}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );

  const handleTakeFal = async () => {
    setIsGeneratingFal(true);
    setFalData(null); 
    try {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      stopAudioAnalysis();
      
      const result = await generateFal();
      setFalData(result);
      
      setTimeout(() => {
        handleSpeak(`${result.verses.join('. ')}. تفسیرِ حکیمانه: ${result.tafsir}`, 'fal');
      }, 800);
      
    } catch (error: any) {
      console.error(error);
      const msg = error.message === "QUOTA_EXCEEDED" 
        ? 'سهمیه هوش مصنوعی به پایان رسیده است. لطفا بعدا تلاش کنید.' 
        : 'فال در غبارِ زمان گم شد. دوباره نیت کن.';
      showNotification(msg, 'error');
    } finally {
      setIsGeneratingFal(false);
    }
  };

  const renderFal = () => (
    <div className="flex flex-col h-[90vh] p-4 items-center relative z-10">
      <div className="flex items-center justify-between w-full mb-8">
        <button onClick={() => setView('home')} className="p-2 hover:bg-quantum-purple/20 rounded-full transition-colors">
          <ChevronLeft className="w-6 h-6 text-quantum-purple" />
        </button>
        <span className="quantum-glow font-bold text-lg font-nastaliq">جامِ جم (فال)</span>
        <div className="w-10"></div>
      </div>

      <div className="flex-1 w-full max-w-xl flex flex-col items-center justify-center space-y-8">
        {!falData && !isGeneratingFal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-8 relative">
            <div className="absolute inset-0 bg-quantum-purple/5 blur-3xl rounded-full scale-150" />
            <FerdowsiAvatar size={200} audioVolume={audioVolume} />
            <p className="text-white/80 text-lg leading-relaxed quantum-data tracking-[0.2em]">
              نیت کن و بر خردِ نیاکان توکل نما...
            </p>
            <motion.button 
              whileHover={{ scale: 1.05, boxShadow: '0 0 40px rgba(230,138,0,0.8)' }}
              whileTap={{ scale: 0.95 }}
              onClick={handleTakeFal}
              disabled={isGeneratingFal}
              className={`bg-royal-gold text-white font-bold py-4 px-10 rounded-full shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all text-xl mt-4 ${isGeneratingFal ? 'opacity-50 cursor-wait' : ''}`}
            >
              کشفِ تقدیر
            </motion.button>
          </motion.div>
        )}

        {isGeneratingFal && (
          <div className="flex flex-col items-center justify-center space-y-6">
            <div className="relative">
               <motion.div 
                    animate={{ 
                      opacity: 0.1 + (audioVolume / 255) * 0.9, 
                      scale: 1 + (audioVolume / 255) * 0.5
                    }}
                    className="absolute inset-0 bg-royal-gold rounded-full blur-2xl -z-10"
                />
               <FerdowsiAvatar size={120} audioVolume={audioVolume} />
            </div>
            <p className="text-royal-turquoise animate-pulse font-nastaliq text-2xl drop-shadow-[0_0_10px_rgba(230,138,0,0.8)]">
              حکیم در حالِ گشودن کتابِ سرنوشت است...
            </p>
          </div>
        )}

        {falData && !isGeneratingFal && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            className="w-full glass-panel p-8 rounded-3xl border border-royal-gold/30 shadow-[0_0_30px_rgba(26,63,37,0.3)] space-y-8 relative overflow-hidden"
          >
            <div className="absolute -top-20 -left-20 w-40 h-40 bg-royal-gold/10 blur-3xl rounded-full pointer-events-none" />
            
            <div className="flex flex-col items-center mb-4">
               <div className="relative">
                 {isPlayingVoice && (
                    <motion.div 
                      animate={{ 
                        opacity: 0.3 + (audioVolume / 255) * 0.7, 
                        scale: 1 + (audioVolume / 255) * 0.4
                      }}
                      className="absolute inset-0 bg-royal-gold rounded-full blur-xl -z-10"
                    />
                 )}
                 <FerdowsiAvatar size={100} audioVolume={audioVolume} />
               </div>
            </div>
            
            <div className="text-center mb-6 relative z-10">
              <h3 className="text-3xl font-bold quantum-glow font-nastaliq border-b border-royal-gold/30 pb-4 inline-block px-8 drop-shadow-[0_0_10px_rgba(230,138,0,0.5)]">
                نشانِ تقدیر
              </h3>
            </div>
            
            <div className="space-y-4 text-center w-full relative z-10">
               {falData.verses.map((verse, index) => (
                <p key={index} className="text-2xl text-white leading-relaxed whitespace-pre-wrap font-bold font-nastaliq drop-shadow-[0_0_8px_rgba(230,138,0,0.6)]">
                  {verse}
                </p>
              ))}
            </div>

            <div className="mt-8 pt-8 border-t border-quantum-purple/30 text-center relative z-10">
              <button 
                 onClick={() => handleSpeak(`${falData.verses.join('. ')}. تفسیرِ حکیمانه: ${falData.tafsir}`, 'fal')}
                 className="absolute top-4 left-0 p-3 rounded-full hover:bg-quantum-purple/20 transition-all"
              >
                <Volume2 className={`w-6 h-6 ${isGeneratingAudio === 'fal' ? 'animate-pulse text-quantum-purple' : 'text-royal-turquoise/50'}`} />
              </button>
              <h4 className="text-royal-turquoise font-bold mb-4 font-nastaliq text-xl drop-shadow-[0_0_5px_rgba(230,138,0,0.6)]">تفسیر حکیمانه</h4>
              <p className="text-white/80 leading-loose text-justify px-4 font-amiri text-lg">
                {falData.tafsir}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8 pt-4 relative z-10 w-full px-4">
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleTakeFal}
                disabled={isGeneratingFal}
                className="flex-1 flex items-center justify-center space-x-2 rtl:space-x-reverse bg-royal-gold text-royal-black font-bold py-3 px-8 rounded-full transition-all shadow-[0_0_20px_rgba(212,175,55,0.4)]"
              >
                <RefreshCw className={`w-5 h-5 ${isGeneratingFal ? 'animate-spin' : ''}`} />
                <span>فالِ دگربار</span>
              </motion.button>

              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: 'فال شاهنامه من',
                      text: falData.verses.join('\n') + '\n\nتفسیر: ' + falData.tafsir
                    }).catch(() => {});
                  }
                }}
                className="flex-1 flex items-center justify-center space-x-2 rtl:space-x-reverse border border-royal-gold gold-text font-bold py-3 px-8 rounded-full transition-all"
              >
                <Share2 className="w-5 h-5" />
                <span>ارسال نیکی</span>
              </motion.button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );

  return (
    <main className="relative min-h-screen bg-royal-black text-foreground overflow-hidden font-amiri" dir="rtl">
      <LatticeBackground />
      
      {/* Notification Banner */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm px-4"
          >
            <div className={`glass-panel p-4 rounded-2xl border ${
              notification.type === 'success' ? 'border-royal-gold shadow-[0_0_20px_rgba(212,175,55,0.3)]' :
              notification.type === 'error' ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]' :
              'border-royal-turquoise shadow-[0_0_20px_rgba(0,206,209,0.2)]'
            } flex items-center justify-between`}>
              <div className="flex items-center space-x-3 rtl:space-x-reverse">
                {notification.type === 'success' && <CheckCircle2 className="w-5 h-5 gold-text" />}
                {notification.type === 'error' && <AlertTriangle className="w-5 h-5 text-red-500" />}
                {notification.type === 'info' && <Brain className="w-5 h-5 text-royal-turquoise" />}
                
                <span className={`font-bold text-sm ${
                  notification.type === 'success' ? 'gold-text' : 
                  notification.type === 'error' ? 'text-red-400' :
                  'text-royal-turquoise'
                }`}>
                  {notification.message}
                </span>
              </div>
              <button onClick={() => setNotification(null)} className={`hover:scale-110 transition-transform ${
                notification.type === 'error' ? 'text-red-400/70 hover:text-red-400' : 'text-royal-gold/50 hover:text-royal-gold'
              }`}>
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Images Layer: Epic Scenes of Shahnameh */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Dimensional Overlays for Mood */}
        <div className="absolute inset-0 bg-royal-black/60 z-[1]" />
        <div className="absolute inset-0 bg-gradient-to-b from-royal-black via-transparent to-royal-black z-[2]" />
        <div className="absolute inset-0 bg-gradient-to-r from-royal-black/80 via-transparent to-royal-black/80 z-[2]" />
        
        {/* Epic Scenes */}
        <div className="absolute inset-0 flex items-center justify-center opacity-15">
          {/* Cybernetic Persian Theme */}
          <motion.img 
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 5, ease: "easeOut" }}
            src="https://picsum.photos/seed/cyber-ancient-persia/1920/1080?blur=4" 
            alt=""
            className="w-full h-full object-cover grayscale sepia brightness-75 contrast-125 mix-blend-screen"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Side Accents: Rostam (The Hero) and Ferdowsi (The Creator) */}
        <motion.div 
          animate={{ opacity: [0.05, 0.15, 0.05], filter: ["blur(4px)", "blur(2px)", "blur(4px)"] }}
          transition={{ duration: 6, repeat: Infinity }}
          className="absolute -left-10 top-0 h-full w-1/3 opacity-10"
        >
           <img 
            src="https://picsum.photos/seed/hologram-warrior/600/1200" 
            alt=""
            className="h-full w-full object-cover grayscale mix-blend-screen"
            referrerPolicy="no-referrer"
          />
        </motion.div>
        <motion.div 
          animate={{ opacity: [0.05, 0.15, 0.05], filter: ["blur(4px)", "blur(2px)", "blur(4px)"] }}
          transition={{ duration: 6, repeat: Infinity, delay: 3 }}
          className="absolute -right-10 top-0 h-full w-1/3 opacity-10"
        >
           <img 
            src="https://picsum.photos/seed/quantum-sage/600/1200" 
            alt=""
            className="h-full w-full object-cover grayscale mix-blend-screen"
            referrerPolicy="no-referrer"
          />
        </motion.div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-0">
        <AnimatePresence mode="wait">
          {view === 'home' && <motion.div key="home" initial={{ opacity: 0, scale: 0.98, filter: 'blur(10px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 0.98, filter: 'blur(10px)' }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>{renderHome()}</motion.div>}
          {view === 'chat' && <motion.div key="chat" initial={{ opacity: 0, x: 20, filter: 'blur(10px)' }} animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, x: -20, filter: 'blur(10px)' }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>{renderChat()}</motion.div>}
          {view === 'test' && <motion.div key="test" initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>{renderTest()}</motion.div>}
          {view === 'story' && <motion.div key="story" initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>{renderStory()}</motion.div>}
          {view === 'voice' && <motion.div key="voice" initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>{renderVoice()}</motion.div>}
          {view === 'fal' && <motion.div key="fal" initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>{renderFal()}</motion.div>}
          {view === 'manuscript' && <motion.div key="manuscript" initial={{ opacity: 0, filter: 'blur(10px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, filter: 'blur(10px)' }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>{renderManuscript()}</motion.div>}
          {view === 'manuscript_manager' && <motion.div key="manuscript_manager" initial={{ opacity: 0, filter: 'blur(10px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, filter: 'blur(10px)' }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>{renderManuscriptManager()}</motion.div>}
        </AnimatePresence>
      </div>

      {/* Confetti Effect Placeholder */}
      <div id="confetti-container" className="fixed inset-0 pointer-events-none z-50" />
    </main>
  );
}

function MenuButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ y: -2, scale: 1.01, boxShadow: '0 10px 40px rgba(230, 138, 0, 0.4), inset 0 0 15px rgba(26, 63, 37, 0.4)' }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      onClick={onClick}
      className="relative flex flex-col items-center justify-center p-4 md:p-6 glass-panel rounded-[1.5rem] md:rounded-[2rem] border border-royal-turquoise/20 space-y-2 md:space-y-3 transition-opacity group overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-quantum-purple/10 to-royal-turquoise/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="absolute top-0 right-0 w-full h-[1px] bg-gradient-to-l from-transparent via-royal-turquoise to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-royal-gold to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="text-royal-turquoise group-hover:text-royal-gold transition-colors duration-300 relative z-10 filter drop-shadow-[0_0_8px_rgba(230,138,0,0.6)] mix-blend-screen">
        {icon}
      </div>
      <span className="text-white/90 group-hover:text-white font-bold text-xs md:text-sm tracking-wide whitespace-nowrap relative z-10 filter drop-shadow-[0_0_5px_rgba(255,255,255,0.3)] transition-colors duration-300">{label}</span>
    </motion.button>
  );
}
