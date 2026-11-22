#!/usr/bin/env node
/**
 * Jednorázová extrakce demo dat z Panattoni-Materials-Configurator.html.
 *
 * - Vyřízne literál `const DB = {...}` a vyhodnotí jej v prázdném `vm` kontextu (žádné globály, bez sítě).
 * - Base64 obrázky uloží do public/catalog/img/<hash>.jpg (deduplikace podle obsahu).
 * - Zapíše src/catalog/demo/materials.source.json (čísla beze změny, anglické texty ze zdroje).
 *
 * Výstup je SEED. České popisy a mapování na tabulky Products/Options/Prices doplňuje src/catalog/demo/*.ts.
 * Všechna data jsou DEMO: nejde o schválený ceník ani o schválené standardy Panattoni.
 *
 * Použití: npm run catalog:extract
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const htmlPath = path.join(root, "Panattoni-Materials-Configurator.html");
const imgDir = path.join(root, "public", "catalog", "img");
const outJson = path.join(root, "src", "catalog", "demo", "materials.source.json");

const html = fs.readFileSync(htmlPath, "utf8");
const start = html.indexOf("const DB = {");
const end = html.indexOf("\n};", start);
if (start < 0 || end < 0) throw new Error("Literál DB nebyl v HTML nalezen.");
const literal = html.slice(start + "const DB = ".length, end + 3).replace(/;\s*$/, "");

const DB = vm.runInNewContext(`(${literal})`, Object.create(null), { timeout: 2000 });

fs.mkdirSync(imgDir, { recursive: true });
const written = new Map();

function saveImage(dataUri) {
  const m = /^data:image\/(jpeg|png);base64,(.+)$/.exec(dataUri);
  if (!m) throw new Error("Neočekávaný formát obrázku.");
  const buf = Buffer.from(m[2], "base64");
  const hash = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 12);
  const ext = m[1] === "png" ? "png" : "jpg";
  const rel = `/catalog/img/${hash}.${ext}`;
  if (!written.has(rel)) {
    fs.writeFileSync(path.join(imgDir, `${hash}.${ext}`), buf);
    written.set(rel, buf.length);
  }
  return rel;
}

const out = { source: "Panattoni-Materials-Configurator.html", categories: {} };
for (const [catId, cat] of Object.entries(DB)) {
  out.categories[catId] = {
    title_en: cat.title,
    unit: cat.unit,
    qty: cat.qty,
    intro_en: cat.intro,
    spec_en: cat.spec ?? [],
    variants: cat.variants.map((v) => ({
      id: v.id,
      pnt: Boolean(v.pnt),
      image: v.img ? saveImage(v.img) : null,
      imageFit: v.imgFit ?? null,
      name: v.name,
      supplier: v.sup,
      type_en: v.type,
      gwp_kg_co2e: v.gwp,
      u_value: v.u,
      mass: v.mass,
      unit_price: v.price,
      service_life: v.life,
      fire: v.fire,
      thickness: v.thick,
      density: v.dens ?? null,
      price_per_m3: v.pm3 ?? null,
      note_en: v.note ?? null,
      epd_url: v.epd,
    })),
  };
}

// Další hodnoty zdrojového souboru, které katalog potřebuje (viz docs/ASSUMPTIONS.md).
const other = /const OTHER_GWP = ([0-9.]+);/.exec(html);
out.other_gwp_kg_per_m2 = other ? Number(other[1]) : null;

fs.writeFileSync(outJson, JSON.stringify(out, null, 2) + "\n");
const total = Object.values(out.categories).reduce((n, c) => n + c.variants.length, 0);
console.log(`Kategorií: ${Object.keys(out.categories).length}, variant: ${total}, unikátních obrázků: ${written.size}`);
console.log(`Zapsáno: ${path.relative(root, outJson)}`);
