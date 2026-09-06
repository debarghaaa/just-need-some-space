'use client';
import { Button, LinkButton } from '@/components/ui';
import { COPY } from '@/game/copy';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="wrap-narrow section" style={{ textAlign: 'center' }}>
      <h1>{COPY.signalLost.head}</h1>
      <p className="lede" style={{ marginInline: 'auto' }}>{COPY.signalLost.sub}</p>
      <div className="row" style={{ justifyContent: 'center', marginTop: '1.5rem' }}>
        <Button variant="primary" onClick={() => reset()}>{COPY.reconnect}</Button>
        <LinkButton href="/" variant="ghost">Home</LinkButton>
      </div>
    </div>
  );
}
