import { LinkButton } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="wrap-narrow section" style={{ textAlign: 'center' }}>
      <p className="eyebrow">404</p>
      <h1>THIS PART OF SPACE IS EMPTY.</h1>
      <p className="lede" style={{ marginInline: 'auto' }}>Which is normal for space. The page you asked for does not exist.</p>
      <div className="row" style={{ justifyContent: 'center', marginTop: '1.5rem' }}>
        <LinkButton href="/" variant="primary">Back to Earth</LinkButton>
        <LinkButton href="/universe" variant="ghost">Open the universe</LinkButton>
      </div>
    </div>
  );
}
