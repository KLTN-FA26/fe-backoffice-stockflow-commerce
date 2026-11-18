/**
 * Store in-memory cho mock goods receipt (BE PR #62), chỉ dùng khi USE_MOCK=true.
 *
 * Phiếu seed sinh từ store PO mock — tức là phiếu mua hàng cũ (`receiptType = PURCHASE`) mà BE vẫn cho đọc sau
 * 4A-8; thùng của chúng là nguồn tồn kho mock (`mock-receipt-cartons`). Record giữ vài field nội bộ cũ (dòng PO,
 * cờ QC) để seed tồn kho; response đi qua `toReceiptView`. Không có phiếu nào nằm ở CONFIRMED: BE rời trạng thái
 * đó ngay trong transaction xác nhận (GoodsReceiptStatus javadoc).
 */

import { beError, beOk, getPoStore, readRouteId } from "./mock-routes-purchase-orders-store";
import { cartonLineView, resetMockCartons } from "./mock-receipt-cartons";

import type { MockReceiptPackage } from "./mock-receipt-cartons";
import type { MockBePo } from "./mock-routes-purchase-orders-store";

export type MockReceiptStatus =
  "DRAFT" | "PENDING_APPROVAL" | "CONFIRMED" | "IN_PUTAWAY" | "CLOSED" | "CANCELLED";
export type MockQcProgress = "NOT_REQUIRED" | "AWAITING_MOVE_TO_QC" | "IN_QC_AREA" | "INSPECTED";
export type MockQcOutcome = "ACCEPTED" | "QUARANTINE" | "REJECTED";

export interface MockInspection {
  id: string;
  outcome: MockQcOutcome;
  quantity: number;
  locationCode: string | null;
  reason: string | null;
  inspectedBy: string;
  inspectedAt: string;
}

export interface MockReceiptLine {
  id: string;
  /** null trên phiếu không có PO (BR-RCP-002): dòng gọi hàng bằng SKU. */
  purchaseOrderLineId: string | null;
  purchaseOrderLineNo: number | null;
  inventoryItemId: string;
  sku: string | null;
  quantity: number;
  lotNumber: string | null;
  expiryDate: string | null;
  locationCode: string;
  note: string | null;
  qcRequired: boolean;
  qcProgress: MockQcProgress;
  qcLocationCode: string | null;
  movedToQcAt: string | null;
  quantityForPutaway: number;
  inspections: MockInspection[];
  warnings?: string[];
  /** SCRUM-473: đơn vị đóng gói của các thùng (null = dòng lẻ). */
  unitOfMeasure?: string | null;
  /** SCRUM-473: thùng của dòng, kể cả VOID (view lọc bỏ — `cartonLineView`). */
  packages?: MockReceiptPackage[];
}

export interface MockReceipt {
  id: string;
  number: string;
  /** null trên phiếu không có PO (BR-RCP-002, SCRUM-478). */
  purchaseOrderId: string | null;
  purchaseOrderNumber: string | null;
  warehouseId: string;
  supplierId?: string | null;
  supplierName?: string | null;
  withoutPurchaseOrder?: boolean;
  blindReason?: string | null;
  /** PO gắn bổ sung — chỉ tham chiếu (owner NOPO-ATTACH). */
  referencedPurchaseOrderId?: string | null;
  referencedPurchaseOrderNumber?: string | null;
  status: MockReceiptStatus;
  deliveryNote: string | null;
  note: string | null;
  receivedAt: string;
  receivedBy: string;
  confirmedAt: string | null;
  confirmedBy: string | null;
  closedAt: string | null;
  lines: MockReceiptLine[];
  warnings?: string[];
}

/* ── Kho & khu (chép seed demo BE: db/demo V20260928009000 + V20260929000270) ─ */

export const MOCK_WAREHOUSE_ID = "d99123fd-2997-4751-6bb9-e10a2e6d9949";
export const MOCK_RECEIPT_ACTOR = "mock-user";

export type MockAreaType = "RECEIVING" | "QUALITY_CONTROL" | "QUARANTINE";

/** BE `warehouse.area` của kho HCM — mã vị trí (location_code) → loại khu. */
export const MOCK_AREAS: Readonly<Record<string, MockAreaType>> = {
  "HCM-RCV01": "RECEIVING",
  "HCM-QCA01": "QUALITY_CONTROL",
  "HCM-QC01": "QUARANTINE",
  "HCM-RTV01": "QUARANTINE",
};

/* ── Chính sách SKU (BE InventoryItemPolicy) ──────────────────────────── */

export interface MockItemPolicy {
  inventoryItemId: string;
  lotTracked: boolean;
  expiryTracked: boolean;
  qcRequired: boolean;
}

