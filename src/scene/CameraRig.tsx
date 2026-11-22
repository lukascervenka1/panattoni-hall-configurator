"use client";
// @refresh reset
// Camera refs and effects belong to one scene setup. Remount on code edits so
// Fast Refresh cannot reuse dependencies from an older camera implementation.
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import type { HallConfig } from "@/configurator/schema/config";
import { DEFAULT_FOV, presetDistance, presetPose, refitDistance, type ViewPreset } from "./camera";

interface ControlsLike {
  target: THREE.Vector3;
  update: () => void;
  addEventListener: (type: string, fn: () => void) => void;
  removeEventListener: (type: string, fn: () => void) => void;
}

interface Anim {
  t: number;
  duration: number;
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
}

/**
 * Řízení kamery nad OrbitControls: přednastavené pohledy s plynulým přechodem a automatické přizpůsobení jen tehdy,
 * když by se po změně rozměrů model nevešel do záběru. Změna materiálu ani volby kameru nikdy nemění.
 */
export function CameraRig({
  config,
  preset,
  nonce,
  reducedMotion,
  fixedPose,
}: {
  fixedPose?: { position: [number, number, number]; target: [number, number, number] } | null;
  config: HallConfig;
  preset: ViewPreset;
  nonce: number;
  reducedMotion: boolean;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as unknown as ControlsLike | null;
  const invalidate = useThree((s) => s.invalidate);
  const anim = useRef<Anim | null>(null);
  const placed = useRef(false);
  const interacted = useRef(false);
  const lastPreset = useRef<{ preset: ViewPreset; nonce: number } | null>(null);
  const aspect = size.width / Math.max(1, size.height);

  const start = (toPos: THREE.Vector3, toTarget: THREE.Vector3, jump: boolean) => {
    if (!controls) return;
    if (jump || reducedMotion) {
      camera.position.copy(toPos);
      controls.target.copy(toTarget);
      controls.update();
      anim.current = null;
      invalidate();
      return;
    }
    anim.current = {
      t: 0,
      duration: 0.75,
      fromPos: camera.position.clone(),
      toPos,
      fromTarget: controls.target.clone(),
      toTarget,
    };
    invalidate();
  };

  // Přednastavený pohled (a jeho opětovné vyvolání přes `nonce`). Nový pohled znamená čerstvý záběr.
  useEffect(() => {
    if (!controls) return;
    camera.fov = preset === "interior" ? 58 : DEFAULT_FOV;
    camera.near = preset === "interior" ? 0.15 : 0.8;
    camera.updateProjectionMatrix();
    const prev = lastPreset.current;
    if (prev && prev.preset === preset && prev.nonce === nonce && placed.current) return;
    // Pevná pozice z URL (?cam=...) slouží ke stabilním vizuálním testům a ladění; platí jen pro první umístění.
    const pose = fixedPose && !placed.current ? fixedPose : presetPose(preset, config, aspect, DEFAULT_FOV);
    start(new THREE.Vector3(...pose.position), new THREE.Vector3(...pose.target), !placed.current);
    placed.current = true;
    interacted.current = Boolean(fixedPose) && !prev;
    lastPreset.current = { preset, nonce };
    // Záměrně jen při změně pohledu: změna rozměrů/materiálu kameru nepřesouvá (řeší ji refit níže).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls, preset, nonce]);

  // Plátno dostane skutečnou velikost až po prvním měření (nebo se změní rozvržení, např. přepnutí režimu).
  // Dokud uživatel kameru sám nepohnul, záběr se přepočítá pro nový poměr stran.
  useEffect(() => {
    const last = lastPreset.current;
    if (!controls || !placed.current || interacted.current || !last) return;
    const pose = presetPose(last.preset, config, aspect, DEFAULT_FOV);
    start(new THREE.Vector3(...pose.position), new THREE.Vector3(...pose.target), true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.round(aspect * 20)]);

  // Přizpůsobení pouze tehdy, když se model po změně rozměrů nevejde (nebo je zbytečně malý).
  const { lengthM, widthM, clearHeightM, shape, notchLengthM, notchWidthM } = config.dimensions;
  useEffect(() => {
    if (!controls || !placed.current || fixedPose) return;
    if (preset === "office") {
      // Velikost administrativy se mění za pohybu: záběr se přizpůsobí, ale neskáče.
      const pose = presetPose("office", config, aspect, DEFAULT_FOV);
      start(new THREE.Vector3(...pose.position), new THREE.Vector3(...pose.target), false);
      return;
    }
    if (preset === "interior") {
      const pose = presetPose("interior", config, aspect, DEFAULT_FOV);
      // Re-anchor after geometry changes, including the L cut-out. Jumping between
      // valid positions avoids flying the interior camera through the new wall.
      start(new THREE.Vector3(...pose.position), new THREE.Vector3(...pose.target), true);
      return;
    }
    const dist = camera.position.distanceTo(controls.target);
    const next = refitDistance(dist, presetDistance(preset, config, aspect, DEFAULT_FOV));
    if (next === null) return;
    const dir = camera.position.clone().sub(controls.target).normalize();
    start(controls.target.clone().add(dir.multiplyScalar(next)), controls.target.clone(), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lengthM, widthM, clearHeightM, shape, notchLengthM, notchWidthM, config.office.enabled, config.office.areaM2, config.office.floors, controls, Math.round(aspect * 20)]);

  // Uživatel může přechod kdykoli přerušit tažením; od té chvíle už kameru sám nepřepisujeme jinak než "přizpůsob jen když je potřeba".
  useEffect(() => {
    if (!controls) return;
    const onStart = () => {
      anim.current = null;
      interacted.current = true;
    };
    controls.addEventListener("start", onStart);
    return () => controls.removeEventListener("start", onStart);
  }, [controls]);

  useFrame((_, delta) => {
    const a = anim.current;
    if (!a || !controls) return;
    a.t = Math.min(1, a.t + delta / a.duration);
    const e = 1 - Math.pow(1 - a.t, 3);
    camera.position.lerpVectors(a.fromPos, a.toPos, e);
    controls.target.lerpVectors(a.fromTarget, a.toTarget, e);
    controls.update();
    if (a.t >= 1) anim.current = null;
    invalidate();
  });

  return null;
}
