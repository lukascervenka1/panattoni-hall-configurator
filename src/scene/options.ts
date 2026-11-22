/**
 * Mapování voleb katalogu na vzhled modelu. Čistá logika bez Three.js.
 *
 * Excel (katalog) určuje, KTERÁ varianta je vybrána a její `material_key`; renderer zná jen předem implementované
 * vzhledy (spec kap. 9: nový typ geometrie vyžaduje vývoj). Každá volba má buď viditelný dopad, nebo
 * srozumitelné vysvětlení, proč se na modelu nemění (spec kap. 6 a 18).
 */
import type { PublicCatalog } from "@/catalog/public";
import type { HallConfig } from "@/configurator/schema/config";

export type ViewHint = "perspective" | "top" | "interior" | null;

export interface Effect {
  visible: boolean;
  /** Věta pro zákazníka: co se na modelu změní, nebo proč nic. */
  text_cs: string;
  /** Pohled kamery, ve kterém je změna vidět (tlačítko "Ukázat"). */
  view: ViewHint;
}

export interface SceneLook {
  claddingColor: string;
  structure: { columnColor: string; columnSize: number; girder: "precast" | "glulam" | "steel"; girderColor: string };
  floor: { tint: string; roughness: number; jointless: boolean };
  roof: { membraneTint: string; undersideColor: string; timber: boolean };
  dock: { doorColor: string; house: boolean };
  driveIn: { doorColor: string; thermal: boolean };
  skylight: { tint: string; opacity: number };
  window: { frameColor: string; glassTint: string };
  heatingHall: "std" | "warm_air" | "radiant";
  heatingOffice: "std" | "heat_pump";
  lighting: "std" | "sensors";
  pvShare: 0 | 0.3 | 0.6;
  partitions: 0 | 1 | 2;
}

export const DEFAULT_LOOK: SceneLook = {
  claddingColor: "#a7b0bd",
  structure: { columnColor: "#aeb5bf", columnSize: 0.6, girder: "precast", girderColor: "#b9bec6" },
  floor: { tint: "#a8acb1", roughness: 0.38, jointless: false },
  roof: { membraneTint: "#cfd4d9", undersideColor: "#c3c8ce", timber: false },
  dock: { doorColor: "#27499a", house: false },
  driveIn: { doorColor: "#2b4f9f", thermal: false },
  skylight: { tint: "#8dc0e0", opacity: 0.82 },
  window: { frameColor: "#0f1c3b", glassTint: "#6c8cb0" },
  heatingHall: "std",
  heatingOffice: "std",
  lighting: "std",
  pvShare: 0,
  partitions: 0,
};

type Patch = (look: SceneLook) => void;

/** Změny vzhledu podle `material_key`. Klíče bez záznamu nemění nic (standardní vzhled). */
const LOOKS: Record<string, Patch> = {
  "structure-p2": (l) => void (l.structure.columnSize = 0.5),
  "structure-p3": (l) => void (l.structure.columnSize = 0.5),
  "structure-tim": (l) => void ((l.structure.girder = "glulam"), (l.structure.girderColor = "#b98a55")),
  "structure-stl": (l) => void ((l.structure.girder = "steel"), (l.structure.girderColor = "#7d8794")),
  "floor-heavy": (l) => void ((l.floor.tint = "#8d9197"), (l.floor.roughness = 0.45)),
  "floor-v2": (l) => void (l.floor.jointless = true),
  "roof-v2": (l) => void (l.roof.membraneTint = "#d9dde0"),
  "roof-v3": (l) => void (l.roof.membraneTint = "#eceef0"),
  "roof-v4": (l) => void ((l.roof.timber = true), (l.roof.undersideColor = "#b98a55")),
  "dock-assa": (l) => void (l.dock.doorColor = "#1f3f86"),
  "dock-vw": (l) => void ((l.dock.house = true), (l.dock.doorColor = "#2f5aa6")),
  "drive_in-t67": (l) => void ((l.driveIn.thermal = true), (l.driveIn.doorColor = "#1e3d80")),
  "skylight-vario": (l) => void ((l.skylight.tint = "#a7d1ea"), (l.skylight.opacity = 0.7)),
  "skylight-top90": (l) => void ((l.skylight.tint = "#b4d9ef"), (l.skylight.opacity = 0.6)),
  "window-circal": (l) => void ((l.window.frameColor = "#2f3a35"), (l.window.glassTint = "#86aab3")),
  "heating_hall-warm_air": (l) => void (l.heatingHall = "warm_air"),
  "heating_hall-radiant": (l) => void (l.heatingHall = "radiant"),
  "heating_office-heat_pump": (l) => void (l.heatingOffice = "heat_pump"),
  "lighting-sensors": (l) => void (l.lighting = "sensors"),
  "photovoltaics-p30": (l) => void (l.pvShare = 0.3),
  "photovoltaics-p60": (l) => void (l.pvShare = 0.6),
  "partition-split2": (l) => void (l.partitions = 1),
  "partition-split3": (l) => void (l.partitions = 2),
};

