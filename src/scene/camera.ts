/**
 * Čisté výpočty poloh kamery pro přednastavené pohledy a pro "přizpůsob jen když je potřeba".
 * Bez Reactu a Three.js (vrací obyčejné trojice čísel), proto testovatelné.
 */
import { notchOf, officeLayout, totalHeightM } from "@/configurator/calculations/layout";
import type { HallConfig } from "@/configurator/schema/config";
import { boundingRadius } from "./layout";

export const VIEW_PRESETS = ["perspective", "front", "rear", "right", "office", "section", "roof", "top", "interior"] as const;
export type ViewPreset = (typeof VIEW_PRESETS)[number];

export const VIEW_LABELS_CS: Record<ViewPreset, string> = {
  perspective: "Perspektiva",
  front: "Zepředu",
  rear: "Zezadu",
  right: "Vrata z boku",
  office: "Administrativa",
  section: "Řez halou",
  roof: "Střecha z nadhledu",
  top: "Shora",
  interior: "Interiér",
};

export type Vec3 = [number, number, number];
export interface CameraPose {
  position: Vec3;
  target: Vec3;
}

export const DEFAULT_FOV = 38;

/** Vzdálenost, ze které se do záběru vejde obdélník dané poloviční šířky a výšky. */
export function fitDistance(halfW: number, halfH: number, fovDeg: number, aspect: number): number {
  const halfV = (fovDeg * Math.PI) / 360;
  const halfHoriz = Math.atan(Math.tan(halfV) * aspect);
  return Math.max(halfW / Math.tan(halfHoriz), halfH / Math.tan(halfV));
}

/** Vzdálenost, ze které se do záběru vejde celá koule o poloměru R. */
export function sphereFitDistance(radius: number, fovDeg: number, aspect: number): number {
  const halfV = (fovDeg * Math.PI) / 360;
  const halfHoriz = Math.atan(Math.tan(halfV) * aspect);
  // 1,3 = rezerva pro překryvné ovládací prvky a okolí; model nesmí dosedat na okraj záběru.
  return (radius / Math.sin(Math.min(halfV, halfHoriz))) * 1.3;
}

/** Pohledy z administrativy potřebují i její rozměry; ostatní vystačí s rozměry haly. */
export type PoseConfig = Pick<HallConfig, "dimensions"> & Partial<Pick<HallConfig, "office">>;

