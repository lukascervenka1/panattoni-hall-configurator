"use client";
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import type { HallConfig } from "@/configurator/schema/config";
import { useUiStore } from "@/configurator/state/ui-store";
import { CONSTRUCTION, clamp01, displayConfig, easeOut, isSettled, stepSceneValues, valuesOf, type BuildValues } from "./build";
import { CONSTRUCTION_DURATION, createConstructionClip, createRig } from "./constructionClip";

export interface BuildAnim {
  reducedMotion: boolean;
  /** Platná zobrazená konfigurace; doky a vrata přibývají po jednom. */
  shown: HallConfig;
  /** Mutovatelné hodnoty čtené v useFrame (bez překreslování Reactu). */
  state: MutableRefObject<{ floor: number; walls: number; roofDrop: number; roofReveal: number; officePop: number; ground: number }>;
  /** Pokrok vyrůstání vybavení haly (sloupy, regály, svítidla) a okolí (stromy, auta, stožáry). */
  furnish: MutableRefObject<number>;
  env: MutableRefObject<number>;
  columns: MutableRefObject<number>;
  beams: MutableRefObject<number>;
  operationTime: MutableRefObject<number>;
  /** Probíhá animace: stínová mapa se musí přepočítávat každý snímek. */
  busy: MutableRefObject<boolean>;
}

/**
 * Režisér stavby. Tři situace:
 * 1. První načtení, změna konceptu nebo interní příkaz k opakování: přehraje se klip stavby (`AnimationMixer`,
 *    viz constructionClip.ts): základ → sloupy → vazníky → opláštění → střecha → vybavení. Lze ji přeskočit.
 * 2. Změna rozměrů nebo výbavy: rozměry se přestaví jednou, doky a vrata přibývají po jednom,
 *    vybavení a okolí zůstávají viditelné.
 * 3. `reducedMotion`: žádné přechody, vše okamžitě v cílovém stavu.
 * Čas se po zásekách ořezává (dt ≤ 50 ms), aby se animace při kompilaci shaderů nepřeskočila.
 */
