"use client";

import * as React from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";

/**
 * A sparse field of real, GPU-lit stars behind the string — the hero reads
 * as a recital hall at night, not just a dark background. Each star is drawn
 * by its own shader (core + soft glow), the same technique a planetarium
 * dome would use, not a texture sprite: no canvas-2d texture to build on
 * mount, one draw call for the whole field, and no dependency on the
 * page's bloom pass for its glow. That makes it materially cheaper than the
 * existing dust/note particle field, not just visually quieter — which is
 * why, unlike that field, it is allowed to run on every device, including
 * the low-end Android phones this audience actually carries (PRODUCT.md).
 *
 * Stars fade up out of the dark over the first couple of seconds, timed
 * alongside the hero's own staged text reveal, then settle into a slow
 * twinkle — "the house lights are still coming down" as the headline lands.
 */
const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aTint;
  uniform float uTime;
  uniform float uReveal;
  uniform float uScale;
  varying float vAlpha;
  varying vec3 vTint;
  void main() {
    float twinkle = 0.78 + 0.22 * sin(uTime * (0.6 + aPhase * 1.4) + aPhase * 6.28);
    vAlpha = twinkle * uReveal;
    vTint = aTint;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uScale * (120.0 / max(-mv.z, 1.0));
  }
`;

const fragmentShader = /* glsl */ `
  varying float vAlpha;
  varying vec3 vTint;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p);
    float core = smoothstep(0.22, 0.0, d);
    float glow = pow(smoothstep(0.5, 0.0, d), 3.0);
    float a = clamp(core + glow * 0.55, 0.0, 1.0) * vAlpha;
    gl_FragColor = vec4(vTint * a, a);
  }
`;

interface StarSpread {
  width: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

function buildStars(count: number, spread: StarSpread) {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const tints = new Float32Array(count * 3);
  // Mostly warm cream, a handful of brighter brass-gold — real stars vary
  // in temperature, but this page's night sky stays inside its own palette
  // rather than borrowing the cool blue of a literal sky.
  const cream = new THREE.Color("#F7F2E8");
  const gold = new THREE.Color("#F6B55A");

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * spread.width;
    positions[i * 3 + 1] = spread.minY + Math.random() * (spread.maxY - spread.minY);
    positions[i * 3 + 2] = -(spread.minZ + Math.random() * (spread.maxZ - spread.minZ));
    sizes[i] = 1.1 + Math.random() * 2.2;
    phases[i] = Math.random();
    const warm = Math.random() < 0.22;
    const tint = warm ? gold : cream;
    tints[i * 3] = tint.r;
    tints[i * 3 + 1] = tint.g;
    tints[i * 3 + 2] = tint.b;
  }
  return { positions, sizes, phases, tints };
}

/** Visible half-width at a given depth, for the active perspective camera —
 *  a narrow portrait phone has a much tighter horizontal frustum than a
 *  wide desktop window at the same vertical FOV, so a fixed world-unit
 *  spread either clips almost everything off a phone screen or barely
 *  fills a desktop one. Deriving it from the real camera/aspect means the
 *  field always actually fills the frame it is drawn in. */
function useHorizontalSpreadAt(depth: number) {
  const fov = useThree((s) => (s.camera as THREE.PerspectiveCamera).fov);
  const aspect = useThree((s) => s.size.width / s.size.height);
  return 2 * depth * Math.tan((fov * Math.PI) / 360) * aspect;
}

export function StarField({ count = 110 }: { count?: number }) {
  // Build the field relative to a star at the middle of its own depth range,
  // measured from the camera's resting z (5.2, see string-field.tsx) rather
  // than imported directly — this file has no reason to depend on that
  // module, and the rig only dollies a further few units out on scroll.
  const cameraRestZ = 5.2;
  const minZ = 2;
  const maxZ = 9;
  const midDepth = cameraRestZ + (minZ + maxZ) / 2;
  const frameWidth = useHorizontalSpreadAt(midDepth);

  const data = React.useMemo(
    () => buildStars(count, { width: frameWidth * 1.15, minY: -5.5, maxY: 5.5, minZ, maxZ }),
    [count, frameWidth, minZ, maxZ],
  );

  const geometry = React.useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(data.sizes, 1));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(data.phases, 1));
    geo.setAttribute("aTint", new THREE.BufferAttribute(data.tints, 3));
    return geo;
  }, [data]);

  const uniforms = React.useMemo(
    () => ({
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uScale: { value: 1 },
    }),
    [],
  );

  const material = React.useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [uniforms],
  );

  const points = React.useMemo(() => new THREE.Points(geometry, material), [geometry, material]);
  const dpr = useThree((s) => s.viewport.dpr);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    uniforms.uTime.value = t;
    uniforms.uScale.value = dpr;
    // Ease up to fully revealed over ~2.4s — a pure function of elapsed
    // time, not an accumulated clock.getDelta(): that call mutates shared
    // clock state, and another useFrame consumer on this same canvas
    // reading it first each frame left this ramp starved to near-zero.
    uniforms.uReveal.value = Math.min(1, t / 2.4);
  });

  return <primitive object={points} frustumCulled={false} />;
}
