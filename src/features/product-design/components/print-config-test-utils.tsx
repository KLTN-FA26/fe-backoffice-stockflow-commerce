/** Helpers of the print-configuration screen tests: a render with providers, `.glb` files, and in-memory trees. */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import path from "node:path";
import { BufferAttribute, BufferGeometry, Group, Mesh } from "three";

import { SEED_PRINT_CONFIG_VARIANT } from "@/lib/api/mock-print-config-store";

import { PrintConfigSection } from "./PrintConfigSection";

import type { ReactElement } from "react";
import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { GlbLoader } from "./use-glb-reading";

export const SEED = SEED_PRINT_CONFIG_VARIANT;
/** A customizable variant with no configuration yet. */
export const EMPTY_VARIANT = { productId: "PRD-001", variantId: "SKU-001-BLK-L" };

/** The file input's name with no file chosen, for a new configuration and for a saved one. */
export const NEW_FILE = "Chọn hoặc kéo thả file .glb";
export const REPLACE_FILE = "Chọn file .glb khác để thay";
/** The same input's name once a file is chosen (the row's "Đổi file" opens it). */
export const CHANGE_FILE = "Đổi file .glb";
/** The file input, whatever its look: present means the person may choose a file. */
export const FILE_INPUT =
  /^(Chọn hoặc kéo thả file \.glb|Chọn file \.glb khác để thay|Đổi file \.glb)$/;
/** The title button of the defaults card (closed until opened). */
export const DEFAULTS_TOGGLE = { name: "Số mặc định (cần xác nhận với nhà in)" };
/** The page band: who the page is about, the configuration's status, activate / stop and the save. */
export const STATUS_CARD = { name: "Biến thể và trạng thái cấu hình in" };
export const CHOSEN_FILE = { name: "File đã chọn" };

/**
 * The status in the page band, once the configuration is loaded (waits for it to read `label`). The band is looked up
 * again on each try: the loading band and the loaded one are different elements.
 */
export async function findStatus(label: string) {
  return waitFor(() => within(screen.getByRole("region", STATUS_CARD)).getByText(label));
}

export const allowAll = (_: PermissionCode) => true;
export const allowNone = (_: PermissionCode) => false;
/** Read, but not update. */
export const readOnly = (permission: PermissionCode) => permission.endsWith(":READ");

export function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

export function renderSection(
  props: Partial<React.ComponentProps<typeof PrintConfigSection>> = {},
) {
  return renderWithQuery(
    <PrintConfigSection
      productId={SEED.productId}
      variantId={SEED.variantId}
      can={allowAll}
      {...props}
    />,
  );
}

/** The real sample cup of `public/mock/models`, as a `File`. */
export function sampleCupFile(): File {
  const bytes = readFileSync(path.resolve(process.cwd(), "public/mock/models/sample-cup-12oz.glb"));
  return new File([new Uint8Array(bytes)], "sample-cup-12oz.glb", { type: "model/gltf-binary" });
}

/** The `{ name, bytes }` a save carries for its file. */
export const savedFile = (name = "model.glb", size = 16) => ({
  name,
  bytes: new Uint8Array(size).buffer,
});

/** A permission check that allows exactly these codes. */
export const canWith =
  (...codes: PermissionCode[]) =>
  (permission: PermissionCode) =>
    codes.includes(permission);

export const glbFile = (name = "model.glb", size = 64) =>
  new File([new Uint8Array(size)], name, { type: "model/gltf-binary" });

/** A file that reports another size (no memory spent on it). */
export function glbOfSize(name: string, size: number): File {
  const file = glbFile(name);
  Object.defineProperty(file, "size", { value: size });
  return file;
}

