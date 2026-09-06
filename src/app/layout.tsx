import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';
import '@/styles/globals.css';
import '@/styles/ui.css';
import '@/styles/site.css';
import { BRAND } from '@/game/copy';
import { SEMANTIC } from '@/game/palette';
import { Nav } from '@/components/site/Nav';
import { Footer } from '@/components/site/Footer';
import { MotionPrefs } from '@/components/site/MotionPrefs';
import { ToastProvider } from '@/components/ui/Toast';
import { isBackendConfigured } from '@/lib/env';
import { getViewer } from '@/server/profile';

/*
 * Typography: exactly two families, both self-hosted (no third-party requests).
 *  - Courier Prime: the typewriter voice for body, descriptions, navigation drawer text, forms and
 *    long-form content (regular, bold, and true italics for the origin quote).
 *  - Pixelify Sans: titles, headings, buttons, player names, HUD labels, loading and system messages,
 *    numbers and game-state text.
 */
const pixel = localFont({ src: '../../public/fonts/pixelify-sans-latin-wght-normal.woff2', variable: '--font-pixel', display: 'swap', weight: '400 700' });
const typewriter = localFont({
  src: [
    { path: '../../public/fonts/courier-prime-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/courier-prime-latin-400-italic.woff2', weight: '400', style: 'italic' },
    { path: '../../public/fonts/courier-prime-latin-700-normal.woff2', weight: '700', style: 'normal' },
    { path: '../../public/fonts/courier-prime-latin-700-italic.woff2', weight: '700', style: 'italic' },
  ],
  variable: '--font-typewriter',
  display: 'swap',
  fallback: ['Courier New', 'Courier', 'monospace'],
});

export const metadata: Metadata = {
  title: { default: BRAND, template: `%s | ${BRAND}` },
  description: 'A multiplayer pixel-art universe where you build your rocket, explore strange worlds, collect resources, meet other explorers, and find somewhere that feels like yours.',
  applicationName: BRAND,
  icons: { icon: [{ url: '/icon', type: 'image/png', sizes: '32x32' }], apple: [{ url: '/apple-icon', type: 'image/png', sizes: '180x180' }] },
};

export const viewport: Viewport = { themeColor: SEMANTIC['--color-bg-primary'], width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const backendReady = isBackendConfigured();
  const viewer = backendReady ? await getViewer() : null;
  const navUser = viewer?.profile ? { username: viewer.profile.username, points: viewer.profile.points, isGuest: viewer.isGuest } : viewer ? { username: 'new explorer', points: 0, isGuest: viewer.isGuest } : null;
  return (
    <html lang="en" className={`${pixel.variable} ${typewriter.variable}`} data-motion="on">
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        <MotionPrefs />
        <ToastProvider>
          <Nav user={navUser} backendReady={backendReady} />
          <main id="main">{children}</main>
          <Footer />
        </ToastProvider>
      </body>
    </html>
  );
}
