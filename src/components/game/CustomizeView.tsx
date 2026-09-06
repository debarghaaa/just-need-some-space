'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Button, Panel } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { COPY } from '@/game/copy';
import { drawExplorer, drawNameplate, drawPlanet, drawRocket, flameSpans } from '@/game/pixel';
import { BODIES, COLORS, DECALS, DISPLAY_NAME_MAX, ENGINES, FINS, STARTER_ROCKETS, SUIT_PRESETS, normalizeDisplayName, rocketColors, type ColorId, type RocketConfig, type SuitConfig, WINGED_BODIES } from '@/game/rockets';
import { generateSystem } from '@/game/universe';
import { PALETTE } from '@/game/palette';

/*
 * Customization (section 45). Left: controls. Right: a live preview that is drawn by the same
 * renderers the game uses (drawRocket, drawExplorer, drawNameplate), from the same config object
 * that gets saved. Nothing in the preview is a static image.
 */

type Mode = 'rocket' | 'astronaut';

export function CustomizeView(props: { rocket: RocketConfig; rocketName: string; suit: SuitConfig; displayName: string; username: string; seed: string; isGuest: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [cfg, setCfg] = useState<RocketConfig>(props.rocket);
  const [suit, setSuit] = useState<SuitConfig>(props.suit);
  const [name, setName] = useState(props.displayName);
  const [rocketName, setRocketName] = useState(props.rocketName);
  const [mode, setMode] = useState<Mode>('rocket');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const nameId = useId();
  const rocketNameId = useId();

  const nameCheck = normalizeDisplayName(name);
  const dirty = JSON.stringify({ cfg, suit, name: nameCheck.value, rocketName }) !== JSON.stringify({ cfg: props.rocket, suit: props.suit, name: props.displayName, rocketName: props.rocketName });
  const colors = rocketColors(cfg);

  async function save() {
    if (nameCheck.error) return toast({ head: 'HOLD ON.', sub: nameCheck.error, tone: 'warn' });
    setBusy(true);
    setFailed(false);
    let res: Response;
    try {
      res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'save_customization', displayName: nameCheck.value, rocketName, rocket: cfg, suit }),
      });
    } catch {
      setBusy(false);
      setFailed(true);
      toast({ head: COPY.signalLost.head, sub: COPY.signalLost.sub, tone: 'err' });
      return;
    }
    const json = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
    setBusy(false);
    if (!res.ok || !json.ok) {
      // The database did not confirm: say so plainly, keep the edits, offer TRY AGAIN.
      setFailed(true);
      toast({ head: COPY.customize.failed.head, sub: json.error ?? COPY.customize.failed.sub, tone: 'err' });
      return;
    }
    toast({ head: COPY.customize.saved.head, sub: COPY.customize.saved.sub, tone: 'ok' });
    setName(nameCheck.value);
    router.refresh();
  }

  const setRocket = <K extends keyof RocketConfig>(k: K, v: RocketConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));
  const setSuitPart = <K extends keyof SuitConfig>(k: K, v: SuitConfig[K]) => setSuit((s) => ({ ...s, [k]: v }));

  return (
    <div className="custom">
      <div className="custom-controls">
        <Panel title={COPY.customize.rocket} tight>
          <div className="stack" style={{ display: 'grid', gap: '1.25rem' }}>
            <div className="field">
              <label htmlFor={rocketNameId}>Rocket name</label>
              <input id={rocketNameId} className="input" maxLength={24} value={rocketName} disabled={busy} onChange={(e) => setRocketName(e.target.value)} />
            </div>
            <div className="custom-group">
              <h3>Presets</h3>
              <div className="opts">
                {STARTER_ROCKETS.map((s) => (
                  <button key={s.name} type="button" className="opt" disabled={busy} onClick={() => { setCfg(s.config); setRocketName(s.name); }} title={s.blurb}>{s.name}</button>
                ))}
              </div>
            </div>
            <PartGroup label="Body" value={cfg.body} options={BODIES} onChange={(v) => setRocket('body', v)} disabled={busy} />
            <PartGroup label="Engine" value={cfg.engine} options={ENGINES} onChange={(v) => setRocket('engine', v)} disabled={busy} note={WINGED_BODIES.has(cfg.body) ? 'This hull has its own nozzles. The engine colour still applies.' : undefined} />
            <PartGroup label="Fins" value={cfg.fins} options={FINS} onChange={(v) => setRocket('fins', v)} disabled={busy} note={WINGED_BODIES.has(cfg.body) ? 'This hull has its own wings. The fin colour still applies.' : undefined} />
            <PartGroup label="Decal" value={cfg.decal} options={DECALS} onChange={(v) => setRocket('decal', v)} disabled={busy} />
            <SwatchGroup label="Body colour" value={colors.body} onChange={(v) => setRocket('color', v)} disabled={busy} />
            <SwatchGroup label="Engine colour" value={colors.engine} onChange={(v) => setRocket('engineColor', v)} disabled={busy} />
            <SwatchGroup label="Fin colour" value={colors.fins} onChange={(v) => setRocket('finColor', v)} disabled={busy} />
            <SwatchGroup label="Window and accent colour" value={colors.accent} onChange={(v) => setRocket('accent', v)} disabled={busy} />
            <SwatchGroup label="Decal colour" value={colors.decal} onChange={(v) => setRocket('decalColor', v)} disabled={busy || cfg.decal === 'none'} note={cfg.decal === 'none' ? 'Pick a decal first.' : undefined} />
          </div>
        </Panel>

        <Panel title={COPY.customize.astronaut} tight>
          <div className="stack" style={{ display: 'grid', gap: '1.25rem' }}>
            <div className="custom-group">
              <h3>Suits</h3>
              <div className="opts">
                {SUIT_PRESETS.map((s) => (
                  <button key={s.name} type="button" className="opt" disabled={busy} onClick={() => setSuit(s.config)}>{s.name}</button>
                ))}
              </div>
            </div>
            <SwatchGroup label="Suit primary" value={suit.primary} onChange={(v) => setSuitPart('primary', v)} disabled={busy} />
            <SwatchGroup label="Suit secondary" value={suit.secondary} onChange={(v) => setSuitPart('secondary', v)} disabled={busy} note="Helmet, belt, gloves and boots." />
            <SwatchGroup label="Helmet visor accent" value={suit.visor} onChange={(v) => setSuitPart('visor', v)} disabled={busy} />
            <SwatchGroup label="Backpack and equipment accent" value={suit.pack} onChange={(v) => setSuitPart('pack', v)} disabled={busy} />
          </div>
        </Panel>

        <Panel title={COPY.customize.name} tight>
          <div className="field">
            <label htmlFor={nameId}>{COPY.customize.nameHint}</label>
            <input id={nameId} className="input" maxLength={DISPLAY_NAME_MAX} value={name} disabled={busy} aria-invalid={Boolean(nameCheck.error) || undefined} aria-describedby={`${nameId}-hint`} onChange={(e) => setName(e.target.value)} />
            <span id={`${nameId}-hint`} className={nameCheck.error ? 'hint red' : 'hint'}>
              {nameCheck.error ?? `Shown above your rocket and your astronaut. Up to ${DISPLAY_NAME_MAX} characters. Your username stays @${props.username}.`}
            </span>
          </div>
          {props.isGuest ? <p className="small muted" style={{ margin: '0.75rem 0 0' }}>You are exploring as a guest. This name is yours for as long as this browser keeps the session. Add an email in Settings to keep it for good.</p> : null}
        </Panel>

        <div className="row" style={{ position: 'sticky', bottom: 0, padding: '0.75rem 0', background: 'var(--color-bg-primary)', borderTop: '2px solid var(--color-border-subtle)' }}>
          <Button variant="primary" size="lg" busy={busy} disabled={!dirty || Boolean(nameCheck.error)} onClick={save}>
            {failed ? COPY.customize.retry : COPY.customize.save}
          </Button>
          <Button variant="ghost" disabled={!dirty || busy} onClick={() => { setCfg(props.rocket); setSuit(props.suit); setName(props.displayName); setRocketName(props.rocketName); setFailed(false); }}>Revert</Button>
          <span className="small muted" aria-live="polite">{failed ? COPY.customize.failed.sub : dirty ? 'Unsaved changes.' : 'Saved. Nothing to change.'}</span>
        </div>
      </div>

      <aside className="custom-preview" aria-label="Live preview">
        <div className="row between">
          <span className="display-xs">Live preview</span>
          <div className="ptabs" role="tablist" aria-label="Preview mode">
            <button type="button" role="tab" className="ptab" aria-selected={mode === 'rocket'} onClick={() => setMode('rocket')}>Rocket</button>
            <button type="button" role="tab" className="ptab" aria-selected={mode === 'astronaut'} onClick={() => setMode('astronaut')}>Astronaut</button>
          </div>
        </div>
        <PreviewStage mode={mode} rocket={cfg} suit={suit} name={nameCheck.value || props.username} seed={props.seed} />
        <p className="small muted" style={{ margin: 0 }}>
          {mode === 'rocket' ? 'This is exactly what other players see in orbit, drawn by the same code.' : 'This is you on a planet surface, at gameplay scale, drawn by the same code.'}
        </p>
      </aside>
    </div>
  );
}

