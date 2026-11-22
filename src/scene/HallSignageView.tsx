"use client";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { HallConfig } from "@/configurator/schema/config";
import { DEMO_GEOMETRY } from "@/configurator/calculations/constants";
import { facadeMatrix } from "./geometry";
import { buildHallSignGeometry, layoutHallSigns, SIGNAGE, type HallSign } from "./hallSignage";

function RaisedSign({ sign, config }: { sign: HallSign; config: HallConfig }) {
  const geometry = useMemo(() => buildHallSignGeometry(sign.widthM), [sign.widthM]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const matrix = useMemo(() => facadeMatrix(config.dimensions, sign.facade).multiply(new THREE.Matrix4().makeTranslation(sign.centerU, sign.centerY, DEMO_GEOMETRY.wallThicknessM + SIGNAGE.standoffM)), [config.dimensions, sign]);
  return <group matrix={matrix} matrixAutoUpdate={false}>
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial attach="material-0" color="#001844" roughness={0.44} metalness={0.24} />
      <meshStandardMaterial attach="material-1" color="#001031" roughness={0.54} metalness={0.2} />
    </mesh>
  </group>;
}

/** Inherits wall construction and section clipping. Only the original letters and emblem are extruded. */
export function HallSignage({ config }: { config: HallConfig }) {
  const signature = JSON.stringify([config.dimensions, config.openings, config.office, config.daylight]);
  const signs = useMemo(() => layoutHallSigns(config), [signature]); // eslint-disable-line react-hooks/exhaustive-deps
  return <group>{signs.map((sign) => <RaisedSign key={sign.facade} sign={sign} config={config} />)}</group>;
}
