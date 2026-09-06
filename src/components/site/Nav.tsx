'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BRAND } from '@/game/copy';
import { BrandMark } from './Brand';
import { PixelIcon } from '@/components/ui/PixelIcon';
import { LinkButton } from '@/components/ui';
import { LogoutButton } from './LogoutButton';

export interface NavUser {
  username: string;
  points: number;
  isGuest?: boolean;
}

const PUBLIC_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/universe', label: 'Explore' },
  { href: '/rocket', label: 'Rocket' },
  { href: '/customize', label: 'Customize' },
  { href: '/codex', label: 'Codex' },
  { href: '/about', label: 'About' },
];
const PLAYER_LINKS = [
  { href: '/profile', label: 'Profile' },
  { href: '/profile#inventory', label: 'Inventory' },
  { href: '/profile#points', label: 'Points' },
];

function isCurrent(path: string, href: string): boolean {
  const clean = href.split('#')[0];
  if (clean === '/') return path === '/';
  return path === clean || path.startsWith(clean + '/');
}

export function Nav({ user, backendReady }: { user: NavUser | null; backendReady: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [livePoints, setLivePoints] = useState(user?.points ?? 0);
  useEffect(() => setOpen(false), [path]);

  // Keep the global points counter in sync immediately after a game action.
  // The server value remains authoritative; this event only makes the UI update without a refresh.
  useEffect(() => {
    setLivePoints(user?.points ?? 0);
  }, [user?.points]);

  useEffect(() => {
    const onPoints = (event: Event) => {
      const points = (event as CustomEvent<{ points?: number }>).detail?.points;
      if (!Number.isFinite(points) || !points || points <= 0) return;
      setLivePoints((current) => current + Math.floor(points));
    };
    window.addEventListener('jnss:points-awarded', onPoints);
    return () => window.removeEventListener('jnss:points-awarded', onPoints);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const links = user ? [...PUBLIC_LINKS, ...PLAYER_LINKS] : PUBLIC_LINKS;

  const renderLinks = (cls: string) =>
    links.map((l) => (
      <li key={l.href}>
        <Link href={l.href} className={cls} aria-current={isCurrent(path, l.href) && !l.href.includes('#') ? 'page' : undefined}>
          {l.label}
        </Link>
      </li>
    ));

  const authControls = user ? (
    <>
      <Link href="/profile#points" className="nav-points" title="Your points, computed server-side">
        {livePoints.toLocaleString()} pts
      </Link>
      <LinkButton href="/settings" variant="ghost" size="sm" aria-label="Settings">
        <PixelIcon name="gear" size={12} /> {user.username}{user.isGuest ? <span className="tag tag-guest" style={{ marginLeft: '0.25rem' }}>Guest</span> : null}
      </LinkButton>
      <LogoutButton isGuest={user.isGuest} />
    </>
  ) : backendReady ? (
    <>
      <LinkButton href="/login" variant="ghost" size="sm">Log in</LinkButton>
      <LinkButton href="/universe" variant="primary" size="sm">Enter</LinkButton>
    </>
  ) : (
    <span className="tag tag-warn" title="Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY">Backend not configured</span>
  );

  return (
    <header className="nav">
      <div className="wrap nav-inner">
        <Link href="/" className="brand" aria-label={`${BRAND} home`}>
          <BrandMark />
          <span>{BRAND}</span>
        </Link>
        <nav aria-label="Primary">
          <ul className="nav-links">{renderLinks('nav-link')}</ul>
        </nav>
        <div className="nav-right">
          <div className="row" style={{ display: 'none' }} />
          <div className="nav-desktop-auth row" style={{ gap: '0.5rem' }}>{authControls}</div>
          <button type="button" className="nav-toggle" aria-expanded={open} aria-controls="nav-drawer" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen((v) => !v)}>
            <PixelIcon name={open ? 'x' : 'menu'} size={16} />
          </button>
        </div>
      </div>
      {open ? (
        <div id="nav-drawer" className="nav-drawer">
          <nav aria-label="Primary mobile">
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{renderLinks('nav-link')}</ul>
          </nav>
          <div className="row">{authControls}</div>
        </div>
      ) : null}
    </header>
  );
}
