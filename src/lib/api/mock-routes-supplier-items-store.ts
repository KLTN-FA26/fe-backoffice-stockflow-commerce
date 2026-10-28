/**
 * Mock danh mục hàng NCC (BE #117/#118) — store in-memory + luật điều khoản dùng chung cho
 * `mock-routes-supplier-items.ts` (CRUD danh mục) và `mock-routes-purchase-orders.ts` (kiểm dòng PO).
 *
 * Wire shape = BE `SupplierItemResponse`. Lỗi theo envelope BE (`beError`, `fieldErrors[{field,message,code}]`).
 */

import { getPoStore, todayVn } from "./mock-routes-purchase-orders-store";
import { findMockSupplier } from "./mock-routes-suppliers";
import { bumpMockItemVersionForSku, registerMockSkuReferences } from "./mock-routes-variants";

import type { MockBePo, MockFieldError } from "./mock-routes-purchase-orders-store";

export interface MockSupplierItem {
  supplierItemId: string;
  supplierId: string;
  inventoryItemId: string;
  sku: string;
  supplierSkuCode: string | null;
  price: number;
  currency: string;
  moq: number;
  packSize: number;
  leadTimeDays: number | null;
  effectiveLeadTimeDays: number;
  preferred: boolean;
  version: number;
  createdAt: string;
  /** BE `last_modified_at` NULL tới lần sửa đầu → bị bỏ khỏi JSON (Jackson non_null). */
  lastModifiedAt: string | null;
}

/** Hàng lưu trong store: `preferred` và `effectiveLeadTimeDays` được tính lại khi đọc. */
export type StoredSupplierItem = Omit<MockSupplierItem, "preferred" | "effectiveLeadTimeDays">;

/** BE `CommercialTerms.LEAD_DAYS` — lead time mặc định khi cả dòng lẫn NCC không có. */
const DEFAULT_LEAD_DAYS = 7;
const DEFAULT_CURRENCY = "VND";
/** BE `PurchasePrices.maxScale`: min(2, số lẻ của tiền tệ). */
const MAX_PRICE_SCALE = 2;

/** BE `SupplierItemRepository.usedByOpenPurchaseOrder`: PO còn đặt hàng (DRAFT … PARTIALLY_RECEIVED). */
const IN_USE_PO_STATUSES: readonly string[] = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "CONFIRMED",
  "PARTIALLY_RECEIVED",
];

let items: StoredSupplierItem[] = [];
/** sku → supplierId mặc định (BE: NCC mặc định của inventory item; "ưu tiên" suy ra từ đây). */
const defaultSupplierBySku = new Map<string, string>();

// BE `item_in_use`: có dòng danh mục NCC → SKU không đổi được; NCC mặc định nằm trên hồ sơ → đi theo SKU
registerMockSkuReferences("supplier-items", {
  inUse: (sku) => items.some((i) => i.sku === sku),
  rename: (from, to) => {
    const supplierId = defaultSupplierBySku.get(from);
    if (supplierId === undefined) return;
    defaultSupplierBySku.delete(from);
    defaultSupplierBySku.set(to, supplierId);
  },
});
let seedPromise: Promise<void> | null = null;

export function resetSupplierItemMockStore(): void {
  items = [];
  defaultSupplierBySku.clear();
  seedPromise = null;
}

/** NCC mặc định của SKU — nguồn duy nhất, dùng chung với mock thông tin mua hàng (`defaultSupplierId`). */
export function mockDefaultSupplierOf(sku: string): string | null {
  return defaultSupplierBySku.get(sku) ?? null;
}

/**
 * Ghi NCC mặc định từ PUT thông tin mua hàng. Không tự tăng version — PUT đó đã tăng một lần
 * (BE `ItemPurchasingRepository.save`: `version=version+1` trong cùng câu UPDATE).
 */
export function setMockDefaultSupplier(sku: string, supplierId: string | null): void {
  if (supplierId === null) defaultSupplierBySku.delete(sku);
  else defaultSupplierBySku.set(sku, supplierId);
}

