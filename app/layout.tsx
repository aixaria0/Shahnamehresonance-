import type { Metadata } from 'next';
import { Noto_Nastaliq_Urdu, Inter, Amiri } from 'next/font/google';
import './globals.css';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const notoNastaliq = Noto_Nastaliq_Urdu({ 
  subsets: ['arabic'], 
  weight: ['400', '700'],
  variable: '--font-nastaliq' 
});
const amiri = Amiri({
  subsets: ['arabic'],
  weight: ['400', '700'],
  variable: '--font-amiri'
});

export const viewport = {
  themeColor: '#09170e',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'رزونِنس شاهنامه | Resonance Shahnameh',
  description: 'تجربه‌ای عمیق و شخصی با حکیم ابوالقاسم فردوسی در دنیای شاهنامه',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'شاهنامه',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={`${inter.variable} ${notoNastaliq.variable} ${amiri.variable}`}>
      <body className="antialiased selection:bg-royal-gold/30 selection:text-royal-gold">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
