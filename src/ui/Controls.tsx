"use client";
import { maxDockCount, maxDriveInCount, maxOfficeFloors, notchLimits, notchOf, officeAreaLimits } from "@/configurator/calculations/layout";
import { DEMO_GEOMETRY as G } from "@/configurator/calculations/constants";
import { ruleRange } from "@/configurator/rules/validate";
import { configForOfficeFloors } from "@/configurator/rules/office";
import { useConfigStore } from "@/configurator/state/config-store";
import { useUiStore } from "@/configurator/state/ui-store";
import { computeQuantities } from "@/configurator/calculations/quantities";
import { fmtM, fmtM2, fmtNum } from "./format";
import { ParameterField } from "./ParameterField";
import { Section } from "./Section";

/* ------------------------------------------------------------------ koncept */

function MiniHall({ ratio }: { ratio: number }) {
  const w = 56;
  const h = Math.max(14, Math.min(34, w / ratio));
  return (
    <svg width={64} height={40} viewBox="0 0 64 40" aria-hidden="true" className="text-accent">
      <rect x={4} y={40 - h - 4} width={w} height={h} fill="none" stroke="currentColor" strokeWidth={2} />
      <rect x={4} y={40 - h - 4} width={14} height={h * 0.55} fill="currentColor" opacity={0.25} />
    </svg>
  );
}

