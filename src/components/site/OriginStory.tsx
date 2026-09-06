import { COPY } from '@/game/copy';

/** Renders the origin copy exactly as supplied. Layout only; no rewording. */
export function OriginStory() {
  return (
    <div className="origin">
      {COPY.origin.paragraphs.map((lines, i) => {
        const text = lines.join(' ');
        const isQuote = text.startsWith('\u201c');
        const isBig = text === 'We built one.' || text === 'Welcome to somewhere else.';
        return (
          <p key={i} className={isQuote ? 'quote' : isBig ? 'big' : undefined}>
            {lines.map((line, j) => (
              <span key={j}>
                {line}
                {j < lines.length - 1 ? <br /> : null}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
