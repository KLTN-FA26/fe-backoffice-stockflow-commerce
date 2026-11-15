// Split from stockflow-storefront src/features/product-design/engine/model3d/load.ts (`bakeMillimetres`)
import { type BufferGeometry, Camera, type Group, Light, Mesh } from "three";

import { MODEL3D_LIMITS } from "@/constants/numbers";

/**
 * Scales the whole tree from metres to millimetres and bakes it (exported for tests, not part of the
 * public barrel): every node's translation and every geometry (once,
 * also when shared) is multiplied by 1000, node rotations and scales are left alone. That is the
 * same as scaling the world by 1000, so every mesh keeps its place and its `matrixWorld` is in mm.
 * Morph targets, skins and instanced meshes are not scaled: the file convention forbids animation.
 */
export function bakeMillimetres(root: Group) {
  const factor = MODEL3D_LIMITS.mmPerMetre;
  const scaled = new Set<BufferGeometry>();
  const drop: (Light | Camera)[] = [];
  root.traverse((object) => {
    object.position.multiplyScalar(factor);
    if (object instanceof Mesh && !scaled.has(object.geometry)) {
      scaled.add(object.geometry);
      object.geometry.scale(factor, factor, factor);
    }
    // The viewer lights the scene itself.
    if (object instanceof Light || object instanceof Camera) drop.push(object);
  });
  drop.forEach((object) => object.removeFromParent());
  root.updateMatrixWorld(true);
}
