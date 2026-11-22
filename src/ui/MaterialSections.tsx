"use client";
import { useMemo } from "react";
import type { CatalogOption } from "@/catalog/schema";
import type { CategoryId } from "@/catalog/ids";
import { lowestCarbonOptionIds } from "@/catalog/carbon";
import { validateConfig, rulesForProduct } from "@/configurator/rules/validate";
import { withParameter } from "@/configurator/schema/config";
import { useConfigStore } from "@/configurator/state/config-store";
import { useUiStore, type HighlightId, type SectionId } from "@/configurator/state/ui-store";
import { effectOf } from "@/scene/options";
import { IconChevron } from "./icons";

/** Skupiny kategorií v panelu. Technologie a dispozice nemají v demo seedu ceny (viz docs/ASSUMPTIONS.md). */
const GROUPS: Array<{ id: SectionId; label: string; title: string; description: string; categories: CategoryId[] }> = [
  { id: "shell", label: "Konstrukce", title: "Konstrukce a plášť", description: "Zvolte vzhled fasády, nosnou konstrukci a podlahu.", categories: ["cladding", "structure", "floor"] },
  { id: "roof", label: "Střecha", title: "Střecha a energie", description: "Nastavte denní světlo, skladbu střechy a fotovoltaiku.", categories: ["roof", "skylight", "photovoltaics"] },
  { id: "fixtures", label: "Vrata a okna", title: "Vrata a okna", description: "Vyberte provedení nakládacích doků, vjezdů a oken.", categories: ["dock", "drive_in", "window"] },
  { id: "technology", label: "Technologie", title: "Vytápění a osvětlení", description: "Doplňte technické vybavení haly a kanceláří.", categories: ["heating_hall", "heating_office", "lighting"] },
  { id: "layout", label: "Dispozice", title: "Vnitřní uspořádání", description: "Přizpůsobte členění prostoru svému provozu.", categories: ["partition"] },
];

export function MaterialNavigation() {
  const section = useUiStore((s) => s.openSection);
  const setSection = useUiStore((s) => s.setOpenSection);
  const active = Math.max(0, GROUPS.findIndex((group) => group.id === section));
  return <div className="equipment-navigation">
    <div className="equipment-location"><span>Vybavení haly</span><span>Část {active + 1} z {GROUPS.length}</span></div>
    <div className="equipment-tabs" role="tablist" aria-label="Části vybavení">
      {GROUPS.map((group, index) => <button key={group.id} type="button" role="tab"
        id={`equipment-tab-${group.id}`} aria-controls={`equipment-panel-${group.id}`} aria-selected={index === active}
        tabIndex={index === active ? 0 : -1} onClick={() => setSection(group.id)}
        onKeyDown={(event) => {
          const next = event.key === "Home" ? 0 : event.key === "End" ? GROUPS.length - 1
            : ["ArrowRight", "ArrowDown"].includes(event.key) ? (index + 1) % GROUPS.length
            : ["ArrowLeft", "ArrowUp"].includes(event.key) ? (index + GROUPS.length - 1) % GROUPS.length : null;
          if (next === null) return;
          event.preventDefault();
          setSection(GROUPS[next]!.id);
          event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
        }}><span aria-hidden="true">{index + 1}</span>{group.label}</button>)}
    </div>
  </div>;
}

const HIGHLIGHT: Partial<Record<CategoryId, HighlightId>> = { dock: "docks", drive_in: "driveIns" };

function LowCarbonBadge({ gwp, compact = false }: { gwp: number; compact?: boolean }) {
  const description = `Nejnižší uvedené GWP A1–A3 mezi dostupnými variantami této kategorie: ${gwp.toLocaleString("cs-CZ")} kg CO₂e na jednotku.`;
  return <span className={`carbon-badge${compact ? " carbon-badge-compact" : ""}`} title={description}>
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20.8 3.2c.7 5.5-.6 11.2-5.1 14-3.7 2.2-7.4 1.4-9.3-1.1-2-2.7-1.5-6.4 1.6-8.7 3.5-2.6 7.6-1.3 12.8-4.2Z" fill="currentColor" opacity=".22" /><path d="M20.8 3.2c.7 5.5-.6 11.2-5.1 14-3.7 2.2-7.4 1.4-9.3-1.1-2-2.7-1.5-6.4 1.6-8.7 3.5-2.6 7.6-1.3 12.8-4.2ZM4 21c1.6-5 5.8-8.7 11-11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
    <span className={compact ? "sr-only" : undefined}>Nejnižší uhlíková stopa</span>
  </span>;
}

