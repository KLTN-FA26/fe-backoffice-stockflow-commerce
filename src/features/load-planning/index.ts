/**
 * Xếp hàng lên xe (load planning) — public API của feature. PR F1: thư viện + khung 3D (hợp đồng `Layout`:
 * `schemas.ts`). PR F4: kế hoạch xếp xe (danh sách, lập mới, chi tiết) nối BE PR #161 — xem README.md.
 *
 * KHÔNG export `VehicleViewer3D` ở đây: nó kéo three vào bundle. Dùng `VehicleViewer` (next/dynamic).
 */

export * from "./types";
export * from "./schemas";
export * from "./selectors";
export * from "./plan-types";
export * from "./plan-schemas";
export * from "./reconciliation-schemas";
export * from "./plan-selectors";
export * from "./input-schemas";
export * from "./api";
export * from "./api-steps";
export * from "./queries";
export * from "./mutations";
export * from "./lifecycle";
export * from "./errors";
export * from "./lib/dims";
export * from "./lib/palette";
export * from "./lib/piece-check";
export * from "./lib/loading-steps";
export * from "./lib/item-rows";
export * from "./lib/kit-balance";
export * from "./lib/layout-check";
export * from "./lib/manual-packing";
export * from "./lib/empty-spaces";
export * from "./lib/scene";
export * from "./lib/view-presets";
export { VehicleViewer } from "./components/viewer/VehicleViewer";
export type { EmptySpace, VehicleViewer3DProps } from "./components/viewer/VehicleViewer3D";
export { LayoutMetrics } from "./components/report/LayoutMetrics";
export { MetricsStrip } from "./components/report/MetricsStrip";
export { VehicleItemTable } from "./components/report/VehicleItemTable";
export { KitBalanceBadge } from "./components/report/KitBalanceBadge";

// Ước tính xếp xe (SCRUM-287 F3, BE PR #160)
export * from "./estimate-types";
export * from "./estimate-schemas";
export * from "./estimate-api";
export * from "./estimate-queries";
export * from "./estimate-errors";
export * from "./lib/estimate-view";
export { LoadEstimateButton } from "./components/estimate/LoadEstimateButton";
export type { LoadEstimateButtonProps } from "./components/estimate/LoadEstimateButton";
