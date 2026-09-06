import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'green' | 'default';
type Size = 'sm' | 'md' | 'lg';

function btnClass(variant: Variant = 'default', size: Size = 'md', block = false, busy = false, extra = ''): string {
  return [
    'btn',
    variant !== 'default' ? `btn-${variant}` : '',
    size !== 'md' ? `btn-${size}` : '',
    block ? 'btn-block' : '',
    busy ? 'btn-busy' : '',
    extra,
  ]
    .filter(Boolean)
    .join(' ');
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  busy?: boolean;
}

export function Button({ variant, size, block, busy, className = '', type = 'button', disabled, children, ...rest }: ButtonProps) {
  return (
    <button type={type} className={btnClass(variant, size, block, busy, className)} disabled={disabled || busy} aria-busy={busy || undefined} {...rest}>
      {children}
    </button>
  );
}

export interface LinkButtonProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

export function LinkButton({ href, variant, size, block, className = '', children, ...rest }: LinkButtonProps) {
  return (
    <Link href={href} className={btnClass(variant, size, block, false, className)} {...rest}>
      {children}
    </Link>
  );
}

export function Panel({ title, children, className = '', tight = false, raised = false, dark = false, as: Tag = 'section', actions }: { title?: ReactNode; children: ReactNode; className?: string; tight?: boolean; raised?: boolean; dark?: boolean; as?: 'section' | 'div' | 'article' | 'aside'; actions?: ReactNode }) {
  return (
    <Tag className={['panel', tight ? 'panel-tight' : '', raised ? 'panel-raised' : '', dark ? 'panel-dark' : '', className].filter(Boolean).join(' ')}>
      {title ? (
        actions ? (
          <div className="panel-head">
            <h2 className="panel-title" style={{ margin: 0, flex: 1 }}>{title}</h2>
            {actions}
          </div>
        ) : (
          <h2 className="panel-title">{title}</h2>
        )
      ) : null}
      {children}
    </Tag>
  );
}

export function Tag({ kind = 'neutral', children }: { kind?: string; children: ReactNode }) {
  return <span className={`tag tag-${kind}`}>{children}</span>;
}

export function Empty({ head, sub, children }: { head: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="empty" role="status">
      <div className="display-sm">{head}</div>
      {sub ? <p>{sub}</p> : null}
      {children}
    </div>
  );
}

export function Notice({ head, children, tone = 'amber' }: { head?: string; children: ReactNode; tone?: 'amber' | 'red' | 'blue' }) {
  return (
    <div className={`notice ${tone === 'red' ? 'notice-red' : tone === 'blue' ? 'notice-blue' : ''}`} role={tone === 'red' ? 'alert' : 'note'}>
      {head ? <div className="display-sm">{head}</div> : null}
      {children}
    </div>
  );
}

export function Dialogue({ head, sub, children }: { head: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="dialogue" role="status">
      <div className="dialogue-head">{head}</div>
      {sub ? <div className="dialogue-sub">{sub}</div> : null}
      {children}
    </div>
  );
}

export function Stat({ label, value, unit }: { label: string; value: ReactNode; unit?: string }) {
  return (
    <div className="stat">
      <dt>{label}</dt>
      <dd>
        {value}
        {unit ? <small> {unit}</small> : null}
      </dd>
    </div>
  );
}

export function Crumbs({ items }: { items: Array<{ href?: string; label: string }> }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {items.map((it, i) => (
        <span key={i} style={{ display: 'contents' }}>
          {i > 0 ? <span aria-hidden="true">/</span> : null}
          {it.href ? <Link href={it.href}>{it.label}</Link> : <span aria-current="page">{it.label}</span>}
        </span>
      ))}
    </nav>
  );
}

/** Marks what kind of thing the player is looking at. Required by the multiplayer clarity rule. */
export function EntityKind({ kind }: { kind: 'player' | 'system' | 'proc' }) {
  if (kind === 'player') return <Tag kind="player">Real player</Tag>;
  if (kind === 'system') return <Tag kind="system">System</Tag>;
  return <Tag kind="proc">Generated</Tag>;
}