function PartGroup<T extends string>({ label, value, options, onChange, disabled, note }: { label: string; value: T; options: ReadonlyArray<{ id: T; name: string; note: string }>; onChange: (v: T) => void; disabled?: boolean; note?: string }) {
  const current = options.find((o) => o.id === value);
  return (
    <div className="custom-group" role="radiogroup" aria-label={label}>
      <h3>{label}</h3>
      <div className="opts">
        {options.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className="opt" disabled={disabled} onClick={() => onChange(o.id)}>{o.name}</button>
        ))}
      </div>
      <p className="part-note">{note ?? current?.note}</p>
    </div>
  );
}

function SwatchGroup({ label, value, onChange, disabled, note }: { label: string; value: ColorId; onChange: (v: ColorId) => void; disabled?: boolean; note?: string }) {
  return (
    <div className="custom-group" role="radiogroup" aria-label={label}>
      <h3>{label}</h3>
      <div className="swatches">
        {COLORS.map((c) => (
          <button key={c.id} type="button" role="radio" className="swatch" aria-checked={value === c.id} aria-label={`${label}: ${c.name}`} disabled={disabled} onClick={() => onChange(c.id)}>
            <i style={{ background: c.hex }} aria-hidden="true" />
            <span>{c.name}</span>
          </button>
        ))}
      </div>
      {note ? <p className="part-note">{note}</p> : null}
    </div>
  );
}

