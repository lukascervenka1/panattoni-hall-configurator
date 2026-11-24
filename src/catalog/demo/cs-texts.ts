/**
 * České popisy k demo seedu z HTML katalogu. Čísla (ceny, GWP) se berou beze změny z materials.source.json;
 * zde jsou jen texty. Klíč je `<kategorie>.<varianta>` podle zdrojového HTML (kategorie drive/sky/win = drive_in/skylight/window).
 */
export interface OptionTexts {
  name_cs: string;
  type_cs: string;
  note_cs?: string;
  color_hex?: string;
}

export const OPTION_TEXTS: Record<string, OptionTexts> = {
  // Opláštění
  "cladding.spa": { name_cs: "Ruukki SPA E 100", type_cs: "Ocel + minerální vata", color_hex: "#f5f5f5" },
  "cladding.ks": { name_cs: "Kingspan KS TL QuadCore", type_cs: "Ocel + QuadCore (PIR)", color_hex: "#97a4b4" },
  "cladding.paroc": { name_cs: "Paroc AST S LEC", type_cs: "Nízkouhlíková ocel + kamenná vlna", color_hex: "#bfb9ad" },
  "cladding.life": { name_cs: "Ruukki SPA E Life LowCarbon", type_cs: "Ocel SSAB Zero + recyklovaná skelná vata", color_hex: "#8fa18f" },
  "cladding.eco": {
    name_cs: "EcoCocon – panel z lisované slámy",
    type_cs: "Dřevěný rám + lisovaná sláma",
    note_cs: "Fosilní GWP; uložený biogenní uhlík jej snižuje o dalších cca 101 kg CO₂e/m². Vyžaduje vnější obklad a posouzení požární bezpečnosti.",
    color_hex: "#b9a06e",
  },
  // Nosná konstrukce
  "structure.base": { name_cs: "Standardní prefabrikovaný skelet", type_cs: "Železobetonové sloupy + předpjaté vazníky 24 m" },
  "structure.p1": { name_cs: "Prefabrikát 1 · CEM III/A + ocel z EAF", type_cs: "Záměna materiálu" },
  "structure.p2": { name_cs: "Prefabrikát 2 · štíhlé předpjaté prvky", type_cs: "Optimalizace návrhu z vysokohodnotného betonu" },
  "structure.p3": { name_cs: "Prefabrikát 3 · struska + ocel XCarb", type_cs: "Kombinace materiálu a návrhu" },
  "structure.tim": {
    name_cs: "Lepené lamelové vazníky 24 m",
    type_cs: "Lepené lamelové dřevo na prefabrikovaných sloupech",
    note_cs: "Fosilní GWP; uložený biogenní uhlík jej snižuje o dalších cca 34 kg CO₂e/m².",
  },
  "structure.stl": {
    name_cs: "Ocelové příhradové vazníky XCarb",
    type_cs: "Příhradové vazníky z oceli z EAF na prefabrikovaných sloupech",
    note_cs: "S konvenční ocelí z vysoké pece cca 65 kg CO₂e/m².",
  },
  // Podlahy
  "floor.pnt": { name_cs: "Standard PNT 180 mm", type_cs: "Drátkobeton C30/37, vsyp, strojně hlazený" },
  "floor.heavy": {
    name_cs: "PNT · vysoké zatížení 220 mm",
    type_cs: "Drátkobeton C30/37–C35/45",
    note_cs: "Funkční navýšení pro VNA a vysoké regálové sklady, nikoli nízkouhlíková varianta.",
  },
  "floor.v1": { name_cs: "V1 · beton CEM III/A", type_cs: "Beton s nízkým podílem slínku, geometrie PNT" },
  "floor.v2": { name_cs: "V2 · bezespará podlaha PRIMX", type_cs: "Samonapínací drátkobeton" },
  "floor.v3": { name_cs: "V3 · CEM III/B + Dramix 5D/Loop", type_cs: "Tenčí deska, penetrace místo vsypu" },
  // Střecha
  "roof.pnt": { name_cs: "Standard PNT", type_cs: "Ocel + 220 mm kamenná vlna + PVC fólie" },
  "roof.v1": { name_cs: "V1 · plech LowCarbon", type_cs: "Recyklovaná ocel z EAF, zbytek jako PNT" },
  "roof.v2": { name_cs: "V2 · izolace PIR", type_cs: "PIR místo kamenné vlny" },
  "roof.v3": { name_cs: "V3 · LowCarbon + MW + TPO", type_cs: "Kombinace" },
  "roof.v4": {
    name_cs: "V4 · dřevěné střešní prvky",
    type_cs: "Nosné dřevěné prvky místo plechu",
    note_cs: "Fosilní GWP; uložený biogenní uhlík jej snižuje o dalších cca 50 kg CO₂e/m².",
  },
  // Nakládací doky
  "dock.pnt": { name_cs: "Standard PNT Hörmann", type_cs: "Rampa + manžeta + vrata 3×3 m" },
  "dock.assa": { name_cs: "ASSA ABLOY DL6220T", type_cs: "Teleskopická rampa + manžeta + vrata" },
  "dock.vw": {
    name_cs: "Van Wijk – externí nakládací dům",
    type_cs: "Externí dům + rampa + vrata",
    note_cs: "EPD systému 5 940 + vrata 581 kg CO₂e. Více využitelné podlahové plochy uvnitř haly.",
  },
  // Vjezdová vrata
  "drive_in.pnt": { name_cs: "Hörmann SPU F42", type_cs: "Sekční vrata PU 42 mm" },
  "drive_in.t67": {
    name_cs: "Hörmann SPU 67 Thermo",
    type_cs: "67 mm s přerušeným tepelným mostem",
    note_cs: "Emise odhadnuty; přínos je ve snížených provozních tepelných ztrátách.",
  },
  // Světlíky
  "skylight.pnt": { name_cs: "LAMILUX F100 PC / pásový B", type_cs: "Polykarbonátová kopule / pásový světlík" },
  "skylight.vario": { name_cs: "VELUX Vario CRL Vario Therm", type_cs: "Lehký polykarbonátový světlík" },
  "skylight.top90": { name_cs: "VELUX Top-90 Hybrid Dome", type_cs: "Hybridní polykarbonátová kopule" },
  // Okna administrativy
  "window.pnt": {
    name_cs: "Standardní hliníkové okno PNT",
    type_cs: "Hliníkový rám s přerušeným tepelným mostem, trojsklo",
    note_cs: "Orientační hodnota pro systém z primárního hliníku; ověřit podle EPD dodavatele.",
  },
  "window.circal": {
    name_cs: "Nízkouhlíkové hliníkové okno",
    type_cs: "Profily z ≥ 75 % recyklovaného hliníku, trojsklo",
    note_cs: "Orientační; největší část zbývajícího GWP pochází z trojskla.",
  },
};

