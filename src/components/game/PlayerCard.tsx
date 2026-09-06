'use client';
import { useState } from 'react';
import { Button, EntityKind } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { COPY } from '@/game/copy';
import type { RocketConfig } from '@/game/rockets';
import type { PresenceRow } from '@/app/api/presence/route';
import { RocketSprite } from './Sprites';
import { Modal } from '@/components/ui/Modal';

/** A real player, as seen from a map or the surface. Wave + invite are real server actions. */
export function PlayerCard({ row, where, onWave, onApproach, compact = false }: { row: PresenceRow; where: string; onWave?: () => void; onApproach?: () => void; compact?: boolean }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function invite() {
    setBusy(true);
    const res = await fetch('/api/friends', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'invite', userId: row.player_id }) });
    const json = (await res.json().catch(() => ({}))) as { error?: string; already?: string };
    setBusy(false);
    setConfirm(false);
    if (!res.ok) return toast({ head: 'INVITE FAILED.', sub: json.error ?? 'Try again.', tone: 'err' });
    if (json.already === 'accepted') return toast({ head: 'ALREADY FRIENDS.', sub: 'You two have done this before.', tone: 'info' });
    if (json.already === 'pending') return toast({ head: 'INVITE ALREADY SENT.', sub: 'Give them a minute. Space is slow.', tone: 'info' });
    toast({ head: 'INVITE SENT.', sub: `${row.username} can accept it from their profile.`, tone: 'ok' });
  }

  return (
    <div className="player-row">
      {row.rocket ? <RocketSprite config={row.rocket as RocketConfig} scale={1} /> : <span />}
      <div>
        <div className="who">{row.username}</div>
        <div className="where">{where}</div>
        {!compact ? <div style={{ marginTop: '0.25rem' }}><EntityKind kind="player" /></div> : null}
      </div>
      <div className="row" style={{ gap: '0.35rem', justifyContent: 'flex-end' }}>
        {compact ? <EntityKind kind="player" /> : null}
        {onApproach ? <Button size="sm" variant="secondary" onClick={onApproach}>Approach</Button> : null}
        {onWave ? <Button size="sm" onClick={() => { onWave(); toast({ head: 'YOU WAVED.', sub: `${row.username} will see it within a few seconds.`, tone: 'info', ttl: 2500 }); }}>Wave</Button> : null}
        <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>Invite</Button>
      </div>
      <Modal
        open={confirm}
        title={COPY.friendInvite.head}
        onClose={() => setConfirm(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>Never mind</Button>
            <Button variant="primary" busy={busy} onClick={invite}>Send invite to {row.username}</Button>
          </>
        }
      >
        <p className="dim">{COPY.friendInvite.sub}</p>
        <p className="small muted" style={{ margin: 0 }}>Friends can see when you are in the same system. Nothing else is shared.</p>
      </Modal>
    </div>
  );
}
