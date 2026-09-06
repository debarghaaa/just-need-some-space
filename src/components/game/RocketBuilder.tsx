'use client';
import { useId } from 'react';
import { RocketSprite } from './Sprites';
import { BODIES, COLORS, DECALS, ENGINES, FINS, STARTER_ROCKETS, WINGED_BODIES, type RocketConfig } from '@/game/rockets';

/**
 * Rocket customization panel. Purely presentational + controlled: parent owns the config
 * and decides when it is saved.
 */
export function RocketBuilder({ value, onChange, name, onNameChange, disabled = false }: { value: RocketConfig; onChange: (next: RocketConfig) => void; name: string; onNameChange: (name: string) => void; disabled?: boolean }) {
  const nameId = useId();
  const set = <K extends keyof RocketConfig>(key: K, v: RocketConfig[K]) => onChange({ ...value, [key]: v });

  const group = <K extends keyof RocketConfig>(label: string, key: K, options: ReadonlyArray<{ id: RocketConfig[K]; name: string; note: string; hex?: string }>, note?: string) => {
    const current = options.find((o) => o.id === value[key]);
    return (
      <div className="part-group" role="radiogroup" aria-label={label}>
        <h3>{label}</h3>
        <div className={options[0]?.hex ? 'swatches' : 'opts'}>
          {options.map((o) => (
            o.hex ? (
              <button key={String(o.id)} type="button" role="radio" aria-checked={value[key] === o.id} className="swatch" aria-label={`${label}: ${o.name}`} disabled={disabled} onClick={() => set(key, o.id)}>
                <i style={{ background: o.hex }} aria-hidden="true" />
                <span>{o.name}</span>
              </button>
            ) : (
              <button key={String(o.id)} type="button" role="radio" aria-checked={value[key] === o.id} className="opt" disabled={disabled} onClick={() => set(key, o.id)}>
                {o.name}
              </button>
            )
          ))}
        </div>
        <p className="part-note">{note ?? current?.note}</p>
      </div>
    );
  };
  const winged = WINGED_BODIES.has(value.body);

  return (
    <div className="builder">
      <div className="preview-stage">
        <RocketSprite config={value} scale={8} flame={1} label={`Preview of ${name || 'your rocket'}`} />
      </div>
      <div className="stack" style={{ display: 'grid', gap: '1.25rem' }}>
        <div className="field">
          <label htmlFor={nameId}>Rocket name</label>
          <input id={nameId} className="input" maxLength={24} value={name} disabled={disabled} onChange={(e) => onNameChange(e.target.value)} placeholder="Something with a bit of dignity" />
        </div>
        <div className="part-group">
          <h3>Presets</h3>
          <div className="opts">
            {STARTER_ROCKETS.map((s) => (
              <button key={s.name} type="button" className="opt" disabled={disabled} onClick={() => { onChange(s.config); if (!name) onNameChange(s.name); }} title={s.blurb}>
                {s.name}
              </button>
            ))}
          </div>
        </div>
        {group('Body', 'body', BODIES)}
        {group('Engine', 'engine', ENGINES, winged ? 'This hull has its own nozzles. The engine colour still applies.' : undefined)}
        {group('Fins', 'fins', FINS, winged ? 'This hull has its own wings. The fin colour still applies.' : undefined)}
        {group('Body colour', 'color', COLORS)}
        {group('Window and accent colour', 'accent', COLORS)}
        {group('Decal', 'decal', DECALS)}
      </div>
    </div>
  );
}