/** BE `assignDefaultSupplier`: chỉ ghi + tăng version hồ sơ khi giá trị thật sự đổi (`is distinct from`). */
function assignDefault(sku: string, supplierId: string): void {
  if (defaultSupplierBySku.get(sku) === supplierId) return;
  defaultSupplierBySku.set(sku, supplierId);
  bumpMockItemVersionForSku(sku);
}

/** BE `clearDefaultSupplier`: chỉ xoá (và tăng version) khi NCC mặc định đang là chính NCC này. */
function clearDefault(sku: string, supplierId: string): void {
  if (defaultSupplierBySku.get(sku) !== supplierId) return;
  defaultSupplierBySku.delete(sku);
  bumpMockItemVersionForSku(sku);
}

function pairExists(supplierId: string, sku: string): boolean {
  return items.some((i) => i.supplierId === supplierId && i.sku === sku);
}

interface ItemTerms {
  supplierSkuCode?: string | null;
  moq?: number;
  packSize?: number;
  leadTimeDays?: number | null;
}

function buildItem(
  supplierId: string,
  sku: string,
  price: number,
  currency: string,
  terms: ItemTerms,
): StoredSupplierItem {
  return {
    supplierItemId: crypto.randomUUID(),
    supplierId,
    inventoryItemId: `item-${sku}`,
    sku,
    supplierSkuCode: terms.supplierSkuCode ?? null,
    price,
    currency,
    moq: terms.moq ?? 1,
    packSize: terms.packSize ?? 1,
    leadTimeDays: terms.leadTimeDays ?? null,
    version: 0,
    createdAt: new Date().toISOString(),
    lastModifiedAt: null,
  };
}

/**
 * ASSUMPTION (mock): suy từ dòng PO mock; hình dòng theo seed demo BE V20260928009000 (GOVIET).
 * Mỗi cặp (supplierId, sku) khác nhau → 1 dòng danh mục, giá = unitPrice của dòng PO đầu tiên,
 * tiền tệ = tiền tệ PO, moq 1, packSize 1, leadTimeDays null, preferred false.
 */
export function ensureSupplierCatalogSeeded(): Promise<void> {
  // Memoize the in-flight promise: concurrent first callers all wait for the same seeding.
  seedPromise ??= (async () => {
    const pos: MockBePo[] = [...(await getPoStore()).values()];
    for (const po of pos) {
      for (const line of po.lines) {
        if (pairExists(po.supplierId, line.sku)) continue;
        items.push(buildItem(po.supplierId, line.sku, line.unitPrice, po.currency, {}));
      }
    }
  })();
  return seedPromise;
}

function withDerived(item: StoredSupplierItem, supplierLeadDays: number): MockSupplierItem {
  return {
    ...item,
    preferred: defaultSupplierBySku.get(item.sku) === item.supplierId,
    effectiveLeadTimeDays: item.leadTimeDays ?? supplierLeadDays,
  };
}

async function supplierLead(supplierId: string): Promise<number> {
  return (await findMockSupplier(supplierId))?.leadTimeDays ?? DEFAULT_LEAD_DAYS;
}

/** Helper cho test, như `SupplierItemFixtures` của BE; cặp đã có thì được thay. */
export function seedMockSupplierItem(input: {
  supplierId: string;
  sku: string;
  price: number;
  currency: string;
  moq?: number;
  packSize?: number;
  leadTimeDays?: number | null;
  preferred?: boolean;
}): MockSupplierItem {
  items = items.filter((i) => !(i.supplierId === input.supplierId && i.sku === input.sku));
  const stored = buildItem(input.supplierId, input.sku, input.price, input.currency, input);
  items.push(stored);
  if (input.preferred) defaultSupplierBySku.set(input.sku, input.supplierId);
  return withDerived(stored, DEFAULT_LEAD_DAYS);
}

export async function listSupplierItems(supplierId: string): Promise<MockSupplierItem[]> {
  await ensureSupplierCatalogSeeded();
  const lead = await supplierLead(supplierId);
  return items.filter((i) => i.supplierId === supplierId).map((i) => withDerived(i, lead));
}

