import * as THREE from "three";

/** Rozměr jedné dlaždice textury v metrech (šířka × výška). UV vycházejí z metrických souřadnic stěny. */
export const PANEL_TILE_M = { w: 3.6, h: 1.2 } as const;

/**
 * Procedurální textura sendvičových panelů: vodorovné a svislé spáry. Šedá s průhlednou spárou,
 * takže se barva opláštění z katalogu vynásobí a spáry zůstanou jemně tmavší. Žádný externí asset.
 */
export function createPanelTexture(): THREE.CanvasTexture {
  const w = 768;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  // jemné žebrování
  ctx.fillStyle = "rgba(0,0,0,0.035)";
  for (let x = 0; x < w; x += 32) ctx.fillRect(x, 0, 2, h);
  // spáry panelů
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fillRect(0, 0, w, 3);
  ctx.fillStyle = "rgba(0,0,0,0.14)";
  ctx.fillRect(0, 0, 3, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / PANEL_TILE_M.w, 1 / PANEL_TILE_M.h);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
