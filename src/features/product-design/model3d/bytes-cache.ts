// Split from stockflow-storefront src/features/product-design/engine/model3d/load.ts (byte cache and download)
import { MODEL3D_LOAD_MESSAGES } from "@/constants/labels-model3d";
import { MODEL3D_LIMITS } from "@/constants/numbers";

import { messageOf, Model3dError, timeoutError } from "./model3d-error";

import type { Model3dLoadReason } from "./model3d-error";

/**
 * Loading a `.glb` from a URL goes through a small cache of the BYTES (never of parsed trees: a
 * scene takes ownership of the tree it is given, so every `loadGlb` call parses its own copy).
 *
 * - One shared download per URL at a time. It is not tied to any caller's abort signal: a caller that
 *   aborts stops waiting (`ABORTED`) while the download goes on for the others and for the cache.
 *   Its 15 s limit runs from when the download started; each call's parse has its own 15 s.
 * - The bytes of a successful download are kept for the last 4 URLs (least recently used dropped).
 *   Parsing uses a copy of the kept buffer, so the cache entry is never touched by a parser.
 * - A failed download (HTTP error, network error, the 15 s timeout) is remembered for 60 s: a call of
 *   the same URL in that window fails at once with the same code and reason, without a request.
 *   It is remembered only briefly so that a flaky connection recovers without a page reload, while
 *   a set submission of N designs does not make N slow requests (and N times 15 s of waiting) to a
 *   file that is down. An abort is never remembered. An `ArrayBuffer` source bypasses all of this.
 */

const {
  loadTimeoutMs: LOAD_TIMEOUT_MS,
  keptUrls: KEPT_URLS,
  failureMemoryMs: FAILURE_MEMORY_MS,
} = MODEL3D_LIMITS;

type Download = { promise: Promise<ArrayBuffer>; cancel: () => void };
type Failure = { code: "LOAD_FAILED"; message: string; reason?: Model3dLoadReason; until: number };

const downloads = new Map<string, Download>();
const kept = new Map<string, ArrayBuffer>();
const failures = new Map<string, Failure>();
let generation = 0;

/** Empties the byte cache, the remembered failures and cancels running downloads (tests only). */
export function resetGlbCacheForTests() {
  generation += 1;
  downloads.forEach((download) => download.cancel());
  downloads.clear();
  kept.clear();
  failures.clear();
}

function startDownload(url: string): Download {
  const mine = generation;
  const control = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      control.abort();
      reject(timeoutError(MODEL3D_LOAD_MESSAGES.timeoutDownload));
    }, LOAD_TIMEOUT_MS);
  });
  timeout.catch(() => undefined);

  const run = async (): Promise<ArrayBuffer> => {
    try {
      const bytes = await Promise.race([
        (async () => {
          const response = await fetch(url, { signal: control.signal });
          if (!response.ok) {
            throw new Model3dError(
              "LOAD_FAILED",
              MODEL3D_LOAD_MESSAGES.http(response.status),
              "http",
            );
          }
          return response.arrayBuffer();
        })(),
        timeout,
      ]);
      if (mine === generation) {
        kept.delete(url);
        kept.set(url, bytes);
        // While the cache is over its size there is always an oldest key; `done` only guards
        // against looping forever.
        while (kept.size > KEPT_URLS) {
          const oldest = kept.keys().next();
          if (oldest.done) break;
          kept.delete(oldest.value);
        }
      }
      return bytes;
    } catch (error) {
      const failure =
        error instanceof Model3dError
          ? error
          : new Model3dError(
              "LOAD_FAILED",
              MODEL3D_LOAD_MESSAGES.network(messageOf(error)),
              "network",
            );
      if (mine === generation) {
        failures.set(url, {
          code: "LOAD_FAILED",
          message: failure.message,
          ...(failure.reason ? { reason: failure.reason } : {}),
          until: Date.now() + FAILURE_MEMORY_MS,
        });
      }
      throw failure;
    } finally {
      clearTimeout(timer);
      if (mine === generation) downloads.delete(url);
    }
  };
  const promise = run();
  promise.catch(() => undefined);
  return { promise, cancel: () => control.abort() };
}

/** The bytes of a URL: kept, remembered as failed, or one shared download. */
export function bytesOf(url: string): Promise<ArrayBuffer> {
  const hit = kept.get(url);
  if (hit) {
    kept.delete(url);
    kept.set(url, hit);
    return Promise.resolve(hit);
  }
  const failure = failures.get(url);
  if (failure) {
    if (Date.now() < failure.until) {
      return Promise.reject(new Model3dError(failure.code, failure.message, failure.reason));
    }
    failures.delete(url);
  }
  let download = downloads.get(url);
  if (!download) {
    download = startDownload(url);
    downloads.set(url, download);
  }
  return download.promise;
}