/**
 * BE `SupplierItemServiceImpl#suppliersOf`: mọi NCC bán SKU, NCC mặc định đứng đầu rồi theo tên NCC.
 * Hình `SkuSupplierResponse` (không có `leadTimeDays` riêng, chỉ `effectiveLeadTimeDays`).
 */
export async function listSkuSuppliers(sku: string) {
  await ensureSupplierCatalogSeeded();
  const rows = await Promise.all(
    items
      .filter((i) => i.sku === sku)
      .map(async (i) => {
        const supplier = await findMockSupplier(i.supplierId);
        const item = withDerived(i, supplier?.leadTimeDays ?? DEFAULT_LEAD_DAYS);
        return {
          supplierId: item.supplierId,
          supplierCode: supplier?.code ?? "",
          supplierName: supplier?.name ?? "",
          supplierStatus: supplier?.status ?? "ACTIVE",
          supplierItemId: item.supplierItemId,
          supplierSkuCode: item.supplierSkuCode,
          price: item.price,
          currency: item.currency,
          moq: item.moq,
          packSize: item.packSize,
          effectiveLeadTimeDays: item.effectiveLeadTimeDays,
          preferred: item.preferred,
        };
      }),
  );
  return rows.sort(
    (a, b) =>
      Number(b.preferred) - Number(a.preferred) ||
      a.supplierName.localeCompare(b.supplierName, "vi"),
  );
}

/** BE: tiền tệ NCC — mock không lưu, suy từ dòng danh mục đầu tiên (BE quy giá về tiền tệ NCC). */
export async function supplierCurrency(supplierId: string): Promise<string> {
  await ensureSupplierCatalogSeeded();
  return items.find((i) => i.supplierId === supplierId)?.currency ?? DEFAULT_CURRENCY;
}

export function supplierHasSku(supplierId: string, sku: string): boolean {
  return pairExists(supplierId, sku);
}

export function findStoredSupplierItem(
  supplierId: string,
  supplierItemId: string,
): StoredSupplierItem | null {
  return (
    items.find((i) => i.supplierId === supplierId && i.supplierItemId === supplierItemId) ?? null
  );
}

export function insertSupplierItem(
  supplierId: string,
  sku: string,
  price: number,
  currency: string,
  terms: ItemTerms,
  preferred: boolean,
): StoredSupplierItem {
  const stored = buildItem(supplierId, sku, price, currency, terms);
  items.push(stored);
  // BE: tạo dòng với preferred=false KHÔNG xoá NCC mặc định hiện có.
  if (preferred) assignDefault(sku, supplierId);
  return stored;
}

export function updateSupplierItem(
  supplierItemId: string,
  patch: Pick<
    StoredSupplierItem,
    "price" | "supplierSkuCode" | "moq" | "packSize" | "leadTimeDays"
  >,
  preferred: boolean,
): StoredSupplierItem | null {
  const idx = items.findIndex((i) => i.supplierItemId === supplierItemId);
  const current = items[idx];
  if (!current) return null;
  // Chỉ chép đúng các field sửa được: route truyền cả điều khoản đã đọc, gồm `sku` của request (rỗng
  // khi không gửi). BE bỏ qua `sku` khi sửa — spread nguyên object sẽ đổi / xoá SKU của dòng và làm
  // lệch "ưu tiên" (NCC mặc định) của SKU
  const next: StoredSupplierItem = {
    ...current,
    price: patch.price,
    supplierSkuCode: patch.supplierSkuCode,
    moq: patch.moq,
    packSize: patch.packSize,
    leadTimeDays: patch.leadTimeDays,
    version: current.version + 1,
    lastModifiedAt: new Date().toISOString(),
  };
  items[idx] = next;
  if (preferred) assignDefault(next.sku, next.supplierId);
  // BE: bỏ ưu tiên chỉ xoá NCC mặc định khi chính NCC này đang là mặc định.
  else clearDefault(next.sku, next.supplierId);
  return next;
}

export function deleteSupplierItem(supplierItemId: string): void {
  // BE: xoá dòng không đụng NCC mặc định của hồ sơ hàng tồn.
  items = items.filter((i) => i.supplierItemId !== supplierItemId);
}

