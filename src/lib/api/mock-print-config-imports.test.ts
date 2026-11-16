// @vitest-environment node
/**
 * The mock adapter imports every route module when it starts, so with `NEXT_PUBLIC_USE_MOCK=true` whatever the
 * print-configuration mock files import statically is loaded on every page. None of it may reach three.js: the mock
 * takes only the pure formula module (`model3d/cup-sector`), never the `model3d` entry. (`mock-adapter.ts` loads the
 * route modules with dynamic imports, so the walk starts at the mock files themselves.)
 * Same idea as `features/product-design/components/three-on-demand.test.ts`: walk the static, non-type imports.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const SRC = path.resolve(process.cwd(), "src");
const STATIC_IMPORT = /^\s*(?:import|export)\s+(?!type\b)(?:[^;]*?\sfrom\s+)?["']([^"']+)["']/gm;
const THREE = /^(three|three\/.*|@react-three\/.*)$/;

function resolveLocal(from: string, specifier: string): string | null {
  const base = specifier.startsWith("@/")
    ? path.join(SRC, specifier.slice(2))
    : specifier.startsWith(".")
      ? path.resolve(path.dirname(from), specifier)
      : null;
  if (!base) return null;
  for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Every file reached from `entry` by static imports, and the files that import three. */
function closure(entry: string) {
  const seen = new Set<string>();
  const importersOfThree: string[] = [];
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop();
    if (!file || seen.has(file)) continue;
    seen.add(file);
    for (const match of readFileSync(file, "utf8").matchAll(STATIC_IMPORT)) {
      const specifier = match[1] ?? "";
      if (THREE.test(specifier)) importersOfThree.push(path.relative(SRC, file));
      const next = resolveLocal(file, specifier);
      if (next) queue.push(next);
    }
  }
  return { seen, importersOfThree };
}

const rel = (set: Set<string>) =>
  [...set].map((file) => path.relative(SRC, file).replaceAll("\\", "/"));

describe("the print-configuration mock does not load three.js at start-up", () => {
  const mockFiles = [
    "lib/api/mock-routes-print-configs.ts",
    "lib/api/mock-print-config-store.ts",
    "lib/api/mock-print-config-parse.ts",
    "lib/api/mock-print-config-file.ts",
    "lib/api/mock-print-config-seed.ts",
  ];

  it.each(mockFiles)("%s reaches no module that imports three", (file) => {
    const { importersOfThree } = closure(path.join(SRC, file));
    expect(importersOfThree).toEqual([]);
  });

  it("they use the pure formula module and never the model3d entry", () => {
    const { seen } = closure(path.join(SRC, "lib/api/mock-routes-print-configs.ts"));
    const files = rel(seen);
    expect(files).toContain("features/product-design/model3d/cup-sector.ts");
    expect(files).not.toContain("features/product-design/model3d/index.ts");
  });
});
