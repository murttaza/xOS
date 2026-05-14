type Props = {
  className?: string;
  height?: number;
};

// Two themed PNGs share an identical alpha mask, so swapping by `.dark` class keeps
// the wordmark perfectly aligned across themes without re-tinting at runtime.
export function Wordmark({ className, height = 32 }: Props) {
  const style = { height, width: 'auto', maxWidth: 'none' as const };
  return (
    <>
      <img
        src="/wordmark-dark.png"
        alt="mOS"
        height={height}
        style={style}
        className={`hidden dark:inline-block ${className ?? ''}`}
        draggable={false}
      />
      <img
        src="/wordmark-light.png"
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
