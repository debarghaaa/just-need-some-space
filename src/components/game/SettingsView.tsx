'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, Panel } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { DEFAULT_SETTINGS, readSettings, writeSettings, type LocalSettings } from '@/components/site/MotionPrefs';
import { LogoutButton } from '@/components/site/LogoutButton';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import { COPY } from '@/game/copy';
import { normalizeDisplayName } from '@/game/rockets';

function Toggle({ label, desc, on, onChange }: { label: string; desc: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="setting-row">
      <div>
        <div className="label">{label}</div>
        <p className="desc">{desc}</p>
      </div>
      <button type="button" role="switch" aria-checked={on} className="opt" aria-pressed={on} onClick={() => onChange(!on)} style={{ minWidth: 72, textAlign: 'center' }}>
        {on ? 'On' : 'Off'}
      </button>
    </div>
  );
}

export function SettingsView({ email, isGuest, displayName, planetName, onboarded }: { email: string; isGuest: boolean; displayName: string; planetName: string; onboarded: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [s, setS] = useState<LocalSettings>(DEFAULT_SETTINGS);
  const [dn, setDn] = useState(displayName);
  const [pn, setPn] = useState(planetName);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteWord, setDeleteWord] = useState('');
  const [linkEmail, setLinkEmail] = useState('');
  const [linkPassword, setLinkPassword] = useState('');
  const [linkMsg, setLinkMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => setS(readSettings()), []);

  async function keepAccount() {
    const sb = getBrowserSupabase();
    if (!sb) return;
    if (linkPassword.length < 8) return setLinkMsg({ ok: false, text: 'Passwords need at least 8 characters.' });
    setBusy(true);
    setLinkMsg(null);
    // Anonymous user -> permanent user: attach email, then set a password. Same user id, same rows.
    const { error: e1 } = await sb.auth.updateUser({ email: linkEmail });
    if (e1) { setBusy(false); return setLinkMsg({ ok: false, text: e1.message }); }
    const { error: e2 } = await sb.auth.updateUser({ password: linkPassword });
    setBusy(false);
    if (e2) return setLinkMsg({ ok: false, text: e2.message });
    setLinkMsg({ ok: true, text: 'Saved. If your project requires email confirmation, check your inbox; otherwise you can log in with this email from now on.' });
    router.refresh();
  }

  const update = (patch: Partial<LocalSettings>) => {
    const next = { ...s, ...patch };
    setS(next);
    writeSettings(next);
  };

  async function saveProfile() {
    const check = normalizeDisplayName(dn);
    if (check.error) return toast({ head: 'HOLD ON.', sub: check.error, tone: 'warn' });
    setBusy(true);
    const res = await fetch('/api/profile', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'update', displayName: dn, planetName: pn }) });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) return toast({ head: 'NOT SAVED.', sub: json.error, tone: 'err' });
    toast({ head: 'SAVED.', tone: 'ok', ttl: 2000 });
    router.refresh();
  }

  async function deleteAccount() {
    setBusy(true);
    const res = await fetch('/api/profile', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'delete_account' }) });
    if (!res.ok) {
      setBusy(false);
      return toast({ head: 'COULD NOT DELETE.', sub: ((await res.json().catch(() => ({}))) as { error?: string }).error, tone: 'err' });
    }
    await getBrowserSupabase()?.auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <div className="grid-2">
      <div className="stack">
        <Panel title="Interface">
          <Toggle label="Sound effects" desc="Short synthesised blips for scanning, collecting and waving." on={s.sound} onChange={(v) => update({ sound: v })} />
          <Toggle label="Music" desc="There is no music yet. This switch is here so it is ready when there is. It does nothing today." on={s.music} onChange={(v) => update({ music: v })} />
          <Toggle label="Reduce animation" desc="Stops orbit drift, bobbing and reveal transitions. Also follows your system preference automatically." on={s.reduceMotion} onChange={(v) => update({ reduceMotion: v })} />
          <div className="setting-row">
            <div>
              <div className="label">Interface scale</div>
              <p className="desc">Scales text and controls. Pixel art is unaffected.</p>
            </div>
            <div className="opts" role="radiogroup" aria-label="Interface scale">
              {(['small', 'normal', 'large'] as const).map((v) => (
                <button key={v} type="button" role="radio" aria-checked={s.scale === v} className="opt" onClick={() => update({ scale: v })}>{v}</button>
              ))}
            </div>
          </div>
          <p className="small muted" style={{ margin: '0.75rem 0 0' }}>Interface settings are stored in this browser.</p>
        </Panel>

        <Panel title="Session">
          <div className="setting-row">
            <div>
              <div className="label">{isGuest ? 'Exploring as a guest' : 'Signed in as'}</div>
              <p className="desc mono">{isGuest ? 'No email on this explorer yet.' : email}</p>
            </div>
            <LogoutButton isGuest={isGuest} />
          </div>
        </Panel>

        {isGuest ? (
          <Panel title="Keep this explorer">
            <div id="account" />
            <p className="dim" style={{ marginTop: 0 }}>Guest explorers live in this browser. Add an email and password and the same explorer, points, rocket and codex entries become a normal account you can log into anywhere.</p>
            <div className="stack">
              <div className="field">
                <label htmlFor="link-email">Email</label>
                <input id="link-email" className="input" type="email" autoComplete="email" value={linkEmail} onChange={(e) => setLinkEmail(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="link-password">Password</label>
                <input id="link-password" className="input" type="password" autoComplete="new-password" minLength={8} value={linkPassword} onChange={(e) => setLinkPassword(e.target.value)} />
                <span className="hint">At least 8 characters.</span>
              </div>
              {linkMsg ? (
                <div className={linkMsg.ok ? 'form-ok' : 'form-error'} role={linkMsg.ok ? 'status' : 'alert'}>
                  <strong>{linkMsg.ok ? 'DONE.' : 'THAT DID NOT WORK.'}</strong>
                  {linkMsg.text}
                </div>
              ) : null}
              <Button variant="primary" busy={busy} disabled={!linkEmail || !linkPassword} onClick={keepAccount}>Add email and password</Button>
            </div>
          </Panel>
        ) : null}
      </div>

      <div className="stack">
        <Panel title="Account">
          {onboarded ? (
            <div className="stack">
              <div className="field">
                <label htmlFor="dn">Display name</label>
                <input id="dn" className="input" maxLength={32} value={dn} onChange={(e) => setDn(e.target.value)} />
                <span className="hint">Also editable on <a href="/customize">Customize</a>, next to your rocket and suit.</span>
              </div>
              <div className="field">
                <label htmlFor="pn">Home planet name</label>
                <input id="pn" className="input" maxLength={32} value={pn} onChange={(e) => setPn(e.target.value)} />
              </div>
              <Button variant="primary" busy={busy} disabled={dn === displayName && pn === planetName} onClick={saveProfile}>Save</Button>
            </div>
          ) : (
            <p className="dim">Finish <a href="/onboarding">onboarding</a> to set a username and planet.</p>
          )}
        </Panel>

        <Panel title="Danger">
          <div className="setting-row">
            <div>
              <div className="label">Delete account</div>
              <p className="desc">Removes your profile, rockets, discoveries, inventory, points and friendships. Planets you were first to find keep the record but lose your name. This cannot be undone.</p>
            </div>
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete</Button>
          </div>
        </Panel>
      </div>

      <Modal
        open={confirmDelete}
        title="DELETE EVERYTHING?"
        onClose={() => setConfirmDelete(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Keep my account</Button>
            <Button variant="danger" busy={busy} disabled={deleteWord !== 'DELETE'} onClick={deleteAccount}>Delete permanently</Button>
          </>
        }
      >
        <p className="dim">Type <span className="mono">DELETE</span> to confirm. The universe will carry on without you, which is either comforting or not.</p>
        <input className="input mono" value={deleteWord} onChange={(e) => setDeleteWord(e.target.value)} aria-label="Type DELETE to confirm" />
      </Modal>
    </div>
  );
}
