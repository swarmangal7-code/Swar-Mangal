"use client";

import * as React from "react";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { ParticleField } from "@/components/3d/particle-field";
import { useCinematicMotion } from "@/lib/motion/use-cinematic-motion";

/**
 * The page's closing 3D moment — the hero's dust-and-notes cloud alone,
 * without the string, as a quieter echo rather than a repeat. Bookends the
 * cinematic opening: the visitor arrived inside a lit, vibrating instrument
 * and leaves inside the same light, settled. Desktop-only (see StringField's
 * own comment on why) and skipped under reduced motion / no WebGL.
 */
export function ParticleAccent({ className }: { className?: string }) {
  const reduced = useCinematicMotion();
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      const mq = window.matchMedia("(min-width: 768px)");
      setReady(Boolean(gl) && mq.matches);
    } catch {
      setReady(false);
    }
  }, []);

  if (reduced || !ready) return null;

  return (
    <div aria-hidden className={className}>
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        camera={{ position: [0, 0, 5.2], fov: 42 }}
      >
        <ParticleField spread={{ x: 10, y: 6, z: 5 }} />
        <EffectComposer>
          <Bloom mipmapBlur intensity={0.6} luminanceThreshold={0.15} luminanceSmoothing={0.3} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
