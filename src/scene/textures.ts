/**
 * Procedurální textury (žádné externí assety, žádné licence). Všechny jsou dlaždice v metrech:
 * UV se odvozují ze světových souřadnic, takže se detail při změně rozměrů nikdy neroztahuje.
 * Vytváří se na klientu (potřebují <canvas>) a vlastník je musí uvolnit přes `disposeTextures`.
 */
import * as THREE from "three";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext("2d")! };
}

function toTexture(c: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return t;
}

/** Výšková mapa → normálová mapa (Sobel). `strength` řídí hloubku reliéfu. */
function heightToNormal(h: Float32Array, w: number, hh: number, strength: number): HTMLCanvasElement {
  const { c, ctx } = makeCanvas(w, hh);
  const img = ctx.createImageData(w, hh);
  const at = (x: number, y: number) => h[((y + hh) % hh) * w + ((x + w) % w)]!;
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      // Plátno má osu y dolů, ale textura se nahrává převrácená (flipY): proto +dy.
      img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export const TILE = {
  facade: { w: 6, h: 1.2 },
  membrane: 1.5,
  asphalt: 8,
  concrete: 6,
  grass: 10,
  parking: { w: 2.7, d: 16 },
  road: { w: 12, d: 8 },
} as const;

export interface SceneTextures {
  pvCell: THREE.Texture;
  facadeMap: THREE.Texture;
  facadeNormal: THREE.Texture;
  membrane: THREE.Texture;
  asphalt: THREE.Texture;
  concrete: THREE.Texture;
  grass: THREE.Texture;
  parking: THREE.Texture;
  road: THREE.Texture;
  /** Atlas čísel vrat 8 × 8 buněk: 1 až 40, pak S1 až S8 (viz PLATE_ATLAS v geometry.ts). */
  numbers: THREE.Texture;
}

/** Sendvičové panely kladené vodorovně: spára, jemné žebrování a svislý styk po 6 m. */
function facade(): { map: HTMLCanvasElement; normal: HTMLCanvasElement } {
  const w = 1024;
  const h = 256;
  const hm = new Float32Array(w * h);
  const rnd = mulberry32(11);
  const { c: map, ctx } = makeCanvas(w, h);
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const t = y / h;
    // spára u dolního okraje panelu, tři jemné žlábky
    const groove = t < 0.03 ? 0 : 1;
    const flute = 0.5 + 0.5 * Math.cos(t * Math.PI * 2 * 4);
    for (let x = 0; x < w; x++) {
      const endJoint = x < 3 ? 0.2 : 1;
      const height = 0.55 + 0.25 * flute * groove;
      hm[y * w + x] = Math.min(height, 0.55 + 0.25 * flute) * endJoint * (groove ? 1 : 0.1);
      const noise = 0.97 + rnd() * 0.06;
      const ao = (groove ? 1 : 0.7) * (0.93 + 0.07 * flute) * (x < 3 ? 0.85 : 1);
      const v = Math.round(255 * noise * ao);
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { map, normal: heightToNormal(hm, w, h, 2.4) };
}

function speckle(w: number, h: number, base: [number, number, number], spread: number, seed: number) {
  const { c, ctx } = makeCanvas(w, h);
  const rnd = mulberry32(seed);
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const n = 1 + (rnd() - 0.5) * spread;
    img.data[i * 4] = Math.min(255, base[0] * n);
    img.data[i * 4 + 1] = Math.min(255, base[1] * n);
    img.data[i * 4 + 2] = Math.min(255, base[2] * n);
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return { c, ctx, rnd };
}

function membrane(): HTMLCanvasElement {
  const n = 256;
  const { c, ctx } = speckle(n, n, [236, 238, 240], 0.05, 5);
  ctx.fillStyle = "rgba(60,66,74,0.28)";
  ctx.fillRect(0, 0, n, 3); // svar fólie
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(0, 3, n, 2);
  ctx.fillStyle = "rgba(60,66,74,0.12)";
  ctx.fillRect(0, 0, 2, n);
  return c;
}

function asphalt(): HTMLCanvasElement {
  const n = 512;
  const { c, ctx, rnd } = speckle(n, n, [232, 232, 232], 0.22, 21);
  ctx.strokeStyle = "rgba(20,20,20,0.18)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    let x = rnd() * n;
    let y = rnd() * n;
    ctx.moveTo(x, y);
    for (let s = 0; s < 8; s++) {
      x += (rnd() - 0.5) * 40;
      y += (rnd() - 0.5) * 40;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return c;
}

/** Betonová deska řezaná na pole 6 × 6 m (jako ve zdrojové specifikaci podlahy). */
function concrete(): HTMLCanvasElement {
  const n = 512;
  const { c, ctx } = speckle(n, n, [226, 226, 224], 0.07, 33);
  ctx.fillStyle = "rgba(40,40,40,0.35)";
  ctx.fillRect(0, 0, n, 3);
  ctx.fillRect(0, 0, 3, n);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(0, 3, n, 2);
  ctx.fillRect(3, 0, 2, n);
  return c;
}

function grass(): HTMLCanvasElement {
  const n = 512;
  const { c, ctx, rnd } = speckle(n, n, [150, 176, 128], 0.14, 44);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(${95 + rnd() * 40},${130 + rnd() * 40},${85 + rnd() * 30},0.12)`;
    ctx.beginPath();
    ctx.ellipse(rnd() * n, rnd() * n, 30 + rnd() * 60, 20 + rnd() * 40, rnd() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

/** Parkovací stání: čáry po 2,7 m ve dvou řadách (dlouhá strana = hloubka parkoviště 16 m). */
function parking(): HTMLCanvasElement {
  const w = 128;
  const h = 1024;
  const { c, ctx } = speckle(w, h, [236, 236, 236], 0.2, 55);
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  const px = h / TILE.parking.d;
  const line = Math.max(4, 0.1 * px);
  const rowDepth = 5.5;
  for (const y0 of [0, TILE.parking.d - rowDepth]) {
    ctx.fillRect(0, y0 * px, line, rowDepth * px); // dělicí čára stání
  }
  ctx.fillRect(0, 0, w, line * 0.8);
  ctx.fillRect(0, h - line * 0.8, w, line * 0.8);
  return c;
}

function road(): HTMLCanvasElement {
  const w = 768;
  const h = 512;
  const { c, ctx } = speckle(w, h, [226, 226, 226], 0.2, 66);
  const px = w / TILE.road.w;
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillRect(0, h / 2 - 3, 4 * px, 6); // přerušovaná osa vozovky
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillRect(0, 10, w, 3);
  ctx.fillRect(0, h - 13, w, 3);
  return c;
}

function pvCell(): HTMLCanvasElement {
  const { c, ctx } = makeCanvas(256, 512);
  ctx.fillStyle = "#263c51"; ctx.fillRect(0, 0, 256, 512);
  for (let row = 0; row < 12; row++) for (let col = 0; col < 6; col++) {
    ctx.fillStyle = (row + col) % 3 === 0 ? "#203548" : "#192f42";
    ctx.fillRect(5 + col * 41, 5 + row * 42, 39, 40);
  }
  ctx.strokeStyle = "#a1adb4"; ctx.lineWidth = 6; ctx.strokeRect(3, 3, 250, 506);
  return c;
}

/** Tmavě modré tabulky s bílými čísly vrat (fotografie z katalogu: doky 12, 13, 14 a vjezdová vrata S1, S2, S3). */
function numberAtlas(): THREE.CanvasTexture {
  const cell = 64;
  const { c, ctx } = makeCanvas(cell * 8, cell * 8);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < 48; i++) {
    const x = (i % 8) * cell;
    const y = Math.floor(i / 8) * cell;
    ctx.fillStyle = "#0b2a66";
    ctx.fillRect(x, y, cell, cell);
    ctx.strokeStyle = "#dfe6f2";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 3, y + 3, cell - 6, cell - 6);
    const label = i < 40 ? String(i + 1) : `S${i - 39}`;
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${label.length > 2 ? 26 : 34}px Helvetica, Arial, sans-serif`;
    ctx.fillText(label, x + cell / 2, y + cell / 2 + 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function createSceneTextures(): SceneTextures {
  const f = facade();
  const t: SceneTextures = {
    pvCell: toTexture(pvCell(), true),
    facadeMap: toTexture(f.map, true),
    facadeNormal: toTexture(f.normal, false),
    membrane: toTexture(membrane(), true),
    asphalt: toTexture(asphalt(), true),
    concrete: toTexture(concrete(), true),
    grass: toTexture(grass(), true),
    parking: toTexture(parking(), true),
    road: toTexture(road(), true),
    numbers: numberAtlas(),
  };
  // Fasáda: UV v metrech → opakování 1 / rozměr dlaždice.
  for (const tx of [t.facadeMap, t.facadeNormal]) tx.repeat.set(1 / TILE.facade.w, 1 / TILE.facade.h);
  return t;
}

export function disposeTextures(t: SceneTextures) {
  Object.values(t).forEach((x) => x.dispose());
}

/**
 * Vodorovná plocha obdélníku s UV ve světových metrech (spojitost textury přes sousední plochy).
 * `tileW`/`tileD` jsou rozměry dlaždice v metrech.
 */
export function flatRect(x0: number, x1: number, z0: number, z1: number, y: number, tileW: number, tileD: number, swap = false): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
  g.rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  const pos = g.getAttribute("position");
  const uv = g.getAttribute("uv");
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / tileW;
    const v = pos.getZ(i) / tileD;
    uv.setXY(i, swap ? v : u, swap ? u : v);
  }
  uv.needsUpdate = true;
  return g;
}

/** Totéž, ale UV začíná v rohu obdélníku (parkoviště: čára stání musí začínat na jeho okraji). */
export function localFlatRect(x0: number, x1: number, z0: number, z1: number, y: number, tileW: number, tileD: number): THREE.BufferGeometry {
  const g = flatRect(x0, x1, z0, z1, y, tileW, tileD);
  const pos = g.getAttribute("position");
  const uv = g.getAttribute("uv");
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - x0) / tileW, (pos.getZ(i) - z0) / tileD);
  uv.needsUpdate = true;
  return g;
}


/* ------------------------------------------------------------------ krajina: pole a mraky */

export type FieldTextureKind = "wheat" | "crop" | "plowed" | "rapeseed" | "meadow";
export const FIELD_TILE_M = 12;

function field(base: [number, number, number], stripe: [number, number, number], periodPx: number, spread: number, seed: number, stripeAlpha: number): HTMLCanvasElement {
  const n = 256;
  const { c, ctx } = speckle(n, n, base, spread, seed);
  if (periodPx > 0) {
    ctx.fillStyle = `rgba(${stripe[0]},${stripe[1]},${stripe[2]},${stripeAlpha})`;
    for (let y = 0; y < n; y += periodPx) ctx.fillRect(0, y, n, Math.max(2, periodPx / 3));
  }
  return c;
}

function cloud(): HTMLCanvasElement {
  const w = 512;
  const h = 256;
  const { c, ctx } = makeCanvas(w, h);
  const rnd = mulberry32(77);
  // měkké kupy: překrývající se radiální gradienty, spodek mírně do šeda
  for (let i = 0; i < 26; i++) {
    const x = 90 + rnd() * (w - 180);
    const rr = 36 + rnd() * 62;
    const y = h * 0.62 - rnd() * rnd() * 110 - rr * 0.1;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
    const shade = 255 - Math.floor((y / h) * 34);
    g.addColorStop(0, `rgba(${shade},${shade},${shade},0.55)`);
    g.addColorStop(0.6, `rgba(${shade},${shade},${shade},0.28)`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  return c;
}

export interface LandscapeTextures {
  fields: Record<FieldTextureKind, THREE.Texture>;
  cloud: THREE.Texture;
}

export function createLandscapeTextures(): LandscapeTextures {
  const mk = (c: HTMLCanvasElement) => toTexture(c, true);
  const cl = new THREE.CanvasTexture(cloud());
  cl.colorSpace = THREE.SRGBColorSpace;
  return {
    fields: {
      wheat: mk(field([214, 182, 96], [186, 150, 70], 16, 0.14, 101, 0.38)),
      crop: mk(field([112, 156, 70], [78, 122, 50], 16, 0.14, 102, 0.42)),
      plowed: mk(field([138, 106, 74], [100, 72, 48], 32, 0.2, 103, 0.5)),
      rapeseed: mk(field([226, 202, 52], [170, 170, 50], 16, 0.12, 104, 0.3)),
      meadow: mk(field([150, 184, 106], [0, 0, 0], 0, 0.16, 105, 0)),
    },
    cloud: cl,
  };
}

export function disposeLandscapeTextures(t: LandscapeTextures) {
  Object.values(t.fields).forEach((x) => x.dispose());
  t.cloud.dispose();
}
