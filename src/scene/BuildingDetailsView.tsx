"use client";
import { useEffect, useMemo } from "react";
import type { HallConfig } from "@/configurator/schema/config";
import { buildBuildingDetails } from "./buildingDetails";

export function BuildingDetails({ config, night }: { config: HallConfig; night: boolean }) {
  const signature = JSON.stringify([config.dimensions, config.office, config.openings, config.daylight]);
  const geometry = useMemo(() => buildBuildingDetails(config), [signature]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => Object.values(geometry).forEach((g) => g?.dispose()), [geometry]);
  const colors = { metal: "#3f4d58", lens: "#eee8d6", pots: "#d5d6cc", soil: "#655f52", green: "#8c9f80", mat: "#5b6262" };
  return <group>{Object.entries(geometry).map(([key, g]) => g && <mesh key={key} geometry={g} castShadow={key === "pots"} receiveShadow>
    <meshStandardMaterial color={colors[key as keyof typeof colors]} roughness={key === "lens" ? 0.4 : 0.8} metalness={key === "metal" ? 0.35 : 0} emissive={key === "lens" ? "#ffe6b5" : "#000000"} emissiveIntensity={night ? 1.1 : 0.08} />
  </mesh>)}</group>;
}