export function useBuildAnimation(target: HallConfig, reducedMotion: boolean): BuildAnim {
  const invalidate = useThree((s) => s.invalidate);
  const cur = useRef<BuildValues>(valuesOf(target));
  const tgtVals = useRef<BuildValues>(valuesOf(target));
  const targetRef = useRef(target);
  const replaying = useRef(false);
  const productId = useRef(target.productId);
  const officeSig = useRef("");
  const officeClock = useRef(1);
  const acc = useRef(0);
  const shownKey = useRef("");
  const busyRef = useRef(true);
  const furnish = useRef(reducedMotion ? 1 : 0);
  const env = useRef(reducedMotion ? 1 : 0);
  const columns = useRef(reducedMotion ? 1 : 0);
  const beams = useRef(reducedMotion ? 1 : 0);
  const operationTime = useRef(0);
  const state = useRef({ floor: reducedMotion ? 1 : 0, walls: reducedMotion ? 1 : 0, roofDrop: reducedMotion ? 0 : CONSTRUCTION.roofDropM, roofReveal: reducedMotion ? 1 : 0, officePop: reducedMotion ? 1 : 0, ground: reducedMotion ? 1 : 0 });
  const [shown, setShown] = useState<HallConfig>(() => displayConfig(target, valuesOf(target)));

  // Klip stavby a mixer (skill threejs-animation): rig se animuje, hodnoty se po každé aktualizaci přečtou.
  const rig = useMemo(() => createRig(), []);
  const mixer = useMemo(() => new THREE.AnimationMixer(rig.root), [rig]);
  const clip = useMemo(() => createConstructionClip(), []);
  // Akce se při každém spuštění bere znovu: po `uncacheRoot` (úklid efektu v StrictMode / hot reloadu) by uložená akce
  // byla neplatná ("_cacheIndex" undefined). `clipAction` ji po úklidu vytvoří znovu a jinak vrací stejnou.
  const getAction = () => {
    const a = mixer.clipAction(clip);
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true; // po skončení drží poslední pozici
    return a;
  };

  const finalize = () => {
    replaying.current = false;
    state.current = { floor: 1, walls: 1, roofDrop: 0, roofReveal: 1, officePop: 1, ground: 1 };
    furnish.current = 1;
    env.current = 1;
    columns.current = 1;
    beams.current = 1;
    if (useUiStore.getState().constructing) useUiStore.getState().setConstructing(false);
  };
  const start = () => {
    replaying.current = true;
    operationTime.current = 0;
    furnish.current = 0;
    env.current = 1;
    columns.current = 0;
    beams.current = 0;
    getAction().reset().play();
    mixer.update(0);
    useUiStore.getState().setConstructing(true);
  };
  // Události mixeru, příkazy z rozhraní (přeskočit / přehrát znovu) a úklid vazeb.
  useEffect(() => {
    const onFinished = () => finalize();
    mixer.addEventListener("finished", onFinished);
    const unsub = useUiStore.subscribe((st, prev) => {
      if (st.buildCommand === prev.buildCommand || !st.buildCommand) return;
      if (st.buildCommand.kind === "skip" && replaying.current) {
        mixer.update(CONSTRUCTION_DURATION + 1); // přeskočení na konec: vyvolá "finished"
      } else if (st.buildCommand.kind === "replay" && !reducedMotion) {
        start();
        invalidate();
      }
    });
    if (reducedMotion) finalize();
    else start();
    return () => {
      mixer.removeEventListener("finished", onFinished);
      unsub();
      mixer.stopAllAction();
      mixer.uncacheRoot(rig.root); // uvolní vazby vytvořené pro rig
      if (useUiStore.getState().constructing) useUiStore.getState().setConstructing(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mixer, reducedMotion]);

  // Cíl se aktualizuje přímo při renderu (levné); logika běží ve useFrame.
  targetRef.current = target;
  tgtVals.current = valuesOf(target);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    if (!reducedMotion && useUiStore.getState().live && env.current >= 0.95) operationTime.current += Math.min(delta, 0.1);
    const tg = targetRef.current;
    const tv = tgtVals.current;

    // Změna konceptu = nový projekt: přehrát stavbu od začátku bez doběhu rozměrů.
    if (tg.productId !== productId.current) {
      productId.current = tg.productId;
      cur.current = { ...tv };
      if (!reducedMotion) start();
    }

    if (reducedMotion) {
      cur.current = { ...tv };
      replaying.current = false;
      furnish.current = 1;
      env.current = 1;
      columns.current = 1;
      beams.current = 1;
      state.current = { floor: 1, walls: 1, roofDrop: 0, roofReveal: 1, officePop: 1, ground: 1 };
    } else {
      cur.current = stepSceneValues(cur.current, tv, dt);
    }
    const settled = isSettled(cur.current, tv);

    // Zobrazená konfigurace: zapisujeme do Reactu nejvýš ~22× za sekundu a jen při změně.
    acc.current += dt;
    const candidate = displayConfig(tg, cur.current);
    const key = JSON.stringify(candidate);
    if (key !== shownKey.current && (acc.current > 0.045 || settled)) {
      shownKey.current = key;
      acc.current = 0;
      setShown(candidate);
    }

    if (replaying.current) {
      mixer.update(dt);
      const st = state.current;
      st.floor = rig.floor.scale.x;
      st.walls = rig.walls.scale.y;
      st.roofDrop = rig.roof.position.y;
      st.roofReveal = rig.roof.scale.x;
      columns.current = clamp01(rig.frame.position.x);
      beams.current = clamp01(rig.frame.position.y);
      st.officePop = rig.office.scale.y;
      st.ground = rig.reveal.position.z;
      furnish.current = clamp01(rig.reveal.position.x);
      env.current = clamp01(rig.reveal.position.y);
      officeSig.current = `${candidate.office.enabled}|${candidate.office.floors}`;
    } else if (!reducedMotion) {
      // Keep the context stable while dimensions change; only the requested geometry moves.
      furnish.current = 1;
      env.current = 1;
      columns.current = 1;
      beams.current = 1;
      // Administrativa: při zapnutí nebo změně počtu podlaží "vyroste" (měřítko po výšce).
      const os = `${candidate.office.enabled}|${candidate.office.floors}`;
      if (os !== officeSig.current) {
        officeSig.current = os;
        officeClock.current = 0;
      }
      if (officeClock.current < 0.8) officeClock.current += dt;
      state.current.officePop = easeOut(officeClock.current / 0.8);
    }

    const busy =
      replaying.current ||
      !settled ||
      furnish.current < 1 ||
      env.current < 1 ||
      state.current.officePop < 1 ||
      key !== shownKey.current;
    busyRef.current = busy;
    if (busy) invalidate();
  });

  return { reducedMotion, shown, state, furnish, env, columns, beams, operationTime, busy: busyRef };
}
