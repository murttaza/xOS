import wordmarkDarkUrl from '../assets/wordmark-dark.png';
import wordmarkLightUrl from '../assets/wordmark-light.png';

type Props = {
  className?: string;
  height?: number;
};

// Two themed PNGs share an identical alpha mask, so swapping by `.dark` class keeps
// the wordmark perfectly aligned across themes without re-tinting at runtime.
// Imported through Vite so the emitted URLs are relative and resolve correctly in
// Electron's file:// renderer context (a public/ path would 404 there).
export function Wordmark({ className, height = 24 }: Props) {
  const style = { height, width: 'auto', maxWidth: 'none' as const };
  return (
    <>
      <img
        src={wordmarkDarkUrl}
        alt="mOS"
        height={height}
        style={style}
        className={`hidden dark:inline-block ${className ?? ''}`}
        draggable={false}
      />
      <img
        src={wordmarkLightUrl}
        alt="mOS"
        height={height}
        style={style}
        className={`inline-block dark:hidden ${className ?? ''}`}
        draggable={false}
        aria-hidden="true"
      />
    </>
  );
}
