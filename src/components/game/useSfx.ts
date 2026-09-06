'use client';
import { useCallback, useRef } from 'react';
import { readSettings } from '@/components/site/MotionPrefs';

type SfxName = 'blip' | 'scan' | 'collect' | 'land' | 'wave' | 'error' | 'found';

/** Tiny square-wave sound effects synthesised on the fly. Respects the Sound setting. */
export function useSfx() {
  const ctx = useRef<AudioContext | null>(null);
  return useCallback((name: SfxName) => {
    if (!readSettings().sound) return;
    try {
      ctx.current ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const ac = ctx.current;
      if (ac.state === 'suspended') void ac.resume();
      const notes: Record<SfxName, Array<[number, number]>> = {
        blip: [[660, 0.05]],
        scan: [[440, 0.06], [660, 0.06], [880, 0.08]],
        collect: [[523, 0.05], [784, 0.09]],
        land: [[330, 0.08], [262, 0.08], [196, 0.14]],
        wave: [[784, 0.05], [988, 0.05], [784, 0.05]],
        error: [[196, 0.12], [147, 0.16]],
        found: [[523, 0.06], [659, 0.06], [784, 0.06], [1047, 0.14]],
      };
      let t = ac.currentTime;
      for (const [freq, dur] of notes[name]) {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'square';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain).connect(ac.destination);
        osc.start(t);
        osc.stop(t + dur);
        t += dur;
      }
    } catch {
      // audio is optional
    }
  }, []);
}
