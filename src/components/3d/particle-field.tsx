"use client";

import * as React from "react";
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  Points as ThreePoints,
  PointsMaterial,
  BufferGeometry,
  BufferAttribute,
} from "three";
import { useFrame, useThree } from "@react-three/fiber";

import { scrollState } from "@/lib/motion/scroll-state";

/** A soft radial-gradient dot — dust/light motes, not hard circles. */
function useGlowTexture() {
  return React.useMemo(() => {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.4, "rgba(255,235,180,0.6)");
    gradient.addColorStop(1, "rgba(255,235,180,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const tex = new CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);
}

/** A single music-note glyph rendered to a canvas, reused as a sprite map —
 *  the literal "musical vibe" among the field's plainer light motes. */
function useNoteTexture() {
  return React.useMemo(() => {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.font = `${size * 0.8}px Georgia, "Times New Roman", serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(226,189,104,0.9)";
    ctx.shadowBlur = size * 0.18;
    ctx.fillStyle = "#F7EAC8";
    ctx.fillText("♪", size / 2, size / 2 + size * 0.05);
    const tex = new CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);
}

const DUST_COUNT = 140;
const NOTE_COUNT = 9;

function makeCloud(count: number, spread: { x: number; y: number; z: number }) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * spread.x;
    positions[i * 3 + 1] = (Math.random() - 0.5) * spread.y;
    positions[i * 3 + 2] = (Math.random() - 0.5) * spread.z;
    seeds[i] = Math.random() * Math.PI * 2;
  }
  return { positions, seeds };
}

/**
 * The cinematic layer: warm dust motes drifting like they're lit by a stage
 * spotlight, plus a handful of literal music-note glyphs among them —
 * "musical vibe" made explicit rather than only implied by the string.
 * Both layers gain drift speed with real Lenis scroll velocity, same
 * mechanism as the string field.
 */
export function ParticleField({ spread = { x: 14, y: 8, z: 6 } }: { spread?: { x: number; y: number; z: number } }) {
  const glow = useGlowTexture();
  const note = useNoteTexture();

  const dust = React.useMemo(() => makeCloud(DUST_COUNT, spread), [spread]);
  const notes = React.useMemo(
    () => makeCloud(NOTE_COUNT, { x: spread.x * 0.8, y: spread.y * 0.9, z: spread.z }),
    [spread],
  );

  const dustGeo = React.useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(dust.positions.slice(), 3));
    return geo;
  }, [dust]);
  const notesGeo = React.useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(notes.positions.slice(), 3));
    return geo;
  }, [notes]);

  const dustPoints = React.useMemo(
    () =>
      new ThreePoints(
        dustGeo,
        new PointsMaterial({
          map: glow,
          size: 0.16,
          color: new Color("#E2BD68"),
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
          blending: AdditiveBlending,
          sizeAttenuation: true,
        }),
      ),
    [dustGeo, glow],
  );
  const notePoints = React.useMemo(
    () =>
      new ThreePoints(
        notesGeo,
        new PointsMaterial({
          map: note,
          size: 0.55,
          transparent: true,
          opacity: 0.8,
          depthWrite: false,
          blending: AdditiveBlending,
          sizeAttenuation: true,
        }),
      ),
    [notesGeo, note],
  );

  const smoothedVelocity = React.useRef(0);
  const clock = useThree((s) => s.clock);

  useFrame(() => {
    smoothedVelocity.current += (scrollState.velocity - smoothedVelocity.current) * 0.08;
    const drift = 1 + Math.min(Math.abs(smoothedVelocity.current) * 0.8, 3.5);
    const t = clock.getElapsedTime();

    const dustPos = dustGeo.getAttribute("position") as BufferAttribute;
    for (let i = 0; i < DUST_COUNT; i++) {
      const seed = dust.seeds[i];
      dustPos.setY(i, dust.positions[i * 3 + 1] + Math.sin(t * 0.15 * drift + seed) * 0.6);
      dustPos.setX(i, dust.positions[i * 3] + Math.cos(t * 0.1 * drift + seed) * 0.4);
    }
    dustPos.needsUpdate = true;

    const notePos = notesGeo.getAttribute("position") as BufferAttribute;
    for (let i = 0; i < NOTE_COUNT; i++) {
      const seed = notes.seeds[i];
      notePos.setY(i, notes.positions[i * 3 + 1] + Math.sin(t * 0.12 * drift + seed) * 0.9);
      notePos.setX(i, notes.positions[i * 3] + Math.sin(t * 0.08 * drift + seed * 1.7) * 0.5);
    }
    notePos.needsUpdate = true;
  });

  return (
    <>
      <primitive object={dustPoints} />
      <primitive object={notePoints} />
    </>
  );
}
