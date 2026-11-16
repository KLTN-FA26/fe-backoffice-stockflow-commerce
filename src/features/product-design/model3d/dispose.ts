// Ported from stockflow-storefront src/features/product-design/engine/model3d/dispose.ts
import { type BufferGeometry, type Material, Mesh, type Object3D, Texture } from "three";

/** Every texture a material holds in one of its image slots (`map`, `normalMap`, ...). */
export function texturesOf(material: Material): Texture[] {
  return Object.values(material).filter((value): value is Texture => value instanceof Texture);
}

/** Frees a texture and, for a decoded `ImageBitmap`, its pixels. */
function disposeTexture(texture: Texture) {
  const image: unknown = texture.image;
  texture.dispose();
  if (image && typeof image === "object" && "close" in image && typeof image.close === "function") {
    image.close();
  }
}

/** Frees materials and the textures they hold, once each. */
export function disposeMaterials(
  materials: Iterable<Material>,
  keep: ReadonlySet<Texture> = new Set(),
) {
  const textures = new Set<Texture>();
  for (const material of new Set(materials)) {
    for (const texture of texturesOf(material)) if (!keep.has(texture)) textures.add(texture);
    material.dispose();
  }
  textures.forEach(disposeTexture);
}

export function materialsOf(mesh: Mesh): Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

/** Frees the geometry, materials and textures of every mesh below `root`. */
export function disposeGlbTree(root: Object3D) {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    geometries.add(object.geometry);
    materialsOf(object).forEach((material) => materials.add(material));
  });
  geometries.forEach((geometry) => geometry.dispose());
  disposeMaterials(materials);
}