/** A band of a truncated cone around Y, from `y0` to `y1`, whose radius follows the 90 / 60 / 110 cup. */
function band(name: string, y0: number, y1: number): Mesh {
  const radiusAt = (y: number) => (60 + (30 * y) / 110) / 2;
  const segments = 64;
  const rings = [
    { y: y1, r: radiusAt(y1) },
    { y: y0, r: radiusAt(y0) },
  ];
  const positions: number[] = [];
  for (const { y, r } of rings) {
    for (let i = 0; i < segments; i += 1) {
      const a = (i / segments) * 2 * Math.PI;
      positions.push(-r * Math.sin(a), y, -r * Math.cos(a));
    }
  }
  const index: number[] = [];
  for (let i = 0; i < segments; i += 1) {
    const a = i;
    const b = (i + 1) % segments;
    index.push(a, a + segments, b, b, a + segments, b + segments);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setIndex(index);
  const mesh = new Mesh(geometry);
  mesh.name = name;
  return mesh;
}

const treeOf = (...meshes: Mesh[]) => {
  const root = new Group();
  root.add(...meshes);
  return root;
};

/** A cup the way the sample is built: the print band `print:BODY` over a full wall. */
export const cupTree = (printName = "print:BODY") =>
  treeOf(band(printName, 7.927, 104.055), band("wall", 0, 110));

/** A tree with no `print:*` object at all. */
export const treeWithoutPrint = () => treeOf(band("wall", 0, 110));

export interface BagShift {
  dx?: number;
  dy?: number;
  dz?: number;
}

/** A 260 x 120 x 280 bag, faces FRONT +z, BACK -z, RIGHT +x, LEFT -x, optionally shifted or with faces left out. */
export function bagTree(
  shift: BagShift = {},
  faces: readonly string[] = ["FRONT", "BACK", "LEFT", "RIGHT"],
): Group {
  const [w, g, h] = [260, 120, 280];
  const quads: Record<string, number[][]> = {
    FRONT: [
      [-w / 2, h, g / 2],
      [-w / 2, 0, g / 2],
      [w / 2, 0, g / 2],
      [w / 2, h, g / 2],
    ],
    BACK: [
      [w / 2, h, -g / 2],
      [w / 2, 0, -g / 2],
      [-w / 2, 0, -g / 2],
      [-w / 2, h, -g / 2],
    ],
    LEFT: [
      [-w / 2, h, -g / 2],
      [-w / 2, 0, -g / 2],
      [-w / 2, 0, g / 2],
      [-w / 2, h, g / 2],
    ],
    RIGHT: [
      [w / 2, h, g / 2],
      [w / 2, 0, g / 2],
      [w / 2, 0, -g / 2],
      [w / 2, h, -g / 2],
    ],
  };
  const meshes = faces.map((code) => {
    const corners = (quads[code] ?? []).flatMap(([x = 0, y = 0, z = 0]) => [
      x + (shift.dx ?? 0),
      y + (shift.dy ?? 0),
      z + (shift.dz ?? 0),
    ]);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(corners), 3));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    const mesh = new Mesh(geometry);
    mesh.name = `print:${code}`;
    return mesh;
  });
  return treeOf(...meshes);
}

/** A tree with the front face of a bag only: enough to read its size, not to size the whole bag. */
export function frontFaceOnlyTree(): Group {
  const [w, g, h] = [120, 80, 160];
  const corners = [-w / 2, h, g / 2, -w / 2, 0, g / 2, w / 2, 0, g / 2, w / 2, h, g / 2];
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(corners), 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const face = new Mesh(geometry);
  face.name = "print:FRONT";
  return treeOf(face);
}

/** The geometry of the first mesh, to watch when the tree is freed. */
export function firstGeometry(root: Group): BufferGeometry {
  const first = root.children[0];
  if (!(first instanceof Mesh)) throw new Error("tree without a mesh");
  return first.geometry;
}

/** A loader that hands out the given trees one after the other. */
export function loaderOf(...trees: Group[]): GlbLoader & { calls: () => number } {
  let n = 0;
  const load: GlbLoader = async () => {
    const tree = trees[Math.min(n, trees.length - 1)];
    n += 1;
    if (!tree) throw new Error("no tree");
    return tree;
  };
  return Object.assign(load, { calls: () => n });
}

/**
 * Press "Lưu cấu hình in" of a stored configuration and confirm the dialog it opens (a save bumps the version of what
 * is stored, so it asks first; a first save of a new configuration does not).
 */
export async function saveStored(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Lưu cấu hình in" }));
  const dialog = within(await screen.findByRole("dialog", { name: "Lưu cấu hình in?" }));
  await user.click(dialog.getByRole("button", { name: "Lưu cấu hình in" }));
}
