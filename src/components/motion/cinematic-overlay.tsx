/**
 * Two cheap, classic cinematic devices layered over the whole page:
 * a vignette (edges read darker, like light falling off outside a lens)
 * and film grain (an animated SVG feTurbulence noise field, not an image
 * asset). Fixed position so both hold steady relative to the viewport
 * while the page scrolls underneath — it's shooting through a lens, not
 * a sticker on the content.
 *
 * Server component: this is pure static markup, no interactivity, so it
 * costs nothing to keep out of the client bundle.
 */
export function CinematicOverlay() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-40">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 120% at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
      <svg className="absolute inset-0 h-full w-full opacity-[0.05] mix-blend-overlay">
        <filter id="cinematicGrain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch">
            <animate attributeName="seed" values="1;40;1" dur="1.2s" repeatCount="indefinite" />
          </feTurbulence>
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#cinematicGrain)" />
      </svg>
    </div>
  );
}
