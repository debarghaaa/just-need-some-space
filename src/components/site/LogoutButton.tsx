'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { COPY } from '@/game/copy';
import { getBrowserSupabase } from '@/lib/supabase/browser';

/**
 * Logs out. Guest explorers (no email, no password) cannot log back in, so they get a plain
 * warning first instead of silently losing everything.
 */
export function LogoutButton({ block = false, isGuest = false }: { block?: boolean; isGuest?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function logout() {
    setBusy(true);
    // clear presence while the session is still valid, then sign out
    await fetch('/api/presence', { method: 'DELETE' }).catch(() => undefined);
    const sb = getBrowserSupabase();
    await sb?.auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <>
      <Button variant="ghost" size={block ? 'md' : 'sm'} block={block} busy={busy} onClick={() => (isGuest ? setConfirm(true) : logout())}>
        Log out
      </Button>
      {isGuest ? (
        <Modal
          open={confirm}
          title={COPY.guest.logoutWarning.head}
          onClose={() => setConfirm(false)}
          actions={
            <>
              <Button variant="ghost" onClick={() => setConfirm(false)}>Stay</Button>
              <Button variant="secondary" onClick={() => { setConfirm(false); router.push('/settings#account'); }}>Add an email first</Button>
              <Button variant="danger" busy={busy} onClick={logout}>Log out anyway</Button>
            </>
          }
        >
          <p className="dim" style={{ margin: 0 }}>{COPY.guest.logoutWarning.sub}</p>
        </Modal>
      ) : null}
    </>
  );
}
