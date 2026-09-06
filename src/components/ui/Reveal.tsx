'use client';
import { useEffect, useRef, type ReactNode } from 'react';

/**
 * One-time rise-in when an element scrolls into view. Server markup is fully visible; after
 * hydration only elements below the fold are hidden until they intersect. Disabled under
 * prefers-reduced-motion and the in-app setting. A safety timer reveals everything regardless.
 */
export function Reveal({ children, className = '', as: Tag = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'li' | 'article' }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off';
    if (reduce) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.95) return; // already on screen: no animation
    el.classList.add('reveal-pending');
    const show = () => {
      el.classList.remove('reveal-pending');
      el.classList.add('reveal-in');
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) { show(); io.disconnect(); }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.05 },
    );
    io.observe(el);
    const safety = window.setTimeout(() => { el.classList.remove('reveal-pending'); io.disconnect(); }, 8000);
    return () => { io.disconnect(); window.clearTimeout(safety); };
  }, []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const T = Tag as any;
  return (
    <T ref={ref} className={`reveal ${className}`.trim()}>
      {children}
    </T>
  );
}