/**
 * Lấy cờ lô/hạn dùng từ catalog mock. ASSUMPTION (mock): `qcRequired` = SKU theo dõi lô —
 * mock-data không có cờ "Yêu cầu QC khi nhận" của docs 01 và không SKU nào theo dõi hạn dùng;
 * cần SKU 3 bước để demo luồng QC. BE thật đọc cờ `qc_required` của inventory item.
 */
export async function itemPolicy(sku: string): Promise<MockItemPolicy> {
  const { skus } = await import("@/lib/mock-data");
  const found = skus.find((s) => s.skuId === sku);
  return {
    inventoryItemId: `item-${sku}`,
    lotTracked: found?.lotTracking ?? false,
    expiryTracked: found?.expiryTracking ?? false,
    qcRequired: found?.lotTracking ?? false,
  };
}

/** SKU có trong catalog mock không (BE: `inventory.itemPolicy(Sku)` rỗng → `INVENTORY_ITEM_NOT_FOUND`). */
export async function mockSkuExists(sku: string): Promise<boolean> {
  const { skus } = await import("@/lib/mock-data");
  return skus.some((s) => s.skuId === sku);
}

/** Kho demo duy nhất của mock (HCM) — cho ô chọn kho của phiếu không có PO. */
export const MOCK_WAREHOUSE_OPTION = {
  id: MOCK_WAREHOUSE_ID,
  prefix: "HCM",
  name: "Kho Hồ Chí Minh",
} as const;

/* ── Seed ────────────────────────────────────────────────────────────── */

let store: Map<string, MockReceipt> | null = null;
let sequence = 0;

const DAY_MS = 24 * 60 * 60 * 1000;
const SEED_BASE = Date.parse("2026-10-09T02:00:00Z");

/** BE `GoodsReceiptRepositoryAdapter#nextNumber`: GR-yyyyMMdd-NNNN theo ngày VN. */
export function nextReceiptNumber(at: string): string {
  sequence += 1;
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" })
    .format(new Date(at))
    .replaceAll("-", "");
  return `GR-${day}-${String(sequence).padStart(4, "0")}`;
}

