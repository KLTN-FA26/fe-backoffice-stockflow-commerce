let support: boolean | undefined;

/**
 * Whether this browser can make a WebGL context. Asked once and remembered: a browser keeps only a few contexts, and
 * a test context made on every render would take the view's own away (the warehouse map's viewer does the same).
 */
export function hasWebGl(): boolean {
  if (support !== undefined) return support;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    support = gl !== null;
  } catch {
    support = false;
  }
  return support;
}
