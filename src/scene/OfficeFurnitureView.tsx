"use client";
import { useMemo, type MutableRefObject } from "react";
import type { HallConfig } from "@/configurator/schema/config";
import { Instanced } from "./Instanced";
import { layoutOfficeFurniture, type FurnitureFinish } from "./officeFurniture";

const FINISHES: Record<FurnitureFinish, string> = {
  wood: "#d6c4a7", frame: "#35444c", upholstery: "#6c7c81", screen: "#8fb6c6",
  storage: "#e7e9e3", paper: "#f6f5ef", pots: "#bfc5ba", leaves: "#81927b", carpet: "#adb7b5",
};

export function OfficeFurniture({ config, reveal }: { config: HallConfig; reveal: MutableRefObject<number> }) {
  const key = JSON.stringify([config.dimensions, config.office]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const furniture = useMemo(() => layoutOfficeFurniture(config), [key]);
  return <group>{(Object.keys(FINISHES) as FurnitureFinish[]).map((finish) =>
    <Instanced key={finish} items={furniture[finish]} color={FINISHES[finish]} reveal={reveal} roughness={finish === "screen" ? 0.35 : 0.8} emissive={finish === "screen" ? "#8fb6c6" : undefined} emissiveIntensity={0.2}>
      {finish === "leaves" ? <icosahedronGeometry args={[0.5, 1]} /> : finish === "pots" ? <cylinderGeometry args={[0.5, 0.38, 1, 8]} /> : <boxGeometry args={[1, 1, 1]} />}
    </Instanced>
  )}</group>;
}
