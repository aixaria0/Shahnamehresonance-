export const COURT_CHARACTERS = ["rostam", "zal", "simorgh", "kaykhosrow"] as const;
export type CharacterId = (typeof COURT_CHARACTERS)[number];

export const characterMeta: Record<CharacterId, { name: string; english: string; title: string; icon: string; tint: string; note: string; voice: { label: string; rate: number; pitch: number; hints: string[] } }> = {
  rostam: { name: "رستم", english: "Rostam", title: "پهلوانِ هفت‌خوان", icon: "⚔", tint: "from-amber-300/30 to-red-900/20", note: "سخنِ استوار، دلِ پاسبان", voice: { label: "آوای پهلوان", rate: 0.84, pitch: 0.75, hints: ["Algenib", "Male", "David"] } },
  zal: { name: "زال", english: "Zal", title: "پدرِ دانا", icon: "◒", tint: "from-slate-100/25 to-sky-900/20", note: "تدبیر، مهر و میانجی‌گری", voice: { label: "آوای خردمند", rate: 0.92, pitch: 0.96, hints: ["Iapetus", "Daniel", "Male"] } },
  simorgh: { name: "سیمرغ", english: "Simorgh", title: "فرزانه‌ی البرز", icon: "✦", tint: "from-cyan-200/25 to-violet-900/25", note: "دیدِ دور و درمانِ جان", voice: { label: "آوای البرز", rate: 0.8, pitch: 1.15, hints: ["Achernar", "Samantha", "Female"] } },
  kaykhosrow: { name: "کی‌خسرو", english: "Kay Khosrow", title: "شاهِ دادگر", icon: "♛", tint: "from-indigo-200/25 to-amber-900/25", note: "داد، خویشتن‌داری، فرجام", voice: { label: "آوای داد", rate: 0.78, pitch: 0.88, hints: ["Alnilam", "George", "Male"] } },
};

export const quickPrompts = [
  "در دوراهیِ پیش رو، چگونه میان دل و خرد داوری کنم؟",
  "برای آغازِ کاری دشوار، چه نیرویی باید در خود بپرورانم؟",
  "چگونه پس از یک شکست، دوباره برخیزم؟",
];
