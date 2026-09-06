'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { RocketBuilder } from './RocketBuilder';
import type { RocketConfig } from '@/game/rockets';
import { COPY } from '@/game/copy';

export function RocketPage({ initial, initialName }: { initial: RocketConfig; initialName: string }) {
  const router = useRouter();
  const toast = useToast();
  const [cfg, setCfg] = useState(initial);
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(cfg) !== JSON.stringify(initial) || name !== initialName;

  async function save() {
    setBusy(true);
    const res = await fetch('/api/profile', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'save_rocket', rocketName: name, rocket: cfg }) });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) return toast({ head: COPY.saveFailed.head, sub: json.error ?? COPY.saveFailed.sub, tone: 'err' });
    toast({ head: 'ROCKET SAVED.', sub: 'Other players will see the new one next time you are in orbit.', tone: 'ok' });
    router.refresh();
  }

  return (
    <div className="stack">
      <RocketBuilder value={cfg} onChange={setCfg} name={name} onNameChange={setName} disabled={busy} />
      <div className="row">
        <Button variant="primary" busy={busy} disabled={!dirty} onClick={save}>Save rocket</Button>
        <Button variant="ghost" disabled={!dirty || busy} onClick={() => { setCfg(initial); setName(initialName); }}>Revert</Button>
        {!dirty ? <span className="small muted">Saved. Nothing to change.</span> : <span className="small muted">Unsaved changes.</span>}
      </div>
    </div>
  );
}
