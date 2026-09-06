import Link from 'next/link';
import { BRAND } from '@/game/copy';
import { BrandMark } from './Brand';

const LINKS = [
  { href: '/universe', label: 'Game' },
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/about', label: 'About' },
  { href: '/terms', label: 'Terms & Conditions' },
  { href: '/privacy', label: 'Privacy Policy' },
];

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-inner">
        <Link href="/" className="brand" aria-label={`${BRAND} home`}>
          <BrandMark />
          <span>{BRAND}</span>
        </Link>
        <nav aria-label="Footer">
          <ul className="footer-links">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
