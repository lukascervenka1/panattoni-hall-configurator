"use client";
import { useMemo } from "react";
import { Billboard, Line, Text } from "@react-three/drei";
import { notchOf, totalHeightM } from "@/configurator/calculations/layout";
import type { HallConfig } from "@/configurator/schema/config";
import { boundingRadius } from "./layout";

const FONT = "/fonts/bai-jamjuree-600.woff";
type P = [number, number, number];

function Dim({ a, b, label, color, outline, size }: { a: P; b: P; label: string; color: string; outline: string; size: number }) {
  const mid: P = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + size * 0.9, (a[2] + b[2]) / 2];
  return (
    <group>
      <Line points={[a, b]} color={color} lineWidth={2.2} depthTest={false} renderOrder={20} />
      <Billboard position={mid}>
        <Text
          font={FONT}
          characters="0123456789,. m×/"
          fontSize={size}
          color={color}
          outlineWidth={size * 0.12}
          outlineColor={outline}
          anchorX="center"
          anchorY="middle"
          renderOrder={21}
          material-depthTest={false}
        >
          {label}
        </Text>
      </Billboard>
    </group>
  );
}

const fmt = (n: number) => n.toLocaleString("cs-CZ", { maximumFractionDigits: 1 });

/** Kóty délky, šířky a výšek nad okrajem střechy, aby nekolidovaly s okolím. Čísla odpovídají konfiguraci. */
export function Dimensions3D({ config, night }: { config: HallConfig; night: boolean }) {
  const { lengthM: L, widthM: W, clearHeightM: C } = config.dimensions;
  const H = totalHeightM(C);
  const size = useMemo(() => Math.max(1.4, boundingRadius(config) * 0.05), [config]);
  const color = night ? "#e8edf5" : "#26292c";
  const outline = night ? "#0d1a33" : "#ffffff";
  const { nx, nz } = notchOf(config.dimensions);
  const y = H + size * 1.8;
  const o = size * 2.2; // odsazení kót od rohů
  return (
    <group>
      <Dim a={[-L / 2, y, W / 2 + o]} b={[L / 2, y, W / 2 + o]} label={`${fmt(L)} m`} color={color} outline={outline} size={size} />
      {nx > 0 && nz > 0 && (
        <>
          <Dim a={[L / 2 - nx, y, W / 2 - nz + o]} b={[L / 2, y, W / 2 - nz + o]} label={`${fmt(nx)} m`} color={color} outline={outline} size={size * 0.85} />
          <Dim a={[L / 2 - nx - o, y, W / 2 - nz]} b={[L / 2 - nx - o, y, W / 2]} label={`${fmt(nz)} m`} color={color} outline={outline} size={size * 0.85} />
        </>
      )}
      <Dim a={[L / 2 + o, y, W / 2]} b={[L / 2 + o, y, -W / 2]} label={`${fmt(W)} m`} color={color} outline={outline} size={size} />
      <Dim a={[-L / 2 - o, 0, W / 2 + o]} b={[-L / 2 - o, H, W / 2 + o]} label={`${fmt(H)} m`} color={color} outline={outline} size={size} />
      <Dim a={[-L / 2 - o * 1.9, 0, W / 2 + o]} b={[-L / 2 - o * 1.9, C, W / 2 + o]} label={`${fmt(C)} m`} color={color} outline={outline} size={size * 0.85} />
    </group>
  );
}