export function ConceptSection({ embedded = false }: { embedded?: boolean }) {
  const catalog = useConfigStore((s) => s.catalog);
  const productId = useConfigStore((s) => s.config.productId);
  const setProduct = useConfigStore((s) => s.setProduct);
  const current = catalog.products.find((p) => p.product_id === productId);

  return (
    <Section id="concept" title="Koncept" summary={current?.name_cs} embedded={embedded}>
      <div role="radiogroup" aria-label="Koncept haly" className="grid gap-2.5">
        {catalog.products.map((p) => {
          const preset = (id: string) => Number(catalog.presets.find((r) => r.preset_id === p.preset_id && r.parameter_id === id)?.value ?? 0);
          const L = preset("length_m");
          const W = preset("width_m");
          return (
            <button
              key={p.product_id}
              type="button"
              role="radio"
              aria-checked={p.product_id === productId}
              className="choice grid-cols-[auto_1fr] items-center gap-x-3"
              onClick={() => p.product_id !== productId && setProduct(p.product_id)}
            >
              <MiniHall ratio={L / Math.max(W, 1)} />
              <span className="grid gap-0.5">
                <span className="font-semibold">{p.name_cs}</span>
                <span className="text-[13px] text-muted">{p.description_cs}</span>
                <span className="num text-[13px] text-muted">
                  Výchozí {fmtNum(L)} × {fmtNum(W)} m
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="field-hint m-0">Změna konceptu nastaví nové výchozí rozměry a vybavení.</p>
    </Section>
  );
}

/* ------------------------------------------------------------------ tvar půdorysu */

function ShapeIcon({ kind }: { kind: "rect" | "L" }) {
  return (
    <svg width={56} height={36} viewBox="0 0 56 36" aria-hidden="true" className="text-accent">
      {kind === "rect" ? (
        <rect x={4} y={6} width={48} height={24} fill="currentColor" fillOpacity={0.12} stroke="currentColor" strokeWidth={2} />
      ) : (
        <path d="M4 6 H52 V18 H34 V30 H4 Z" fill="currentColor" fillOpacity={0.12} stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ rozměry */

export function DimensionsSection({ embedded = false }: { embedded?: boolean }) {
  const catalog = useConfigStore((s) => s.catalog);
  const config = useConfigStore((s) => s.config);
  const set = useConfigStore((s) => s.setParameter);
  const d = config.dimensions;
  const q = computeQuantities(config);
  const r = (id: "length_m" | "width_m" | "clear_height_m") => ruleRange(catalog, config.productId, id);
  const L = r("length_m");
  const W = r("width_m");
  const H = r("clear_height_m");
  const lim = notchLimits({ ...d, shape: "L" });
  const { nx, nz } = notchOf(d);
  const nl = ruleRange(catalog, config.productId, "notch_length_m");
  const nw = ruleRange(catalog, config.productId, "notch_width_m");
  const setHighlight = useUiStore((s) => s.setHighlight);

  return (
    <Section id="dimensions" title="Rozměry" summary={`${d.shape === "L" ? "L · " : ""}${fmtNum(d.lengthM)} × ${fmtNum(d.widthM)} × ${fmtNum(d.clearHeightM, 1)} m`} embedded={embedded}>
      <div className="field" onPointerEnter={() => setHighlight("dimensions")} onPointerLeave={() => setHighlight(null)}>
        <span id="shape-label" className="field-label">
          Tvar půdorysu
        </span>
        <div role="radiogroup" aria-labelledby="shape-label" className="grid grid-cols-2 gap-2.5">
          {(["rect", "L"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={d.shape === k}
              disabled={k === "L" && !lim.available}
              className="choice justify-items-start disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => d.shape !== k && set("shape", k)}
            >
              <ShapeIcon kind={k} />
              <span className="font-semibold">{k === "rect" ? "Obdélník" : "Tvar L"}</span>
              <span className="text-[13px] text-muted">{k === "rect" ? "Jednoduchá hala" : "Výřez v rohu, vzniká dvorek"}</span>
            </button>
          ))}
        </div>
        {!lim.available && <p className="field-hint m-0">Pro tvar L musí být hala dost velká: ramena po výřezu zůstanou nejméně 24 m široká.</p>}
      </div>
      <ParameterField label="Délka haly" unit="m" value={d.lengthM} min={L.min ?? 24} max={L.max ?? 300} step={L.step ?? 6} onChange={(v) => set("length_m", v)} highlight="dimensions" />
      <ParameterField label="Šířka haly" unit="m" value={d.widthM} min={W.min ?? 24} max={W.max ?? 150} step={W.step ?? 6} onChange={(v) => set("width_m", v)} highlight="dimensions" />
      <ParameterField label="Světlá výška" unit="m" decimals={1} value={d.clearHeightM} min={H.min ?? 6} max={H.max ?? 14} step={H.step ?? 0.5} onChange={(v) => set("clear_height_m", v)} highlight="dimensions" />
      {d.shape === "L" && (
        <>
          <ParameterField
            label="Délka výřezu"
            unit="m"
            value={nx}
            min={Math.max(nl.min ?? lim.minM, lim.minM)}
            max={Math.min(nl.max ?? lim.maxLengthM, lim.maxLengthM)}
            step={nl.step ?? 6}
            onChange={(v) => set("notch_length_m", v)}
            highlight="dimensions"
            hint="Výřez v pravém předním rohu podél délky haly. Ramena zůstanou nejméně 24 m široká."
          />
          <ParameterField
            label="Šířka výřezu"
            unit="m"
            value={nz}
            min={Math.max(nw.min ?? lim.minM, lim.minM)}
            max={Math.min(nw.max ?? lim.maxWidthM, lim.maxWidthM)}
            step={nw.step ?? 6}
            onChange={(v) => set("notch_width_m", v)}
            highlight="dimensions"
            hint="Výřez v pravém předním rohu napříč halou."
          />
        </>
      )}
      <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-lg bg-surface-2 p-3 text-sm">
        <dt className="text-muted">Celková výška</dt>
        <dd className="num m-0 font-semibold">{fmtM(q.totalHeightM)}</dd>
        <dt className="text-muted">Zastavěná plocha</dt>
        <dd className="num m-0 font-semibold">{fmtM2(q.footprintAreaM2)}</dd>
      </dl>
      <p className="field-hint m-0">
        {d.shape === "L" ? "Zastavěná plocha je plocha obdélníku bez výřezu. " : ""}Celková výška = světlá výška + {fmtNum(G.roofStructureAllowanceM, 1)} m (střešní skladba a atika). Jde o zjednodušený převod, ne o statický návrh.
      </p>
    </Section>
  );
}

/* ------------------------------------------------------------------ otvory */

export function OpeningsSection({ embedded = false }: { embedded?: boolean }) {
  const config = useConfigStore((s) => s.config);
  const set = useConfigStore((s) => s.setParameter);
  const { dockCount, driveInCount } = config.openings;
  const maxDocks = maxDockCount(config.dimensions);
  const maxDrive = maxDriveInCount(config.dimensions);

  return (
    <Section id="openings" title="Vrata a nakládací doky" summary={`${dockCount} doků · ${driveInCount} vjezdových vrat`} embedded={embedded}>
      <ParameterField
        label="Nakládací doky"
        unit="ks"
        value={dockCount}
        min={0}
        max={maxDocks}
        step={1}
        onChange={(v) => { const ui = useUiStore.getState(); ui.setRoofHidden(false); if (ui.viewPreset !== "rear") ui.setViewPreset("rear"); set("dock_count", v); }}
        highlight="docks"
        hint={`Na zadní fasádu se vejde nejvýše ${maxDocks} doků (vrata ${G.dock.widthM} × ${G.dock.heightM} m, rozteč nejméně ${fmtNum(G.dock.minPitchM, 1)} m).`}
      />
      <ParameterField
        label="Vjezdová vrata"
        unit="ks"
        value={driveInCount}
        min={0}
        max={maxDrive}
        step={1}
        onChange={(v) => { const ui = useUiStore.getState(); ui.setRoofHidden(false); if (ui.viewPreset !== "right") ui.setViewPreset("right"); set("drive_in_count", v); }}
        highlight="driveIns"
        hint={`Na boční fasádu se vejde nejvýše ${maxDrive} vrat (${G.driveIn.widthM} × ${G.driveIn.heightM} m).`}
      />
      <p className="field-hint m-0">Počet vrat je omezen délkou fasády. Otvory se rozmísťují automaticky a nikdy se nepřekrývají.</p>
    </Section>
  );
}

/* ------------------------------------------------------------------ administrativa */

export function OfficeSection({ embedded = false }: { embedded?: boolean }) {
  const catalog = useConfigStore((s) => s.catalog);
  const config = useConfigStore((s) => s.config);
  const set = useConfigStore((s) => s.setParameter);
  const setOfficeFloors = useConfigStore((s) => s.setOfficeFloors);
  const setHighlight = useUiStore((s) => s.setHighlight);
  const o = config.office;
  const maxFloors = maxOfficeFloors(config.dimensions.clearHeightM);
  const threeFloorHeight = 3 * G.office.floorHeightM + G.office.headroomM;
  const floorChoices = ([1, 2, 3] as const).map((floors) => ({
    floors, config: configForOfficeFloors(config, catalog, floors),
  }));
  const canRaiseForThree = floorChoices[2]!.config !== null;
  const lim = officeAreaLimits(config.dimensions, o.floors);
  const required = catalog.rules.find(
    (r) => r.product_id === config.productId && r.parameter_id === "office_enabled" && r.rule_type === "required" && r.value === "true",
  );
  const fits = lim.maxM2 >= lim.minM2 && maxFloors > 0;
  const q = computeQuantities(config);

  return (
    <Section id="office" title="Administrativa" summary={o.enabled ? `${fmtM2(o.areaM2)} · ${o.floors} podlaží` : "Bez administrativy"} embedded={embedded}>
      <div className="flex items-center justify-between gap-4" onPointerEnter={() => setHighlight("office")} onPointerLeave={() => setHighlight(null)}>
        <span id="office-switch-label" className="field-label">
          Administrativní vestavba
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={o.enabled}
          aria-labelledby="office-switch-label"
          disabled={Boolean(required) || !fits}
          className="btn btn-sm min-w-[5.5rem]"
          onClick={() => set("office_enabled", !o.enabled)}
        >
          {o.enabled ? "Zapnuto" : "Vypnuto"}
        </button>
      </div>
      {required && <p className="field-hint m-0">{required.message_cs}</p>}
      {!fits && <p className="field-hint m-0">Do haly o těchto rozměrech se administrativa nevejde.</p>}
      {o.enabled && (
        <>
          <ParameterField
            label="Plocha administrativy celkem"
            unit="m²"
            value={o.areaM2}
            min={lim.minM2}
            max={lim.maxM2}
            step={10}
            onChange={(v) => set("office_area_m2", v)}
            highlight="office"
            hint={`Součet podlaží. Pro tuto halu ${fmtNum(lim.minM2)} až ${fmtNum(lim.maxM2)} m².`}
          />
          <div className="field">
            <span id="floors-label" className="field-label">
              Počet podlaží administrativy
            </span>
            <div className="seg w-fit" role="radiogroup" aria-labelledby="floors-label">
              {floorChoices.map(({ floors, config: choice }) => (
                <button key={floors} type="button" role="radio" aria-checked={o.floors === floors} disabled={!choice}
                  title={choice && choice.dimensions.clearHeightM > config.dimensions.clearHeightM
                    ? `Zvýší světlou výšku haly na ${fmtNum(choice.dimensions.clearHeightM)} m`
                    : !choice ? "Výška tohoto konceptu neumožňuje zvolený počet podlaží." : undefined}
                  onClick={() => setOfficeFloors(floors)}>
                  {floors}
                </button>
              ))}
            </div>
            <p className="field-hint m-0">
              {maxFloors < 3
                ? canRaiseForThree
                  ? `Volbou 3 podlaží se světlá výška haly automaticky zvýší na ${fmtNum(floorChoices[2]!.config!.dimensions.clearHeightM)} m.`
                  : `Tři podlaží vyžadují světlou výšku nejméně ${fmtNum(threeFloorHeight, 1)} m. Tento koncept umožňuje nejvýše dvě podlaží administrativy.`
                : "Počítáme přízemí a dvě patra. Administrativa zůstává vestavbou uvnitř haly."}
            </p>
          </div>
          <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-lg bg-surface-2 p-3 text-sm">
            <dt className="text-muted">Půdorys jednoho podlaží</dt>
            <dd className="num m-0 font-semibold">{fmtM2(q.officeFootprintM2)}</dd>
            <dt className="text-muted">Okna administrativy</dt>
            <dd className="num m-0 font-semibold">{q.officeWindowCount} ks</dd>
          </dl>
          <p className="field-hint m-0">Přízemí administrativy je už součástí zastavěné plochy haly a nepočítá se podruhé.</p>
        </>
      )}
    </Section>
  );
}