function Thumb({ option }: { option: CatalogOption }) {
  const { image, image_fit } = option.details;
  return (
    <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-md border border-line bg-white">
      {image ? (
        // Fotografie výrobce (demo seed); před veřejným použitím je nutné ověřit licenci.
        <img src={image} alt="" loading="lazy" className="size-full" style={{ objectFit: image_fit ?? "contain" }} />
      ) : (
        <span className="text-xs text-muted" aria-hidden="true">
          bez fota
        </span>
      )}
    </span>
  );
}

function Detail({ option }: { option: CatalogOption }) {
  const d = option.details;
  const rows: Array<[string, string | null]> = [
    ["Dodavatel", d.supplier],
    ["Tloušťka / rozměr", d.thickness],
    ["Součinitel U", d.u_value && d.u_value !== "—" ? d.u_value : null],
    ["Hmotnost", d.mass],
    ["Životnost", d.service_life],
    ["Požární třída", d.fire],
    ["GWP A1–A3", d.gwp_kg_co2e !== null ? `${d.gwp_kg_co2e.toLocaleString("cs-CZ")} kg CO₂e na jednotku` : null],
  ];
  const shown = rows.filter(([, v]) => v);
  if (shown.length === 0 && !d.note_cs && !d.epd_url) return null;
  return (
    <details className="text-sm">
      <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Detail</summary>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {shown.map(([k, v]) => (
          <div key={k} className="col-span-2 grid grid-cols-subgrid">
            <dt className="text-muted">{k}</dt>
            <dd className="num m-0 text-right">{v}</dd>
          </div>
        ))}
      </dl>
      {d.note_cs && <p className="mb-1 mt-2 text-[13px] text-muted">{d.note_cs}</p>}
      {d.epd_url && (
        <a className="inline-flex min-h-11 items-center underline" href={d.epd_url} target="_blank" rel="noopener noreferrer">
          Zdroj EPD (nový panel)
        </a>
      )}
    </details>
  );
}

