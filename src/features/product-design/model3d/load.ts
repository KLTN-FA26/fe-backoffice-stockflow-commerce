// Ported from stockflow-storefront src/features/product-design/engine/model3d/load.ts
import { MODEL3D_LOAD_MESSAGES } from "@/constants/labels-model3d";
import { MODEL3D_LIMITS } from "@/constants/numbers";

import { bakeMillimetres } from "./bake";
import { bytesOf } from "./bytes-cache";
import { disposeGlbTree } from "./dispose";
import { messageOf, Model3dError, timeoutError } from "./model3d-error";

import type { Group } from "three";

/** Where `loadGlb` leaves the size of the file, for the checks of `measureModel`. */
export const BYTE_LENGTH_KEY = "glbByteLength";

/**
 * Loads a `.glb` (a URL, or its bytes) into a three `Group` in millimetres. A URL goes through the
 * byte cache described at the top of `bytes-cache.ts`. three's loader is imported on demand; no
 * Draco, KTX2 or Meshopt decoder is set up, so a file that needs one fails as `LOAD_FAILED`
 * (`reason: "parse"`), like a network error (`"network"`), an HTTP error (`"http"`), or a download
 * or parse longer than 15 s (`"timeout"`). An aborted `signal` rejects with `ABORTED` (a tree
 * parsed after that is freed).
 */
export async function loadGlb(
  source: string | ArrayBuffer,
  opts: { signal?: AbortSignal } = {},
): Promise<Group> {
  const aborted = () => new Model3dError("ABORTED", MODEL3D_LOAD_MESSAGES.aborted);
  if (opts.signal?.aborted) throw aborted();

  const work = new AbortController();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => work.abort();
  opts.signal?.addEventListener("abort", stop, { once: true });
  const interruption = () =>
    timedOut ? timeoutError(MODEL3D_LOAD_MESSAGES.timeoutParse) : aborted();
  const interrupted = new Promise<never>((_, reject) => {
    work.signal.addEventListener("abort", () => reject(interruption()), { once: true });
  });
  interrupted.catch(() => undefined);
  const until = <T>(step: Promise<T>): Promise<T> => Promise.race([step, interrupted]);

  try {
    const { GLTFLoader } = await until(import("three/addons/loaders/GLTFLoader.js"));
    // A URL's kept buffer is parsed through a copy; a caller's own buffer is used as it is.
    const bytes = typeof source === "string" ? (await until(bytesOf(source))).slice(0) : source;

    // The parse has its own limit, from when it starts.
    timer = setTimeout(() => {
      timedOut = true;
      work.abort();
    }, MODEL3D_LIMITS.loadTimeoutMs);
    const gltf = await until(
      new Promise<{ scene?: Group }>((resolve, reject) => {
        try {
          new GLTFLoader().parse(
            bytes,
            "",
            (parsed) => {
              // Aborted while parsing: nothing will use this tree, free it now.
              if (work.signal.aborted && parsed.scene) disposeGlbTree(parsed.scene);
              resolve(parsed);
            },
            reject,
          );
        } catch (error) {
          reject(error);
        }
      }),
    );
    const root = gltf.scene;
    if (!root) {
      throw new Model3dError("LOAD_FAILED", MODEL3D_LOAD_MESSAGES.noScene, "parse");
    }
    if (work.signal.aborted) {
      disposeGlbTree(root);
      throw interruption();
    }

    bakeMillimetres(root);
    root.userData[BYTE_LENGTH_KEY] = bytes.byteLength;
    return root;
  } catch (error) {
    if (error instanceof Model3dError) throw error;
    if (work.signal.aborted) throw interruption();
    throw new Model3dError("LOAD_FAILED", MODEL3D_LOAD_MESSAGES.parse(messageOf(error)), "parse");
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", stop);
  }
}
