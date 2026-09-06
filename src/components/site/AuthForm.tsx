'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import { COPY } from '@/game/copy';

type Mode = 'login' | 'signup' | 'forgot' | 'reset';

const HEAD: Record<Mode, { h: string; sub: string; cta: string }> = {
  login: { h: 'WELCOME BACK.', sub: 'Your rocket has been sitting exactly where you left it.', cta: 'Log in' },
  signup: { h: 'LEAVE EARTH.', sub: 'An account keeps your rocket, your discoveries and your points.', cta: 'Create account' },
  forgot: { h: 'FORGOT SOMETHING.', sub: 'Enter your email and we will send a reset link, if the account exists.', cta: 'Send reset link' },
  reset: { h: 'NEW PASSWORD.', sub: 'Choose something you will remember from orbit.', cta: 'Save password' },
};

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/universe';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const sb = getBrowserSupabase();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!sb) return;
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      if (mode === 'login') {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(next);
        router.refresh();
      } else if (mode === 'signup') {
        if (password.length < 8) throw new Error('Passwords need at least 8 characters.');
        const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding` } });
        if (error) throw error;
        if (data.session) {
          router.push('/onboarding');
          router.refresh();
        } else {
          setOkMsg('Check your email to confirm the account, then come back and log in.');
        }
      } else if (mode === 'forgot') {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=/reset-password` });
        if (error) throw error;
        setOkMsg('If that address has an account, a reset link is on its way.');
      } else {
        if (password.length < 8) throw new Error('Passwords need at least 8 characters.');
        const { error } = await sb.auth.updateUser({ password });
        if (error) throw error;
        setOkMsg('Password updated.');
        setTimeout(() => { router.push('/universe'); router.refresh(); }, 600);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  if (!sb) {
    return (
      <div className="notice" role="alert">
        <div className="display-sm">BACKEND NOT CONFIGURED.</div>
        <p style={{ margin: 0 }}>Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable accounts. Nothing here is faked in the meantime.</p>
      </div>
    );
  }

  const t = HEAD[mode];
  return (
    <form className="panel auth-card stack" onSubmit={submit} noValidate>
      <h1>{t.h}</h1>
      <p className="dim" style={{ marginTop: '-0.5rem' }}>{t.sub}</p>
      {mode !== 'reset' ? (
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      ) : null}
      {mode !== 'forgot' ? (
        <div className="field">
          <label htmlFor="password">{mode === 'reset' ? 'New password' : 'Password'}</label>
          <input id="password" className="input" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          {mode !== 'login' ? <span className="hint">At least 8 characters.</span> : null}
        </div>
      ) : null}
      {error ? (
        <div className="form-error" role="alert">
          <strong>THAT DID NOT WORK.</strong>
          {error}
        </div>
      ) : null}
      {okMsg ? (
        <div className="form-ok" role="status">
          <strong>DONE.</strong>
          {okMsg}
        </div>
      ) : null}
      <Button type="submit" variant="primary" block busy={busy}>
        {t.cta}
      </Button>
      <div className="row between small dim">
        {mode === 'login' ? (
          <>
            <Link href="/forgot-password">Forgot password</Link>
            <Link href="/signup">Create an account</Link>
          </>
        ) : mode === 'signup' ? (
          <Link href="/login">I already have an account</Link>
        ) : (
          <Link href="/login">Back to log in</Link>
        )}
      </div>
      {mode === 'signup' ? (
        <p className="small muted" style={{ margin: 0 }}>
          By creating an account you agree to the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.
        </p>
      ) : null}
      {mode === 'signup' ? <p className="small muted" style={{ margin: 0 }}>{COPY.joinMultiplayer.head} {COPY.joinMultiplayer.sub}</p> : null}
    </form>
  );
}
