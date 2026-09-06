'use client';
import { useEffect } from 'react';

const KEY = 'jnss:settings';

export interface LocalSettings {
  sound: boolean;
  music: boolean;
  reduceMotion: boolean;
  scale: 'small' | 'normal' | 'large';
}
export const DEFAULT_SETTINGS: LocalSettings = { sound: true, music: false, reduceMotion: false, scale: 'normal' };

export function readSettings(): LocalSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<LocalSettings>) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}
export function writeSettings(s: LocalSettings): void {
  window.localStorage.setItem(KEY, JSON.stringify(s));
  applySettings(s);
}
export function applySettings(s: LocalSettings): void {
  const root = document.documentElement;
  root.dataset.motion = s.reduceMotion ? 'off' : 'on';
  root.style.setProperty('--ui-scale', s.scale === 'small' ? '0.9' : s.scale === 'large' ? '1.15' : '1');
}

/** Applies persisted interface settings (motion, scale) on first paint. */
export function MotionPrefs() {
  useEffect(() => {
    applySettings(readSettings());
  }, []);
  return null;
}
