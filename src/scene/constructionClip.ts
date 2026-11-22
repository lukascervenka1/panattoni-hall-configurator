/**
 * Časová osa stavby jako skutečný `AnimationClip` (skill threejs-animation): základ → stěny → střecha → vybavení → okolí.
 *
 * Klip nic nevykresluje. Animuje "rig", pomocný strom objektů s pojmenovanými uzly; režisér stavby po každém
 * `mixer.update()` přečte jeho hodnoty a předá je modelu. Díky mixeru lze stavbu přeskočit (`action.time`),
 * přehrát znovu (`reset`) a poznat konec (událost `finished`).
 *
 *   floor.scale[x|z]   základ roste od středu            0 → 1
 *   walls.scale[y]     stěny rostou odspodu              0 → 1
 *   roof.position[y]   střecha dosedá shora              roofDropM → 0
 *   office.scale[y]    vestavba "vyroste"                0 → 1
 *   reveal.position    x = vybavení haly, y = okolí, z = rozšíření ploch areálu (0 → 1)
 */
import * as THREE from "three";
import { CONSTRUCTION } from "./build";

export interface Rig {
  root: THREE.Group;
  floor: THREE.Object3D;
  walls: THREE.Object3D;
  roof: THREE.Object3D;
  office: THREE.Object3D;
  frame: THREE.Object3D;
  reveal: THREE.Object3D;
}

export function createRig(): Rig {
  const root = new THREE.Group();
  const node = (name: string) => {
    const o = new THREE.Object3D();
    o.name = name;
    root.add(o);
    return o;
  };
  const rig: Rig = { root, floor: node("floor"), walls: node("walls"), roof: node("roof"), office: node("office"), frame: node("frame"), reveal: node("reveal") };
  // Klidové hodnoty před přehráním (po skončení klipu zůstává poslední pozice).
  rig.floor.scale.set(1, 1, 1);
  rig.walls.scale.set(1, 1, 1);
  rig.roof.position.y = 0;
  rig.office.scale.set(1, 1, 1);
  rig.reveal.position.set(1, 1, 1);
  rig.frame.position.set(1, 1, 0);
  return rig;
}

type Ease = "out" | "inOut" | "linear";

/**
 * Dvouklíčová stopa mezi `t0` a `t1` s Bézierovým průběhem. Ovládací body jsou absolutní (čas, hodnota),
 * ekvivalent CSS cubic-bezier: out = (0.215, 0.61, 0.355, 1), inOut = (0.65, 0, 0.35, 1).
 */
function track(name: string, t0: number, t1: number, v0: number, v1: number, ease: Ease): THREE.NumberKeyframeTrack {
  const tr = new THREE.NumberKeyframeTrack(name, [t0, t1], [v0, v1]);
  if (ease === "linear") return tr;
  const [x1, y1, x2, y2] = ease === "out" ? [0.215, 0.61, 0.355, 1] : [0.65, 0, 0.35, 1];
  const dt = t1 - t0;
  const dv = v1 - v0;
  tr.setInterpolation(THREE.InterpolateBezier);
  tr.settings = {
    inTangents: [t0, v0, t0 + x2 * dt, v0 + y2 * dv],
    outTangents: [t0 + x1 * dt, v0 + y1 * dv, t1, v1],
  };
  return tr;
}

/** Celková délka klipu: po posledním prvku okolí ještě krátká doba, než se stavba prohlásí za dokončenou. */
export const CONSTRUCTION_DURATION = CONSTRUCTION.furnishStart + CONSTRUCTION.furnishDur + 1.4;

export function createConstructionClip(): THREE.AnimationClip {
  const c = CONSTRUCTION;
  const tracks = [
    track("floor.scale[x]", c.floorStart, c.floorStart + c.floorDur, 0.001, 1, "out"),
    track("floor.scale[z]", c.floorStart, c.floorStart + c.floorDur, 0.001, 1, "out"),
    track("reveal.position[z]", c.roofStart + c.roofDur, c.furnishStart + c.furnishDur + 0.7, 0, 1, "out"),
    track("frame.position[x]", c.columnsStart, c.columnsStart + c.columnsDur, 0, 1, "linear"),
    track("frame.position[y]", c.beamsStart, c.beamsStart + c.beamsDur, 0, 1, "linear"),
    track("walls.scale[y]", c.wallsStart, c.wallsStart + c.wallsDur, 0.001, 1, "inOut"),
    track("roof.scale[x]", c.roofStart, c.roofStart + c.roofDur, 0, 1, "inOut"),
    track("roof.position[y]", c.roofStart, c.roofStart + c.roofDur, c.roofDropM, 0, "out"),
    track("office.scale[y]", c.furnishStart, c.furnishStart + c.furnishDur, 0.001, 1, "out"),
    track("reveal.position[x]", c.furnishStart, c.furnishStart + c.furnishDur, 0, 1, "linear"),
    track("reveal.position[y]", c.furnishStart + c.furnishDur + 0.6, CONSTRUCTION_DURATION, 0, 1, "out"),
  ];
  return new THREE.AnimationClip("construction", CONSTRUCTION_DURATION, tracks);
}
