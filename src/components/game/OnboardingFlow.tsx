'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { RocketBuilder } from './RocketBuilder';
import { COPY } from '@/game/copy';
import { STARTER_ROCKETS, type RocketConfig } from '@/game/rockets';

export function OnboardingFlow({ suggestedUsername, isGuest = false }: { suggestedUsername: string; isGuest?: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [username, setUsername] = useState(suggestedUsername);
  const [displayName, setDisplayName] = useState('');
  const [planetName, setPlanetName] = useState('');
  const [rocket, setRocket] = useState<RocketConfig>(STARTER_ROCKETS[0].config);
  const [rocketName, setRocketName] = useState(STARTER_ROCKETS[0].name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish() {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'onboard', username, displayName: displayName || username, planetName, rocketName, rocket }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? 'Could not save.');
      if (res.status === 409 || json.error?.includes('Username') || json.error?.includes('Earth')) setStep(1);
      return;
    }
    router.push('/universe?welcome=1');
    router.refresh();
  }

  if (step === 1) {
    return (
      <form
        className="panel auth-card stack"
        style={{ marginInline: 'auto', width: 'min(520px, 100%)' }}
        onSubmit={(e) => {
          e.preventDefault();
          if (planetName.trim().toLowerCase() === 'earth') { setError('Please choose something better than Earth.'); return; }
          setError(null);
          setStep(2);
        }}
      >
        <p className="eyebrow">Step 1 of 2</p>
        <h1>{COPY.planetCreate.head}</h1>
        <p className="dim" style={{ marginTop: '-0.5rem' }}>{COPY.planetCreate.sub}</p>
        {isGuest ? <p className="small muted" style={{ margin: 0 }}>You are in as a guest: no email, no password. Everything you do is saved to this guest explorer. You can add an email later in Settings to keep it across devices.</p> : null}
        <div className="field">
          <label htmlFor="planet">Your planet&apos;s name</label>
          <input id="planet" className="input" required maxLength={32} value={planetName} onChange={(e) => setPlanetName(e.target.value)} placeholder="Not Earth" autoFocus />
          <span className="hint">This is the name of your home base. You can rename it in Settings.</span>
        </div>
        <div className="field">
          <label htmlFor="username">Username</label>
          <input id="username" className="input mono" required pattern="[a-z0-9_]{3,20}" maxLength={20} value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} />
          <span className="hint">3 to 20 characters: lowercase letters, numbers, underscores. This is your handle; the name shown above your rocket is the display name.</span>
        </div>
        <div className="field">
          <label htmlFor="display">Display name (optional)</label>
          <input id="display" className="input" maxLength={32} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={username || 'How you want to be addressed'} />
        </div>
        {error ? (
          <div className="form-error" role="alert">
            <strong>HOLD ON.</strong>
            {error}
          </div>
        ) : null}
        <Button type="submit" variant="primary" block>
          Next: build a rocket
        </Button>
      </form>
    );
  }

  return (
    <div className="stack">
      <div>
        <p className="eyebrow">Step 2 of 2</p>
        <h1>BUILD YOUR FIRST ROCKET.</h1>
        <p className="dim">You can change every part later. Nothing here is permanent except the decision to leave.</p>
      </div>
      <RocketBuilder value={rocket} onChange={setRocket} name={rocketName} onNameChange={setRocketName} disabled={busy} />
      {error ? (
        <div className="form-error" role="alert">
          <strong>THAT DID NOT SAVE.</strong>
          {error}
        </div>
      ) : null}
      <div className="row">
        <Button variant="ghost" onClick={() => setStep(1)} disabled={busy}>
          Back
        </Button>
        <Button variant="primary" size="lg" busy={busy} onClick={finish}>
          {COPY.launch.head}
        </Button>
        <span className="small muted">{COPY.launch.sub}</span>
      </div>
    </div>
  );
}
