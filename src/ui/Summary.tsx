"use client";
import { computeQuantities } from "@/configurator/calculations/quantities";
import { useConfigStore } from "@/configurator/state/config-store";
import { fmtM, fmtM2, fmtNum } from "./format";
import { Plan2D } from "./Plan2D";

/** Lidsky čitelný souhrn konfigurace. Funguje i bez 3D (text + půdorys). Číselné hodnoty jsou odvozené, ne zadané. */
export function Summary({ withPlan = false }: { withPlan?: boolean }) {
  const catalog = useConfigStore((s) => s.catalog);
  const config = useConfigStore((s) => s.config);
  const q = computeQuantities(config);
  const product = catalog.products.find((p) => p.product_id === config.productId);

  const rows: Array<[string, string]> = [
    ["Koncept", product?.name_cs ?? config.productId],
    ["Tvar půdorysu", config.dimensions.shape === "L" ? `L, výřez ${fmtNum(config.dimensions.notchLengthM)} × ${fmtNum(config.dimensions.notchWidthM)} m` : "obdélník"],
    ["Rozměry obálky (D × Š)", `${fmtNum(q.lengthM)} × ${fmtNum(q.widthM)} m`],
    ["Světlá / celková výška", `${fmtM(q.clearHeightM)} / ${fmtM(q.totalHeightM)}`],
    ["Zastavěná plocha", fmtM2(q.footprintAreaM2)],
    ...(config.office.enabled
      ? ([
          ["Administrativa (podlahová plocha)", `${fmtM2(q.officeFloorAreaM2)} na ${config.office.floors} podl.`],
          ["Celková podlahová plocha", fmtM2(q.totalFloorAreaM2)],
        ] as Array<[string, string]>)
      : []),
    ["Nakládací doky", `${q.dockCount} ks`],
    ["Vjezdová vrata", `${q.driveInCount} ks`],
    ...(config.office.enabled ? ([["Okna administrativy", `${q.officeWindowCount} ks · ${fmtM2(q.officeWindowAreaM2)}`]] as Array<[string, string]>) : []),
    ["Prosvětlení haly", config.daylight === "both" ? "Střešní světlíky + fasádní okna" : config.daylight === "facade" ? "Fasádní okna" : "Střešní světlíky"],
    ...(q.hallWindowCount > 0 ? ([["Okna haly", `${q.hallWindowCount} ks · ${fmtM2(q.hallWindowAreaM2)}`]] as Array<[string, string]>) : []),
    ["Opláštění (čistá plocha)", fmtM2(q.netFacadeAreaM2)],
    ["Střecha bez světlíků", fmtM2(q.roofAreaM2)],
    ["Světlíky", fmtM2(q.skylightAreaM2)],
  ];

  return (
    <section aria-labelledby="summary-h" className="grid gap-3">
      <h2 id="summary-h" className="text-[17px]">
        Souhrn konfigurace
      </h2>
      {withPlan && (
        <div className="aspect-[16/10] w-full rounded-lg border border-line bg-surface p-2">
          <Plan2D config={config} />
        </div>
      )}
      <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="col-span-2 grid grid-cols-subgrid border-b border-line pb-1.5">
            <dt className="text-muted">{k}</dt>
            <dd className="num m-0 text-right font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="field-hint m-0">Plochy a množství jsou odvozené ze zadaných rozměrů. Ilustrační regály a vybavení nezaručují skladovací ani výrobní kapacitu.</p>
    </section>
  );
}