function daysAgo(days: number): string {
  return new Date(SEED_BASE - days * DAY_MS).toISOString();
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

async function seedLine(
  po: MockBePo,
  index: number,
  quantity: number,
  receivedAt: string,
  progress: MockQcProgress | "auto",
): Promise<MockReceiptLine> {
  const poLine = po.lines[index];
  if (!poLine) throw new Error(`PO ${po.poNumber} has no line ${index}`);
  const policy = await itemPolicy(poLine.sku);
  const qcProgress =
    progress === "auto" ? (policy.qcRequired ? "INSPECTED" : "NOT_REQUIRED") : progress;
  const inspected = qcProgress === "INSPECTED";
  return {
    id: crypto.randomUUID(),
    purchaseOrderLineId: poLine.lineId,
    purchaseOrderLineNo: index + 1,
    inventoryItemId: policy.inventoryItemId,
    sku: poLine.sku,
    quantity,
    lotNumber: policy.lotTracked ? `LOT-${poLine.sku}-${receivedAt.slice(5, 10)}` : null,
    expiryDate: policy.expiryTracked ? addDays(receivedAt, 365) : null,
    locationCode: "HCM-RCV01",
    note: null,
    qcRequired: policy.qcRequired,
    qcProgress: policy.qcRequired ? qcProgress : "NOT_REQUIRED",
    qcLocationCode: policy.qcRequired && qcProgress !== "AWAITING_MOVE_TO_QC" ? "HCM-QCA01" : null,
    movedToQcAt: policy.qcRequired && qcProgress !== "AWAITING_MOVE_TO_QC" ? receivedAt : null,
    quantityForPutaway: policy.qcRequired && !inspected ? 0 : quantity,
    inspections:
      policy.qcRequired && inspected
        ? [
            {
              id: crypto.randomUUID(),
              outcome: "ACCEPTED",
              quantity,
              locationCode: null,
              reason: null,
              inspectedBy: MOCK_RECEIPT_ACTOR,
              inspectedAt: receivedAt,
            },
          ]
        : [],
  };
}

interface SeedSpec {
  po: MockBePo;
  status: MockReceiptStatus;
  ageDays: number;
  /** [chỉ số dòng PO, SL, tiến độ QC] */
  lines: readonly (readonly [number, number, MockQcProgress | "auto"])[];
}

async function build(spec: SeedSpec): Promise<MockReceipt> {
  const receivedAt = daysAgo(spec.ageDays);
  const confirmed = !["DRAFT", "CANCELLED"].includes(spec.status);
  const lines = await Promise.all(
    spec.lines.map(([index, qty, progress]) => seedLine(spec.po, index, qty, receivedAt, progress)),
  );
  return {
    id: crypto.randomUUID(),
    number: nextReceiptNumber(receivedAt),
    purchaseOrderId: spec.po.purchaseOrderId,
    purchaseOrderNumber: spec.po.poNumber,
    warehouseId: MOCK_WAREHOUSE_ID,
    status: spec.status,
    deliveryNote: `DN-${spec.po.poNumber.slice(-4)}-${spec.ageDays}`,
    note: null,
    receivedAt,
    receivedBy: MOCK_RECEIPT_ACTOR,
    confirmedAt: confirmed ? receivedAt : null,
    confirmedBy: confirmed ? MOCK_RECEIPT_ACTOR : null,
    closedAt: spec.status === "CLOSED" ? receivedAt : null,
    lines,
  };
}

/** Chia `total` thành các đợt giao (đợt cuối nhận phần dư). */
function split(total: number, parts: number): number[] {
  const base = Math.floor(total / parts);
  return Array.from({ length: parts }, (_, i) =>
    i === parts - 1 ? total - base * (parts - 1) : base,
  );
}

/**
 * Phiếu đã xác nhận cộng lại đúng `quantityReceived` của PO (3 đợt giao + 2 phiếu In QC: một chờ
 * chuyển QC, một đã ở khu QC); PO còn mở có thêm DRAFT / CANCELLED để demo đủ trạng thái.
 */
async function seedSpecs(): Promise<SeedSpec[]> {
  const pos = [...(await getPoStore()).values()];
  const specs: SeedSpec[] = [];
  for (const po of pos) {
    const received = po.lines.map((line) => line.quantityReceived);
    // D4: PO nhận đủ là RECEIVED, rồi CLOSED khi đóng đơn.
    const fullyReceived = po.status === "RECEIVED" || po.status === "CLOSED";
    if (received.some((qty) => qty > 0)) {
      const waves = received.map((qty) => split(qty, 3));
      [0, 1, 2].forEach((wave) => {
        specs.push({
          po,
          status: wave < 2 || fullyReceived ? "CLOSED" : "IN_PUTAWAY",
          ageDays: 30 - wave * 7,
          lines: po.lines
            .map((_, index) => [index, waves[index]?.[wave] ?? 0, "auto"] as const)
            .filter(([, qty]) => qty > 0),
        });
      });
    }
    if (po.status !== "CONFIRMED" && po.status !== "PARTIALLY_RECEIVED") continue;
    const openIndex = po.lines.findIndex((line) => line.openQuantity > 0);
    specs.push({ po, status: "CANCELLED", ageDays: 6, lines: [] });
    specs.push({ po, status: "DRAFT", ageDays: 0, lines: [] });
    if (openIndex >= 0) {
      specs.push({ po, status: "DRAFT", ageDays: 1, lines: [[openIndex, 1, "auto"]] });
    }
  }
  return specs;
}

export async function getReceiptStore(): Promise<Map<string, MockReceipt>> {
  if (!store) {
    sequence = 0;
    const receipts: MockReceipt[] = [];
    for (const spec of await seedSpecs()) {
      receipts.push(await build(spec));
    }
    store = new Map(receipts.map((receipt) => [receipt.id, receipt]));
  }
  return store;
}

export function resetReceiptMockStore(): void {
  store = null;
  sequence = 0;
  resetMockCartons();
}

/* ── Helpers dùng chung cho routes phiếu ─────────────────────────────── */

/**
 * Như BE `GoodsReceiptWebMapper#toResponse` sau 4A-9: gắn field thùng của mọi dòng (SCRUM-473) và
 * `receiptType`. Phiếu seed sinh từ PO mock nên đều là phiếu mua hàng cũ (`PURCHASE`).
 */
export function toReceiptView(receipt: MockReceipt) {
  return {
    ...receipt,
    receiptType: "PURCHASE" as const,
    warnings: [],
    lines: receipt.lines.map((line) => ({ ...line, ...cartonLineView(line), warnings: [] })),
  };
}

export async function saveReceipt(receipt: MockReceipt) {
  (await getReceiptStore()).set(receipt.id, receipt);
  return beOk(toReceiptView(receipt));
}

export function receiptNotFound(id: string) {
  return beError(404, "GOODS_RECEIPT_NOT_FOUND", `No goods receipt ${id}`);
}

export function invalidReceiptTransition(message: string) {
  return beError(409, "INVALID_RECEIPT_TRANSITION", message);
}

export async function loadReceipt(config: Parameters<typeof readRouteId>[0]) {
  const id = readRouteId(config);
  const receipt = (await getReceiptStore()).get(id);
  return { id, receipt };
}