export const CATEGORY_TEXTS: Record<string, { name_cs: string; description_cs: string }> = {
  cladding: {
    name_cs: "Opláštění",
    description_cs: "Sendvičové panely s jádrem z minerální vlny kladené vodorovně na nosnou konstrukci. Tloušťka a tepelné vlastnosti se navrhují podle platných ČSN.",
  },
  structure: {
    name_cs: "Nosná konstrukce",
    description_cs: "Nosný skelet haly. Orientační rastr sloupů 24 × 12 m, případně podle dispozice nájemce.",
  },
  floor: {
    name_cs: "Podlahy",
    description_cs: "Drátkobetonová deska na separační PE fólii, povrch zpracovaný vsypem nebo křemičitým posypem a strojně hlazený.",
  },
  roof: {
    name_cs: "Střecha",
    description_cs: "Trapézový plech na nosných vaznících, parozábrana, tepelná izolace a jednovrstvá hydroizolační fólie, odvodnění podtlakovým systémem.",
  },
  dock: {
    name_cs: "Nakládací doky",
    description_cs: "Vybavené nakládací doky s rohovou ochranou. Standardní sekční vrata 3 × 3 m.",
  },
  drive_in: {
    name_cs: "Vjezdová vrata",
    description_cs: "Elektricky ovládaná izolovaná sekční vrata 4 × 5 m s okénkem v úrovni očí.",
  },
  skylight: {
    name_cs: "Světlíky",
    description_cs: "Neotevíravé světlíky na 2 % plochy střechy a 5 % v zóně doků.",
  },
  window: {
    name_cs: "Hliníková okna",
    description_cs: "Okna s trojsklem a rámy s přerušeným tepelným mostem. Zvolené provedení platí pro administrativu i případný horní pás oken haly; množství odpovídá jejich celkové ploše.",
  },
};

/** Převede anglické zápisy zdrojových textových hodnot na české (desetinná čárka, tisíce, několik slov). */
export function csDisplay(s: string | null | undefined): string | null {
  if (s == null) return null;
  return s
    .replace(/(\d),(\d{3})/g, "$1 $2")
    .replace(/(\d)\.(\d)/g, "$1,$2")
    .replace(/\byears?\b/g, "let")
    .replace(/\bper fire design\b/g, "dle požárního řešení")
    .replace(/\bmembrane\b/g, "hydroizolace")
    .replace(/\bcolumns\b/g, "sloupy")
    .replace(/\bgirder\b/g, "vazník")
    .replace(/\bleveller\b/g, "rampa")
    .replace(/\btruss depth\b/g, "výška vazníku")
    .replace(/\bframe\b/g, "rám")
    .replace(/\bas baseline\b/g, "jako základ")
    .replace(/\bCombustible insulation, review in fire design and with FM\b/g, "Hořlavá izolace, nutné posouzení v požárním řešení a s FM")
    .replace(/\bPer system, verify BROOF\b/g, "Dle systému, ověřit BROOF")
    .replace(/\bVerify BROOF\b/g, "Ověřit BROOF")
    .replace(/\blower \(verify\)/g, "nižší (ověřit)")
    .replace(/\bverify\b/g, "ověřit")
    .replace(/\bdoor\b/g, "vrata");
}
