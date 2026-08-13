import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { characterMeta, CharacterId, COURT_CHARACTERS } from "@/lib/court";
import { trpc } from "@/lib/trpc";
import { ArrowRight, BookMarked, Crown, Heart, Landmark, Loader2, LogOut, ScrollText, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { Link } from "wouter";

export default function Profile() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const sessions = trpc.court.sessions.list.useQuery(undefined, { enabled: isAuthenticated, refetchOnWindowFocus: false });
  const favorites = trpc.court.favorites.list.useQuery(undefined, { enabled: isAuthenticated, refetchOnWindowFocus: false });

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, []);

  if (loading) return <main className="profile-page profile-loading"><Loader2 className="size-6 animate-spin" />در حال گشودنِ دیوان...</main>;
  if (!isAuthenticated) return <main className="profile-page"><div className="profile-unauth"><Crown className="size-10" /><span className="section-kicker">دیوانِ شخصی</span><h1>برای نگه‌داشتنِ روایت‌ها،<br /><em>واردِ دربار شوید</em></h1><p>با حساب Manus، گفت‌وگوهای شما، نامِ چهره‌های برگزیده و دفترِ شخصی‌تان در دسترس می‌ماند.</p><button onClick={() => startLogin()} className="button-gold"><Crown className="size-4" />ورود با Manus</button><Link href="/" className="button-ghost"><ArrowRight className="size-4" />بازگشت به خانه</Link></div></main>;

  const favoriteIds = new Set(favorites.data?.map(item => item.character) ?? []);
  return <main className="profile-page"><div className="profile-orbit" aria-hidden="true" /><header className="profile-header"><Link href="/" className="profile-brand"><ArrowRight className="size-4" />بازگشت به دربار</Link><div className="profile-titlemark"><span>✦</span> دفترِ رزُونانس <span>✦</span></div><button onClick={() => logout()} className="profile-logout"><LogOut className="size-4" />خروج</button></header><div className="profile-wrap"><section className="profile-hero"><div className="profile-monogram">{(user?.name || "ش").slice(0, 1)}</div><div className="profile-copy"><span className="section-kicker">دیوانِ شخصی</span><h1>{user?.name || "مهمانِ دربار"}</h1><p>حافظِ گفت‌وگوها و برگزیده‌های شما در جهانِ شاهنامه.</p><div className="profile-verse">«توانا بود هر که دانا بود»</div></div><Link href="/#court" className="button-gold profile-new-chat"><Landmark className="size-4" />گفت‌وگوی تازه</Link></section>
  <section className="profile-grid"><article className="profile-card profile-sessions"><div className="profile-card-heading"><div><ScrollText className="size-5" /><h2>دفترِ گفت‌وگوها</h2></div><span>{sessions.data?.length ?? 0} گفتگو</span></div>{sessions.isLoading ? <div className="profile-spinner"><Loader2 className="size-5 animate-spin" /></div> : sessions.error ? <div className="profile-empty profile-error"><BookMarked className="size-7" /><p>دفترِ گفت‌وگوها اکنون گشوده نشد.</p><button onClick={() => sessions.refetch()}>دوباره بکوش</button></div> : sessions.data?.length ? <div className="profile-session-list">{sessions.data.map(session => <Link key={session.id} href="/#court" className="profile-session"><ScrollText className="size-4" /><div><strong>{session.title}</strong><small>{characterMeta[session.character as CharacterId]?.name || session.character} · {new Date(session.updatedAt).toLocaleDateString("fa-IR")}</small></div></Link>)}</div> : <div className="profile-empty"><BookMarked className="size-7" /><p>نخستین گفت‌وگویتان هنوز در انتظار است.</p><Link href="/#court">گشودنِ دربار</Link></div>}</article>
  <article className="profile-card"><div className="profile-card-heading"><div><Heart className="size-5" /><h2>چهره‌های برگزیده</h2></div><span>{favoriteIds.size} برگزیده</span></div><div className="favorite-grid">{favorites.error ? <div className="profile-empty profile-error"><Heart className="size-7" /><p>نامِ برگزیده‌ها اکنون پیدا نیست.</p><button onClick={() => favorites.refetch()}>دوباره بکوش</button></div> : COURT_CHARACTERS.filter(id => favoriteIds.has(id)).length ? COURT_CHARACTERS.filter(id => favoriteIds.has(id)).map(id => <div key={id} className="profile-favorite"><div>{characterMeta[id].icon}</div><strong>{characterMeta[id].name}</strong><small>{characterMeta[id].title}</small></div>) : <div className="profile-empty"><Sparkles className="size-7" /><p>هنوز چهره‌ای برگزیده نشده است.</p><Link href="/#court">دیدنِ اهلِ دربار</Link></div>}</div></article></section></div></main>;
}
