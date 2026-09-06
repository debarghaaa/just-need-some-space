'use client';
import { useCallback, useEffect, useState } from 'react';
import { Button, Empty, EntityKind, Panel, Tag } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { COPY } from '@/game/copy';

interface Friendship {
  id: string;
  status: 'pending' | 'accepted';
  direction: 'sent' | 'received';
  otherId: string;
  username: string;
  displayName: string;
  createdAt: string;
}

export function FriendsPanel() {
  const toast = useToast();
  const [rows, setRows] = useState<Friendship[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/friends');
      if (!res.ok) throw new Error((await res.json().catch(() => ({ error: 'Failed' }))).error);
      setRows(((await res.json()) as { friendships: Friendship[] }).friendships);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load.');
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 8000);
    return () => window.clearInterval(t);
  }, [load]);

  async function respond(id: string, action: 'accept' | 'reject' | 'remove') {
    const res = await fetch('/api/friends', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, id }) });
    if (!res.ok) return toast({ head: 'THAT DID NOT WORK.', sub: ((await res.json().catch(() => ({}))) as { error?: string }).error, tone: 'err' });
    toast({ head: action === 'accept' ? 'FRIEND ADDED.' : action === 'reject' ? 'INVITE DECLINED.' : 'REMOVED.', sub: action === 'accept' ? 'You now have one more person who does not irritate you.' : undefined, tone: 'ok', ttl: 2500 });
    void load();
  }

  const incoming = rows?.filter((r) => r.status === 'pending' && r.direction === 'received') ?? [];
  const outgoing = rows?.filter((r) => r.status === 'pending' && r.direction === 'sent') ?? [];
  const friends = rows?.filter((r) => r.status === 'accepted') ?? [];

  return (
    <Panel title="Friends" as="section" actions={<span className="small muted">Invites arrive here. Refreshes every few seconds.</span>}>
      {error ? <p className="red small">{error}</p> : null}
      {rows === null ? (
        <p className="loading-line cursor">CHECKING WHO STILL LIKES YOU</p>
      ) : rows.length === 0 ? (
        <Empty head={COPY.emptyFriends.head} sub={COPY.emptyFriends.sub} />
      ) : (
        <div className="grid-2">
          <div>
            <h3 className="display-xs" style={{ color: 'var(--color-primary-soft)' }}>Incoming ({incoming.length})</h3>
            {incoming.length === 0 ? <p className="small muted">None waiting.</p> : incoming.map((f) => (
              <div className="player-row" key={f.id}>
                <span />
                <div><div className="who">{f.username}</div><div className="where">{f.displayName} wants to be friends</div></div>
                <div className="row" style={{ gap: '0.35rem' }}>
                  <Button size="sm" variant="green" onClick={() => respond(f.id, 'accept')}>Accept</Button>
                  <Button size="sm" variant="ghost" onClick={() => respond(f.id, 'reject')}>Reject</Button>
                </div>
              </div>
            ))}
            <h3 className="display-xs" style={{ color: 'var(--color-primary-soft)', marginTop: '1rem' }}>Sent ({outgoing.length})</h3>
            {outgoing.length === 0 ? <p className="small muted">Nothing pending.</p> : outgoing.map((f) => (
              <div className="player-row" key={f.id}>
                <span />
                <div><div className="who">{f.username}</div><div className="where">Waiting for an answer</div></div>
                <Button size="sm" variant="ghost" onClick={() => respond(f.id, 'remove')}>Withdraw</Button>
              </div>
            ))}
          </div>
          <div>
            <h3 className="display-xs" style={{ color: 'var(--color-primary-soft)' }}>Friends ({friends.length})</h3>
            {friends.length === 0 ? <p className="small muted">{COPY.emptyFriends.head} {COPY.emptyFriends.sub}</p> : friends.map((f) => (
              <div className="player-row" key={f.id}>
                <span />
                <div><div className="who">{f.username}</div><div className="where">{f.displayName}. Friends since {new Date(f.createdAt).toLocaleDateString()}</div></div>
                <div className="row" style={{ gap: '0.35rem' }}>
                  <EntityKind kind="player" />
                  <Button size="sm" variant="ghost" onClick={() => respond(f.id, 'remove')}>Remove</Button>
                </div>
              </div>
            ))}
            <p className="small muted" style={{ marginTop: '1rem' }}><Tag>Note</Tag> Friend invites are sent from the map or the surface when another player is nearby.</p>
          </div>
        </div>
      )}
    </Panel>
  );
}
