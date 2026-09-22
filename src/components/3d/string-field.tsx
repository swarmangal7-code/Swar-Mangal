"use client";

import * as React from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Line as ThreeLine,
  LineBasicMaterial,
  MathUtils,
  PerspectiveCamera,
} from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useReducedMotion } from "framer-motion";

import { scrollState } from "@/lib/motion/scroll-state";
import { cn } from "@/lib/utils/cn";
import { ParticleField } from "@/components/3d/particle-field";

const SEGMENTS = 96;
const HALF_WIDTH = 6.4;
const STRANDS = [
  { offset: 0, opacity: 0.9, color: "#E2BD68" },
  { offset: 0.045, opacity: 0.35, color: "#E2BD68" },
  { offset: -0.045, opacity: 0.35, color: "#D6A84F" },
] as const;

/**
 * The signature interaction: one string, lit like brass/steel, that behaves
 * like it is actually strung across the viewport — ambient sway at rest,
 * bends toward the cursor like a pluck, and gains amplitude with real Lenis
 * scroll velocity (read every frame from `scrollState`, no React re-render
 * on the hot path). This is what "sound made visible" means on this page.
 */
function Strand({ offsetY, opacity, color }: { offsetY: number; opacity: number; color: string }) {
  const positions = React.useMemo(() => new Float32Array((SEGMENTS + 1) * 3), []);
  const geometry = React.useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(positions, 3));
    return geo;
  }, [positions]);
  // R3F's <line> JSX tag collides with the DOM/SVG <line> element under
  // TypeScript's automatic JSX runtime — build the THREE.Line imperatively
  // and mount it with <primitive> instead of fighting the namespace.
  const line = React.useMemo(
    () =>
      new ThreeLine(
        geometry,
        new LineBasicMaterial({ color, transparent: true, opacity, blending: AdditiveBlending }),
      ),
    [geometry, color, opacity],
  );

  const pointer = useThree((s) => s.pointer);
  const clock = useThree((s) => s.clock);
  const smoothedVelocity = React.useRef(0);

  useFrame(() => {
    const t = clock.getElapsedTime();
    // Ease the raw scroll velocity so a single fast flick doesn't snap the
    // string — it should feel plucked, not glitched.
    smoothedVelocity.current += (scrollState.velocity - smoothedVelocity.current) * 0.12;
    const vel = MathUtils.clamp(smoothedVelocity.current, -4, 4);
    const vibeAmp = 0.05 + Math.min(Math.abs(vel) * 0.11, 0.85);
    const vibeFreq = 2.2 + Math.min(Math.abs(vel) * 0.6, 3.5);

    const pointerX = pointer.x * HALF_WIDTH;
    const pointerY = pointer.y * 1.6;

    for (let i = 0; i <= SEGMENTS; i++) {
      const x = -HALF_WIDTH + (i / SEGMENTS) * HALF_WIDTH * 2;

      const ambient = Math.sin(x * 0.6 + t * 0.35) * 0.055;
      const vibration = Math.sin(x * vibeFreq - t * 3.4) * vibeAmp * Math.sin((i / SEGMENTS) * Math.PI);

      const dx = x - pointerX;
      const pluck = pointerY * Math.exp(-(dx * dx) / (2 * 1.15 * 1.15));

      const y = offsetY + ambient + vibration + pluck * 0.7;
      const z = Math.cos(x * 0.5 + t * 0.3) * 0.4 + pluck * 0.9;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }

    const attr = geometry.getAttribute("position") as BufferAttribute;
    attr.needsUpdate = true;
  });

  return <primitive object={line} />;
}

function Scene({ cinematic }: { cinematic: boolean }) {
  return (
    <>
      <PerspectiveRig />
      {STRANDS.map((s) => (
        <Strand key={s.offset} offsetY={s.offset} opacity={s.opacity} color={s.color} />
      ))}
      {cinematic && (
        <>
          <ParticleField />
          {/* mipmapBlur keeps this cheap enough for the GPUs this still
              runs on — full-res bloom would double the frame cost for a
              scene that's mostly a thin line and a few hundred points. */}
          <EffectComposer>
            <Bloom mipmapBlur intensity={0.65} luminanceThreshold={0.15} luminanceSmoothing={0.3} />
          </EffectComposer>
        </>
      )}
    </>
  );
}

/**
 * Camera work, not just drift: a slow orbital sway at rest, plus a dolly-out
 * tied to how far the visitor has scrolled past the hero (plain
 * window.scrollY, not Lenis's whole-page progress — the hero is one
 * viewport tall, so page-wide progress would barely move within it). The
 * scene pulls back and widens as you leave, like a camera retreating from
 * the stage rather than the hero just scrolling out of frame.
 */
function PerspectiveRig() {
  useFrame(({ camera, clock }) => {
    const t = clock.getElapsedTime();
    const heroProgress =
      typeof window === "undefined" ? 0 : Math.min(Math.max(window.scrollY / window.innerHeight, 0), 1);

    camera.position.x = Math.sin(t * 0.05) * 0.4;
    camera.position.y = Math.cos(t * 0.04) * 0.2 + heroProgress * 0.6;
    camera.position.z = 5.2 + heroProgress * 3.5;
    if (camera instanceof PerspectiveCamera) {
      camera.fov = 42 + heroProgress * 10;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export function StringField({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const [supported, setSupported] = React.useState(true);
  // Particles + bloom roughly double the frame cost of the scene. PRODUCT.md
  // is explicit that this audience skews toward mid/low-end Android — the
  // string itself (the actual signature interaction) still plays everywhere;
  // only the cinematic dressing is desktop-only.
  const [cinematic, setCinematic] = React.useState(false);

  React.useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (!gl) setSupported(false);
    } catch {
      setSupported(false);
    }
    const mq = window.matchMedia("(min-width: 768px)");
    setCinematic(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setCinematic(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // Reduced motion / no WebGL: a still, lit gradient reads as "a resting
  // string" without a single animated frame — never a blank gap. Centered
  // within whatever box `className` sizes, same as the dynamic-import
  // loading placeholder this mirrors.
  if (reduced || !supported) {
    return (
      <div aria-hidden className={cn("relative flex items-center", className)}>
        <div
          className="h-px w-full"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(226,189,104,0.22) 48%, rgba(226,189,104,0.22) 52%, transparent 100%)",
          }}
        />
      </div>
    );
  }

  return (
    <div aria-hidden className={className}>
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        camera={{ position: [0, 0, 5.2], fov: 42 }}
      >
        <Scene cinematic={cinematic} />
      </Canvas>
    </div>
  );
}
