/**
 * Loading screen. One word, by request: HARNESSMOGGING. No rotating copy, no scene, no timers.
 *
 * It is a server component with no JavaScript of its own, so it costs nothing to show and never
 * delays the page it stands in for. The only motion is the CSS cursor blink, which the reduced
 * motion rules in globals.css already switch off.
 */
export const LOADING_WORD = 'HARNESSMOGGING';

export function LoadingScreen({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`loading-screen${compact ? ' loading-compact' : ''}`} role="status" aria-live="polite" aria-busy="true">
      <p className="loading-word cursor">{LOADING_WORD}</p>
    </div>
  );
}
