// @vitest-environment node
/**
 * Opening a variant's page must not load three.js. The section is reached from the feature's `index.ts`; nothing in
 * what that file statically imports (inside this feature) may import three, the loader, the measuring code, or the
 * `model3d` entry. Only `use-glb-reading.ts` may reach them, through a dynamic `import()` made when a file is chosen.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const FEATURE = path.resolve(process.cwd(), "src/features/product-design");
/** Files of `model3d` that import three (directly or through another of them). */
const HEAVY = new Set(
  [
    "bake",
    "dispose",
    "find-print-meshes",
    "load",
    "measure",
    "measure-bag",
    "measure-cup",
    "measure-points",
    "measure-resolve",
    "measure-winding",
    "bytes-cache",
    "index",
  ].map((name) => path.join(FEATURE, "model3d", `${name}.ts`)),
);

/** The folder of the 3D view: it imports three and react-three-fiber, so only a dynamic `import()` may reach it. */
const VIEW_DIR = "model-view";

const STATIC_IMPORT = /^\s*(?:import|export)\s+(?!type\b)(?:[^;]*?\sfrom\s+)?["']([^"']+)["']/gm;

function resolveInFeature(from: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) return null;
  const base = path.resolve(path.dirname(from), specifier);
  for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Every file the entry reaches through static (non-type) imports inside the feature. */
function staticClosure(entry: string) {
  const seen = new Set<string>();
  const external: { file: string; specifier: string }[] = [];
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop();
    if (!file || seen.has(file)) continue;
    seen.add(file);
    for (const match of readFileSync(file, "utf8").matchAll(STATIC_IMPORT)) {
      const specifier = match[1] ?? "";
      const next = resolveInFeature(file, specifier);
      if (next) queue.push(next);
      else external.push({ file, specifier });
    }
  }
  return { seen, external };
}

const productionFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory())
      return name === "model3d" || name === VIEW_DIR ? [] : productionFiles(full);
    return /\.(ts|tsx)$/.test(name) &&
      !/\.test\./.test(name) &&
      name !== "test-fixtures.ts" &&
      !name.includes("test-utils")
      ? [full]
      : [];
  });

describe("three.js stays out of the first load", () => {
  const { seen, external } = staticClosure(path.join(FEATURE, "index.ts"));

  it("the feature's entry reaches the section", () => {
    expect([...seen].some((file) => file.endsWith("PrintConfigSection.tsx"))).toBe(true);
  });

  it("nothing statically reachable from the entry imports three", () => {
    expect(
      external.filter(({ specifier }) => specifier === "three" || specifier.startsWith("three/")),
    ).toEqual([]);
  });

  it("nothing statically reachable from the entry is a model3d file that imports three", () => {
    expect(
      [...seen].filter((file) => HEAVY.has(file)).map((file) => path.relative(FEATURE, file)),
    ).toEqual([]);
  });

  it("no production file of the feature outside model3d imports three or the model3d entry statically", () => {
    const offenders = productionFiles(FEATURE).flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(STATIC_IMPORT)]
        .map((m) => m[1] ?? "")
        .filter(
          (spec) =>
            spec === "three" || spec.startsWith("three/") || /(^|\/)model3d(\/index)?$/.test(spec),
        )
        .map((spec) => `${path.relative(FEATURE, file)} -> ${spec}`),
    );
    expect(offenders).toEqual([]);
  });

  it("nothing statically reachable from the entry is a file of the 3D view", () => {
    expect([...seen].filter((file) => file.includes(`${path.sep}${VIEW_DIR}${path.sep}`))).toEqual(
      [],
    );
  });

  it("no production file outside the view folder imports it statically", () => {
    const offenders = productionFiles(FEATURE).flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(STATIC_IMPORT)]
        .map((m) => m[1] ?? "")
        .filter((spec) => spec.includes(VIEW_DIR))
        .map((spec) => `${path.relative(FEATURE, file)} -> ${spec}`),
    );
    expect(offenders).toEqual([]);
  });

  it("the 3D view is reached only through a dynamic import, made by the slot once there is something to show", () => {
    const slot = readFileSync(path.join(FEATURE, "components", "ModelViewSlot.tsx"), "utf8");
    expect(slot).toMatch(/dynamic\(\s*\(\) => import\("\.\/model-view\/PrintModelView"\)/);
    expect(slot).toMatch(/ssr: false/);
    // the only file outside the folder that names it at all is the slot, in that one import
    const naming = productionFiles(FEATURE).filter((file) =>
      readFileSync(file, "utf8").includes(`/${VIEW_DIR}/`),
    );
    expect(naming.map((file) => path.basename(file))).toEqual(["ModelViewSlot.tsx"]);
  });

  it("the reading hook loads model3d on demand, when a file is chosen", () => {
    const source = readFileSync(path.join(FEATURE, "components", "use-glb-reading.ts"), "utf8");
    expect(source).toMatch(/await import\("\.\.\/model3d"\)/);
  });
});
