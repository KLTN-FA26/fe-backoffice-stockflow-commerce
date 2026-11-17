/**
 * Dữ liệu seed của mock cấu hình in: một ly 12oz đã có file `.glb` mẫu, ở biến thể SKU-001-WHT-L của PRD-001
 * (sản phẩm Customizable, trạng thái Published nên màn hình mở được để sửa; biến thể = SKU trong mock-data).
 */
import type { CupModel } from "@/features/product-design/model3d";
import type { MockPrintTemplate } from "./mock-print-config-store";

export const SEED_PRINT_CONFIG_VARIANT = {
  productId: "PRD-001",
  variantId: "SKU-001-WHT-L",
} as const;

/** SHA-256 của `public/mock/models/sample-cup-12oz.glb` (113.376 byte), file mà số đo mẫu được đo ra. */
const SAMPLE_CUP_FILE = {
  url: "/mock/models/sample-cup-12oz.glb",
  name: "sample-cup-12oz.glb",
  sizeBytes: 113_376,
  checksum: "1faf14f6b7b9e7be5ac2d174dce76d7574ef5299387c001bdd0703943f65a7ea",
} as const;

const SAMPLE_CUP_MODEL: CupModel = {
  kind: "parametric-cup",
  topDiameterMm: 90,
  bottomDiameterMm: 60,
  heightMm: 110,
  rimMm: 3,
  seamMm: 8,
  bandTopOffsetMm: 6,
  bandBottomOffsetMm: 8,
  material: "paper-white",
};

export function seedTemplates(): MockPrintTemplate[] {
  const { productId, variantId } = SEED_PRINT_CONFIG_VARIANT;
  return [
    {
      templateId: "tpl-seed-cup12-body",
      productId,
      variantId,
      sku: variantId,
      code: "CUP12-BODY",
      name: "Ly giấy 12oz - thân ly",
      minDpi: 300,
      colorMode: "CMYK",
      allowedFileFormats: ["image/png", "image/jpeg"],
      maxFileSizeMb: 50,
      maxColors: null,
      allowedFontCodes: null,
      active: true,
      model: SAMPLE_CUP_MODEL,
      areas: [{ code: "BODY", name: "Thân ly", safeMarginMm: 3, bleedMm: 2 }],
      surfaces: [{ printAreaCode: "BODY", meshName: "print:BODY" }],
      file: { ...SAMPLE_CUP_FILE },
      version: 3,
    },
  ];
}
