'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PRESENCE_HEARTBEAT_MS } from '@/game/rules';
import type { PresenceRow } from '@/app/api/presence/route';

export interface PresenceState {
  others: PresenceRow[];
  status: 'connecting' | 'live' | 'offline';
  lastSync: number | null;
}

export interface Location {
  systemId: string | null;
  planetId: string | null;
}

/**
 * Presence: I tell the server where I am every few seconds; the server tells me who else is here.
 * Positions are read through a ref (getPos) so the heartbeat never re-renders the game loop.
 *
 * Transport: POST /api/presence (works everywhere, including the local stack). When running against
 * hosted Supabase the same table is also available through Realtime; the polling cadence here is
 * short enough that the difference is not visible for a handful of players per area.
 */
export function usePresence(loc: Location, getPos: () => { x: number; y: number; facing: number }, enabled = true) {
  const [state, setState] = useState<PresenceState>({ others: [], status: 'connecting', lastSync: null });
  const pendingAction = useRef<'wave' | null>(null);
  const inFlight = useRef(false);
  const timer = useRef<number | null>(null);
  const alive = useRef(true);

  const beat = useCallback(async () => {
    if (inFlight.current || !alive.current) return;
    inFlight.current = true;
    try {
      const pos = getPos();
      const res = await fetch('/api/presence', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...loc, ...pos, action: pendingAction.current }),
        keepalive: true,
      });
      pendingAction.current = null;
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { others: PresenceRow[] };
      if (alive.current) setState({ others: json.others, status: 'live', lastSync: Date.now() });
    } catch {
      if (alive.current) setState((s) => ({ ...s, status: 'offline' }));
    } finally {
      inFlight.current = false;
    }
  }, [loc.systemId, loc.planetId, getPos]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!enabled) return;
    alive.current = true;
    void beat();
    timer.current = window.setInterval(() => void beat(), PRESENCE_HEARTBEAT_MS);
    const onVis = () => { if (document.visibilityState === 'visible') void beat(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      alive.current = false;
      if (timer.current) window.clearInterval(timer.current);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [beat, enabled]);

  const wave = useCallback(() => {
    pendingAction.current = 'wave';
    void beat();
  }, [beat]);

  const refresh = useCallback(() => void beat(), [beat]);

  return { ...state, wave, refresh };
}