export function presetPose(preset: ViewPreset, config: PoseConfig, aspect: number, fovDeg = DEFAULT_FOV): CameraPose {
  const { lengthM: L, widthM: W, clearHeightM: C } = config.dimensions;
  const H = totalHeightM(C);
  const R = boundingRadius(config);
  switch (preset) {
    case "perspective": {
      // Záběr z projekce obdélníkového půdorysu a výšky (ne z opsané koule): plochá hala vyplní plátno.
      const dir = [0.62, 0.46, 0.78];
      const n = Math.hypot(...dir);
      const gx = dir[0]! / Math.hypot(dir[0]!, dir[2]!);
      const gz = dir[2]! / Math.hypot(dir[0]!, dir[2]!);
      const sinE = dir[1]! / n;
      const cosE = Math.sqrt(1 - sinE * sinE);
      const screenW = (L + 24) * Math.abs(gz) + (W + 72) * Math.abs(gx);
      const depthExt = (L + 24) * Math.abs(gx) + (W + 72) * Math.abs(gz);
      const screenH = depthExt * sinE + H * cosE;
      const d = fitDistance((screenW / 2) * 1.22, (screenH / 2) * 1.3, fovDeg, aspect) + depthExt * 0.25;
      return { position: [(dir[0]! / n) * d, (dir[1]! / n) * d + H * 0.2, (dir[2]! / n) * d + 18], target: [0, H * 0.28, 18] };
    }
    case "front": {
      const d = fitDistance((L / 2) * 1.12, H * 0.75, fovDeg, aspect) + W / 2;
      return { position: [0, H * 0.5, d], target: [0, H * 0.4, 0] };
    }
    case "rear": {
      const d = fitDistance((L / 2) * 1.12, H * 0.75, fovDeg, aspect) + W / 2;
      return { position: [0, H * 0.5, -d], target: [0, H * 0.4, 0] };
    }
    case "right": {
      const d = fitDistance((W + 64) / 2, H * 0.9, fovDeg, aspect) + L / 2;
      return { position: [d, H * 1.25, 16], target: [L / 2, H * 0.4, 16] };
    }
    case "office": {
      // Nízký, téměř čelní pohled jako z katalogu: okna, vstup a parkoviště v jednom záběru.
      const o = config.office ? officeLayout({ dimensions: config.dimensions, office: config.office }) : null;
      const frontage = L - notchOf(config.dimensions).nx;
      const widthM = o?.widthM ?? Math.min(40, frontage * 0.35);
      // Celá administrativa včetně vstupu a levého rohu; u malých hal nepřesahovat čelní rameno půdorysu L.
      const halfView = Math.min((frontage + 14) / 2, Math.max(24, (widthM + 14) / 2));
      const cx = -L / 2 + halfView - 6;
      const d = Math.max(60, fitDistance(halfView * 1.12, Math.max(6, H * 0.65), fovDeg, aspect));
      return {
        position: [cx + d * 0.18, H + 2.4, W / 2 + d],
        target: [cx, H * 0.36, W / 2 + 5],
      };
    }
    case "section": {
      // Řez: čelní stěna je odstraněná, kamera stojí před otevřenou stranou, mírně shora a z boku. Záběr míří na levou
      // část haly s administrativou a prvními řadami regálů (jako na vizuálu z katalogu), ne na celou délku.
      const halfView = Math.min(L / 2, 40);
      const tx = -L / 2 + halfView * 0.92;
      const d = fitDistance(halfView, Math.max(H * 0.8, 6), fovDeg, aspect) + 6;
      return { position: [tx + d * 0.3, H + d * 0.2, W / 2 + d * 0.88], target: [tx, H * 0.28, W / 2 - Math.min(14, W * 0.25)] };
    }
    case "roof": {
      const d = sphereFitDistance(R + 10, fovDeg, aspect);
      return { position: [d * 0.35, d * 0.82, d * 0.45], target: [0, H * 0.6, 0] };
    }
    case "top": {
      const d = fitDistance((L / 2) * 1.1, (W / 2) * 1.1, fovDeg, aspect);
      return { position: [0, d, 0.001], target: [0, 0, 0] };
    }
    case "interior": {
      // The rear arm is a continuous rectangle even for an L footprint.
      // Stay in its right-hand service aisle, clear of the front office block.
      const depth = W - notchOf(config.dimensions).nz;
      const z = -W / 2 + Math.min(8, depth * 0.3);
      return {
        position: [L / 2 - Math.min(8, L * 0.12), Math.min(4.5, C * 0.45), z],
        target: [-L * 0.2, Math.min(3.5, C * 0.34), Math.min(-W / 2 + depth * 0.6, W / 2 - 16)],
      };
    }
  }
}

/**
 * Kameru po změně rozměrů přizpůsobíme jen tehdy, když by se model nevešel do záběru (nebo je zbytečně maličký).
 * Porovnává se s odstupem, který pro právě aktivní pohled určuje `presetPose` (`referenceDistance`).
 * Vrací novou vzdálenost od cíle, nebo null, pokud je vše v pořádku a kamera se nemá hýbat.
 */
export function refitDistance(currentDistance: number, referenceDistance: number): number | null {
  if (currentDistance < referenceDistance * 0.85) return referenceDistance;
  if (currentDistance > referenceDistance * 3.5) return referenceDistance * 2.2;
  return null;
}

/** Odstup kamery od cíle pro daný pohled (vstup pro refitDistance). */
export function presetDistance(preset: ViewPreset, config: PoseConfig, aspect: number, fovDeg = DEFAULT_FOV): number {
  const p = presetPose(preset, config, aspect, fovDeg);
  return Math.hypot(p.position[0] - p.target[0], p.position[1] - p.target[1], p.position[2] - p.target[2]);
}
