/**
 * Prezentační stav: režim, pohled kamery, den/večer, otevřené sekce, zvýraznění.
 * Záměrně oddělený od konfigurace (spec kap. 8): nic z toho se neukládá do produktové konfigurace ani do ceny.
 */
import { create } from "zustand";
import type { ViewPreset } from "@/scene/camera";

export type Mode = "build" | "preview";
export type SectionId = "concept" | "dimensions" | "openings" | "office" | "shell" | "fixtures" | "roof" | "technology" | "layout";
export type HighlightId = "dimensions" | "docks" | "driveIns" | "office" | null;

export const CONFIG_STEPS = [
  { section: "concept", label: "Využití", title: "Jaký prostor potřebujete?", description: "Vyberte výchozí koncept. V dalších krocích ho přizpůsobíte svému provozu." },
  { section: "dimensions", label: "Velikost", title: "Dejte svým plánům prostor.", description: "Upravte rozměry a sledujte, jak se vaše hala mění." },
  { section: "openings", label: "Logistika", title: "Plynulý pohyb zboží.", description: "Zvolte počet nakládacích doků a přímých vjezdů do haly." },
  { section: "office", label: "Zázemí", title: "Místo pro váš tým.", description: "Doplňte halu o kanceláře a zázemí pro zaměstnance." },
  { section: "shell", label: "Vybavení", title: "Detaily, které rozhodují.", description: "Vyberte materiály a technologie pro svůj způsob provozu." },
] as const;

function stepForSection(section: SectionId): number {
  const step = CONFIG_STEPS.findIndex((s) => s.section === section);
  return step < 0 ? 4 : step;
}

interface UiState {
  step: number;
  setStep: (step: number) => void;
  siteVisible: boolean;
  setSiteVisible: (visible: boolean) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  viewPreset: ViewPreset;
  /** Zvýšením se kamera znovu nastaví na pohled i tehdy, když je preset stejný (např. "Výchozí pohled"). */
  viewNonce: number;
  setViewPreset: (v: ViewPreset) => void;
  resetView: () => void;
  night: boolean;
  setNight: (v: boolean) => void;
  roofExploded: boolean;
  setRoofExploded: (v: boolean) => void;
  roofHidden: boolean;
  setRoofHidden: (v: boolean) => void;
  showDimensions: boolean;
  setShowDimensions: (v: boolean) => void;
  openSection: SectionId | null;
  setOpenSection: (s: SectionId | null) => void;
  highlight: HighlightId;
  setHighlight: (h: HighlightId) => void;
  /** Mobil: 3D ovládání povoleno (jinak jednoprstový tah posouvá stránku). */
  touchRotate: boolean;
  setTouchRotate: (v: boolean) => void;
  /** Živé prostředí: doprava a plynoucí mraky. */
  live: boolean;
  setLive: (v: boolean) => void;
  /** Přehrává se stavba haly (jde přeskočit). */
  constructing: boolean;
  setConstructing: (v: boolean) => void;
  /** Příkaz režiséru stavby: přeskočit nebo přehrát znovu (n zajistí, že se stejný příkaz opakuje). */
  buildCommand: { kind: "skip" | "replay"; n: number } | null;
  requestBuild: (kind: "skip" | "replay") => void;
}

export const useUiStore = create<UiState>((set) => ({
  step: 0,
  setStep: (requested) => {
    const step = Math.max(0, Math.min(CONFIG_STEPS.length - 1, Math.round(requested)));
    set({ step, openSection: CONFIG_STEPS[step]!.section, highlight: null });
  },
  siteVisible: false,
  setSiteVisible: (siteVisible) => set({ siteVisible }),
  mode: "build",
  setMode: (mode) => set({ mode }),
  viewPreset: "perspective",
  viewNonce: 0,
  setViewPreset: (viewPreset) => set((s) => ({ viewPreset, viewNonce: s.viewNonce + 1 })),
  resetView: () => set((s) => ({ viewPreset: "perspective", viewNonce: s.viewNonce + 1 })),
  night: false,
  setNight: (night) => set({ night }),
  roofExploded: false,
  setRoofExploded: (roofExploded) => set({ roofExploded }),
  roofHidden: false,
  setRoofHidden: (roofHidden) => set({ roofHidden }),
  showDimensions: false,
  setShowDimensions: (showDimensions) => set({ showDimensions }),
  openSection: "concept",
  setOpenSection: (openSection) => set((s) => ({ openSection, step: openSection ? stepForSection(openSection) : s.step })),
  highlight: null,
  setHighlight: (highlight) => set({ highlight }),
  touchRotate: false,
  setTouchRotate: (touchRotate) => set({ touchRotate }),
  live: true,
  setLive: (live) => set({ live }),
  constructing: false,
  setConstructing: (constructing) => set({ constructing }),
  buildCommand: null,
  requestBuild: (kind) => set((s) => ({ buildCommand: { kind, n: (s.buildCommand?.n ?? 0) + 1 } })),
}));
