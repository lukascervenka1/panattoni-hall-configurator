/**
 * Záznam poptávky pro CRM: kontakt, zájem, souhlas, konfigurace a SERVEROVĚ přepočtená orientační cena.
 * Vzniká jen na serveru; nic z ceny, co by poslal klient, se nepřebírá.
 */
import type { Catalog } from "@/catalog/schema";
import { computeQuantities } from "@/configurator/calculations/quantities";
import type { HallConfig } from "@/configurator/schema/config";
import type { PriceResult } from "@/pricing/calculate";
import { formatMoney } from "@/pricing/money";
import { INTENT_LABEL_CS, type InquiryInput, type InquiryIntent } from "./schema";

export interface InquiryRecord {
  /** = submissionId z klienta; klíč idempotence. */
  id: string;
  source: "konfigurator-hal";
  receivedAt: string;
  intent: InquiryIntent;
  contact: { company: string; name: string; email: string; phone?: string };
  note?: string;
  consent: { accepted: true; textVersion: string; at: string };
  /** Demo katalog: poptávka vychází z ukázkových cen a parametrů, nikoli z nabídky. */
  catalog: { id: string; label: string; isDemo: boolean };
  config: HallConfig;
  price: {
    currency: string;
    vat: "excluded";
    subtotalCents: number;
    /** false = dílčí součet; celková cena vyžaduje individuální kalkulaci. */
    isComplete: boolean;
    incompleteReasons: string[];
    lines: Array<{ category: string; option: string; status: "priced" | "individual"; amountCents: number | null }>;
  };
  /** Lidsky čitelný souhrn konfigurace (česky) pro obchodníka v CRM. */
  summaryLines: string[];
}

const fmt = (n: number, digits = 0) => n.toLocaleString("cs-CZ", { maximumFractionDigits: digits });

/** Souhrn pro obchodníka: rozměry, otvory, administrativa a vybrané volby podle názvů z katalogu. */
export function summarizeConfig(config: HallConfig, catalog: Catalog): string[] {
  const q = computeQuantities(config);
  const product = catalog.products.find((p) => p.product_id === config.productId);
  const lines = [
    `Koncept: ${product?.name_cs ?? config.productId}`,
    `Rozměry obálky: ${fmt(q.lengthM)} × ${fmt(q.widthM)} m, světlá výška ${fmt(q.clearHeightM, 1)} m, zastavěná plocha ${fmt(q.footprintAreaM2)} m²`,
    config.dimensions.shape === "L" ? `Půdorys L, výřez ${fmt(config.dimensions.notchLengthM)} × ${fmt(config.dimensions.notchWidthM)} m` : "Půdorys obdélník",
    `Nakládací doky: ${q.dockCount} ks, vjezdová vrata: ${q.driveInCount} ks`,
    `Prosvětlení haly: ${config.daylight === "both" ? "střešní světlíky + fasádní okna" : config.daylight === "facade" ? "fasádní okna" : "střešní světlíky"}`,
    config.office.enabled ? `Administrativa: ${fmt(config.office.areaM2)} m² na ${config.office.floors} podl.` : "Bez administrativy",
  ];
  for (const [categoryId, optionId] of Object.entries(config.selections)) {
    const category = catalog.categories.find((c) => c.category_id === categoryId);
    const option = catalog.options.find((o) => o.option_id === optionId);
    if (category && option) lines.push(`${category.name_cs}: ${option.name_cs}`);
  }
  return lines;
}

export function buildInquiryRecord(input: InquiryInput, catalog: Catalog, price: PriceResult, now: Date): InquiryRecord {
  const at = now.toISOString();
  return {
    id: input.submissionId,
    source: "konfigurator-hal",
    receivedAt: at,
    intent: input.intent,
    contact: { ...input.contact },
    ...(input.note ? { note: input.note } : {}),
    consent: { accepted: true, textVersion: input.consent.textVersion, at },
    catalog: { id: price.catalogVersion.id, label: price.catalogVersion.label, isDemo: price.catalogVersion.isDemo },
    config: input.config,
    price: {
      currency: price.currency,
      vat: price.vat,
      subtotalCents: price.subtotalCents,
      isComplete: price.isComplete,
      incompleteReasons: price.incompleteReasons,
      lines: price.lines.map((l) => ({ category: l.categoryName, option: l.optionName, status: l.status, amountCents: l.amountCents })),
    },
    summaryLines: summarizeConfig(input.config, catalog),
  };
}

/** Text pro pole popisu v CRM: zájem, poznámka, souhrn a cena s výhradami. Neobsahuje nic, co zákazník nezadal nebo neviděl. */
export function describeInquiry(record: InquiryRecord): string {
  const price = record.price;
  const parts = [
    `Zájem: ${INTENT_LABEL_CS[record.intent]}`,
    ...(record.note ? [`Poznámka zákazníka: ${record.note}`] : []),
    "",
    "Konfigurace:",
    ...record.summaryLines.map((l) => `- ${l}`),
    "",
    `${price.isComplete ? "Orientační cena realizace" : "Dílčí součet (orientační)"}: ${formatMoney(price.subtotalCents, price.currency)} bez DPH`,
    ...(price.isComplete ? [] : ["Celková cena vyžaduje individuální kalkulaci."]),
    ...(record.catalog.isDemo ? [`POZOR: ${record.catalog.label}. Ceny a parametry nejsou schválené, nejde o nabídku.`] : []),
    "",
    `Zdroj: ${record.source}, katalog ${record.catalog.id}, poptávka ${record.id}`,
    `Souhlas se zpracováním osobních údajů: znění ${record.consent.textVersion}, ${record.consent.at}`,
  ];
  return parts.join("\n");
}