const PW = 224;
const PH = 160;

/** Miniature scene: starfield, a distant generated planet, an orbit line, and the player with a nameplate. */
function PreviewStage({ mode, rocket, suit, name, seed }: { mode: Mode; rocket: RocketConfig; suit: SuitConfig; name: string; seed: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const planet = useMemo(() => generateSystem(seed, 0).planets[1] ?? generateSystem(seed, 0).planets[0], [seed]);
  const rocketKey = JSON.stringify(rocket);
  const suitKey = JSON.stringify(suit);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const S = 3;
    canvas.width = PW * S;
    canvas.height = PH * S;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off';
    const planetSprite = drawPlanet(planet, S, 18);
    const rocketSprite = drawRocket(rocket, S, 1);
    const nozzles = flameSpans(rocket);
    const walker = [drawExplorer(suit, 0, S * 2), drawExplorer(suit, 1, S * 2)];
    const start = performance.now();
    let raf = 0;
    const paint = (now: number) => {
      const t = reduce ? 0 : Math.max(0, now - start) / 1000; // rAF timestamps can precede `start` on the first frame
      ctx.fillStyle = mode === 'rocket' ? PALETTE.void : planet.palette.sky;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = i % 9 === 0 ? PALETTE.solarGold : i % 3 === 0 ? PALETTE.ice : PALETTE.sky;
        ctx.globalAlpha = i % 4 === 0 ? 0.9 : 0.45;
        ctx.fillRect(((i * 53 + 11) % PW) * S, ((i * 37 + 5) % (mode === 'rocket' ? PH : PH / 2)) * S, S, S);
      }
      ctx.globalAlpha = 1;
      if (mode === 'rocket') {
        ctx.strokeStyle = 'rgba(169,222,249,0.3)'; // --color-primary-soft (Icy Blue) at 30%: orbit line
        ctx.setLineDash([2 * S, 4 * S]);
        ctx.lineWidth = S;
        ctx.beginPath();
        ctx.ellipse(PW * 0.78 * S, PH * 0.3 * S, 70 * S, 26 * S, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.drawImage(planetSprite, Math.round(PW * 0.78 * S - planetSprite.width / 2), Math.round(PH * 0.3 * S - planetSprite.height / 2));
        const bob = Math.round(Math.sin(t * 2) * 2) * S;
        const rx = Math.round(PW * 0.42 * S);
        const ry = Math.round(PH * 0.62 * S) + bob;
        ctx.drawImage(rocketSprite, rx - rocketSprite.width / 2, ry - rocketSprite.height / 2);
        if (!reduce) {
          // one spark trail per nozzle, so hulls with wing-tip or paired engines trail from the right place
          for (const [x0, x1] of nozzles) {
            const nx = rx - rocketSprite.width / 2 + Math.floor((x0 + x1) / 2) * S;
            for (let i = 0; i < 4; i++) {
              ctx.fillStyle = i < 2 ? PALETTE.ice : PALETTE.sunlitAmber; // 47.6 engine warmth: Porcelain then Apricot Cream
              ctx.globalAlpha = 1 - i / 5;
              ctx.fillRect(nx + Math.round(Math.sin(t * 8 + i) * S), ry + rocketSprite.height / 2 + (i * 2 + ((t * 20) % 2)) * S, S, S);
            }
          }
          ctx.globalAlpha = 1;
        }
        drawNameplate(ctx, name, rx, ry - rocketSprite.height / 2 - 3 * S, { px: 7 * S });
      } else {
        // ground: same tones as drawTerrainTiles (official ground tone, shadow and base as specks)
        const [c0, c1] = planet.palette.ramp;
        const gy = Math.round(PH * 0.62);
        ctx.fillStyle = planet.palette.ground;
        ctx.fillRect(0, gy * S, PW * S, (PH - gy) * S);
        for (let i = 0; i < 90; i++) {
          ctx.fillStyle = i % 3 === 0 ? c1 : c0;
          ctx.fillRect(((i * 41 + 3) % PW) * S, (gy + 2 + ((i * 17) % (PH - gy - 3))) * S, S, S);
        }
        ctx.fillStyle = c0;
        ctx.fillRect(0, gy * S, PW * S, S);
        ctx.drawImage(planetSprite, Math.round(PW * 0.8 * S - planetSprite.width / 2), Math.round(PH * 0.22 * S - planetSprite.height / 2));
        const frame = reduce ? 0 : (Math.floor(t * 3) % 2 === 0 ? 0 : 1);
        const spr = walker[frame];
        const ax = Math.round(PW * 0.42 * S);
        const ay = Math.round((gy + 2) * S);
        ctx.drawImage(spr, ax - spr.width / 2, ay - spr.height);
        drawNameplate(ctx, name, ax, ay - spr.height - 3 * S, { px: 7 * S });
      }
      if (!reduce) raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, rocketKey, suitKey, name, planet]);
  return (
    <div className="custom-stage">
      <canvas ref={ref} role="img" aria-label={mode === 'rocket' ? `Preview of your rocket with the name ${name} above it` : `Preview of your astronaut with the name ${name} above it`} />
    </div>
  );
}
