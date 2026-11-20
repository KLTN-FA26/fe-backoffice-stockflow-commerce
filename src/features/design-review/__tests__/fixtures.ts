/** Dữ liệu dạng BE (DesignDraftResponse / DesignArtifactResponse…) cho test màn duyệt thiết kế. */

import type { DesignArtifact } from "../types";

export const DESIGN_ID = "01a1f291-0000-7000-8000-000000000001";
export const CUSTOMER_ID = "0c000000-0000-7000-8000-000000000009";

/** Trường nullable đã bị BE bỏ khỏi JSON (Jackson non_null). */
export const PENDING_DESIGN = {
  id: DESIGN_ID,
  customerId: CUSTOMER_ID,
  productId: "0p000000-0000-7000-8000-000000000001",
  name: "Ly giấy Tết 2027",
  status: "PENDING_REVIEW",
  currentArtifactId: "0a000000-0000-7000-8000-000000000003",
  version: 7,
  productSlug: "ly-giay-12oz",
  sku: "CUP-12OZ-WHT",
  templateCode: "TPL-CUP-12OZ",
  reviewRequestedAt: "2026-11-18T03:00:00Z",
  updatedAt: "2026-11-18T03:00:00Z",
  previewArtifactId: "0a000000-0000-7000-8000-000000000003",
  previewUrl: "https://files.example.com/preview.png?sig=1",
  variantName: "12oz trắng",
  productName: "Ly giấy 12oz",
};

export const CUSTOMER = {
  customerId: CUSTOMER_ID,
  fullName: "Cửa hàng Trà Sen",
  email: "trasen@example.com",
};

function artifact(
  id: string,
  role: DesignArtifact["role"],
  storedAt: string,
  extra: Partial<DesignArtifact> = {},
) {
  return {
    artifactId: id,
    designId: DESIGN_ID,
    role,
    originalName: `${role.toLowerCase()}.${role === "CUSTOMER_PREVIEW" ? "png" : "pdf"}`,
    contentType: role === "CUSTOMER_PREVIEW" ? "image/png" : "application/pdf",
    sizeBytes: 1_048_576,
    storedAt,
    checksum: `sha-${id}`,
    ...extra,
  };
}

/** BE trả mới nhất trước; lần gửi trước còn trong danh sách. */
export const ARTIFACTS = [
  artifact("0a000000-0000-7000-8000-000000000003", "CUSTOMER_PREVIEW", "2026-11-18T02:59:00Z"),
  artifact("0a000000-0000-7000-8000-000000000004", "PRINT_READY", "2026-11-18T02:58:00Z"),
  artifact("0a000000-0000-7000-8000-000000000005", "TECHNICAL_SPEC", "2026-11-18T02:57:00Z"),
  artifact("0a000000-0000-7000-8000-000000000001", "CUSTOMER_PREVIEW", "2026-11-10T02:59:00Z"),
  artifact("0a000000-0000-7000-8000-000000000002", "PRINT_READY", "2026-11-10T02:58:00Z"),
];