export async function toWire(item: StoredSupplierItem): Promise<MockSupplierItem> {
  return withDerived(item, await supplierLead(item.supplierId));
}

/** BE `usedByOpenPurchaseOrder`: PO DRAFT…PARTIALLY_RECEIVED còn đặt cặp NCC × SKU. */
export async function usedByOpenPurchaseOrder(supplierId: string, sku: string): Promise<boolean> {
  const pos = [...(await getPoStore()).values()];
  return pos.some(
    (po) =>
      po.supplierId === supplierId &&
      IN_USE_PO_STATUSES.includes(po.status) &&
      po.lines.some((l) => l.sku === sku),
  );
}

/** BE `PurchasePrices.maxScale`: min(2, số lẻ của tiền tệ) — VND = 0. */
export function priceScaleFor(currency: string): number {
  try {
    const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits;
    return Math.min(MAX_PRICE_SCALE, digits ?? MAX_PRICE_SCALE);
  } catch {
    return MAX_PRICE_SCALE;
  }
}

export interface CatalogLineInput {
  sku: string;
  quantityOrdered: number;
  unitPrice: number | null;
}

export interface CatalogCheck {
  fieldErrors: MockFieldError[];
  /** Giá cuối của từng dòng: giá gõ tay thắng giá danh mục; null khi chưa xác định được. */
  prices: (number | null)[];
  /** Lead time của PO = lớn nhất trong các dòng (hiệu lực). */
  leadTimeDays: number;
}

/**
 * Mô phỏng BE `ProcurementServiceImpl#checkLines` (BR-PO-001): mọi dòng lỗi gom một lượt.
 * SKU không có trong danh mục → chỉ `lines[i].sku`; SL < MOQ và SL không chia hết quy cách →
 * hai lỗi cùng field `lines[i].quantityOrdered`; thiếu giá + khác tiền tệ → `lines[i].unitPrice`.
 * Async vì phải nạp seed danh mục từ store PO mock.
 */
export async function catalogTermsViolations(
  supplierId: string,
  currency: string,
  lines: readonly CatalogLineInput[],
): Promise<CatalogCheck> {
  const catalog = await listSupplierItems(supplierId);
  const fieldErrors: MockFieldError[] = [];
  const prices: (number | null)[] = [];
  let leadTimeDays = 0;
  lines.forEach((line, i) => {
    const item = catalog.find((c) => c.sku === line.sku);
    if (!item) {
      fieldErrors.push({
        field: `lines[${i}].sku`,
        message: `SKU ${line.sku} is not listed by this supplier`,
        code: "SUPPLIER_ITEM_NOT_LISTED",
      });
      prices.push(null);
      return;
    }
    const message = `Quantity ${line.quantityOrdered} does not meet the supplier minimum ${item.moq} in packs of ${item.packSize}`;
    if (line.quantityOrdered < item.moq) {
      fieldErrors.push({
        field: `lines[${i}].quantityOrdered`,
        message,
        code: "PO_LINE_BELOW_MOQ",
      });
    }
    if (line.quantityOrdered % item.packSize !== 0) {
      fieldErrors.push({
        field: `lines[${i}].quantityOrdered`,
        message,
        code: "PO_LINE_NOT_PACK_MULTIPLE",
      });
    }
    let price = line.unitPrice;
    if (price === null) {
      if (item.currency === currency) price = item.price;
      else {
        fieldErrors.push({
          field: `lines[${i}].unitPrice`,
          message: `The catalog price is in ${item.currency}; enter a price in ${currency}`,
          code: "PO_LINE_PRICE_REQUIRED",
        });
      }
    }
    prices.push(price);
    leadTimeDays = Math.max(leadTimeDays, item.effectiveLeadTimeDays);
  });
  return { fieldErrors, prices, leadTimeDays };
}

/** Hôm nay (giờ VN) + `days` ngày, dạng yyyy-MM-dd — BE: thiếu expectedAt ⇒ hôm nay + lead time. */
export function addDaysVn(days: number): string {
  const base = new Date(`${todayVn()}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}