function CategoryBlock({ categoryId, initiallyOpen = false }: { categoryId: CategoryId; initiallyOpen?: boolean }) {
  const catalog = useConfigStore((s) => s.catalog);
  const config = useConfigStore((s) => s.config);
  const set = useConfigStore((s) => s.setParameter);
  const ui = useUiStore();
  const category = catalog.categories.find((c) => c.category_id === categoryId)!;
  const options = catalog.options.filter((o) => o.category_id === categoryId);
  const current = config.selections[categoryId];
  const selectedOption = options.find((option) => option.option_id === current);

  // Volba je zakázaná, je-li pro koncept nedostupná, nebo by vyrobila zakázanou kombinaci. Důvod bere z pravidla katalogu.
  const blocked = useMemo(() => {
    const out = new Map<string, string>();
    for (const o of options) {
      if (o.option_id === current) continue;
      const issues = validateConfig(withParameter(config, categoryId, o.option_id), catalog).issues.filter(
        (i) => i.code === "option_unavailable" || i.code === "forbidden_combination",
      );
      if (issues.length === 0) continue;
      const rule = rulesForProduct(catalog, config.productId).find((r) => r.rule_type === "available_for_concept" && r.parameter_id === categoryId);
      out.set(o.option_id, issues.find((i) => i.code === "forbidden_combination")?.message_cs ?? rule?.message_cs ?? issues[0]!.message_cs);
    }
    return out;
  }, [catalog, config, categoryId, current, options]);
  const lowestCarbon = lowestCarbonOptionIds(options, categoryId, new Set(blocked.keys()));

  const show = (view: "interior" | "top" | "perspective") => {
    ui.setRoofHidden(false);
    ui.setViewPreset(view);
  };
  const hi = HIGHLIGHT[categoryId];

  return (
    <details className="equipment-category" name="equipment-category" open={initiallyOpen} onPointerEnter={() => hi && ui.setHighlight(hi)} onPointerLeave={() => hi && ui.setHighlight(null)}>
      <summary><span><span id={`cat-${categoryId}`} className="equipment-category-title">{category.name_cs}</span>
        <span className="equipment-selection">{selectedOption?.name_cs ?? "Vyberte variantu"}{selectedOption && lowestCarbon.has(current) && <LowCarbonBadge gwp={selectedOption.details.gwp_kg_co2e!} compact />}</span></span><span className="equipment-chevron"><IconChevron open={false} /></span></summary>
      <div className="equipment-category-body">
      <div role="radiogroup" aria-labelledby={`cat-${categoryId}`} className="grid gap-2">
        {options.map((o) => {
          const selected = o.option_id === current;
          const reason = blocked.get(o.option_id);
          const effect = effectOf(o);
          return (
            <div key={o.option_id} className={`choice !p-2.5 ${reason ? "opacity-60" : ""}`} data-selected={selected}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                aria-describedby={selected || reason ? `${o.option_id}-fx` : undefined}
                disabled={Boolean(reason)}
                className="flex min-h-11 w-full items-center gap-3 bg-transparent p-0 text-left text-inherit [font:inherit] enabled:cursor-pointer disabled:cursor-not-allowed"
                onClick={() => {
                  if (!selected) set(categoryId, o.option_id);
                  // Během úvodní stavby by změna ve střeše nebo v interiéru zůstala skrytá, dokud stavba nedoběhne: dokončí se hned.
                  if (ui.constructing) ui.requestBuild("skip");
                  if (["roof", "skylight", "photovoltaics"].includes(categoryId)) {
                    ui.setRoofHidden(false); ui.setRoofExploded(false);
                    ui.setViewPreset(o.material_key === "roof-v4" ? "interior" : "roof");
                  } else if (categoryId === "partition") {
                    // Příčky nejlépe ukáže pohled bez střechy: z interiéru splývají s bílou halou a změna polohy není znát.
                    ui.setRoofExploded(false);
                    ui.setRoofHidden(true);
                    if (ui.viewPreset === "interior") ui.setViewPreset("perspective");
                  } else if (!selected && effect.visible && effect.view === "interior" && ui.viewPreset !== "interior") {
                    // Příčky, vazníky, vytápění a osvětlení zvenku nejsou vidět: kamera se přesune dovnitř, ať změna není "bez reakce".
                    ui.setRoofHidden(false); ui.setRoofExploded(false);
                    ui.setViewPreset("interior");
                  }
                }}
              >
                <Thumb option={o} />
                <span className="grid min-w-0 gap-0.5">
                  <span className="font-semibold">
                    {o.name_cs}
                    {o.details.is_standard && <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 text-xs font-semibold text-muted">Standard</span>}
                  </span>
                  {lowestCarbon.has(o.option_id) && <LowCarbonBadge gwp={o.details.gwp_kg_co2e!} />}
                  <span className="text-[13px] text-muted">{o.details.type_cs ?? o.description_cs}</span>
                  {o.details.supplier && <span className="text-[13px] text-muted">{o.details.supplier}</span>}
                </span>
              </button>
              {reason ? (
                <p id={`${o.option_id}-fx`} className="mb-0 mt-1.5 text-[13px] text-[color:var(--warn-text)]">
                  Nedostupné: {reason}
                </p>
              ) : selected ? (
                <p id={`${o.option_id}-fx`} className="mb-0 mt-1.5 text-[13px] text-muted">
                  <strong className="font-semibold">{effect.visible ? "Viditelná změna." : "Bez změny vzhledu."}</strong> {effect.text_cs}
                </p>
              ) : null}
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3">
                <Detail option={o} />
                {selected && !reason && effect.view && (
                  <button type="button" className="btn btn-sm" onClick={() => show(effect.view!)}>
                    Ukázat v modelu
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {lowestCarbon.size > 0 && <p className="carbon-comparison-note">Lísteček označuje nejnižší uvedené GWP A1–A3 mezi dostupnými variantami v této kategorii.</p>}
      <details className="equipment-category-help"><summary>O kategorii: {category.name_cs.toLocaleLowerCase("cs-CZ")}</summary><p className="field-hint m-0">{category.description_cs}</p></details>
      </div>
    </details>
  );
}

export function MaterialSections() {
  const daylight = useConfigStore((s) => s.config.daylight);
  const section = useUiStore((s) => s.openSection);
  const setSection = useUiStore((s) => s.setOpenSection);
  const index = Math.max(0, GROUPS.findIndex((group) => group.id === section));
  const group = GROUPS[index]!;
  return (
    <section key={group.id} id={`equipment-panel-${group.id}`} role="tabpanel" aria-labelledby={`equipment-tab-${group.id}`} tabIndex={0} className="equipment-panel">
          <div className="equipment-heading"><h2>{group.title}</h2><p>{group.description}</p></div>
          {group.id === "roof" && <details className="equipment-category" name="equipment-category" open>
            <summary><span><span className="equipment-category-title">Denní světlo</span><span className="equipment-selection">{daylight === "roof" ? "Střešní světlíky" : daylight === "facade" ? "Fasádní okna" : "Světlíky + fasádní okna"}</span></span><span className="equipment-chevron"><IconChevron open={false} /></span></summary>
            <div className="equipment-category-body"><DaylightOptions /></div>
          </details>}
          {group.categories.filter((c) => c !== "skylight" || daylight !== "facade").map((c, i) => (
            <CategoryBlock key={c} categoryId={c} initiallyOpen={group.id !== "roof" && i === 0} />
          ))}
          {group.id === "roof" && <details className="equipment-model-views"><summary>Prohlédnout střechu v modelu</summary><RoofViews /></details>}
          {(group.id === "technology" || group.id === "roof") && (
            <p className="field-hint m-0">
              Technologie ukazujeme jen ilustračně. Nejde o výpočet spotřeby, výroby energie ani úspor. Cena alternativ vyžaduje individuální kalkulaci.
            </p>
          )}
          {index < GROUPS.length - 1 && <button type="button" className="btn equipment-next-part" onClick={() => setSection(GROUPS[index + 1]!.id)}>Další část: {GROUPS[index + 1]!.label}<span aria-hidden="true">→</span></button>}
    </section>
  );
}

function DaylightOptions() {
  const config = useConfigStore((s) => s.config);
  const set = useConfigStore((s) => s.setParameter);
  const ui = useUiStore();
  const choices = [
    { id: "roof", title: "Střešní světlíky", hint: "Denní světlo přes střechu haly." },
    { id: "facade", title: "Fasádní okna", hint: "Horní pás oken ve stěnách, střecha bez světlíků." },
    { id: "both", title: "Světlíky + fasádní okna", hint: "Denní světlo přes střechu i horní pás oken ve stěnách." },
  ] as const;
  return <div className="grid gap-2">
    <h3 id="daylight-label" className="text-[15px]">Denní světlo v hale</h3>
    <div role="radiogroup" aria-labelledby="daylight-label" className="grid gap-2">
      {choices.map((choice) => <button key={choice.id} type="button" role="radio" aria-checked={config.daylight === choice.id}
        className="choice flex items-center gap-3 text-left" data-selected={config.daylight === choice.id}
        onClick={() => {
          set("daylight", choice.id);
          if (ui.constructing) ui.requestBuild("skip");
          ui.setRoofHidden(false); ui.setRoofExploded(false);
          ui.setViewPreset(choice.id === "roof" ? "roof" : "perspective");
        }}>
        <svg viewBox="0 0 48 36" width="48" height="36" className="shrink-0 text-muted" aria-hidden="true">
          <path d="M5 13 20 5 43 11 29 20ZM5 13v15l24 5V20m0 13 14-9V11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          {choice.id !== "facade" && <path d="m17 11 5-2 13 3-5 3Z" fill="currentColor" opacity=".6" />}
          {choice.id !== "roof" && <path d="m9 17 16 4v4L9 21Zm24 3 7-4v4l-7 4Z" fill="currentColor" opacity=".6" />}
        </svg>
        <span className="grid gap-0.5"><span className="font-semibold">{choice.title}</span><span className="text-[13px] text-muted">{choice.hint}</span></span>
      </button>)}
    </div>
    <p className="field-hint m-0">Okna administrativy zůstávají ve všech variantách. Provedení oken a světlíků volíte samostatně. Rozmístění nenahrazuje posouzení denního osvětlení.</p>
  </div>;
}

function RoofViews() {
  const ui = useUiStore();
  return <div className="grid gap-3">
    <p className="field-hint m-0">Prohlédněte si krytinu, nosnou konstrukci a rozmístění technologií. Rozložení je prezentační pohled.</p>
    <div className="grid grid-cols-1 gap-2">
      <button type="button" className="btn" aria-pressed={!ui.roofHidden && !ui.roofExploded && ui.viewPreset === "roof"} onClick={() => { ui.setRoofHidden(false); ui.setRoofExploded(false); ui.setViewPreset("roof"); }}>Střecha z nadhledu</button>
      <button type="button" className="btn" aria-pressed={ui.roofHidden} onClick={() => { ui.setRoofExploded(false); ui.setRoofHidden(true); ui.setViewPreset("roof"); }}>Odkrýt konstrukci</button>
      <button type="button" className="btn" aria-pressed={ui.roofExploded} onClick={() => { ui.setRoofHidden(false); ui.setRoofExploded(!ui.roofExploded); ui.setViewPreset("roof"); }}>Nadzvednout střechu</button>
    </div>
  </div>;
}
