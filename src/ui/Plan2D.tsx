"use client";
import { useMemo } from "react";
import { footprintPolygon, notchOf, officeLayout, placeOpenings } from "@/configurator/calculations/layout";
import type { HallConfig } from "@/configurator/schema/config";
import { layoutSkylights } from "@/scene/layout";
import { fmtNum } from "./format";

/**
 * 2D půdorys ze stejných čistých funkcí jako 3D model. Slouží jako náhradní zobrazení, když 3D není dostupné
 * (nepodporované WebGL, ztráta kontextu), a je plnohodnotným textovým i grafickým souhrnem bez 3D.
 * Zadní fasáda (doky) je nahoře, přední (administrativa) dole.
 */
export function Plan2D({ config }: { config: HallConfig }) {
  const { lengthM: L, widthM: W } = config.dimensions;
  const pad = Math.max(L, W) * 0.1;
  const office = officeLayout(config);
  const opens = useMemo(() => placeOpenings(config), [config]);
  const sky = useMemo(() => layoutSkylights(config), [config]);
  const { nx, nz } = notchOf(config.dimensions);
  const outline = footprintPolygon(config.dimensions).map(([x, z]) => `${x},${z}`).join(" ");
  const stroke = Math.max(L, W) / 400;
  const font = Math.max(L, W) / 32;

  // Světové souřadnice (x, z) → SVG (x, z): z roste dolů, takže přední fasáda (+z) je dole.
  const doorPos = (facade: string, u: number): [number, number] => {
    switch (facade) {
      case "front":
        return [-L / 2 + u, W / 2];
      case "rear":
        return [L / 2 - u, -W / 2];
      case "left":
        return [-L / 2, -W / 2 + u];
      case "notchA":
        return [L / 2 - nx + u, W / 2 - nz];
      case "notchB":
        return [L / 2 - nx, W / 2 - u];
      default:
        return [L / 2, W / 2 - nz - u];
    }
  };

  return (
    <svg
      viewBox={`${-L / 2 - pad} ${-W / 2 - pad * 1.6} ${L + pad * 2} ${W + pad * 3.2}`}
      role="img"
      aria-label={`Půdorys haly ${fmtNum(L)} × ${fmtNum(W)} m`}
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <polygon points={outline} fill="var(--surface)" stroke="var(--text)" strokeWidth={stroke * 2.2} strokeLinejoin="round" />
      {sky.map((p, i) => (
        <rect key={i} x={p.x - p.widthM / 2} y={p.z - p.depthM / 2} width={p.widthM} height={p.depthM} fill="var(--accent-soft)" stroke="var(--muted)" strokeWidth={stroke * 0.6} />
      ))}
      {office && (
        <rect x={office.x0} y={office.z0} width={office.widthM} height={office.depthM} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth={stroke * 1.4} />
      )}
      {opens.map((o) => {
        const [x, z] = doorPos(o.facade, o.centerU);
        const horizontal = o.facade === "front" || o.facade === "rear" || o.facade === "notchA";
        const w = o.widthM;
        const t = Math.max(0.9, stroke * 3.2);
        const fill = o.kind === "window" || o.kind === "hallWindow" ? "var(--muted)" : "var(--accent)";
        return <rect key={o.id} x={horizontal ? x - w / 2 : x - t / 2} y={horizontal ? z - t / 2 : z - w / 2} width={horizontal ? w : t} height={horizontal ? t : w} fill={fill} />;
      })}
      <text x={0} y={-W / 2 - pad * 0.45} textAnchor="middle" fontSize={font} fill="var(--muted)">
        zadní fasáda · nakládací doky
      </text>
      <text x={0} y={W / 2 + pad * 0.9} textAnchor="middle" fontSize={font} fill="var(--muted)">
        přední fasáda · administrativa
      </text>
      <text x={0} y={font * 0.35} textAnchor="middle" fontSize={font * 1.3} fontWeight={600} fill="var(--text)">
        {fmtNum(L)} × {fmtNum(W)} m
      </text>
    </svg>
  );
}