export function resolveLook(selections: HallConfig["selections"], catalog: Pick<PublicCatalog, "options">): SceneLook {
  const look: SceneLook = structuredClone(DEFAULT_LOOK);
  for (const optionId of Object.values(selections)) {
    const option = catalog.options.find((o) => o.option_id === optionId);
    if (!option) continue;
    if (option.category_id === "cladding" && option.color_hex) look.claddingColor = option.color_hex;
    LOOKS[option.material_key]?.(look);
  }
  return look;
}

const EFFECTS: Record<string, Effect> = {
  "cladding-": { visible: true, text_cs: "Mění barvu a vzhled fasády.", view: "perspective" },
  "structure-base": { visible: false, text_cs: "Standardní prefabrikovaný skelet je v interiéru vidět jako sloupy a vazníky.", view: "interior" },
  "structure-p1": { visible: false, text_cs: "Vzhled se nemění: jde o záměnu materiálu betonu a oceli. Mění cenu a uhlíkovou stopu.", view: null },
  "structure-p2": { visible: true, text_cs: "Štíhlejší sloupy; uvidíte je v interiéru.", view: "interior" },
  "structure-p3": { visible: true, text_cs: "Štíhlejší sloupy; uvidíte je v interiéru.", view: "interior" },
  "structure-tim": { visible: true, text_cs: "Dřevěné lepené vazníky pod střechou; uvidíte je v interiéru.", view: "interior" },
  "structure-stl": { visible: true, text_cs: "Ocelové příhradové vazníky pod střechou; uvidíte je v interiéru.", view: "interior" },
  "floor-pnt": { visible: false, text_cs: "Podlaha se v modelu nemění; je vidět v interiéru jako pole 6 × 6 m.", view: "interior" },
  "floor-heavy": { visible: true, text_cs: "Tmavší povrch podlahy; změna je vidět v interiéru. Mění únosnost.", view: "interior" },
  "floor-v1": { visible: false, text_cs: "Vzhled se nemění: jde o složení betonu. Mění cenu a uhlíkovou stopu.", view: null },
  "floor-v2": { visible: true, text_cs: "Bezesporá podlaha: v interiéru zmizí pole 6 × 6 m.", view: "interior" },
  "floor-v3": { visible: false, text_cs: "Vzhled se nemění: jde o tenčí desku a jiný beton. Mění cenu a uhlíkovou stopu.", view: null },
  "roof-pnt": { visible: false, text_cs: "Standardní skladba střechy; vzhled shora ani zdola se nemění.", view: null },
  "roof-v1": { visible: false, text_cs: "Vzhled se nemění: jde o nízkouhlíkový plech. Mění cenu a uhlíkovou stopu.", view: null },
  "roof-v2": { visible: true, text_cs: "Jemně světlejší střešní plocha. Mění izolaci a hmotnost.", view: "top" },
  "roof-v3": { visible: true, text_cs: "Světlá střešní fólie TPO.", view: "top" },
  "roof-v4": { visible: true, text_cs: "Dřevěné střešní prvky: uvidíte je v interiéru jako dřevěný strop.", view: "interior" },
  "dock-pnt": { visible: false, text_cs: "Standardní nakládací doky se zárubní a nárazníky.", view: "perspective" },
  "dock-assa": { visible: true, text_cs: "Tmavší odstín modrých vrat; teleskopická rampa není zvenku vidět.", view: "perspective" },
  "dock-vw": { visible: true, text_cs: "Externí nakládací domy: doky vystupují před fasádu.", view: "perspective" },
  "drive_in-pnt": { visible: false, text_cs: "Standardní vjezdová vrata 4 × 5 m.", view: "perspective" },
  "drive_in-t67": { visible: true, text_cs: "Tmavší modrá izolovaná vrata; hlavní přínos (nižší tepelné ztráty) není vidět.", view: "perspective" },
  "skylight-pnt": { visible: false, text_cs: "Standardní světlíky; vzhled se nemění.", view: "top" },
  "skylight-vario": { visible: true, text_cs: "Světlejší světlíky s větším prosvětlením.", view: "top" },
  "skylight-top90": { visible: true, text_cs: "Nejsvětlejší hybridní kopule.", view: "top" },
  "window-pnt": { visible: false, text_cs: "Standardní hliníková okna; vzhled se nemění.", view: "perspective" },
  "window-circal": { visible: true, text_cs: "Tmavší zelenošedý rám z recyklovaného hliníku.", view: "perspective" },
  "heating_hall-std": { visible: false, text_cs: "Temperování není na modelu vidět. Alternativy ukazují jednotky pod střechou v interiéru.", view: "interior" },
  "heating_hall-warm_air": { visible: true, text_cs: "Teplovzdušné jednotky visí pod střechou; uvidíte je v interiéru. Nejde o výpočet spotřeby.", view: "interior" },
  "heating_hall-radiant": { visible: true, text_cs: "Sálavé panely visí nad zónami; uvidíte je v interiéru. Nejde o výpočet spotřeby.", view: "interior" },
  "heating_office-std": { visible: false, text_cs: "Standardní vytápění administrativy není na modelu vidět.", view: null },
  "heating_office-heat_pump": { visible: true, text_cs: "Venkovní jednotka tepelného čerpadla u administrativy.", view: "perspective" },
  "heating_office-electric": { visible: false, text_cs: "Přímotopné vytápění není na modelu vidět; mění cenu a provozní náklady.", view: null },
  "lighting-std": { visible: true, text_cs: "Lineární LED svítidla v rastru; svítí v interiéru a večer přes světlíky.", view: "interior" },
  "lighting-sensors": { visible: true, text_cs: "Stejná svítidla s denním řízením: jemnější večerní záře. Úspora se nepočítá.", view: "interior" },
  "photovoltaics-none": { visible: false, text_cs: "Střecha zůstává bez panelů, s rezervou pro pozdější instalaci.", view: "top" },
  "photovoltaics-p30": { visible: true, text_cs: "Panely na 30 % volné plochy střechy. Rozsah je ilustrativní, výroba se nepočítá.", view: "top" },
  "photovoltaics-p60": { visible: true, text_cs: "Panely na 60 % volné plochy střechy. Rozsah je ilustrativní, výroba se nepočítá.", view: "top" },
  "partition-none": { visible: false, text_cs: "Hala je jeden volný prostor.", view: "interior" },
  "partition-split2": { visible: true, text_cs: "Příčka napříč halou s průchodem; uvidíte ji v interiéru nebo bez střechy.", view: "interior" },
  "partition-split3": { visible: true, text_cs: "Dvě příčky napříč halou s průchody; uvidíte je v interiéru nebo bez střechy.", view: "interior" },
};

export function effectOf(option: { category_id: string; material_key: string }): Effect {
  if (option.category_id === "cladding") return EFFECTS["cladding-"]!;
  return (
    EFFECTS[option.material_key] ?? {
      visible: false,
      text_cs: "Vzhled modelu se nemění; volba ovlivňuje cenu a technické parametry (viz Detail).",
      view: null,
    }
  );
}
export const LOOK_KEYS: string[] = Object.keys(LOOKS);
