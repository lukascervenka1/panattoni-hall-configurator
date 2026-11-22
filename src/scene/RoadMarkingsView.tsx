"use client";
import { useMemo } from "react";
import { Instanced } from "./Instanced";
import type { Rect, SurroundingsLayout } from "./layout";
import { layoutRoadMarkings } from "./roadMarkings";

export function RoadMarkings({ layout, road, night, serviceEnabled = true }: { layout: SurroundingsLayout; road: Rect; night: boolean; serviceEnabled?: boolean }) {
  const markings = useMemo(() => layoutRoadMarkings(layout, road, serviceEnabled), [layout, road, serviceEnabled]);
  return <Instanced items={markings} color={night ? "#b4bdb7" : "#f4f5ee"} roughness={0.9}><boxGeometry /></Instanced>;
}
