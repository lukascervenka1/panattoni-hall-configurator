import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { CONSTRUCTION } from "./build";
import { CONSTRUCTION_DURATION, createConstructionClip, createRig } from "./constructionClip";

function play() {
  const rig = createRig();
  const clip = createConstructionClip();
  const mixer = new THREE.AnimationMixer(rig.root);
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  const at = (t: number) => {
    action.time = t;
    mixer.update(0);
    return {
      floor: rig.floor.scale.x,
      walls: rig.walls.scale.y,
      roofDrop: rig.roof.position.y,
      office: rig.office.scale.y,
      furnish: rig.reveal.position.x,
      env: rig.reveal.position.y,
      ground: rig.reveal.position.z,
      columns: rig.frame.position.x,
      beams: rig.frame.position.y,
      roofReveal: rig.roof.scale.x,
    };
  };
  return { rig, clip, mixer, action, at };
}

describe("klip stavby (AnimationClip + Mixer)", () => {
  it("klip je platný a má pojmenované stopy pro všechny části stavby", () => {
    const clip = createConstructionClip();
    expect(clip.validate()).toBe(true);
    expect(clip.duration).toBe(CONSTRUCTION_DURATION);
    expect(clip.tracks.map((t) => t.name)).toEqual(
      expect.arrayContaining(["floor.scale[x]", "walls.scale[y]", "roof.position[y]", "office.scale[y]", "reveal.position[x]", "reveal.position[y]", "reveal.position[z]"]),
    );
  });

  it("na začátku je vše skryto a střecha visí nad stavbou, na konci je vše dokončeno", () => {
    const { at } = play();
    const start = at(0);
    expect(start.floor).toBeLessThan(0.01);
    expect(start.walls).toBeLessThan(0.01);
    expect(start.roofDrop).toBeCloseTo(CONSTRUCTION.roofDropM);
    expect(start.furnish).toBe(0);
    expect(start.env).toBe(0);
    expect(start.ground).toBe(0);
    expect(start.columns).toBe(0);
    expect(start.beams).toBe(0);
    expect(start.roofReveal).toBe(0);
    const end = at(CONSTRUCTION_DURATION);
    expect(end).toMatchObject({ floor: 1, walls: 1, roofDrop: 0, roofReveal: 1, columns: 1, beams: 1, office: 1, furnish: 1, env: 1, ground: 1 });
  });

  it("nosná konstrukce stojí před opláštěním; komunikace a auta se odhalí až po střeše", () => {
    const { at } = play();
    const c = CONSTRUCTION;
    const columnsMid = at(c.columnsStart + c.columnsDur / 2);
    expect(columnsMid.columns).toBeCloseTo(0.5);
    expect(columnsMid.beams).toBe(0);
    expect(columnsMid.walls).toBeLessThan(0.01);
    const beamsMid = at(c.beamsStart + c.beamsDur / 2);
    expect(beamsMid.columns).toBeCloseTo(1);
    expect(beamsMid.beams).toBeCloseTo(0.5);
    expect(beamsMid.roofReveal).toBe(0);
    expect(at(c.wallsStart + 0.05).floor).toBeGreaterThan(0.5); // základ už stojí, stěny začínají
    const mid = at(c.wallsStart + c.wallsDur / 2);
    expect(mid.columns).toBe(1);
    expect(mid.beams).toBe(1);
    expect(mid.walls).toBeGreaterThan(0.2);
    expect(mid.walls).toBeLessThan(0.8);
    expect(mid.roofDrop).toBeCloseTo(c.roofDropM); // střecha ještě visí
    const roofMid = at(c.roofStart + c.roofDur / 2);
    expect(roofMid.roofDrop).toBeGreaterThan(0);
    expect(roofMid.roofDrop).toBeLessThan(c.roofDropM);
    expect(at(c.roofStart).furnish).toBe(0); // vybavení až po střeše
    const furn = at(c.furnishStart + c.furnishDur / 2);
    expect(furn.furnish).toBeGreaterThan(0.3);
    expect(furn.furnish).toBeLessThan(0.7);
    expect(furn.env).toBe(0);
    expect(furn.ground).toBeGreaterThan(0);
    const roadReady = at(c.furnishStart + c.furnishDur + 0.7);
    expect(roadReady.ground).toBeCloseTo(1);
    expect(roadReady.env).toBeLessThan(1);
  });

  it("průběhy jsou monotónní a Bézierovy křivky mají tvar zpomalení (out) a pomalého rozjezdu i dojezdu (inOut)", () => {
    const { at } = play();
    const c = CONSTRUCTION;
    let prevWalls = -1;
    let prevRoof = Infinity;
    for (let t = 0; t <= CONSTRUCTION_DURATION; t += 0.05) {
      const v = at(t);
      expect(v.walls).toBeGreaterThanOrEqual(prevWalls - 1e-9);
      expect(v.roofDrop).toBeLessThanOrEqual(prevRoof + 1e-9);
      prevWalls = v.walls;
      prevRoof = v.roofDrop;
    }
    // out: ve čtvrtině trvání je už víc než čtvrtina cesty (rychlý start, zpomalení)
    expect(at(c.floorStart + c.floorDur * 0.25).floor).toBeGreaterThan(0.4);
    // inOut: ve čtvrtině trvání je méně než čtvrtina cesty (pomalý rozjezd), v polovině zhruba polovina
    expect(at(c.wallsStart + c.wallsDur * 0.25).walls).toBeLessThan(0.25);
    expect(at(c.wallsStart + c.wallsDur * 0.5).walls).toBeCloseTo(0.5, 1);
  });

  it("přeskočení (action.time) a znovupřehrání (reset) fungují a konec vyvolá událost finished", () => {
    const { mixer, action, at, rig } = play();
    let finished = 0;
    mixer.addEventListener("finished", () => finished++);
    at(1);
    expect(rig.walls.scale.y).toBeLessThan(1);
    mixer.update(CONSTRUCTION_DURATION); // doběhne na konec
    expect(finished).toBe(1);
    expect(rig.walls.scale.y).toBe(1); // clampWhenFinished drží poslední pozici
    action.reset().play();
    mixer.update(0.01);
    expect(rig.walls.scale.y).toBeLessThan(0.1); // znovu od začátku
    mixer.stopAllAction();
    mixer.uncacheRoot(rig.root);
  });
});
