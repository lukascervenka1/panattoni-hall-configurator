/** Zjistí, zda prohlížeč umí WebGL. Při neúspěchu aplikace přepne na 2D náhled bez 3D (spec kap. 7). */
export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return false;
    // Uvolni kontext hned, ať nezabírá limit kontextů prohlížeče.
    (gl as WebGLRenderingContext).getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}
