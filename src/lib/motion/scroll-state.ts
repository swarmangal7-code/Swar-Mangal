/**
 * Shared scroll state written by <LenisProvider> and read by anything that
 * needs scroll velocity/progress every frame (the WebGL string field) —
 * plain mutable refs on purpose, so 60 updates/sec never touch React state
 * or trigger a re-render. Read it inside a rAF/useFrame loop, never in JSX.
 */
export const scrollState = {
  /** Lenis's own velocity units (roughly px/frame at 60fps), signed. */
  velocity: 0,
  /** 0..1 progress through the whole scrollable page. */
  progress: 0,
};
