/**
 * ============================================================================
 *  StockFlowCommerce — MOCK DATA (UI/UX only)
 * ============================================================================
 *  Nguồn sự thật nghiệp vụ: ../docs/  (18 module).
 *  Phạm vi: CHỈ dữ liệu tĩnh phục vụ dựng UI. KHÔNG xử lý form, KHÔNG API,
 *  KHÔNG business events. Tên TRẠNG THÁI khớp 100% bảng "Trạng thái / Vòng đời"
 *  trong docs. Mọi cặp FK trỏ đúng ID giữa các entity.
 *
 *  Quy ước:
 *   - Tiền tệ: VND (open-question A4: chủ yếu VND; PO có thể theo tiền NCC).
 *   - Địa chỉ: VN 3 cấp (xã/phường · quận/huyện · tỉnh/TP) — open-question A7.
 *   - Nhãn trạng thái: giữ tiếng Anh gốc (đúng docs) — UI render kèm tiếng Việt.
 *   - Dữ liệu suy đoán đánh dấu:  // ASSUMPTION (open-question Xn): ...
 *   - Ids ổn định để demo quan hệ: PRD-/SKU-/SUP-/PO-/RC-/INV-/WH-/ORD-/CUS-/DSN-...
 *
 *  Cấu trúc: theo 18 module (01 → 18), mỗi module gồm Type unions + Interfaces
 *  + mảng mock. Cuối file export `mockDb` gộp toàn bộ.
 * ============================================================================
 */

/* ============================================================================
 * 0. COMMON — helpers, units, semantic
 * ==========================================================================*/

export type ID = string;
export type ISODate = string; // 'YYYY-MM-DD'
export type ISODateTime = string; // 'YYYY-MM-DDTHH:mm:ss+07:00'
export type VND = number; // số tiền nguyên (VND)
export type Qty = number; // số lượng (integer)
export type Meters = number; // kích thước mét (open-question A7: hệ mét)

export type Language = "vi" | "en";

/** Nhãn song ngữ Việt–Anh cho thuật ngữ (lấy từ docs/glossary). */
export interface BilingualLabel {
  vi: string;
  en: string;
}

/** 7 semantic tone — dùng chung cả Mode A & Mode B (FRONTEND-AI-RULES §6.1). */
export type SemanticTone =
  "positive" | "info" | "warning" | "danger" | "neutral" | "muted" | "special";

/** Domain cho <StatusDot domain=... status=... /> (nguồn: status-map.ts). */
export type StatusDomain =
  | "product"
  | "sku"
  | "proposal"
  | "po"
  | "receipt"
  | "qc"
  | "invoice"
  | "putaway"
  | "stock"
  | "location"
  | "pick"
  | "allocation"
  | "pack"
  | "shipment"
  | "to" // transfer order (inter-warehouse)
  | "move" // intra-warehouse move task
  | "design"
  | "preflight"
  | "catalog"
  | "cart"
  | "order"
  | "payment"
  | "conversation"
  | "rma"
  | "customer";

/** Tiền tệ hỗ trợ (A4). */
export type Currency = "VND" | "USD" | "CNY";

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  VND: "₫",
  USD: "$",
  CNY: "¥",
};

/** Định dạng tiền VND (UI helper — chỉ hiển thị). */
export function formatVND(amount: VND): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** 3 kho vật lý (A1: một pháp nhân, multi-warehouse). */
export const WAREHOUSE_IDS = ["WH-HN-01", "WH-HCM-01", "WH-DN-01"] as const;
export type WarehouseId = (typeof WAREHOUSE_IDS)[number];

/** Đơn vị đo lường chuẩn (hệ mét). */
export type Uom = "pcs" | "box" | "kg" | "m" | "ream" | "set";

/* ============================================================================
 * MODULE 01 — PRODUCT CREATION (warehouse/01-product-creation)
 * Nguồn: docs/warehouse/01-product-creation/README.md
 * ==========================================================================*/

/** Vòng đời sản phẩm (bảng Lifecycle 01). */
export type ProductStatus =
  "Draft" | "Pending Approval" | "Approved" | "Active" | "Published" | "Inactive" | "Discontinued";

/** Vòng đời SKU (bảng Lifecycle 01 — phần SKU). */
export type SkuStatus = "Active" | "Blocked" | "Obsolete";

/** Loại sản phẩm: thường vs tùy chỉnh/in ấn (G5, B1). */
export type ProductType = "Standard" | "Customizable";

export interface Category {
  categoryId: ID;
  name: BilingualLabel;
  parentId: ID | null;
  level: 1 | 2 | 3;
  slug: string;
}

export interface PrintArea {
  printAreaId: ID;
  productId: ID;
  name: BilingualLabel;
  /** Vị trí trên sản phẩm. */
  position: "front" | "back" | "left-sleeve" | "right-sleeve" | "full";
  /** Kích thước vùng in (mm) — B8: model khai báo theo sản phẩm ở 01. */
  widthMm: number;
  heightMm: number;
  /** DPI tối thiểu chấp nhận (preflight 12 dùng để cảnh báo ảnh mờ). */
  minDpi: number;
  /** Mép bleed & safe area (mm) — DesignCanvas 12 render 3 lớp guide. */
  bleedMm: number;
  safeMarginMm: number;
  allowedTechniques: PrintTechnique[];
}

/** Kỹ thuật in (B3: giá phụ thuộc thông số in). */
export type PrintTechnique = "DTG" | "DTF" | "Screen" | "Embroidery" | "Sublimation";

export interface ProductAttribute {
  attributeId: ID;
  name: BilingualLabel; // ví dụ: Size, Color, Material
  values: string[]; // ["S","M","L","XL"] / ["Đen","Trắng"]
  swatch?: Record<string, string>; // value → hex (chỉ Color)
}

export interface Product {
  productId: ID; // PRD-xxx
  name: string;
  nameEn: string;
  slug: string;
  type: ProductType;
  categoryId: ID;
  status: ProductStatus;
  description: string;
  descriptionEn: string;
  /** Ảnh đại diện + gallery (URL mock). */
  images: string[];
  /** Model 3D (chỉ sản phẩm Customizable) — B7/B8. */
  model3dUrl?: string;
  basePrice: VND;
  /** Giá tùy chỉnh khai báo theo công thức ở 01 (B3). */
  pricingFormula?: PricingFormula;
  attributes: ProductAttribute[];
  printAreas?: PrintArea[]; // chỉ Customizable
  taxClass: "standard" | "reduced" | "exempt";
  uom: Uom;
  brand: string;
  createdAt: ISODateTime;
  createdBy: string;
  approvedBy?: string; // A3: có bước maker–checker
  approvedAt?: ISODateTime;
}

/** Công thức giá sản phẩm in (B3: theo diện tích phủ mực / số màu / kỹ thuật). */
export interface PricingFormula {
  // ASSUMPTION (open-question B3): công thức giá tùy chỉnh chưa chốt nguồn; mock theo diện tích + kỹ thuật.
  basePrintPrice: VND;
  perSquareCmPrice: VND;
  techniqueMultiplier: Record<PrintTechnique, number>;
  colorCountSurcharge: VND; // mỗi màu thêm
}

export interface Sku {
  skuId: ID; // SKU-xxx
  productId: ID;
  barcode: string; // EAN/Code128 cho ScanInput
  variantLabel: string; // "Áo Thun Cotton — Đen / L"
  attributes: Record<string, string>; // { Color: "Đen", Size: "L" }
  status: SkuStatus;
  uom: Uom;
  price: VND;
  cost: VND; // giá vốn (C7: costing theo chính sách kế toán)
  weightKg: number;
  /** Cờ theo dõi lô/serial/hạn dùng — Receipt 03 BR-03 bắt buộc nhập. */
  lotTracking: boolean;
  serialTracking: boolean;
  expiryTracking: boolean;
  /** Tồn hiện tại (ATP) — G3: StockFlowCommerce là nguồn sự thật. */
  stockOnHand: Qty;
  stockReserved: Qty;
  stockAvailable: Qty; // onHand − reserved
  reorderPoint: Qty;
  imageUrl?: string;
}

export interface Supplier {
  supplierId: ID; // SUP-xxx
  name: string;
  taxCode: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  address: AddressVN;
  paymentTerms: string; // "Net 30"
  currency: Currency; // A4: PO theo tiền NCC
  leadTimeDays: number;
  rating: number; // 0–5, hồ sơ chất lượng NCC (C10)
  active: boolean;
}

/** Địa chỉ VN 3 cấp (A7). */
export interface AddressVN {
  street: string;
  ward: string; // xã/phường
  district: string; // quận/huyện
  province: string; // tỉnh/TP
  postalCode: string;
  country: "VN";
}

/* ---- Mock data 01 ---- */

export const categories: Category[] = [
  { categoryId: "CAT-01", name: { vi: "Áo", en: "Apparel" }, parentId: null, level: 1, slug: "ao" },
  {
    categoryId: "CAT-01-01",
    name: { vi: "Áo thun", en: "T-Shirt" },
    parentId: "CAT-01",
    level: 2,
    slug: "ao-thun",
  },
  {
    categoryId: "CAT-01-02",
    name: { vi: "Áo hoodie", en: "Hoodie" },
    parentId: "CAT-01",
    level: 2,
    slug: "ao-hoodie",
  },
  {
    categoryId: "CAT-02",
    name: { vi: "Phụ kiện", en: "Accessories" },
    parentId: null,
    level: 1,
    slug: "phu-kien",
  },
  {
    categoryId: "CAT-02-01",
    name: { vi: "Cốc & bình", en: "Mugs & Drinkware" },
    parentId: "CAT-02",
    level: 2,
    slug: "coc-binh",
  },
  {
    categoryId: "CAT-03",
    name: { vi: "Vật tư in", en: "Print Supplies" },
    parentId: null,
    level: 1,
    slug: "vat-tu-in",
  },
  {
    categoryId: "CAT-03-01",
    name: { vi: "Phôi áo", en: "Blank Apparel" },
    parentId: "CAT-03",
    level: 2,
    slug: "phoi-ao",
  },
];

export const products: Product[] = [
  {
    productId: "PRD-001",
    name: "Áo Thun Cotton Cao Cấp",
    nameEn: "Premium Cotton T-Shirt",
    slug: "ao-thun-cotton-cao-cap",
    type: "Customizable",
    categoryId: "CAT-01-01",
    status: "Published",
    description: "Áo thun cotton 100% co giãn 4 chiều, phù hợp in DTG/DTF. Form unisex.",
    descriptionEn: "100% 4-way stretch cotton tee, ideal for DTG/DTF printing. Unisex fit.",
    images: ["/mock/img/prd-001-1.jpg", "/mock/img/prd-001-2.jpg", "/mock/img/prd-001-3.jpg"],
    model3dUrl: "/mock/3d/tshirt.glb",
    basePrice: 149000,
    pricingFormula: {
      basePrintPrice: 25000,
      perSquareCmPrice: 12,
      techniqueMultiplier: { DTG: 1.0, DTF: 0.9, Screen: 0.8, Embroidery: 1.6, Sublimation: 1.1 },
      colorCountSurcharge: 5000,
    },
    attributes: [
      {
        attributeId: "ATTR-COLOR",
        name: { vi: "Màu sắc", en: "Color" },
        values: ["Đen", "Trắng", "Xám", "Navy"],
        swatch: { Đen: "#1A1B18", Trắng: "#FFFFFF", Xám: "#9A9C95", Navy: "#1F2A44" },
      },
      {
        attributeId: "ATTR-SIZE",
        name: { vi: "Kích cỡ", en: "Size" },
        values: ["S", "M", "L", "XL", "XXL"],
      },
    ],
    printAreas: [
      {
        printAreaId: "PA-001-F",
        productId: "PRD-001",
        name: { vi: "Trước ngực", en: "Front chest" },
        position: "front",
        widthMm: 280,
        heightMm: 380,
        minDpi: 150,
        bleedMm: 3,
        safeMarginMm: 10,
        allowedTechniques: ["DTG", "DTF", "Screen"],
      },
      {
        printAreaId: "PA-001-B",
        productId: "PRD-001",
        name: { vi: "Sau lưng", en: "Back" },
        position: "back",
        widthMm: 300,
        heightMm: 420,
        minDpi: 150,
        bleedMm: 3,
        safeMarginMm: 10,
        allowedTechniques: ["DTG", "DTF", "Screen"],
      },
    ],
    taxClass: "standard",
    uom: "pcs",
    brand: "StockFlow Basics",
    createdAt: "2026-03-12T09:15:00+07:00",
    createdBy: "Nguyễn Thị Lan",
    approvedBy: "Trần Minh Quang",
    approvedAt: "2026-03-14T11:02:00+07:00",
  },
  {
    productId: "PRD-002",
    name: "Cốc Sứ In Ảnh 350ml",
    nameEn: "Custom Photo Mug 350ml",
    slug: "coc-su-in-anh-350ml",
    type: "Customizable",
    categoryId: "CAT-02-01",
    status: "Active",
    description: "Cốc sứ trắng 350ml, in thăng hoa toàn thân, chịu nhiệt.",
    descriptionEn: "350ml white ceramic mug, full-wrap sublimation print, heat resistant.",
    images: ["/mock/img/prd-002-1.jpg", "/mock/img/prd-002-2.jpg"],
    model3dUrl: "/mock/3d/mug.glb",
    basePrice: 89000,
    pricingFormula: {
      basePrintPrice: 15000,
      perSquareCmPrice: 10,
      techniqueMultiplier: { DTG: 1.2, DTF: 1.0, Screen: 1.0, Embroidery: 2.0, Sublimation: 0.85 },
      colorCountSurcharge: 0,
    },
    attributes: [
      {
        attributeId: "ATTR-COLOR",
        name: { vi: "Màu sắc", en: "Color" },
        values: ["Trắng", "Đen lòng"],
        swatch: { Trắng: "#FFFFFF", "Đen lòng": "#2A211A" },
      },
    ],
    printAreas: [
      {
        printAreaId: "PA-002",
        productId: "PRD-002",
        name: { vi: "Quanh thân cốc", en: "Full wrap" },
        position: "full",
        widthMm: 200,
        heightMm: 90,
        minDpi: 200,
        bleedMm: 2,
        safeMarginMm: 8,
        allowedTechniques: ["Sublimation"],
      },
    ],
    taxClass: "standard",
    uom: "pcs",
    brand: "StockFlow Basics",
    createdAt: "2026-03-18T14:20:00+07:00",
    createdBy: "Nguyễn Thị Lan",
    approvedBy: "Trần Minh Quang",
    approvedAt: "2026-03-19T09:45:00+07:00",
  },
  {
    productId: "PRD-003",
    name: "Phôi Áo Thun Trơn Gildan 64000",
    nameEn: "Gildan 64000 Blank T-Shirt",
    slug: "phoi-ao-thun-gildan-64000",
    type: "Standard",
    categoryId: "CAT-03-01",
    status: "Approved",
    description: "Phôi áo nhập cho xưởng in, cotton 100%, định lượng 180gsm.",
    descriptionEn: "Blank apparel for print shop, 100% cotton, 180gsm.",
    images: ["/mock/img/prd-003-1.jpg"],
    basePrice: 42000,
    attributes: [
      {
        attributeId: "ATTR-COLOR",
        name: { vi: "Màu sắc", en: "Color" },
        values: ["Trắng", "Đen"],
        swatch: { Trắng: "#FFFFFF", Đen: "#1A1B18" },
      },
      { attributeId: "ATTR-SIZE", name: { vi: "Kích cỡ", en: "Size" }, values: ["M", "L", "XL"] },
    ],
    taxClass: "standard",
    uom: "pcs",
    brand: "Gildan",
    createdAt: "2026-04-02T08:00:00+07:00",
    createdBy: "Lê Văn Hùng",
    approvedBy: "Trần Minh Quang",
    approvedAt: "2026-04-03T10:10:00+07:00",
  },
  {
    productId: "PRD-004",
    name: "Áo Hoodie Nỉ Cao Cấp",
    nameEn: "Premium Fleece Hoodie",
    slug: "ao-hoodie-ni-cao-cap",
    type: "Customizable",
    categoryId: "CAT-01-02",
    status: "Pending Approval",
    description: "Hoodie nỉ bông 320gsm, in/thêu trước ngực và sau lưng.",
    descriptionEn: "320gsm fleece hoodie, chest & back print/embroidery.",
    images: ["/mock/img/prd-004-1.jpg", "/mock/img/prd-004-2.jpg"],
    model3dUrl: "/mock/3d/hoodie.glb",
    basePrice: 289000,
    pricingFormula: {
      basePrintPrice: 30000,
      perSquareCmPrice: 14,
      techniqueMultiplier: { DTG: 1.0, DTF: 0.95, Screen: 0.85, Embroidery: 1.8, Sublimation: 1.2 },
      colorCountSurcharge: 6000,
    },
    attributes: [
      {
        attributeId: "ATTR-COLOR",
        name: { vi: "Màu sắc", en: "Color" },
        values: ["Đen", "Xám", "Be"],
        swatch: { Đen: "#1A1B18", Xám: "#9A9C95", Be: "#E6DCCC" },
      },
      {
        attributeId: "ATTR-SIZE",
        name: { vi: "Kích cỡ", en: "Size" },
        values: ["M", "L", "XL", "XXL"],
      },
    ],
    printAreas: [
      {
        printAreaId: "PA-004-F",
        productId: "PRD-004",
        name: { vi: "Trước ngực", en: "Front chest" },
        position: "front",
        widthMm: 260,
        heightMm: 300,
        minDpi: 150,
        bleedMm: 3,
        safeMarginMm: 12,
        allowedTechniques: ["DTG", "DTF", "Embroidery"],
      },
    ],
    taxClass: "standard",
    uom: "pcs",
    brand: "StockFlow Basics",
    createdAt: "2026-05-20T16:40:00+07:00",
    createdBy: "Nguyễn Thị Lan",
  },
  {
    productId: "PRD-005",
    name: "Túi Tote Canvas",
    nameEn: "Canvas Tote Bag",
    slug: "tui-tote-canvas",
    type: "Customizable",
    categoryId: "CAT-02",
    status: "Draft",
    description: "Túi tote canvas 12oz, in một mặt hoặc hai mặt.",
    descriptionEn: "12oz canvas tote, single or double-sided print.",
    images: ["/mock/img/prd-005-1.jpg"],
    basePrice: 79000,
    attributes: [
      {
        attributeId: "ATTR-COLOR",
        name: { vi: "Màu sắc", en: "Color" },
        values: ["Be tự nhiên", "Đen"],
        swatch: { "Be tự nhiên": "#E6DCCC", Đen: "#1A1B18" },
      },
    ],
    taxClass: "standard",
    uom: "pcs",
    brand: "StockFlow Basics",
    createdAt: "2026-06-01T10:00:00+07:00",
    createdBy: "Lê Văn Hùng",
  },
  {
    productId: "PRD-006",
    name: "Mũ Lưỡi Trai Thêu Logo",
    nameEn: "Embroidered Cap",
    slug: "mui-luoi-trai-theu-logo",
    type: "Customizable",
    categoryId: "CAT-02",
    status: "Inactive",
    description: "Mũ lưỡi trai thêu logo trước, 6 panel.",
    descriptionEn: "6-panel cap with front embroidery.",
    images: ["/mock/img/prd-006-1.jpg"],
    basePrice: 119000,
    attributes: [
      {
        attributeId: "ATTR-COLOR",
        name: { vi: "Màu sắc", en: "Color" },
        values: ["Đen", "Navy"],
        swatch: { Đen: "#1A1B18", Navy: "#1F2A44" },
      },
    ],
    printAreas: [
      {
        printAreaId: "PA-006",
        productId: "PRD-006",
        name: { vi: "Trước mũ", en: "Front panel" },
        position: "front",
        widthMm: 90,
        heightMm: 55,
        minDpi: 200,
        bleedMm: 2,
        safeMarginMm: 5,
        allowedTechniques: ["Embroidery"],
      },
    ],
    taxClass: "standard",
    uom: "pcs",
    brand: "StockFlow Basics",
    createdAt: "2026-02-10T09:00:00+07:00",
    createdBy: "Nguyễn Thị Lan",
    approvedBy: "Trần Minh Quang",
    approvedAt: "2026-02-11T13:30:00+07:00",
  },
  {
    productId: "PRD-007",
    name: "Áo Polo Thêu Doanh Nghiệp",
    nameEn: "Corporate Embroidered Polo",
    slug: "ao-polo-theu-doanh-nghiep",
    type: "Customizable",
    categoryId: "CAT-01-01",
    status: "Discontinued",
    description: "Polo cá sấu thêu logo, ngưng kinh doanh mùa 2026.",
    descriptionEn: "Pique polo with embroidered logo, discontinued for 2026 season.",
    images: ["/mock/img/prd-007-1.jpg"],
    basePrice: 199000,
    attributes: [
      {
        attributeId: "ATTR-COLOR",
        name: { vi: "Màu sắc", en: "Color" },
        values: ["Trắng", "Đen"],
        swatch: { Trắng: "#FFFFFF", Đen: "#1A1B18" },
      },
      { attributeId: "ATTR-SIZE", name: { vi: "Kích cỡ", en: "Size" }, values: ["M", "L", "XL"] },
    ],
    taxClass: "standard",
    uom: "pcs",
    brand: "StockFlow Basics",
    createdAt: "2025-11-05T09:00:00+07:00",
    createdBy: "Nguyễn Thị Lan",
    approvedBy: "Trần Minh Quang",
    approvedAt: "2025-11-06T10:00:00+07:00",
  },
];

export const skus: Sku[] = [
  {
    skuId: "SKU-001-BLK-L",
    productId: "PRD-001",
    barcode: "8934567890011",
    variantLabel: "Áo Thun Cotton — Đen / L",
    attributes: { Color: "Đen", Size: "L" },
    status: "Active",
    uom: "pcs",
    price: 149000,
    cost: 62000,
    weightKg: 0.22,
    lotTracking: false,
    serialTracking: false,
    expiryTracking: false,
    stockOnHand: 240,
    stockReserved: 35,
    stockAvailable: 205,
    reorderPoint: 60,
    imageUrl: "/mock/img/sku-001-blk-l.jpg",
  },
  {
    skuId: "SKU-001-BLK-M",
    productId: "PRD-001",
    barcode: "8934567890012",
    variantLabel: "Áo Thun Cotton — Đen / M",
    attributes: { Color: "Đen", Size: "M" },
    status: "Active",
    uom: "pcs",
    price: 149000,
    cost: 62000,
    weightKg: 0.21,
    lotTracking: false,
    serialTracking: false,
    expiryTracking: false,
    stockOnHand: 180,
    stockReserved: 40,
    stockAvailable: 140,
    reorderPoint: 60,
    imageUrl: "/mock/img/sku-001-blk-m.jpg",
  },
  {
    skuId: "SKU-001-WHT-L",
    productId: "PRD-001",
    barcode: "8934567890013",
    variantLabel: "Áo Thun Cotton — Trắng / L",
    attributes: { Color: "Trắng", Size: "L" },
    status: "Active",
    uom: "pcs",
    price: 149000,
    cost: 62000,
    weightKg: 0.22,
    lotTracking: false,
    serialTracking: false,
    expiryTracking: false,
    stockOnHand: 18,
    stockReserved: 12,
    stockAvailable: 6,
    reorderPoint: 60,
    imageUrl: "/mock/img/sku-001-wht-l.jpg",
  },
  {
    skuId: "SKU-001-NVY-XL",
    productId: "PRD-001",
    barcode: "8934567890014",
    variantLabel: "Áo Thun Cotton — Navy / XL",
    attributes: { Color: "Navy", Size: "XL" },
    status: "Active",
    uom: "pcs",
    price: 159000,
    cost: 65000,
    weightKg: 0.24,
    lotTracking: false,
    serialTracking: false,
    expiryTracking: false,
    stockOnHand: 0,
    stockReserved: 0,
    stockAvailable: 0,
    reorderPoint: 40,
    imageUrl: "/mock/img/sku-001-nvy-xl.jpg",
  },
  {
    skuId: "SKU-002-WHT",
    productId: "PRD-002",
    barcode: "8934567890021",
    variantLabel: "Cốc Sứ 350ml — Trắng",
    attributes: { Color: "Trắng" },
    status: "Active",
    uom: "pcs",
    price: 89000,
    cost: 31000,
    weightKg: 0.35,
    lotTracking: true,
    serialTracking: false,
    expiryTracking: false,
    stockOnHand: 320,
    stockReserved: 18,
    stockAvailable: 302,
    reorderPoint: 80,
    imageUrl: "/mock/img/sku-002-wht.jpg",
  },
  {
    skuId: "SKU-003-WHT-L",
    productId: "PRD-003",
    barcode: "8934567890031",
    variantLabel: "Phôi Gildan 64000 — Trắng / L",
    attributes: { Color: "Trắng", Size: "L" },
    status: "Active",
    uom: "pcs",
    price: 42000,
    cost: 28000,
    weightKg: 0.18,
    lotTracking: true,
    serialTracking: false,
    expiryTracking: false,
    stockOnHand: 1500,
    stockReserved: 600,
    stockAvailable: 900,
    reorderPoint: 500,
    imageUrl: "/mock/img/sku-003-wht-l.jpg",
  },
  {
    skuId: "SKU-003-BLK-L",
    productId: "PRD-003",
    barcode: "8934567890032",
    variantLabel: "Phôi Gildan 64000 — Đen / L",
    attributes: { Color: "Đen", Size: "L" },
    status: "Active",
    uom: "pcs",
    price: 42000,
    cost: 28000,
    weightKg: 0.18,
    lotTracking: true,
    serialTracking: false,
    expiryTracking: false,
    stockOnHand: 900,
    stockReserved: 300,
    stockAvailable: 600,
    reorderPoint: 500,
    imageUrl: "/mock/img/sku-003-blk-l.jpg",
  },
  {
    skuId: "SKU-004-BLK-L",
    productId: "PRD-004",
    barcode: "8934567890041",
    variantLabel: "Hoodie Nỉ — Đen / L",
    attributes: { Color: "Đen", Size: "L" },
    status: "Blocked",
    uom: "pcs",
    price: 289000,
    cost: 145000,
    weightKg: 0.55,
    lotTracking: false,
    serialTracking: false,
    expiryTracking: false,
    stockOnHand: 0,
    stockReserved: 0,
    stockAvailable: 0,
    reorderPoint: 30,
    imageUrl: "/mock/img/sku-004-blk-l.jpg",
  },
  {
    skuId: "SKU-007-WHT-L",
    productId: "PRD-007",
    barcode: "8934567890071",
    variantLabel: "Polo Thêu — Trắng / L",
    attributes: { Color: "Trắng", Size: "L" },
    status: "Obsolete",
    uom: "pcs",
    price: 199000,
    cost: 95000,
    weightKg: 0.28,
    lotTracking: false,
    serialTracking: false,
    expiryTracking: false,
    stockOnHand: 22,
    stockReserved: 0,
    stockAvailable: 22,
    reorderPoint: 0,
    imageUrl: "/mock/img/sku-007-wht-l.jpg",
  },
];

export const suppliers: Supplier[] = [
  {
    supplierId: "SUP-001",
    name: "Công ty TNHH Dệt may Thành Công",
    taxCode: "0301234567",
    contactName: "Phạm Quốc Bảo",
    contactEmail: "bao.pham@thanhcongtex.vn",
    contactPhone: "+84 903 111 222",
    address: {
      street: "KCN Tân Bình, Lô II-3",
      ward: "Phường Tây Thạnh",
      district: "Quận Tân Phú",
      province: "TP. Hồ Chí Minh",
      postalCode: "761000",
      country: "VN",
    },
    paymentTerms: "Net 30",
    currency: "VND",
    leadTimeDays: 14,
    rating: 4.5,
    active: true,
  },
  {
    supplierId: "SUP-002",
    name: "Guangzhou Print Supplies Co., Ltd",
    taxCode: "91440101MA5XXXXX",
    contactName: "Li Wei",
    contactEmail: "sales@gzprint.cn",
    contactPhone: "+86 20 8888 6666",
    address: {
      street: "No. 88 Huanshi Road",
      ward: "Yuexiu",
      district: "Yuexiu District",
      province: "Guangdong",
      postalCode: "510000",
      country: "VN",
    },
    paymentTerms: "Net 45",
    currency: "USD",
    leadTimeDays: 30,
    rating: 4.0,
    active: true,
  },
  // ASSUMPTION (open-question A4): NCC nước ngoài dùng USD; địa chỉ mock không theo chuẩn VN 3 cấp.
  {
    supplierId: "SUP-003",
    name: "Công ty CP Gốm sứ Minh Long",
    taxCode: "3700123456",
    contactName: "Võ Thị Hạnh",
    contactEmail: "hanh.vo@minhlong.vn",
    contactPhone: "+84 912 333 444",
    address: {
      street: "333 Hưng Định",
      ward: "Phường An Thạnh",
      district: "Thành phố Thuận An",
      province: "Bình Dương",
      postalCode: "750000",
      country: "VN",
    },
    paymentTerms: "Net 30",
    currency: "VND",
    leadTimeDays: 21,
    rating: 4.8,
    active: true,
  },
  {
    supplierId: "SUP-004",
    name: "Công ty TNHH May mặc Việt Thắng",
    taxCode: "0102345678",
    contactName: "Đặng Văn Nam",
    contactEmail: "nam.dang@vietthang.vn",
    contactPhone: "+84 987 555 666",
    address: {
      street: "12 Lê Trọng Tấn",
      ward: "Phường Khương Mai",
      district: "Quận Thanh Xuân",
      province: "Hà Nội",
      postalCode: "115000",
      country: "VN",
    },
    paymentTerms: "Net 15",
    currency: "VND",
    leadTimeDays: 10,
    rating: 4.2,
    active: true,
  },
];

/* ============================================================================
 * MODULE 02 — PURCHASE ORDER (warehouse/02-purchase-order)
 * ==========================================================================*/

/** Vòng đời PO (bảng Lifecycle 02). */
export type PoStatus =
  | "Draft"
  | "Pending Approval"
  | "Approved"
  | "Confirmed"
  | "Partially Received"
  | "Received"
  | "Closed"
  | "Cancelled";

/** Vòng đời Đề xuất Nhập hàng (Replenishment Proposal — 02 §5). */
export type ProposalStatus = "Draft Proposal" | "Reviewed" | "Converted";

export interface ReplenishmentProposal {
  proposalId: ID;
  skuId: ID;
  warehouseId: WarehouseId;
  suggestedQty: Qty;
  reason: string; // "Dưới reorder point", "Sức mua tăng"
  status: ProposalStatus;
  createdAt: ISODateTime;
  reviewedBy?: string;
  convertedToPoId?: ID;
}

export interface PoLine {
  lineId: ID;
  poId: ID;
  skuId: ID;
  orderedQty: Qty;
  receivedQty: Qty; // cập nhật từ Receipt (open quantity = ordered − received)
  unitPrice: number;
  currency: Currency;
  taxRate: number; // 0.08 = VAT 8%
  discountRate: number; // 0.05
  uom: Uom;
  lineTotal: number;
}

export interface PurchaseOrder {
  poId: ID; // PO-2026-xxxx
  poNumber: string;
  supplierId: ID;
  warehouseId: WarehouseId;
  status: PoStatus;
  currency: Currency;
  orderDate: ISODate;
  expectedDate: ISODate;
  createdBy: string;
  approvedBy?: string;
  approvalNote?: string;
  rejectionReason?: string;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  lines: PoLine[];
  fromProposalId?: ID;
  revisionOf?: ID; // PO Confirmed → Create Revision
  notes?: string;
}

export const replenishmentProposals: ReplenishmentProposal[] = [
  {
    proposalId: "PROP-001",
    skuId: "SKU-001-WHT-L",
    warehouseId: "WH-HN-01",
    suggestedQty: 200,
    reason: "Tồn dưới reorder point (6 còn < 60)",
    status: "Draft Proposal",
    createdAt: "2026-06-08T07:30:00+07:00",
  },
  {
    proposalId: "PROP-002",
    skuId: "SKU-001-NVY-XL",
    warehouseId: "WH-HN-01",
    suggestedQty: 150,
    reason: "Hết hàng, sức mua cao",
    status: "Reviewed",
    createdAt: "2026-06-08T07:32:00+07:00",
    reviewedBy: "Đỗ Hồng Nhung",
  },
  {
    proposalId: "PROP-003",
    skuId: "SKU-003-WHT-L",
    warehouseId: "WH-HCM-01",
    suggestedQty: 800,
    reason: "Cân bằng tồn giữa kho HN & HCM",
    status: "Converted",
    createdAt: "2026-06-05T09:00:00+07:00",
    reviewedBy: "Đỗ Hồng Nhung",
    convertedToPoId: "PO-2026-0012",
  },
];

export const purchaseOrders: PurchaseOrder[] = [
  {
    poId: "PO-2026-0009",
    poNumber: "PO-2026-0009",
    supplierId: "SUP-001",
    warehouseId: "WH-HN-01",
    status: "Draft",
    currency: "VND",
    orderDate: "2026-06-09",
    expectedDate: "2026-06-23",
    createdBy: "Lê Văn Hùng",
    subtotal: 25200000,
    taxTotal: 2016000,
    grandTotal: 27216000,
    lines: [
      {
        lineId: "POL-0009-1",
        poId: "PO-2026-0009",
        skuId: "SKU-003-WHT-L",
        orderedQty: 600,
        receivedQty: 0,
        unitPrice: 42000,
        currency: "VND",
        taxRate: 0.08,
        discountRate: 0,
        uom: "pcs",
        lineTotal: 25200000,
      },
    ],
  },
  {
    poId: "PO-2026-0010",
    poNumber: "PO-2026-0010",
    supplierId: "SUP-002",
    warehouseId: "WH-HCM-01",
    status: "Pending Approval",
    currency: "USD",
    orderDate: "2026-06-02",
    expectedDate: "2026-07-02",
    createdBy: "Lê Văn Hùng",
    // ASSUMPTION (open-question A4): PO ngoại tệ (USD) quy đổi khi đối chiếu hoá đơn.
    subtotal: 4200,
    taxTotal: 336,
    grandTotal: 4536,
    lines: [
      {
        lineId: "POL-0010-1",
        poId: "PO-2026-0010",
        skuId: "SKU-002-WHT",
        orderedQty: 600,
        receivedQty: 0,
        unitPrice: 7,
        currency: "USD",
        taxRate: 0.08,
        discountRate: 0,
        uom: "pcs",
        lineTotal: 4200,
      },
    ],
    notes: "Vượt hạn mức duyệt → chờ Approver (A2: hạn mức chưa chốt).",
  },
  {
    poId: "PO-2026-0011",
    poNumber: "PO-2026-0011",
    supplierId: "SUP-004",
    warehouseId: "WH-HN-01",
    status: "Approved",
    currency: "VND",
    orderDate: "2026-05-28",
    expectedDate: "2026-06-07",
    createdBy: "Lê Văn Hùng",
    approvedBy: "Trần Minh Quang",
    subtotal: 18900000,
    taxTotal: 1512000,
    grandTotal: 20412000,
    lines: [
      {
        lineId: "POL-0011-1",
        poId: "PO-2026-0011",
        skuId: "SKU-001-BLK-L",
        orderedQty: 900,
        receivedQty: 0,
        unitPrice: 21000,
        currency: "VND",
        taxRate: 0.08,
        discountRate: 0,
        uom: "pcs",
        lineTotal: 18900000,
      },
    ],
  },
  {
    poId: "PO-2026-0012",
    poNumber: "PO-2026-0012",
    supplierId: "SUP-001",
    warehouseId: "WH-HCM-01",
    status: "Confirmed",
    currency: "VND",
    orderDate: "2026-06-05",
    expectedDate: "2026-06-19",
    createdBy: "Đỗ Hồng Nhung",
    approvedBy: "Trần Minh Quang",
    fromProposalId: "PROP-003",
    subtotal: 33600000,
    taxTotal: 2688000,
    grandTotal: 36288000,
    lines: [
      {
        lineId: "POL-0012-1",
        poId: "PO-2026-0012",
        skuId: "SKU-003-WHT-L",
        orderedQty: 800,
        receivedQty: 0,
        unitPrice: 42000,
        currency: "VND",
        taxRate: 0.08,
        discountRate: 0,
        uom: "pcs",
        lineTotal: 33600000,
      },
    ],
  },
  {
    poId: "PO-2026-0007",
    poNumber: "PO-2026-0007",
    supplierId: "SUP-003",
    warehouseId: "WH-HCM-01",
    status: "Partially Received",
    currency: "VND",
    orderDate: "2026-05-10",
    expectedDate: "2026-05-31",
    createdBy: "Lê Văn Hùng",
    approvedBy: "Trần Minh Quang",
    subtotal: 14700000,
    taxTotal: 1176000,
    grandTotal: 15876000,
    lines: [
      {
        lineId: "POL-0007-1",
        poId: "PO-2026-0007",
        skuId: "SKU-002-WHT",
        orderedQty: 500,
        receivedQty: 300,
        unitPrice: 29400,
        currency: "VND",
        taxRate: 0.08,
        discountRate: 0,
        uom: "pcs",
        lineTotal: 14700000,
      },
    ],
  },
  {
    poId: "PO-2026-0005",
    poNumber: "PO-2026-0005",
    supplierId: "SUP-001",
    warehouseId: "WH-HN-01",
    status: "Received",
    currency: "VND",
    orderDate: "2026-04-18",
    expectedDate: "2026-05-02",
    createdBy: "Lê Văn Hùng",
    approvedBy: "Trần Minh Quang",
    subtotal: 21000000,
    taxTotal: 1680000,
    grandTotal: 22680000,
    lines: [
      {
        lineId: "POL-0005-1",
        poId: "PO-2026-0005",
        skuId: "SKU-001-BLK-M",
        orderedQty: 1000,
        receivedQty: 1000,
        unitPrice: 21000,
        currency: "VND",
        taxRate: 0.08,
        discountRate: 0,
        uom: "pcs",
        lineTotal: 21000000,
      },
    ],
  },
  {
    poId: "PO-2026-0003",
    poNumber: "PO-2026-0003",
    supplierId: "SUP-004",
    warehouseId: "WH-HN-01",
    status: "Closed",
    currency: "VND",
    orderDate: "2026-03-20",
    expectedDate: "2026-03-30",
    createdBy: "Đỗ Hồng Nhung",
    approvedBy: "Trần Minh Quang",
    subtotal: 9450000,
    taxTotal: 756000,
    grandTotal: 10206000,
    lines: [
      {
        lineId: "POL-0003-1",
        poId: "PO-2026-0003",
        skuId: "SKU-001-WHT-L",
        orderedQty: 450,
        receivedQty: 450,
        unitPrice: 21000,
        currency: "VND",
        taxRate: 0.08,
        discountRate: 0,
        uom: "pcs",
        lineTotal: 9450000,
      },
    ],
  },
  {
    poId: "PO-2026-0006",
    poNumber: "PO-2026-0006",
    supplierId: "SUP-002",
    warehouseId: "WH-HCM-01",
    status: "Cancelled",
    currency: "USD",
    orderDate: "2026-04-25",
    expectedDate: "2026-05-25",
    createdBy: "Lê Văn Hùng",
    rejectionReason: "NCC báo hết hàng, dời lịch giao quá lâu",
    subtotal: 2100,
    taxTotal: 168,
    grandTotal: 2268,
    lines: [
      {
        lineId: "POL-0006-1",
        poId: "PO-2026-0006",
        skuId: "SKU-002-WHT",
        orderedQty: 300,
        receivedQty: 0,
        unitPrice: 7,
        currency: "USD",
        taxRate: 0.08,
        discountRate: 0,
        uom: "pcs",
        lineTotal: 2100,
      },
    ],
  },
];

/* ============================================================================
 * MODULE 03 — RECEIPT (warehouse/03-receipt)
 * ==========================================================================*/

/** Trạng thái phiếu nhận (03 §5.1). */
export type ReceiptStatus = "Draft" | "Confirmed" | "In Putaway" | "Closed" | "Cancelled";

/** Trạng thái chất lượng hàng nhận theo lô (03 §5.2). */
export type QcStatus = "Accepted" | "Quarantine" | "Rejected";

export interface Lot {
  lotId: ID;
  skuId: ID;
  receiptId: ID;
  lotNumber: string;
  quantity: Qty;
  productionDate?: ISODate;
  expiryDate?: ISODate; // BR-03: hạn dùng > ngày nhận
  qcStatus: QcStatus;
  qcNote?: string;
  qcBy?: string;
  qcAt?: ISODateTime;
}

export interface SerialRecord {
  serialId: ID;
  skuId: ID;
  receiptId: ID;
  serialNumber: string;
  qcStatus: QcStatus;
}

export interface ReceiptLine {
  lineId: ID;
  receiptId: ID;
  poLineId: ID;
  skuId: ID;
  orderedQty: Qty;
  receivedQty: Qty;
  uom: Uom;
  lotIds: ID[];
  serialIds: ID[];
  evidencePhotoUrls: string[];
  discrepancyQty: Qty; // received − ordered (âm = thiếu)
}

export interface DiscrepancyRecord {
  discrepancyId: ID;
  receiptId: ID;
  lineId: ID;
  type: "over" | "short" | "damage";
  quantity: Qty;
  reason: string;
  resolvedBy?: string;
  status: "open" | "resolved";
}

export interface Receipt {
  receiptId: ID;
  receiptNumber: string;
  poId: ID;
  supplierId: ID;
  warehouseId: WarehouseId;
  status: ReceiptStatus;
  receivedAt: ISODateTime;
  receivedBy: string;
  lines: ReceiptLine[];
  discrepancies?: DiscrepancyRecord[];
  notes?: string;
}

export const lots: Lot[] = [
  {
    lotId: "LOT-RC01-002",
    skuId: "SKU-002-WHT",
    receiptId: "RC-2026-0015",
    lotNumber: "ML-2026-05-A",
    quantity: 280,
    productionDate: "2026-04-20",
    qcStatus: "Accepted",
    qcBy: "Vũ Thanh Tùng",
    qcAt: "2026-05-29T10:20:00+07:00",
  },
  {
    lotId: "LOT-RC01-002B",
    skuId: "SKU-002-WHT",
    receiptId: "RC-2026-0015",
    lotNumber: "ML-2026-05-B",
    quantity: 20,
    qcStatus: "Quarantine",
    qcNote: "12 cốc nứt men, 8 lệch màu — chờ kết luận",
    qcBy: "Vũ Thanh Tùng",
    qcAt: "2026-05-29T10:35:00+07:00",
  },
  {
    lotId: "LOT-RC02-001",
    skuId: "SKU-001-BLK-M",
    receiptId: "RC-2026-0012",
    lotNumber: "TC-2026-04-A",
    quantity: 1000,
    productionDate: "2026-04-10",
    qcStatus: "Accepted",
    qcBy: "Vũ Thanh Tùng",
    qcAt: "2026-05-01T09:00:00+07:00",
  },
  {
    lotId: "LOT-RC03-003",
    skuId: "SKU-003-WHT-L",
    receiptId: "RC-2026-0018",
    lotNumber: "TC-2026-06-A",
    quantity: 300,
    productionDate: "2026-05-25",
    qcStatus: "Accepted",
    qcBy: "Vũ Thanh Tùng",
    qcAt: "2026-06-13T08:40:00+07:00",
  },
];

export const serialRecords: SerialRecord[] = [
  // ASSUMPTION (open-question G1/B3): máy in không thuộc catalog; serial mock để demo luồng serial-tracking.
  {
    serialId: "SER-RC04-01",
    skuId: "SKU-002-WHT",
    receiptId: "RC-2026-0015",
    serialNumber: "N/A",
    qcStatus: "Accepted",
  },
];

export const receipts: Receipt[] = [
  {
    receiptId: "RC-2026-0018",
    receiptNumber: "RC-2026-0018",
    poId: "PO-2026-0012",
    supplierId: "SUP-001",
    warehouseId: "WH-HCM-01",
    status: "Draft",
    receivedAt: "2026-06-13T08:15:00+07:00",
    receivedBy: "Hoàng Anh Tuấn",
    lines: [
      {
        lineId: "RCL-0018-1",
        receiptId: "RC-2026-0018",
        poLineId: "POL-0012-1",
        skuId: "SKU-003-WHT-L",
        orderedQty: 800,
        receivedQty: 300,
        uom: "pcs",
        lotIds: ["LOT-RC03-003"],
        serialIds: [],
        evidencePhotoUrls: ["/mock/img/rc-0018-1.jpg"],
        discrepancyQty: -500,
      },
    ],
    notes: "Đang kiểm đếm đợt 1/2.",
  },
  {
    receiptId: "RC-2026-0015",
    receiptNumber: "RC-2026-0015",
    poId: "PO-2026-0007",
    supplierId: "SUP-003",
    warehouseId: "WH-HCM-01",
    status: "Confirmed",
    receivedAt: "2026-05-29T09:40:00+07:00",
    receivedBy: "Hoàng Anh Tuấn",
    lines: [
      {
        lineId: "RCL-0015-1",
        receiptId: "RC-2026-0015",
        poLineId: "POL-0007-1",
        skuId: "SKU-002-WHT",
        orderedQty: 500,
        receivedQty: 300,
        uom: "pcs",
        lotIds: ["LOT-RC01-002", "LOT-RC01-002B"],
        serialIds: [],
        evidencePhotoUrls: ["/mock/img/rc-0015-1.jpg", "/mock/img/rc-0015-2.jpg"],
        discrepancyQty: -200,
      },
    ],
    discrepancies: [
      {
        discrepancyId: "DISC-0015-1",
        receiptId: "RC-2026-0015",
        lineId: "RCL-0015-1",
        type: "short",
        quantity: 200,
        reason: "NCC giao thiếu, hẹn đợt 2",
        status: "resolved",
        resolvedBy: "Trần Minh Quang",
      },
      {
        discrepancyId: "DISC-0015-2",
        receiptId: "RC-2026-0015",
        lineId: "RCL-0015-1",
        type: "damage",
        quantity: 20,
        reason: "20 cốc lỗi (nứt men/lệch màu) → Quarantine",
        status: "open",
      },
    ],
  },
  {
    receiptId: "RC-2026-0013",
    receiptNumber: "RC-2026-0013",
    poId: "PO-2026-0011",
    supplierId: "SUP-004",
    warehouseId: "WH-HN-01",
    status: "In Putaway",
    receivedAt: "2026-06-07T13:20:00+07:00",
    receivedBy: "Hoàng Anh Tuấn",
    lines: [
      {
        lineId: "RCL-0013-1",
        receiptId: "RC-2026-0013",
        poLineId: "POL-0011-1",
        skuId: "SKU-001-BLK-L",
        orderedQty: 900,
        receivedQty: 900,
        uom: "pcs",
        lotIds: [],
        serialIds: [],
        evidencePhotoUrls: ["/mock/img/rc-0013-1.jpg"],
        discrepancyQty: 0,
      },
    ],
  },
  {
    receiptId: "RC-2026-0012",
    receiptNumber: "RC-2026-0012",
    poId: "PO-2026-0005",
    supplierId: "SUP-001",
    warehouseId: "WH-HN-01",
    status: "Closed",
    receivedAt: "2026-05-01T08:30:00+07:00",
    receivedBy: "Hoàng Anh Tuấn",
    lines: [
      {
        lineId: "RCL-0012-1",
        receiptId: "RC-2026-0012",
        poLineId: "POL-0005-1",
        skuId: "SKU-001-BLK-M",
        orderedQty: 1000,
        receivedQty: 1000,
        uom: "pcs",
        lotIds: ["LOT-RC02-001"],
        serialIds: [],
        evidencePhotoUrls: ["/mock/img/rc-0012-1.jpg"],
        discrepancyQty: 0,
      },
    ],
  },
  {
    receiptId: "RC-2026-0011",
    receiptNumber: "RC-2026-0011",
    poId: "PO-2026-0003",
    supplierId: "SUP-004",
    warehouseId: "WH-HN-01",
    status: "Cancelled",
    receivedAt: "2026-03-28T10:00:00+07:00",
    receivedBy: "Hoàng Anh Tuấn",
    lines: [
      {
        lineId: "RCL-0011-1",
        receiptId: "RC-2026-0011",
        poLineId: "POL-0003-1",
        skuId: "SKU-001-WHT-L",
        orderedQty: 450,
        receivedQty: 0,
        uom: "pcs",
        lotIds: [],
        serialIds: [],
        evidencePhotoUrls: [],
        discrepancyQty: -450,
      },
    ],
    notes: "Huỷ do nhập nhầm PO; tạo lại phiếu mới.",
  },
];

/* ============================================================================
 * MODULE 04 — INVOICE (warehouse/04-invoice)
 * ==========================================================================*/

/** Vòng đời hoá đơn NCC (bảng Lifecycle 04). */
export type InvoiceStatus =
  "Draft" | "Matched" | "Exception" | "Disputed" | "Approved for Payment" | "Paid" | "Cancelled";

export type InvoiceType = "Supplier" | "Adjustment" | "Credit Note";
export type MatchResult = "Matched" | "Exception";

export interface InvoiceLine {
  lineId: ID;
  invoiceId: ID;
  poLineId: ID;
  receiptLineId: ID;
  skuId: ID;
  quantity: Qty;
  unitPrice: number;
  taxRate: number;
  lineTotal: number;
  /** Three-way matching diff (04): so PO ↔ Receipt ↔ Invoice. */
  match: {
    qtyPo: Qty;
    qtyReceipt: Qty;
    qtyInvoice: Qty;
    pricePo: number;
    priceInvoice: number;
    varianceQty: Qty;
    variancePrice: number;
    withinTolerance: boolean;
  };
}

export interface Invoice {
  invoiceId: ID;
  invoiceNumber: string; // số hoá đơn NCC (unique — BR)
  type: InvoiceType;
  supplierId: ID;
  poId: ID;
  receiptId: ID;
  warehouseId: WarehouseId;
  status: InvoiceStatus;
  currency: Currency;
  invoiceDate: ISODate;
  dueDate: ISODate;
  matchResult: MatchResult;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  lines: InvoiceLine[];
  matchedBy?: string;
  matchedAt?: ISODateTime;
  disputeNote?: string;
  paidAt?: ISODateTime;
  paymentRef?: string;
  notes?: string;
}

export const invoices: Invoice[] = [
  {
    invoiceId: "INV-2026-0021",
    invoiceNumber: "ML/2026/0512",
    type: "Supplier",
    supplierId: "SUP-003",
    poId: "PO-2026-0007",
    receiptId: "RC-2026-0015",
    warehouseId: "WH-HCM-01",
    status: "Draft",
    currency: "VND",
    invoiceDate: "2026-06-01",
    dueDate: "2026-07-01",
    matchResult: "Matched",
    subtotal: 8820000,
    taxTotal: 705600,
    grandTotal: 9525600,
    lines: [
      {
        lineId: "INVL-0021-1",
        invoiceId: "INV-2026-0021",
        poLineId: "POL-0007-1",
        receiptLineId: "RCL-0015-1",
        skuId: "SKU-002-WHT",
        quantity: 300,
        unitPrice: 29400,
        taxRate: 0.08,
        lineTotal: 8820000,
        match: {
          qtyPo: 500,
          qtyReceipt: 300,
          qtyInvoice: 300,
          pricePo: 29400,
          priceInvoice: 29400,
          varianceQty: 0,
          variancePrice: 0,
          withinTolerance: true,
        },
      },
    ],
  },
  {
    invoiceId: "INV-2026-0020",
    invoiceNumber: "TC/2026/0488",
    type: "Supplier",
    supplierId: "SUP-001",
    poId: "PO-2026-0005",
    receiptId: "RC-2026-0012",
    warehouseId: "WH-HN-01",
    status: "Matched",
    currency: "VND",
    invoiceDate: "2026-05-05",
    dueDate: "2026-06-04",
    matchResult: "Matched",
    matchedBy: "Bùi Thu Hà",
    matchedAt: "2026-05-06T14:00:00+07:00",
    subtotal: 21000000,
    taxTotal: 1680000,
    grandTotal: 22680000,
    lines: [
      {
        lineId: "INVL-0020-1",
        invoiceId: "INV-2026-0020",
        poLineId: "POL-0005-1",
        receiptLineId: "RCL-0012-1",
        skuId: "SKU-001-BLK-M",
        quantity: 1000,
        unitPrice: 21000,
        taxRate: 0.08,
        lineTotal: 21000000,
        match: {
          qtyPo: 1000,
          qtyReceipt: 1000,
          qtyInvoice: 1000,
          pricePo: 21000,
          priceInvoice: 21000,
          varianceQty: 0,
          variancePrice: 0,
          withinTolerance: true,
        },
      },
    ],
  },
  {
    invoiceId: "INV-2026-0019",
    invoiceNumber: "VT/2026/0301",
    type: "Supplier",
    supplierId: "SUP-004",
    poId: "PO-2026-0011",
    receiptId: "RC-2026-0013",
    warehouseId: "WH-HN-01",
    status: "Exception",
    currency: "VND",
    invoiceDate: "2026-06-08",
    dueDate: "2026-07-08",
    matchResult: "Exception",
    subtotal: 19320000,
    taxTotal: 1545600,
    grandTotal: 20865600,
    lines: [
      {
        lineId: "INVL-0019-1",
        invoiceId: "INV-2026-0019",
        poLineId: "POL-0011-1",
        receiptLineId: "RCL-0013-1",
        skuId: "SKU-001-BLK-L",
        quantity: 920,
        unitPrice: 21000,
        taxRate: 0.08,
        lineTotal: 19320000,
        match: {
          qtyPo: 900,
          qtyReceipt: 900,
          qtyInvoice: 920,
          pricePo: 21000,
          priceInvoice: 21000,
          varianceQty: 20,
          variancePrice: 0,
          withinTolerance: false,
        },
      },
    ],
    // ASSUMPTION (open-question C9): dung sai số lượng/giá theo hệ thống; mock variance 20 vượt tolerance.
  },
  {
    invoiceId: "INV-2026-0018",
    invoiceNumber: "GZ/2026/0077",
    type: "Supplier",
    supplierId: "SUP-002",
    poId: "PO-2026-0007",
    receiptId: "RC-2026-0015",
    warehouseId: "WH-HCM-01",
    status: "Disputed",
    currency: "USD",
    invoiceDate: "2026-05-20",
    dueDate: "2026-06-19",
    matchResult: "Exception",
    disputeNote: "NCC tính giá 7.4 USD/pcs vs PO 7.0 — chờ credit note",
    subtotal: 2220,
    taxTotal: 177.6,
    grandTotal: 2397.6,
    lines: [
      {
        lineId: "INVL-0018-1",
        invoiceId: "INV-2026-0018",
        poLineId: "POL-0007-1",
        receiptLineId: "RCL-0015-1",
        skuId: "SKU-002-WHT",
        quantity: 300,
        unitPrice: 7.4,
        taxRate: 0.08,
        lineTotal: 2220,
        match: {
          qtyPo: 500,
          qtyReceipt: 300,
          qtyInvoice: 300,
          pricePo: 7.0,
          priceInvoice: 7.4,
          varianceQty: 0,
          variancePrice: 0.4,
          withinTolerance: false,
        },
      },
    ],
  },
  {
    invoiceId: "INV-2026-0016",
    invoiceNumber: "VT/2026/0255",
    type: "Supplier",
    supplierId: "SUP-004",
    poId: "PO-2026-0003",
    receiptId: "RC-2026-0011",
    warehouseId: "WH-HN-01",
    status: "Approved for Payment",
    currency: "VND",
    invoiceDate: "2026-04-01",
    dueDate: "2026-05-01",
    matchResult: "Matched",
    matchedBy: "Bùi Thu Hà",
    matchedAt: "2026-04-02T09:00:00+07:00",
    subtotal: 9450000,
    taxTotal: 756000,
    grandTotal: 10206000,
    lines: [
      {
        lineId: "INVL-0016-1",
        invoiceId: "INV-2026-0016",
        poLineId: "POL-0003-1",
        receiptLineId: "RCL-0011-1",
        skuId: "SKU-001-WHT-L",
        quantity: 450,
        unitPrice: 21000,
        taxRate: 0.08,
        lineTotal: 9450000,
        match: {
          qtyPo: 450,
          qtyReceipt: 450,
          qtyInvoice: 450,
          pricePo: 21000,
          priceInvoice: 21000,
          varianceQty: 0,
          variancePrice: 0,
          withinTolerance: true,
        },
      },
    ],
  },
  {
    invoiceId: "INV-2026-0014",
    invoiceNumber: "TC/2026/0402",
    type: "Supplier",
    supplierId: "SUP-001",
    poId: "PO-2026-0003",
    receiptId: "RC-2026-0012",
    warehouseId: "WH-HN-01",
    status: "Paid",
    currency: "VND",
    invoiceDate: "2026-03-25",
    dueDate: "2026-04-24",
    matchResult: "Matched",
    matchedBy: "Bùi Thu Hà",
    matchedAt: "2026-03-26T10:00:00+07:00",
    paidAt: "2026-04-20T16:00:00+07:00",
    paymentRef: "UNC-20260420-019",
    subtotal: 9450000,
    taxTotal: 756000,
    grandTotal: 10206000,
    lines: [
      {
        lineId: "INVL-0014-1",
        invoiceId: "INV-2026-0014",
        poLineId: "POL-0003-1",
        receiptLineId: "RCL-0011-1",
        skuId: "SKU-001-WHT-L",
        quantity: 450,
        unitPrice: 21000,
        taxRate: 0.08,
        lineTotal: 9450000,
        match: {
          qtyPo: 450,
          qtyReceipt: 450,
          qtyInvoice: 450,
          pricePo: 21000,
          priceInvoice: 21000,
          varianceQty: 0,
          variancePrice: 0,
          withinTolerance: true,
        },
      },
    ],
  },
  {
    invoiceId: "INV-2026-0013",
    invoiceNumber: "ML/2026/0399",
    type: "Credit Note",
    supplierId: "SUP-003",
    poId: "PO-2026-0007",
    receiptId: "RC-2026-0015",
    warehouseId: "WH-HCM-01",
    status: "Cancelled",
    currency: "VND",
    invoiceDate: "2026-05-18",
    dueDate: "2026-06-17",
    matchResult: "Exception",
    subtotal: -588000,
    taxTotal: -47040,
    grandTotal: -635040,
    lines: [
      {
        lineId: "INVL-0013-1",
        invoiceId: "INV-2026-0013",
        poLineId: "POL-0007-1",
        receiptLineId: "RCL-0015-1",
        skuId: "SKU-002-WHT",
        quantity: -20,
        unitPrice: 29400,
        taxRate: 0.08,
        lineTotal: -588000,
        match: {
          qtyPo: 500,
          qtyReceipt: 300,
          qtyInvoice: -20,
          pricePo: 29400,
          priceInvoice: 29400,
          varianceQty: -20,
          variancePrice: 0,
          withinTolerance: false,
        },
      },
    ],
    notes: "Credit note cho 20 cốc Quarantine — nhập nhầm, đã huỷ.",
  },
];

/* ============================================================================
 * MODULE 05 — PUTAWAY (warehouse/05-putaway)
 * ==========================================================================*/

/** Vòng đời nhiệm vụ putaway (05 §5). */
export type PutawayStatus =
  | "Pending"
  | "Assigned"
  | "In Progress"
  | "Partially Completed"
  | "On Hold"
  | "Completed"
  | "Cancelled";

/** Trạng thái tồn trong quá trình (05 §5 — "Trạng thái hàng trong quá trình"). */
export type StockStatus = "Inbound" | "In Putaway" | "Available" | "Blocked";

export interface PutawayTaskLine {
  lineId: ID;
  taskId: ID;
  skuId: ID;
  lotId?: ID;
  serialIds?: ID[];
  quantityBase: Qty;
  handlingUnitType: "each" | "carton" | "pallet";
  handlingUnitQty: Qty;
  fromLocationId: ID; // staging / inbound dock
  suggestedLocationId: ID; // gợi ý slotting (06)
  actualLocationId?: ID; // vị trí thực tế đã cất
  overrideReason?: string; // bắt buộc nếu actual ≠ suggested (FRONTEND-AI-RULES §4.3)
  status: PutawayStatus;
}

export interface PutawayTask {
  taskId: ID;
  taskNo: string;
  receiptId: ID;
  warehouseId: WarehouseId;
  status: PutawayStatus;
  priority: "low" | "normal" | "high" | "urgent";
  assignedTo?: string;
  createdAt: ISODateTime;
  startedAt?: ISODateTime;
  completedAt?: ISODateTime;
  holdReason?: string;
  lines: PutawayTaskLine[];
}

export const putawayTasks: PutawayTask[] = [
  {
    taskId: "PT-2026-0041",
    taskNo: "PT-2026-0041",
    receiptId: "RC-2026-0018",
    warehouseId: "WH-HCM-01",
    status: "Pending",
    priority: "normal",
    createdAt: "2026-06-13T08:45:00+07:00",
    lines: [
      {
        lineId: "PTL-0041-1",
        taskId: "PT-2026-0041",
        skuId: "SKU-003-WHT-L",
        lotId: "LOT-RC03-003",
        quantityBase: 300,
        handlingUnitType: "carton",
        handlingUnitQty: 6,
        fromLocationId: "LOC-HCM-STAGE-01",
        suggestedLocationId: "LOC-HCM-A01-02-03-B",
        status: "Pending",
      },
    ],
  },
  {
    taskId: "PT-2026-0040",
    taskNo: "PT-2026-0040",
    receiptId: "RC-2026-0013",
    warehouseId: "WH-HN-01",
    status: "Assigned",
    priority: "high",
    assignedTo: "Nguyễn Văn Đạt",
    createdAt: "2026-06-07T13:25:00+07:00",
    lines: [
      {
        lineId: "PTL-0040-1",
        taskId: "PT-2026-0040",
        skuId: "SKU-001-BLK-L",
        quantityBase: 900,
        handlingUnitType: "carton",
        handlingUnitQty: 18,
        fromLocationId: "LOC-HN-STAGE-02",
        suggestedLocationId: "LOC-HN-B03-01-02-A",
        status: "Assigned",
      },
    ],
  },
  {
    taskId: "PT-2026-0038",
    taskNo: "PT-2026-0038",
    receiptId: "RC-2026-0015",
    warehouseId: "WH-HCM-01",
    status: "In Progress",
    priority: "normal",
    assignedTo: "Phạm Thị Mai",
    createdAt: "2026-05-29T11:00:00+07:00",
    startedAt: "2026-05-29T11:30:00+07:00",
    lines: [
      {
        lineId: "PTL-0038-1",
        taskId: "PT-2026-0038",
        skuId: "SKU-002-WHT",
        lotId: "LOT-RC01-002",
        quantityBase: 280,
        handlingUnitType: "carton",
        handlingUnitQty: 7,
        fromLocationId: "LOC-HCM-STAGE-01",
        suggestedLocationId: "LOC-HCM-C02-04-01-A",
        actualLocationId: "LOC-HCM-C02-04-01-A",
        status: "Completed",
      },
    ],
  },
  {
    taskId: "PT-2026-0037",
    taskNo: "PT-2026-0037",
    receiptId: "RC-2026-0015",
    warehouseId: "WH-HCM-01",
    status: "Partially Completed",
    priority: "normal",
    assignedTo: "Phạm Thị Mai",
    createdAt: "2026-05-29T11:05:00+07:00",
    startedAt: "2026-05-29T13:00:00+07:00",
    lines: [
      {
        lineId: "PTL-0037-1",
        taskId: "PT-2026-0037",
        skuId: "SKU-002-WHT",
        lotId: "LOT-RC01-002",
        quantityBase: 200,
        handlingUnitType: "carton",
        handlingUnitQty: 5,
        fromLocationId: "LOC-HCM-STAGE-01",
        suggestedLocationId: "LOC-HCM-C02-04-02-A",
        actualLocationId: "LOC-HCM-C02-04-02-A",
        status: "Completed",
      },
      {
        lineId: "PTL-0037-2",
        taskId: "PT-2026-0037",
        skuId: "SKU-002-WHT",
        lotId: "LOT-RC01-002",
        quantityBase: 80,
        handlingUnitType: "carton",
        handlingUnitQty: 2,
        fromLocationId: "LOC-HCM-STAGE-01",
        suggestedLocationId: "LOC-HCM-C02-04-03-A",
        status: "In Progress",
      },
    ],
  },
  {
    taskId: "PT-2026-0036",
    taskNo: "PT-2026-0036",
    receiptId: "RC-2026-0015",
    warehouseId: "WH-HCM-01",
    status: "On Hold",
    priority: "urgent",
    assignedTo: "Phạm Thị Mai",
    createdAt: "2026-05-29T11:10:00+07:00",
    startedAt: "2026-05-29T14:00:00+07:00",
    holdReason: "Hàng Quarantine chờ kết luận QC — không putaway vào vùng picking (03 BR-04)",
    lines: [
      {
        lineId: "PTL-0036-1",
        taskId: "PT-2026-0036",
        skuId: "SKU-002-WHT",
        lotId: "LOT-RC01-002B",
        quantityBase: 20,
        handlingUnitType: "carton",
        handlingUnitQty: 1,
        fromLocationId: "LOC-HCM-STAGE-01",
        suggestedLocationId: "LOC-HCM-QTN-01",
        status: "On Hold",
      },
    ],
  },
  {
    taskId: "PT-2026-0030",
    taskNo: "PT-2026-0030",
    receiptId: "RC-2026-0012",
    warehouseId: "WH-HN-01",
    status: "Completed",
    priority: "normal",
    assignedTo: "Nguyễn Văn Đạt",
    createdAt: "2026-05-01T08:40:00+07:00",
    startedAt: "2026-05-01T09:00:00+07:00",
    completedAt: "2026-05-01T11:20:00+07:00",
    lines: [
      {
        lineId: "PTL-0030-1",
        taskId: "PT-2026-0030",
        skuId: "SKU-001-BLK-M",
        lotId: "LOT-RC02-001",
        quantityBase: 1000,
        handlingUnitType: "carton",
        handlingUnitQty: 20,
        fromLocationId: "LOC-HN-STAGE-01",
        suggestedLocationId: "LOC-HN-B02-03-01-A",
        actualLocationId: "LOC-HN-B03-03-01-A",
        overrideReason: "Vị trí gợi ý đầy — chuyển sang bin kế cận cùng zone (đã chọn reason code)",
        status: "Completed",
      },
    ],
  },
  {
    taskId: "PT-2026-0025",
    taskNo: "PT-2026-0025",
    receiptId: "RC-2026-0011",
    warehouseId: "WH-HN-01",
    status: "Cancelled",
    priority: "normal",
    createdAt: "2026-03-28T10:10:00+07:00",
    holdReason: "Receipt huỷ (nhập nhầm PO) → putaway chuyển trả NCC",
    lines: [
      {
        lineId: "PTL-0025-1",
        taskId: "PT-2026-0025",
        skuId: "SKU-001-WHT-L",
        quantityBase: 450,
        handlingUnitType: "carton",
        handlingUnitQty: 9,
        fromLocationId: "LOC-HN-STAGE-01",
        suggestedLocationId: "LOC-HN-A02-01-02-A",
        status: "Cancelled",
      },
    ],
  },
];

/* ============================================================================
 * MODULE 06 — WAREHOUSE MAP & SLOTTING (warehouse/06-warehouse-map-slotting)
 * ==========================================================================*/

/** Trạng thái vị trí lưu kho (06). */
export type LocationStatus = "Empty" | "Occupied" | "Reserved" | "Blocked" | "Full" | "Disabled";

export type LocationType =
  "bin" | "rack" | "level" | "aisle" | "zone" | "staging" | "quarantine" | "dock";
export type ZoneType = "picking" | "bulk" | "staging" | "quarantine" | "packing" | "returns";

export interface Warehouse {
  warehouseId: WarehouseId;
  name: string;
  code: string;
  address: AddressVN;
  totalAreaM2: number;
  dockCount: number;
  active: boolean;
}

export interface Zone {
  zoneId: ID;
  warehouseId: WarehouseId;
  name: string;
  type: ZoneType;
  aisleCount: number;
}

export interface Location {
  locationId: ID; // LOC-HN-B02-03-01-A
  warehouseId: WarehouseId;
  zoneId: ID;
  aisle: string;
  rack: string;
  level: string;
  bin: string;
  type: LocationType;
  status: LocationStatus;
  /** Sức chứa & độ lấp (heatmap 06). */
  capacityVolumeM3: number;
  occupiedVolumeM3: number;
  fillRate: number; // 0–1
  maxWeightKg: number;
  currentSkuIds: ID[];
  /** Toạ độ cho canvas 2D/3D (06 — map 3D chỉ trực quan, không phải nguồn sự thật tồn). */
  coords: { x: number; y: number; z: number };
  isPickable: boolean;
  ergonomicScore: number; // 0–100 (công thái học, C1)
}

/** Gợi ý slotting có xếp hạng (05/06 — SlottingSuggestionList ranked). */
export interface SlottingSuggestion {
  suggestionId: ID;
  skuId: ID;
  taskId: ID; // putaway / move task áp dụng
  rank: number; // 1 = tốt nhất
  locationId: ID;
  score: number; // 0–100
  reasons: string[]; // "gần dock", "cùng SKU", "còn 60% chỗ", "FEFO"
  criteria: {
    nearPacking: number;
    skuAffinity: number;
    fefo: number;
    loadBalance: number;
    ergonomics: number;
    density: number;
  };
  accepted?: boolean;
}

/** KPI dashboard kho (06). */
export interface WarehouseKpi {
  warehouseId: WarehouseId;
  utilizationPct: number; // % độ lấp
  honeycombingPct: number; // % lãng phí tổ ong
  overloadedLocations: number;
  emptyLocations: number;
  blockedLocations: number;
  pendingPutaway: number;
  openPickTasks: number;
  asOf: ISODateTime;
}

export const warehouses: Warehouse[] = [
  {
    warehouseId: "WH-HN-01",
    name: "Kho Hà Nội — Trung tâm",
    code: "HN01",
    address: {
      street: "Lô CN2, KCN Bắc Thăng Long",
      ward: "Xã Kim Chung",
      district: "Huyện Đông Anh",
      province: "Hà Nội",
      postalCode: "130000",
      country: "VN",
    },
    totalAreaM2: 4200,
    dockCount: 4,
    active: true,
  },
  {
    warehouseId: "WH-HCM-01",
    name: "Kho TP.HCM — Tân Bình",
    code: "HCM01",
    address: {
      street: "218 Hoàng Văn Thụ",
      ward: "Phường 4",
      district: "Quận Tân Bình",
      province: "TP. Hồ Chí Minh",
      postalCode: "721000",
      country: "VN",
    },
    totalAreaM2: 3600,
    dockCount: 3,
    active: true,
  },
  {
    warehouseId: "WH-DN-01",
    name: "Kho Đà Nẵng — Liên Chiểu",
    code: "DN01",
    address: {
      street: "Đường số 5, KCN Hòa Khánh",
      ward: "Phường Hòa Khánh Bắc",
      district: "Quận Liên Chiểu",
      province: "Đà Nẵng",
      postalCode: "507000",
      country: "VN",
    },
    totalAreaM2: 1800,
    dockCount: 2,
    active: true,
  },
];

export const zones: Zone[] = [
  {
    zoneId: "ZN-HN-A",
    warehouseId: "WH-HN-01",
    name: "Khu A — Picking nhanh",
    type: "picking",
    aisleCount: 4,
  },
  { zoneId: "ZN-HN-B", warehouseId: "WH-HN-01", name: "Khu B — Bulk", type: "bulk", aisleCount: 6 },
  {
    zoneId: "ZN-HN-STAGE",
    warehouseId: "WH-HN-01",
    name: "Khu Staging nhập",
    type: "staging",
    aisleCount: 1,
  },
  {
    zoneId: "ZN-HN-QTN",
    warehouseId: "WH-HN-01",
    name: "Khu cách ly QC",
    type: "quarantine",
    aisleCount: 1,
  },
  {
    zoneId: "ZN-HN-PACK",
    warehouseId: "WH-HN-01",
    name: "Khu đóng gói",
    type: "packing",
    aisleCount: 2,
  },
  {
    zoneId: "ZN-HCM-C",
    warehouseId: "WH-HCM-01",
    name: "Khu C — Picking",
    type: "picking",
    aisleCount: 5,
  },
  {
    zoneId: "ZN-HCM-STAGE",
    warehouseId: "WH-HCM-01",
    name: "Khu Staging nhập",
    type: "staging",
    aisleCount: 1,
  },
  {
    zoneId: "ZN-HCM-QTN",
    warehouseId: "WH-HCM-01",
    name: "Khu cách ly QC",
    type: "quarantine",
    aisleCount: 1,
  },
  {
    zoneId: "ZN-DN-D",
    warehouseId: "WH-DN-01",
    name: "Khu D — Tổng hợp",
    type: "picking",
    aisleCount: 3,
  },
];

export const locations: Location[] = [
  {
    locationId: "LOC-HN-A01-01-01-A",
    warehouseId: "WH-HN-01",
    zoneId: "ZN-HN-A",
    aisle: "A01",
    rack: "01",
    level: "01",
    bin: "A",
    type: "bin",
    status: "Occupied",
    capacityVolumeM3: 0.48,
    occupiedVolumeM3: 0.3,
    fillRate: 0.62,
    maxWeightKg: 120,
    currentSkuIds: ["SKU-001-BLK-L"],
    coords: { x: 1, y: 1, z: 1 },
    isPickable: true,
    ergonomicScore: 92,
  },
  {
    locationId: "LOC-HN-A01-01-02-A",
    warehouseId: "WH-HN-01",
    zoneId: "ZN-HN-A",
    aisle: "A01",
    rack: "01",
    level: "02",
    bin: "A",
    type: "bin",
    status: "Full",
    capacityVolumeM3: 0.48,
    occupiedVolumeM3: 0.47,
    fillRate: 0.98,
    maxWeightKg: 120,
    currentSkuIds: ["SKU-001-BLK-M"],
    coords: { x: 1, y: 1, z: 2 },
    isPickable: true,
    ergonomicScore: 60,
  },
  {
    locationId: "LOC-HN-A02-01-02-A",
    warehouseId: "WH-HN-01",
    zoneId: "ZN-HN-A",
    aisle: "A02",
    rack: "01",
    level: "02",
    bin: "A",
    type: "bin",
    status: "Empty",
    capacityVolumeM3: 0.48,
    occupiedVolumeM3: 0,
    fillRate: 0,
    maxWeightKg: 120,
    currentSkuIds: [],
    coords: { x: 2, y: 1, z: 2 },
    isPickable: true,
    ergonomicScore: 78,
  },
  {
    locationId: "LOC-HN-B02-03-01-A",
    warehouseId: "WH-HN-01",
    zoneId: "ZN-HN-B",
    aisle: "B02",
    rack: "03",
    level: "01",
    bin: "A",
    type: "bin",
    status: "Occupied",
    capacityVolumeM3: 1.2,
    occupiedVolumeM3: 0.72,
    fillRate: 0.6,
    maxWeightKg: 400,
    currentSkuIds: ["SKU-003-WHT-L"],
    coords: { x: 6, y: 2, z: 1 },
    isPickable: true,
    ergonomicScore: 85,
  },
  {
    locationId: "LOC-HN-B03-01-02-A",
    warehouseId: "WH-HN-01",
    zoneId: "ZN-HN-B",
    aisle: "B03",
    rack: "01",
    level: "02",
    bin: "A",
    type: "bin",
    status: "Reserved",
    capacityVolumeM3: 1.2,
    occupiedVolumeM3: 0,
    fillRate: 0,
    maxWeightKg: 400,
    currentSkuIds: [],
    coords: { x: 7, y: 1, z: 2 },
    isPickable: true,
    ergonomicScore: 70,
  },
  {
    locationId: "LOC-HN-B03-03-01-A",
    warehouseId: "WH-HN-01",
    zoneId: "ZN-HN-B",
    aisle: "B03",
    rack: "03",
    level: "01",
    bin: "A",
    type: "bin",
    status: "Occupied",
    capacityVolumeM3: 1.2,
    occupiedVolumeM3: 0.9,
    fillRate: 0.75,
    maxWeightKg: 400,
    currentSkuIds: ["SKU-001-BLK-M"],
    coords: { x: 7, y: 3, z: 1 },
    isPickable: true,
    ergonomicScore: 88,
  },
  {
    locationId: "LOC-HN-STAGE-01",
    warehouseId: "WH-HN-01",
    zoneId: "ZN-HN-STAGE",
    aisle: "STG",
    rack: "01",
    level: "00",
    bin: "01",
    type: "staging",
    status: "Occupied",
    capacityVolumeM3: 6,
    occupiedVolumeM3: 2.4,
    fillRate: 0.4,
    maxWeightKg: 2000,
    currentSkuIds: ["SKU-001-BLK-L"],
    coords: { x: 0, y: 0, z: 0 },
    isPickable: false,
    ergonomicScore: 95,
  },
  {
    locationId: "LOC-HN-STAGE-02",
    warehouseId: "WH-HN-01",
    zoneId: "ZN-HN-STAGE",
    aisle: "STG",
    rack: "02",
    level: "00",
    bin: "01",
    type: "staging",
    status: "Occupied",
    capacityVolumeM3: 6,
    occupiedVolumeM3: 3.6,
    fillRate: 0.6,
    maxWeightKg: 2000,
    currentSkuIds: ["SKU-001-BLK-L"],
    coords: { x: 0, y: 1, z: 0 },
    isPickable: false,
    ergonomicScore: 95,
  },
  {
    locationId: "LOC-HN-QTN-01",
    warehouseId: "WH-HN-01",
    zoneId: "ZN-HN-QTN",
    aisle: "QTN",
    rack: "01",
    level: "00",
    bin: "01",
    type: "quarantine",
    status: "Blocked",
    capacityVolumeM3: 3,
    occupiedVolumeM3: 0.5,
    fillRate: 0.16,
    maxWeightKg: 800,
    currentSkuIds: [],
    coords: { x: 9, y: 0, z: 0 },
    isPickable: false,
    ergonomicScore: 40,
  },
  {
    locationId: "LOC-HCM-C02-04-01-A",
    warehouseId: "WH-HCM-01",
    zoneId: "ZN-HCM-C",
    aisle: "C02",
    rack: "04",
    level: "01",
    bin: "A",
    type: "bin",
    status: "Occupied",
    capacityVolumeM3: 0.6,
    occupiedVolumeM3: 0.36,
    fillRate: 0.6,
    maxWeightKg: 150,
    currentSkuIds: ["SKU-002-WHT"],
    coords: { x: 2, y: 4, z: 1 },
    isPickable: true,
    ergonomicScore: 86,
  },
  {
    locationId: "LOC-HCM-C02-04-02-A",
    warehouseId: "WH-HCM-01",
    zoneId: "ZN-HCM-C",
    aisle: "C02",
    rack: "04",
    level: "02",
    bin: "A",
    type: "bin",
    status: "Occupied",
    capacityVolumeM3: 0.6,
    occupiedVolumeM3: 0.42,
    fillRate: 0.7,
    maxWeightKg: 150,
    currentSkuIds: ["SKU-002-WHT"],
    coords: { x: 2, y: 4, z: 2 },
    isPickable: true,
    ergonomicScore: 64,
  },
  {
    locationId: "LOC-HCM-C02-04-03-A",
    warehouseId: "WH-HCM-01",
    zoneId: "ZN-HCM-C",
    aisle: "C02",
    rack: "04",
    level: "03",
    bin: "A",
    type: "bin",
    status: "Empty",
    capacityVolumeM3: 0.6,
    occupiedVolumeM3: 0,
    fillRate: 0,
    maxWeightKg: 150,
    currentSkuIds: [],
    coords: { x: 2, y: 4, z: 3 },
    isPickable: true,
    ergonomicScore: 45,
  },
  {
    locationId: "LOC-HCM-A01-02-03-B",
    warehouseId: "WH-HCM-01",
    zoneId: "ZN-HCM-C",
    aisle: "A01",
    rack: "02",
    level: "03",
    bin: "B",
    type: "bin",
    status: "Reserved",
    capacityVolumeM3: 0.5,
    occupiedVolumeM3: 0,
    fillRate: 0,
    maxWeightKg: 120,
    currentSkuIds: [],
    coords: { x: 1, y: 2, z: 3 },
    isPickable: true,
    ergonomicScore: 55,
  },
  {
    locationId: "LOC-HCM-STAGE-01",
    warehouseId: "WH-HCM-01",
    zoneId: "ZN-HCM-STAGE",
    aisle: "STG",
    rack: "01",
    level: "00",
    bin: "01",
    type: "staging",
    status: "Occupied",
    capacityVolumeM3: 5,
    occupiedVolumeM3: 2,
    fillRate: 0.4,
    maxWeightKg: 1500,
    currentSkuIds: ["SKU-003-WHT-L"],
    coords: { x: 0, y: 0, z: 0 },
    isPickable: false,
    ergonomicScore: 94,
  },
  {
    locationId: "LOC-HCM-QTN-01",
    warehouseId: "WH-HCM-01",
    zoneId: "ZN-HCM-QTN",
    aisle: "QTN",
    rack: "01",
    level: "00",
    bin: "01",
    type: "quarantine",
    status: "Blocked",
    capacityVolumeM3: 2.5,
    occupiedVolumeM3: 0.3,
    fillRate: 0.12,
    maxWeightKg: 600,
    currentSkuIds: ["SKU-002-WHT"],
    coords: { x: 8, y: 0, z: 0 },
    isPickable: false,
    ergonomicScore: 38,
  },
  {
    locationId: "LOC-DN-D01-01-01-A",
    warehouseId: "WH-DN-01",
    zoneId: "ZN-DN-D",
    aisle: "D01",
    rack: "01",
    level: "01",
    bin: "A",
    type: "bin",
    status: "Disabled",
    capacityVolumeM3: 0.5,
    occupiedVolumeM3: 0,
    fillRate: 0,
    maxWeightKg: 120,
    currentSkuIds: [],
    coords: { x: 1, y: 1, z: 1 },
    isPickable: false,
    ergonomicScore: 0,
  },
];

export const slottingSuggestions: SlottingSuggestion[] = [
  {
    suggestionId: "SLOT-0041-1",
    skuId: "SKU-003-WHT-L",
    taskId: "PT-2026-0041",
    rank: 1,
    locationId: "LOC-HCM-A01-02-03-B",
    score: 94,
    reasons: ["Gần khu đóng gói", "Còn 100% chỗ trống", "Công thái học tốt (tầng 3 vừa tầm)"],
    criteria: {
      nearPacking: 0.95,
      skuAffinity: 0.6,
      fefo: 0.9,
      loadBalance: 0.88,
      ergonomics: 0.82,
      density: 0.9,
    },
  },
  {
    suggestionId: "SLOT-0041-2",
    skuId: "SKU-003-WHT-L",
    taskId: "PT-2026-0041",
    rank: 2,
    locationId: "LOC-HCM-C02-04-03-A",
    score: 81,
    reasons: ["Cùng zone picking", "Còn trống"],
    criteria: {
      nearPacking: 0.7,
      skuAffinity: 0.65,
      fefo: 0.85,
      loadBalance: 0.8,
      ergonomics: 0.5,
      density: 0.88,
    },
  },
  {
    suggestionId: "SLOT-0040-1",
    skuId: "SKU-001-BLK-L",
    taskId: "PT-2026-0040",
    rank: 1,
    locationId: "LOC-HN-B03-01-02-A",
    score: 90,
    reasons: ["Bin đã reserve sẵn", "Gần dock xuất", "Cùng SKU lân cận"],
    criteria: {
      nearPacking: 0.85,
      skuAffinity: 0.95,
      fefo: 0.8,
      loadBalance: 0.9,
      ergonomics: 0.7,
      density: 0.85,
    },
  },
  {
    suggestionId: "SLOT-0040-2",
    skuId: "SKU-001-BLK-L",
    taskId: "PT-2026-0040",
    rank: 2,
    locationId: "LOC-HN-A02-01-02-A",
    score: 76,
    reasons: ["Khu picking nhanh", "Còn trống"],
    criteria: {
      nearPacking: 0.9,
      skuAffinity: 0.4,
      fefo: 0.7,
      loadBalance: 0.6,
      ergonomics: 0.78,
      density: 0.7,
    },
  },
];

export const warehouseKpis: WarehouseKpi[] = [
  {
    warehouseId: "WH-HN-01",
    utilizationPct: 0.71,
    honeycombingPct: 0.12,
    overloadedLocations: 2,
    emptyLocations: 18,
    blockedLocations: 1,
    pendingPutaway: 1,
    openPickTasks: 5,
    asOf: "2026-06-13T18:00:00+07:00",
  },
  {
    warehouseId: "WH-HCM-01",
    utilizationPct: 0.64,
    honeycombingPct: 0.09,
    overloadedLocations: 1,
    emptyLocations: 24,
    blockedLocations: 1,
    pendingPutaway: 1,
    openPickTasks: 3,
    asOf: "2026-06-13T18:00:00+07:00",
  },
  {
    warehouseId: "WH-DN-01",
    utilizationPct: 0.38,
    honeycombingPct: 0.05,
    overloadedLocations: 0,
    emptyLocations: 40,
    blockedLocations: 0,
    pendingPutaway: 0,
    openPickTasks: 1,
    asOf: "2026-06-13T18:00:00+07:00",
  },
];

/* ============================================================================
 * MODULE 07 — PICKING (warehouse/07-picking)
 * ==========================================================================*/

/** Vòng đời phiếu lấy hàng (07). */
export type PickStatus =
  | "Created"
  | "Released"
  | "Assigned"
  | "In Progress"
  | "Short"
  | "On Hold"
  | "Completed"
  | "Cancelled";

/** Trạng thái phân bổ / tồn theo dòng pick (07). */
export type AllocationStatus = "Available" | "Allocated" | "Reserved" | "Picked" | "Staged";

export type PickType = "single-order" | "batch" | "wave" | "zone" | "cluster";

export interface PickLine {
  lineId: ID;
  pickId: ID;
  orderLineId?: ID; // null nếu pick bổ sung tồn / chuyển kho
  skuId: ID;
  fromLocationId: ID;
  allocatedQty: Qty;
  pickedQty: Qty;
  uom: Uom;
  allocationStatus: AllocationStatus;
  sequence: number; // thứ tự theo lộ trình tối ưu (Route Planner)
  lotId?: ID;
  shortReason?: string;
}

export interface PickTask {
  pickId: ID;
  pickNumber: string;
  warehouseId: WarehouseId;
  orderId?: ID; // đơn TMĐT nguồn (17 → 07)
  transferOrderId?: ID; // TO nguồn (10)
  moveTaskId?: ID; // move task nguồn (11)
  type: PickType;
  waveId?: ID;
  status: PickStatus;
  priority: "low" | "normal" | "high" | "urgent";
  assignedTo?: string;
  createdAt: ISODateTime;
  releasedAt?: ISODateTime;
  startedAt?: ISODateTime;
  completedAt?: ISODateTime;
  routeDistanceM: number; // lộ trình picking (G4)
  totalLines: number;
  lines: PickLine[];
}

export const pickTasks: PickTask[] = [
  {
    pickId: "PICK-2026-0210",
    pickNumber: "PICK-2026-0210",
    warehouseId: "WH-HN-01",
    orderId: "ORD-2026-0014",
    type: "single-order",
    status: "Created",
    priority: "normal",
    createdAt: "2026-06-12T09:00:00+07:00",
    routeDistanceM: 0,
    totalLines: 2,
    lines: [
      {
        lineId: "PICKL-0210-1",
        pickId: "PICK-2026-0210",
        orderLineId: "ORDL-0014-1",
        skuId: "SKU-001-BLK-L",
        fromLocationId: "LOC-HN-A01-01-01-A",
        allocatedQty: 2,
        pickedQty: 0,
        uom: "pcs",
        allocationStatus: "Allocated",
        sequence: 1,
      },
      {
        lineId: "PICKL-0210-2",
        pickId: "PICK-2026-0210",
        orderLineId: "ORDL-0014-2",
        skuId: "SKU-002-WHT",
        fromLocationId: "LOC-HN-B02-03-01-A",
        allocatedQty: 1,
        pickedQty: 0,
        uom: "pcs",
        allocationStatus: "Allocated",
        sequence: 2,
      },
    ],
  },
  {
    pickId: "PICK-2026-0209",
    pickNumber: "PICK-2026-0209",
    warehouseId: "WH-HN-01",
    orderId: "ORD-2026-0013",
    type: "single-order",
    waveId: "WAVE-2026-0031",
    status: "Released",
    priority: "high",
    createdAt: "2026-06-12T08:30:00+07:00",
    releasedAt: "2026-06-12T08:45:00+07:00",
    routeDistanceM: 84,
    totalLines: 1,
    lines: [
      {
        lineId: "PICKL-0209-1",
        pickId: "PICK-2026-0209",
        orderLineId: "ORDL-0013-1",
        skuId: "SKU-001-BLK-M",
        fromLocationId: "LOC-HN-B03-03-01-A",
        allocatedQty: 5,
        pickedQty: 0,
        uom: "pcs",
        allocationStatus: "Allocated",
        sequence: 1,
      },
    ],
  },
  {
    pickId: "PICK-2026-0208",
    pickNumber: "PICK-2026-0208",
    warehouseId: "WH-HCM-01",
    orderId: "ORD-2026-0011",
    type: "single-order",
    status: "Assigned",
    priority: "normal",
    assignedTo: "Trương Văn Lâm",
    createdAt: "2026-06-11T14:00:00+07:00",
    releasedAt: "2026-06-11T14:10:00+07:00",
    routeDistanceM: 56,
    totalLines: 1,
    lines: [
      {
        lineId: "PICKL-0208-1",
        pickId: "PICK-2026-0208",
        orderLineId: "ORDL-0011-1",
        skuId: "SKU-002-WHT",
        fromLocationId: "LOC-HCM-C02-04-01-A",
        allocatedQty: 3,
        pickedQty: 0,
        uom: "pcs",
        allocationStatus: "Allocated",
        sequence: 1,
      },
    ],
  },
  {
    pickId: "PICK-2026-0207",
    pickNumber: "PICK-2026-0207",
    warehouseId: "WH-HCM-01",
    orderId: "ORD-2026-0010",
    type: "batch",
    status: "In Progress",
    priority: "normal",
    assignedTo: "Trương Văn Lâm",
    createdAt: "2026-06-11T10:00:00+07:00",
    releasedAt: "2026-06-11T10:15:00+07:00",
    startedAt: "2026-06-11T10:20:00+07:00",
    routeDistanceM: 120,
    totalLines: 2,
    lines: [
      {
        lineId: "PICKL-0207-1",
        pickId: "PICK-2026-0207",
        orderLineId: "ORDL-0010-1",
        skuId: "SKU-002-WHT",
        fromLocationId: "LOC-HCM-C02-04-01-A",
        allocatedQty: 4,
        pickedQty: 4,
        uom: "pcs",
        allocationStatus: "Picked",
        sequence: 1,
      },
      {
        lineId: "PICKL-0207-2",
        pickId: "PICK-2026-0207",
        orderLineId: "ORDL-0010-2",
        skuId: "SKU-003-WHT-L",
        fromLocationId: "LOC-HCM-STAGE-01",
        allocatedQty: 10,
        pickedQty: 6,
        uom: "pcs",
        allocationStatus: "Allocated",
        sequence: 2,
      },
    ],
  },
  {
    pickId: "PICK-2026-0205",
    pickNumber: "PICK-2026-0205",
    warehouseId: "WH-HN-01",
    orderId: "ORD-2026-0009",
    type: "single-order",
    status: "Short",
    priority: "urgent",
    assignedTo: "Nguyễn Văn Đạt",
    createdAt: "2026-06-10T16:00:00+07:00",
    releasedAt: "2026-06-10T16:10:00+07:00",
    startedAt: "2026-06-10T16:15:00+07:00",
    routeDistanceM: 70,
    totalLines: 1,
    lines: [
      {
        lineId: "PICKL-0205-1",
        pickId: "PICK-2026-0205",
        orderLineId: "ORDL-0009-1",
        skuId: "SKU-001-WHT-L",
        fromLocationId: "LOC-HN-A01-01-02-A",
        allocatedQty: 6,
        pickedQty: 4,
        uom: "pcs",
        allocationStatus: "Picked",
        sequence: 1,
        shortReason: "Tồn thực tế < tồn hệ thống (2 thiếu) — chờ kiểm kê",
      },
    ],
  },
  {
    pickId: "PICK-2026-0204",
    pickNumber: "PICK-2026-0204",
    warehouseId: "WH-HN-01",
    transferOrderId: "TO-2026-0007",
    type: "zone",
    status: "On Hold",
    priority: "normal",
    assignedTo: "Nguyễn Văn Đạt",
    createdAt: "2026-06-10T09:00:00+07:00",
    releasedAt: "2026-06-10T09:10:00+07:00",
    startedAt: "2026-06-10T09:30:00+07:00",
    routeDistanceM: 95,
    totalLines: 1,
    lines: [
      {
        lineId: "PICKL-0204-1",
        pickId: "PICK-2026-0204",
        skuId: "SKU-001-BLK-M",
        fromLocationId: "LOC-HN-B03-03-01-A",
        allocatedQty: 200,
        pickedQty: 0,
        uom: "pcs",
        allocationStatus: "Reserved",
        sequence: 1,
        shortReason: "Chờ Manager duyệt xuất chuyển kho TO-2026-0007",
      },
    ],
  },
  {
    pickId: "PICK-2026-0200",
    pickNumber: "PICK-2026-0200",
    warehouseId: "WH-HN-01",
    orderId: "ORD-2026-0007",
    type: "single-order",
    status: "Completed",
    priority: "normal",
    assignedTo: "Nguyễn Văn Đạt",
    createdAt: "2026-06-08T08:00:00+07:00",
    releasedAt: "2026-06-08T08:10:00+07:00",
    startedAt: "2026-06-08T08:15:00+07:00",
    completedAt: "2026-06-08T08:50:00+07:00",
    routeDistanceM: 62,
    totalLines: 1,
    lines: [
      {
        lineId: "PICKL-0200-1",
        pickId: "PICK-2026-0200",
        orderLineId: "ORDL-0007-1",
        skuId: "SKU-001-BLK-L",
        fromLocationId: "LOC-HN-A01-01-01-A",
        allocatedQty: 3,
        pickedQty: 3,
        uom: "pcs",
        allocationStatus: "Staged",
        sequence: 1,
      },
    ],
  },
  {
    pickId: "PICK-2026-0199",
    pickNumber: "PICK-2026-0199",
    warehouseId: "WH-HCM-01",
    orderId: "ORD-2026-0006",
    type: "single-order",
    status: "Cancelled",
    priority: "low",
    createdAt: "2026-06-07T15:00:00+07:00",
    routeDistanceM: 0,
    totalLines: 1,
    lines: [
      {
        lineId: "PICKL-0199-1",
        pickId: "PICK-2026-0199",
        orderLineId: "ORDL-0006-1",
        skuId: "SKU-002-WHT",
        fromLocationId: "LOC-HCM-C02-04-02-A",
        allocatedQty: 2,
        pickedQty: 0,
        uom: "pcs",
        allocationStatus: "Available",
        sequence: 1,
      },
    ],
  },
  {
    pickId: "PICK-2026-0100",
    pickNumber: "PICK-2026-0100",
    warehouseId: "WH-HCM-01",
    orderId: "ORD-2026-0000",
    type: "single-order",
    status: "Completed",
    priority: "normal",
    assignedTo: "Nguyễn Văn Đạt",
    createdAt: "2026-05-30T13:00:00+07:00",
    releasedAt: "2026-05-30T13:10:00+07:00",
    startedAt: "2026-05-30T13:15:00+07:00",
    completedAt: "2026-05-30T15:00:00+07:00",
    routeDistanceM: 52,
    totalLines: 1,
    lines: [
      {
        lineId: "PICKL-0100-1",
        pickId: "PICK-2026-0100",
        orderLineId: "ORDL-0000-1",
        skuId: "SKU-002-WHT",
        fromLocationId: "LOC-HCM-C02-04-02-A",
        allocatedQty: 3,
        pickedQty: 3,
        uom: "pcs",
        allocationStatus: "Staged",
        sequence: 1,
      },
    ],
  },
  {
    pickId: "PICK-2026-0120",
    pickNumber: "PICK-2026-0120",
    warehouseId: "WH-HCM-01",
    orderId: "ORD-2026-0001",
    type: "single-order",
    status: "Completed",
    priority: "normal",
    assignedTo: "Nguyễn Văn Đạt",
    createdAt: "2026-06-01T21:30:00+07:00",
    releasedAt: "2026-06-01T21:40:00+07:00",
    startedAt: "2026-06-01T21:45:00+07:00",
    completedAt: "2026-06-01T23:30:00+07:00",
    routeDistanceM: 52,
    totalLines: 1,
    lines: [
      {
        lineId: "PICKL-0120-1",
        pickId: "PICK-2026-0120",
        orderLineId: "ORDL-0001-1",
        skuId: "SKU-002-WHT",
        fromLocationId: "LOC-HCM-C02-04-02-A",
        allocatedQty: 1,
        pickedQty: 1,
        uom: "pcs",
        allocationStatus: "Staged",
        sequence: 1,
      },
    ],
  },
  {
    pickId: "PICK-2026-0130",
    pickNumber: "PICK-2026-0130",
    warehouseId: "WH-HN-01",
    orderId: "ORD-2026-0002",
    type: "single-order",
    status: "Completed",
    priority: "normal",
    assignedTo: "Nguyễn Văn Đạt",
    createdAt: "2026-06-01T12:00:00+07:00",
    releasedAt: "2026-06-01T12:10:00+07:00",
    startedAt: "2026-06-01T12:15:00+07:00",
    completedAt: "2026-06-01T14:00:00+07:00",
    routeDistanceM: 52,
    totalLines: 1,
    lines: [
      {
        lineId: "PICKL-0130-1",
        pickId: "PICK-2026-0130",
        orderLineId: "ORDL-0002-1",
        skuId: "SKU-001-BLK-L",
        fromLocationId: "LOC-HN-A01-01-01-A",
        allocatedQty: 1,
        pickedQty: 1,
        uom: "pcs",
        allocationStatus: "Staged",
        sequence: 1,
      },
    ],
  },
  {
    pickId: "PICK-2026-0155",
    pickNumber: "PICK-2026-0155",
    warehouseId: "WH-HCM-01",
    orderId: "ORD-2026-0016",
    type: "single-order",
    status: "Completed",
    priority: "normal",
    assignedTo: "Nguyễn Văn Đạt",
    createdAt: "2026-06-01T11:00:00+07:00",
    releasedAt: "2026-06-01T11:10:00+07:00",
    startedAt: "2026-06-01T11:15:00+07:00",
    completedAt: "2026-06-01T13:00:00+07:00",
    routeDistanceM: 52,
    totalLines: 1,
    lines: [
      {
        lineId: "PICKL-0155-1",
        pickId: "PICK-2026-0155",
        orderLineId: "ORDL-0016-1",
        skuId: "SKU-002-WHT",
        fromLocationId: "LOC-HCM-C02-04-02-A",
        allocatedQty: 1,
        pickedQty: 1,
        uom: "pcs",
        allocationStatus: "Staged",
        sequence: 1,
      },
    ],
  },
  {
    pickId: "PICK-2026-0165",
    pickNumber: "PICK-2026-0165",
    warehouseId: "WH-HCM-01",
    orderId: "ORD-2026-0018",
    type: "single-order",
    status: "Completed",
    priority: "normal",
    assignedTo: "Nguyễn Văn Đạt",
    createdAt: "2026-06-08T16:00:00+07:00",
    releasedAt: "2026-06-08T16:10:00+07:00",
    startedAt: "2026-06-08T16:15:00+07:00",
    completedAt: "2026-06-08T18:00:00+07:00",
    routeDistanceM: 64,
    totalLines: 2,
    lines: [
      {
        lineId: "PICKL-0165-1",
        pickId: "PICK-2026-0165",
        orderLineId: "ORDL-0018-1",
        skuId: "SKU-002-WHT",
        fromLocationId: "LOC-HCM-C02-04-02-A",
        allocatedQty: 3,
        pickedQty: 3,
        uom: "pcs",
        allocationStatus: "Staged",
        sequence: 1,
      },
      {
        lineId: "PICKL-0165-2",
        pickId: "PICK-2026-0165",
        orderLineId: "ORDL-0018-2",
        skuId: "SKU-001-WHT-L",
        fromLocationId: "LOC-HCM-C02-04-01-A",
        allocatedQty: 1,
        pickedQty: 1,
        uom: "pcs",
        allocationStatus: "Staged",
        sequence: 2,
      },
    ],
  },
  {
    pickId: "PICK-2026-0160",
    pickNumber: "PICK-2026-0160",
    warehouseId: "WH-HN-01",
    orderId: "ORD-2026-0019",
    type: "single-order",
    status: "Completed",
    priority: "normal",
    assignedTo: "Nguyễn Văn Đạt",
    createdAt: "2026-05-26T12:00:00+07:00",
    releasedAt: "2026-05-26T12:10:00+07:00",
    startedAt: "2026-05-26T12:15:00+07:00",
    completedAt: "2026-05-26T14:00:00+07:00",
    routeDistanceM: 52,
    totalLines: 1,
    lines: [
      {
        lineId: "PICKL-0160-1",
        pickId: "PICK-2026-0160",
        orderLineId: "ORDL-0019-1",
        skuId: "SKU-001-BLK-M",
        fromLocationId: "LOC-HN-A01-01-01-A",
        allocatedQty: 2,
        pickedQty: 2,
        uom: "pcs",
        allocationStatus: "Staged",
        sequence: 1,
      },
    ],
  },
  {
    pickId: "PICK-2026-0188",
    pickNumber: "PICK-2026-0188",
    warehouseId: "WH-HN-01",
    orderId: "ORD-2026-0004",
    type: "single-order",
    status: "Completed",
    priority: "normal",
    assignedTo: "Nguyễn Văn Đạt",
    createdAt: "2026-06-05T15:00:00+07:00",
    releasedAt: "2026-06-05T15:10:00+07:00",
    startedAt: "2026-06-05T15:15:00+07:00",
    completedAt: "2026-06-05T17:00:00+07:00",
    routeDistanceM: 52,
    totalLines: 1,
    lines: [
      {
        lineId: "PICKL-0188-1",
        pickId: "PICK-2026-0188",
        orderLineId: "ORDL-0004-1",
        skuId: "SKU-001-BLK-M",
        fromLocationId: "LOC-HN-A01-01-01-A",
        allocatedQty: 3,
        pickedQty: 3,
        uom: "pcs",
        allocationStatus: "Staged",
        sequence: 1,
      },
    ],
  },
  {
    pickId: "PICK-2026-0190",
    pickNumber: "PICK-2026-0190",
    warehouseId: "WH-HN-01",
    orderId: "ORD-2026-0005",
    type: "single-order",
    status: "Completed",
    priority: "normal",
    assignedTo: "Nguyễn Văn Đạt",
    createdAt: "2026-06-06T10:00:00+07:00",
    releasedAt: "2026-06-06T10:10:00+07:00",
    startedAt: "2026-06-06T10:15:00+07:00",
    completedAt: "2026-06-06T12:00:00+07:00",
    routeDistanceM: 52,
    totalLines: 1,
    lines: [
      {
        lineId: "PICKL-0190-1",
        pickId: "PICK-2026-0190",
        orderLineId: "ORDL-0005-1",
        skuId: "SKU-001-BLK-L",
        fromLocationId: "LOC-HN-A01-01-01-A",
        allocatedQty: 2,
        pickedQty: 2,
        uom: "pcs",
        allocationStatus: "Staged",
        sequence: 1,
      },
    ],
  },
  {
    pickId: "PICK-2026-0198",
    pickNumber: "PICK-2026-0198",
    warehouseId: "WH-HN-01",
    orderId: "ORD-2026-0008",
    type: "single-order",
    status: "Completed",
    priority: "normal",
    assignedTo: "Nguyễn Văn Đạt",
    createdAt: "2026-06-10T10:00:00+07:00",
    releasedAt: "2026-06-10T10:10:00+07:00",
    startedAt: "2026-06-10T10:15:00+07:00",
    completedAt: "2026-06-10T12:00:00+07:00",
    routeDistanceM: 52,
    totalLines: 1,
    lines: [
      {
        lineId: "PICKL-0198-1",
        pickId: "PICK-2026-0198",
        orderLineId: "ORDL-0008-1",
        skuId: "SKU-002-WHT",
        fromLocationId: "LOC-HN-B02-03-01-A",
        allocatedQty: 2,
        pickedQty: 2,
        uom: "pcs",
        allocationStatus: "Staged",
        sequence: 1,
      },
    ],
  },
  {
    pickId: "PICK-2026-0152",
    pickNumber: "PICK-2026-0152",
    warehouseId: "WH-HN-01",
    orderId: "ORD-2026-0017",
    type: "single-order",
    status: "In Progress",
    priority: "normal",
    assignedTo: "Nguyễn Văn Đạt",
    createdAt: "2026-06-11T11:00:00+07:00",
    releasedAt: "2026-06-11T11:10:00+07:00",
    startedAt: "2026-06-11T11:15:00+07:00",
    routeDistanceM: 64,
    totalLines: 2,
    lines: [
      {
        lineId: "PICKL-0152-1",
        pickId: "PICK-2026-0152",
        orderLineId: "ORDL-0017-1",
        skuId: "SKU-004-BLK-L",
        fromLocationId: "LOC-HN-B02-03-01-A",
        allocatedQty: 1,
        pickedQty: 0,
        uom: "pcs",
        allocationStatus: "Picked",
        sequence: 1,
      },
      {
        lineId: "PICKL-0152-2",
        pickId: "PICK-2026-0152",
        orderLineId: "ORDL-0017-2",
        skuId: "SKU-001-BLK-M",
        fromLocationId: "LOC-HN-A01-01-01-A",
        allocatedQty: 1,
        pickedQty: 0,
        uom: "pcs",
        allocationStatus: "Picked",
        sequence: 2,
      },
    ],
  },
];

/* ============================================================================
 * MODULE 08 — PACKING (warehouse/08-packing)
 * ==========================================================================*/

/** Vòng đời nhiệm vụ đóng gói (08). */
export type PackStatus =
  | "Pending"
  | "In Progress"
  | "Verification Failed"
  | "On Hold"
  | "Packed"
  | "Handed to Shipping"
  | "Cancelled";

export interface PackageLine {
  lineId: ID;
  packageId: ID;
  skuId: ID;
  orderLineId?: ID;
  quantity: Qty;
  uom: Uom;
  serialIds?: ID[];
}

export interface Package {
  packageId: ID;
  packageNo: string;
  packingTaskId: ID;
  orderId: ID;
  cartonType: string; // "Box S 20×15×10"
  weightKg: number;
  dimensions: { lengthCm: number; widthCm: number; heightCm: number };
  /** Cartonization engine gợi ý (G4). */
  fillRate: number;
  sealedAt?: ISODateTime;
  labelUrl?: string;
  lines: PackageLine[];
}

export interface PackingTask {
  taskId: ID;
  taskNo: string;
  warehouseId: WarehouseId;
  orderId: ID;
  pickId: ID;
  status: PackStatus;
  assignedTo?: string;
  verificationMethod: "scan-100" | "weight-check" | "visual";
  verified: boolean;
  verificationNote?: string;
  createdAt: ISODateTime;
  startedAt?: ISODateTime;
  completedAt?: ISODateTime;
  packages: Package[];
}

export const packingTasks: PackingTask[] = [
  {
    taskId: "PACK-2026-0150",
    taskNo: "PACK-2026-0150",
    warehouseId: "WH-HN-01",
    orderId: "ORD-2026-0007",
    pickId: "PICK-2026-0200",
    status: "Handed to Shipping",
    assignedTo: "Lý Thị Hoa",
    verificationMethod: "scan-100",
    verified: true,
    createdAt: "2026-06-08T09:00:00+07:00",
    startedAt: "2026-06-08T09:20:00+07:00",
    completedAt: "2026-06-08T09:45:00+07:00",
    packages: [
      {
        packageId: "PKG-0110-1",
        packageNo: "PKG-0110-1",
        packingTaskId: "PACK-2026-0150",
        orderId: "ORD-2026-0007",
        cartonType: "Box L 40×30×20",
        weightKg: 1.4,
        dimensions: { lengthCm: 40, widthCm: 30, heightCm: 20 },
        fillRate: 0.7,
        sealedAt: "2026-06-08T09:40:00+07:00",
        labelUrl: "/mock/labels/PKG-0110-1.pdf",
        lines: [
          {
            lineId: "PKGL-0110-1",
            packageId: "PKG-0110-1",
            skuId: "SKU-001-BLK-L",
            orderLineId: "ORDL-0007-1",
            quantity: 3,
            uom: "pcs",
          },
          {
            lineId: "PKGL-0110-2",
            packageId: "PKG-0110-1",
            skuId: "SKU-002-WHT",
            orderLineId: "ORDL-0007-2",
            quantity: 1,
            uom: "pcs",
          },
        ],
      },
    ],
  },
  {
    taskId: "PACK-2026-0149",
    taskNo: "PACK-2026-0149",
    warehouseId: "WH-HCM-01",
    orderId: "ORD-2026-0010",
    pickId: "PICK-2026-0207",
    status: "In Progress",
    assignedTo: "Lý Thị Hoa",
    verificationMethod: "scan-100",
    verified: false,
    createdAt: "2026-06-11T11:00:00+07:00",
    startedAt: "2026-06-11T11:20:00+07:00",
    packages: [
      {
        packageId: "PKG-0149-1",
        packageNo: "PKG-0149-1",
        packingTaskId: "PACK-2026-0149",
        orderId: "ORD-2026-0010",
        cartonType: "Box M 30×20×15",
        weightKg: 1.4,
        dimensions: { lengthCm: 30, widthCm: 20, heightCm: 15 },
        fillRate: 0.7,
        lines: [
          {
            lineId: "PKGL-0149-1",
            packageId: "PKG-0149-1",
            skuId: "SKU-002-WHT",
            orderLineId: "ORDL-0010-1",
            quantity: 4,
            uom: "pcs",
          },
        ],
      },
    ],
  },
  {
    taskId: "PACK-2026-0147",
    taskNo: "PACK-2026-0147",
    warehouseId: "WH-HN-01",
    orderId: "ORD-2026-0009",
    pickId: "PICK-2026-0205",
    status: "Verification Failed",
    assignedTo: "Lý Thị Hoa",
    verificationMethod: "scan-100",
    verified: false,
    verificationNote: "Thiếu 2 SKU-001-WHT-L (pick Short) — không đạt kiểm 100%",
    createdAt: "2026-06-10T16:40:00+07:00",
    startedAt: "2026-06-10T16:50:00+07:00",
    packages: [],
  },
  {
    taskId: "PACK-2026-0145",
    taskNo: "PACK-2026-0145",
    warehouseId: "WH-HN-01",
    orderId: "ORD-2026-0008",
    pickId: "PICK-2026-0198",
    status: "On Hold",
    assignedTo: "Lý Thị Hoa",
    verificationMethod: "weight-check",
    verified: false,
    verificationNote: "Chờ vật liệu đóng gói chống vỡ cho cốc sứ",
    createdAt: "2026-06-10T10:00:00+07:00",
    startedAt: "2026-06-10T10:15:00+07:00",
    packages: [],
  },
  {
    taskId: "PACK-2026-0140",
    taskNo: "PACK-2026-0140",
    warehouseId: "WH-HN-01",
    orderId: "ORD-2026-0005",
    pickId: "PICK-2026-0190",
    status: "Packed",
    assignedTo: "Lý Thị Hoa",
    verificationMethod: "scan-100",
    verified: true,
    createdAt: "2026-06-06T09:00:00+07:00",
    startedAt: "2026-06-06T09:20:00+07:00",
    completedAt: "2026-06-06T09:45:00+07:00",
    packages: [
      {
        packageId: "PKG-0140-1",
        packageNo: "PKG-0140-1",
        packingTaskId: "PACK-2026-0140",
        orderId: "ORD-2026-0005",
        cartonType: "Box S 20×15×10",
        weightKg: 0.5,
        dimensions: { lengthCm: 20, widthCm: 15, heightCm: 10 },
        fillRate: 0.85,
        sealedAt: "2026-06-06T09:44:00+07:00",
        labelUrl: "/mock/label/pkg-0140-1.pdf",
        lines: [
          {
            lineId: "PKGL-0140-1",
            packageId: "PKG-0140-1",
            skuId: "SKU-001-BLK-L",
            orderLineId: "ORDL-0005-1",
            quantity: 2,
            uom: "pcs",
          },
        ],
      },
    ],
  },
  {
    taskId: "PACK-2026-0138",
    taskNo: "PACK-2026-0138",
    warehouseId: "WH-HN-01",
    orderId: "ORD-2026-0004",
    pickId: "PICK-2026-0188",
    status: "Handed to Shipping",
    assignedTo: "Lý Thị Hoa",
    verificationMethod: "scan-100",
    verified: true,
    createdAt: "2026-06-05T14:00:00+07:00",
    startedAt: "2026-06-05T14:15:00+07:00",
    completedAt: "2026-06-05T14:40:00+07:00",
    packages: [
      {
        packageId: "PKG-0138-1",
        packageNo: "PKG-0138-1",
        packingTaskId: "PACK-2026-0138",
        orderId: "ORD-2026-0004",
        cartonType: "Box M 30×20×15",
        weightKg: 1.1,
        dimensions: { lengthCm: 30, widthCm: 20, heightCm: 15 },
        fillRate: 0.6,
        sealedAt: "2026-06-05T14:38:00+07:00",
        labelUrl: "/mock/label/pkg-0138-1.pdf",
        lines: [
          {
            lineId: "PKGL-0138-1",
            packageId: "PKG-0138-1",
            skuId: "SKU-001-BLK-M",
            orderLineId: "ORDL-0004-1",
            quantity: 3,
            uom: "pcs",
          },
        ],
      },
    ],
  },
  {
    taskId: "PACK-2026-0135",
    taskNo: "PACK-2026-0135",
    warehouseId: "WH-HCM-01",
    orderId: "ORD-2026-0006",
    pickId: "PICK-2026-0199",
    status: "Cancelled",
    verificationMethod: "scan-100",
    verified: false,
    createdAt: "2026-06-04T09:00:00+07:00",
    packages: [],
  },
  {
    taskId: "PACK-2026-0100",
    taskNo: "PACK-2026-0100",
    warehouseId: "WH-HCM-01",
    orderId: "ORD-2026-0000",
    pickId: "PICK-2026-0100",
    status: "Handed to Shipping",
    assignedTo: "Lý Thị Hoa",
    verificationMethod: "scan-100",
    verified: true,
    createdAt: "2026-05-30T16:00:00+07:00",
    startedAt: "2026-05-30T16:20:00+07:00",
    completedAt: "2026-05-30T17:00:00+07:00",
    packages: [
      {
        packageId: "PKG-0100-1",
        packageNo: "PKG-0100-1",
        packingTaskId: "PACK-2026-0100",
        orderId: "ORD-2026-0000",
        cartonType: "Box M 30×20×15",
        weightKg: 1.1,
        dimensions: { lengthCm: 30, widthCm: 20, heightCm: 15 },
        fillRate: 0.6,
        sealedAt: "2026-06-01T10:00:00+07:00",
        labelUrl: "/mock/labels/PKG-0100-1.pdf",
        lines: [
          {
            lineId: "PKGL-0100-1",
            packageId: "PKG-0100-1",
            skuId: "SKU-002-WHT",
            orderLineId: "ORDL-0000-1",
            quantity: 3,
            uom: "pcs",
          },
        ],
      },
    ],
  },
  {
    taskId: "PACK-2026-0120",
    taskNo: "PACK-2026-0120",
    warehouseId: "WH-HCM-01",
    orderId: "ORD-2026-0001",
    pickId: "PICK-2026-0120",
    status: "Handed to Shipping",
    assignedTo: "Lý Thị Hoa",
    verificationMethod: "scan-100",
    verified: true,
    createdAt: "2026-06-02T00:30:00+07:00",
    startedAt: "2026-06-02T00:50:00+07:00",
    completedAt: "2026-06-02T01:30:00+07:00",
    packages: [
      {
        packageId: "PKG-0120-1",
        packageNo: "PKG-0120-1",
        packingTaskId: "PACK-2026-0120",
        orderId: "ORD-2026-0001",
        cartonType: "Box S 20×15×10",
        weightKg: 0.5,
        dimensions: { lengthCm: 20, widthCm: 15, heightCm: 10 },
        fillRate: 0.7,
        sealedAt: "2026-06-01T10:00:00+07:00",
        labelUrl: "/mock/labels/PKG-0120-1.pdf",
        lines: [
          {
            lineId: "PKGL-0120-1",
            packageId: "PKG-0120-1",
            skuId: "SKU-002-WHT",
            orderLineId: "ORDL-0001-1",
            quantity: 1,
            uom: "pcs",
          },
        ],
      },
    ],
  },
  {
    taskId: "PACK-2026-0130",
    taskNo: "PACK-2026-0130",
    warehouseId: "WH-HN-01",
    orderId: "ORD-2026-0002",
    pickId: "PICK-2026-0130",
    status: "Handed to Shipping",
    assignedTo: "Lý Thị Hoa",
    verificationMethod: "scan-100",
    verified: true,
    createdAt: "2026-06-01T15:00:00+07:00",
    startedAt: "2026-06-01T15:20:00+07:00",
    completedAt: "2026-06-01T16:00:00+07:00",
    packages: [
      {
        packageId: "PKG-0130-1",
        packageNo: "PKG-0130-1",
        packingTaskId: "PACK-2026-0130",
        orderId: "ORD-2026-0002",
        cartonType: "Box S 20×15×10",
        weightKg: 0.5,
        dimensions: { lengthCm: 20, widthCm: 15, heightCm: 10 },
        fillRate: 0.7,
        sealedAt: "2026-06-01T10:00:00+07:00",
        labelUrl: "/mock/labels/PKG-0130-1.pdf",
        lines: [
          {
            lineId: "PKGL-0130-1",
            packageId: "PKG-0130-1",
            skuId: "SKU-001-BLK-L",
            orderLineId: "ORDL-0002-1",
            quantity: 1,
            uom: "pcs",
          },
        ],
      },
    ],
  },
  {
    taskId: "PACK-2026-0155",
    taskNo: "PACK-2026-0155",
    warehouseId: "WH-HCM-01",
    orderId: "ORD-2026-0016",
    pickId: "PICK-2026-0155",
    status: "Handed to Shipping",
    assignedTo: "Lý Thị Hoa",
    verificationMethod: "scan-100",
    verified: true,
    createdAt: "2026-06-01T14:00:00+07:00",
    startedAt: "2026-06-01T14:20:00+07:00",
    completedAt: "2026-06-01T15:00:00+07:00",
    packages: [
      {
        packageId: "PKG-0155-1",
        packageNo: "PKG-0155-1",
        packingTaskId: "PACK-2026-0155",
        orderId: "ORD-2026-0016",
        cartonType: "Box S 20×15×10",
        weightKg: 0.5,
        dimensions: { lengthCm: 20, widthCm: 15, heightCm: 10 },
        fillRate: 0.7,
        sealedAt: "2026-06-01T10:00:00+07:00",
        labelUrl: "/mock/labels/PKG-0155-1.pdf",
        lines: [
          {
            lineId: "PKGL-0155-1",
            packageId: "PKG-0155-1",
            skuId: "SKU-002-WHT",
            orderLineId: "ORDL-0016-1",
            quantity: 1,
            uom: "pcs",
          },
        ],
      },
    ],
  },
  {
    taskId: "PACK-2026-0165",
    taskNo: "PACK-2026-0165",
    warehouseId: "WH-HCM-01",
    orderId: "ORD-2026-0018",
    pickId: "PICK-2026-0165",
    status: "Handed to Shipping",
    assignedTo: "Lý Thị Hoa",
    verificationMethod: "scan-100",
    verified: true,
    createdAt: "2026-06-08T19:00:00+07:00",
    startedAt: "2026-06-08T19:20:00+07:00",
    completedAt: "2026-06-08T20:00:00+07:00",
    packages: [
      {
        packageId: "PKG-0165-1",
        packageNo: "PKG-0165-1",
        packingTaskId: "PACK-2026-0165",
        orderId: "ORD-2026-0018",
        cartonType: "Box L 40×30×20",
        weightKg: 1.4,
        dimensions: { lengthCm: 40, widthCm: 30, heightCm: 20 },
        fillRate: 0.7,
        sealedAt: "2026-06-01T10:00:00+07:00",
        labelUrl: "/mock/labels/PKG-0165-1.pdf",
        lines: [
          {
            lineId: "PKGL-0165-1",
            packageId: "PKG-0165-1",
            skuId: "SKU-002-WHT",
            orderLineId: "ORDL-0018-1",
            quantity: 3,
            uom: "pcs",
          },
          {
            lineId: "PKGL-0165-2",
            packageId: "PKG-0165-1",
            skuId: "SKU-001-WHT-L",
            orderLineId: "ORDL-0018-2",
            quantity: 1,
            uom: "pcs",
          },
        ],
      },
    ],
  },
  {
    taskId: "PACK-2026-0160",
    taskNo: "PACK-2026-0160",
    warehouseId: "WH-HN-01",
    orderId: "ORD-2026-0019",
    pickId: "PICK-2026-0160",
    status: "Handed to Shipping",
    assignedTo: "Lý Thị Hoa",
    verificationMethod: "scan-100",
    verified: true,
    createdAt: "2026-05-26T15:00:00+07:00",
    startedAt: "2026-05-26T15:20:00+07:00",
    completedAt: "2026-05-26T16:00:00+07:00",
    packages: [
      {
        packageId: "PKG-0160-1",
        packageNo: "PKG-0160-1",
        packingTaskId: "PACK-2026-0160",
        orderId: "ORD-2026-0019",
        cartonType: "Box M 30×20×15",
        weightKg: 0.8,
        dimensions: { lengthCm: 30, widthCm: 20, heightCm: 15 },
        fillRate: 0.8,
        sealedAt: "2026-06-01T10:00:00+07:00",
        labelUrl: "/mock/labels/PKG-0160-1.pdf",
        lines: [
          {
            lineId: "PKGL-0160-1",
            packageId: "PKG-0160-1",
            skuId: "SKU-001-BLK-M",
            orderLineId: "ORDL-0019-1",
            quantity: 2,
            uom: "pcs",
          },
        ],
      },
    ],
  },
  {
    taskId: "PACK-2026-0152",
    taskNo: "PACK-2026-0152",
    warehouseId: "WH-HN-01",
    orderId: "ORD-2026-0017",
    pickId: "PICK-2026-0152",
    status: "Pending",
    verificationMethod: "scan-100",
    verified: false,
    createdAt: "2026-06-11T12:00:00+07:00",
    packages: [],
  },
];

/* ============================================================================
 * MODULE 09 — SHIPPING (warehouse/09-shipping)
 * ==========================================================================*/

/** Vòng đời vận đơn (09). */
export type ShipmentStatus =
  | "Label Created"
  | "Ready to Dispatch"
  | "Handed Over"
  | "In Transit"
  | "Out for Delivery"
  | "Delivery Failed"
  | "Returning"
  | "Delivered"
  | "Returned"
  | "Exception"
  | "Cancelled";

export type CarrierService = "standard" | "express" | "same-day" | "economy";
export type ShippingFeeBasis = "flat" | "weight" | "zone" | "realtime";

export interface Carrier {
  carrierId: ID;
  name: string;
  code: string;
  logoUrl: string;
  services: CarrierService[];
  supportsCod: boolean;
  integration: "api" | "aggregator" | "manual";
  // ASSUMPTION (open-question E1): danh sách hãng & phương thức tích hợp chưa chốt.
}

export interface TrackingEvent {
  eventId: ID;
  shipmentId: ID;
  status: ShipmentStatus;
  location: string;
  timestamp: ISODateTime;
  note?: string;
  source: "carrier-webhook" | "manual" | "system";
}

export interface Shipment {
  shipmentId: ID;
  shipmentNumber: string;
  orderId: ID;
  packageIds: ID[];
  warehouseId: WarehouseId;
  carrierId: ID;
  service: CarrierService;
  awbNumber: string; // Air Waybill / mã vận đơn
  status: ShipmentStatus;
  /** Thu hộ COD (09, E6). */
  codAmount: VND;
  codCollected: boolean;
  shippingFee: VND;
  feeBasis: ShippingFeeBasis;
  weightKg?: number;
  recipientName?: string;
  recipientPhone?: string;
  shippingAddress?: AddressVN;
  createdAt: ISODateTime;
  handedOverAt?: ISODateTime;
  deliveredAt?: ISODateTime;
  estimatedDelivery?: ISODate;
  trackingEvents: TrackingEvent[];
  /** RTO / hoàn (09). */
  rtoReason?: string;
}

export const carriers: Carrier[] = [
  {
    carrierId: "CAR-GHN",
    name: "Giao Hàng Nhanh",
    code: "GHN",
    logoUrl: "/mock/logo/ghn.svg",
    services: ["standard", "express", "same-day"],
    supportsCod: true,
    integration: "api",
  },
  {
    carrierId: "CAR-GHTK",
    name: "Giao Hàng Tiết Kiệm",
    code: "GHTK",
    logoUrl: "/mock/logo/ghtk.svg",
    services: ["standard", "economy"],
    supportsCod: true,
    integration: "api",
  },
  {
    carrierId: "CAR-VTP",
    name: "Viettel Post",
    code: "VTP",
    logoUrl: "/mock/logo/vtp.svg",
    services: ["standard", "express", "economy"],
    supportsCod: true,
    integration: "aggregator",
  },
  {
    carrierId: "CAR-JT",
    name: "J&T Express",
    code: "JT",
    logoUrl: "/mock/logo/jt.svg",
    services: ["standard", "express"],
    supportsCod: true,
    integration: "api",
  },
];

export const shipments: Shipment[] = [
  {
    shipmentId: "SHP-2026-0090",
    shipmentNumber: "SHP-2026-0090",
    orderId: "ORD-2026-0019",
    packageIds: ["PKG-0160-1"],
    warehouseId: "WH-HN-01",
    carrierId: "CAR-GHN",
    service: "standard",
    awbNumber: "GHN-1011121314",
    status: "Delivered",
    feeBasis: "flat",
    shippingFee: 25000,
    codAmount: 0,
    codCollected: false,
    createdAt: "2026-05-27T09:00:00+07:00",
    handedOverAt: "2026-05-27T10:00:00+07:00",
    deliveredAt: "2026-05-29T14:00:00+07:00",
    trackingEvents: [
      {
        eventId: "TRK-0090-1",
        shipmentId: "SHP-2026-0090",
        status: "Label Created",
        location: "Kho Hà Nội",
        timestamp: "2026-05-27T09:00:00+07:00",
        source: "system",
      },
      {
        eventId: "TRK-0090-2",
        shipmentId: "SHP-2026-0090",
        status: "Handed Over",
        location: "Bưu cục GHN Đông Anh",
        timestamp: "2026-05-27T10:00:00+07:00",
        source: "system",
      },
      {
        eventId: "TRK-0090-3",
        shipmentId: "SHP-2026-0090",
        status: "Out for Delivery",
        location: "GHN Hà Đông",
        timestamp: "2026-05-29T08:00:00+07:00",
        source: "carrier-webhook",
      },
      {
        eventId: "TRK-0090-4",
        shipmentId: "SHP-2026-0090",
        status: "Delivered",
        location: "Hà Đông — ký tên: V.Đ.Long",
        timestamp: "2026-05-29T14:00:00+07:00",
        source: "carrier-webhook",
      },
    ],
  },
  {
    shipmentId: "SHP-2026-0092",
    shipmentNumber: "SHP-2026-0092",
    orderId: "ORD-2026-0018",
    packageIds: ["PKG-0165-1"],
    warehouseId: "WH-HCM-01",
    carrierId: "CAR-VTP",
    service: "express",
    awbNumber: "VTP-1516171819",
    status: "In Transit",
    feeBasis: "flat",
    shippingFee: 30000,
    codAmount: 0,
    codCollected: false,
    createdAt: "2026-06-09T08:30:00+07:00",
    handedOverAt: "2026-06-09T09:00:00+07:00",
    trackingEvents: [
      {
        eventId: "TRK-0092-1",
        shipmentId: "SHP-2026-0092",
        status: "Label Created",
        location: "Kho TP.HCM",
        timestamp: "2026-06-09T08:30:00+07:00",
        source: "system",
      },
      {
        eventId: "TRK-0092-2",
        shipmentId: "SHP-2026-0092",
        status: "Handed Over",
        location: "Bưu cục VTP Quận 12",
        timestamp: "2026-06-09T09:00:00+07:00",
        source: "system",
      },
      {
        eventId: "TRK-0092-3",
        shipmentId: "SHP-2026-0092",
        status: "In Transit",
        location: "Hub VTP TP.HCM",
        timestamp: "2026-06-09T20:00:00+07:00",
        source: "carrier-webhook",
      },
    ],
  },
  {
    shipmentId: "SHP-2026-0085",
    shipmentNumber: "SHP-2026-0085",
    orderId: "ORD-2026-0016",
    packageIds: ["PKG-0155-1"],
    warehouseId: "WH-HCM-01",
    carrierId: "CAR-GHN",
    service: "standard",
    awbNumber: "GHN-6677889900",
    status: "Delivered",
    feeBasis: "flat",
    shippingFee: 30000,
    codAmount: 0,
    codCollected: false,
    createdAt: "2026-06-02T08:30:00+07:00",
    handedOverAt: "2026-06-02T09:00:00+07:00",
    deliveredAt: "2026-06-04T15:00:00+07:00",
    trackingEvents: [
      {
        eventId: "TRK-0085-1",
        shipmentId: "SHP-2026-0085",
        status: "Label Created",
        location: "Kho TP.HCM",
        timestamp: "2026-06-02T08:30:00+07:00",
        source: "system",
      },
      {
        eventId: "TRK-0085-2",
        shipmentId: "SHP-2026-0085",
        status: "Handed Over",
        location: "Bưu cục GHN Quận 12",
        timestamp: "2026-06-02T09:00:00+07:00",
        source: "system",
      },
      {
        eventId: "TRK-0085-3",
        shipmentId: "SHP-2026-0085",
        status: "In Transit",
        location: "Hub GHN TP.HCM",
        timestamp: "2026-06-03T02:00:00+07:00",
        source: "carrier-webhook",
      },
      {
        eventId: "TRK-0085-4",
        shipmentId: "SHP-2026-0085",
        status: "Out for Delivery",
        location: "GHN Nha Trang",
        timestamp: "2026-06-04T08:00:00+07:00",
        source: "carrier-webhook",
      },
      {
        eventId: "TRK-0085-5",
        shipmentId: "SHP-2026-0085",
        status: "Delivered",
        location: "Nha Trang — ký tên: B.T.Hà",
        timestamp: "2026-06-04T15:00:00+07:00",
        source: "carrier-webhook",
      },
    ],
  },
  {
    shipmentId: "SHP-2026-0088",
    shipmentNumber: "SHP-2026-0088",
    orderId: "ORD-2026-0004",
    packageIds: ["PKG-0138-1"],
    warehouseId: "WH-HN-01",
    carrierId: "CAR-GHN",
    service: "standard",
    awbNumber: "GHN-7788123456",
    status: "Label Created",
    codAmount: 0,
    codCollected: false,
    shippingFee: 30000,
    feeBasis: "zone",
    weightKg: 1.1,
    recipientName: "Trần Thị Bích",
    recipientPhone: "+84 909 222 333",
    shippingAddress: {
      street: "45 Nguyễn Trãi",
      ward: "Phường Bến Thành",
      district: "Quận 1",
      province: "TP. Hồ Chí Minh",
      postalCode: "710000",
      country: "VN",
    },
    createdAt: "2026-06-05T15:00:00+07:00",
    estimatedDelivery: "2026-06-08",
    trackingEvents: [
      {
        eventId: "TRK-0088-1",
        shipmentId: "SHP-2026-0088",
        status: "Label Created",
        location: "Kho Hà Nội",
        timestamp: "2026-06-05T15:00:00+07:00",
        source: "system",
      },
    ],
  },
  {
    shipmentId: "SHP-2026-0087",
    shipmentNumber: "SHP-2026-0087",
    orderId: "ORD-2026-0005",
    packageIds: ["PKG-0140-1"],
    warehouseId: "WH-HN-01",
    carrierId: "CAR-VTP",
    service: "express",
    awbNumber: "VTP-9911223344",
    status: "Ready to Dispatch",
    codAmount: 348000,
    codCollected: false,
    shippingFee: 45000,
    feeBasis: "weight",
    weightKg: 0.5,
    recipientName: "Lê Minh Châu",
    recipientPhone: "+84 912 888 999",
    shippingAddress: {
      street: "120 Lê Duẩn",
      ward: "Phường Hải Châu 1",
      district: "Quận Hải Châu",
      province: "Đà Nẵng",
      postalCode: "511000",
      country: "VN",
    },
    createdAt: "2026-06-06T10:00:00+07:00",
    estimatedDelivery: "2026-06-08",
    trackingEvents: [
      {
        eventId: "TRK-0087-1",
        shipmentId: "SHP-2026-0087",
        status: "Label Created",
        location: "Kho Hà Nội",
        timestamp: "2026-06-06T10:00:00+07:00",
        source: "system",
      },
      {
        eventId: "TRK-0087-2",
        shipmentId: "SHP-2026-0087",
        status: "Ready to Dispatch",
        location: "Kho Hà Nội",
        timestamp: "2026-06-06T16:00:00+07:00",
        note: "Đã gom chuyến, chờ bàn giao",
        source: "system",
      },
    ],
  },
  {
    shipmentId: "SHP-2026-0080",
    shipmentNumber: "SHP-2026-0080",
    orderId: "ORD-2026-0002",
    packageIds: ["PKG-0130-1"],
    warehouseId: "WH-HN-01",
    carrierId: "CAR-GHTK",
    service: "standard",
    awbNumber: "GHTK-3344556677",
    status: "Handed Over",
    codAmount: 0,
    codCollected: false,
    shippingFee: 25000,
    feeBasis: "zone",
    weightKg: 0.8,
    recipientName: "Nguyễn Hoài Nam",
    recipientPhone: "+84 908 111 222",
    shippingAddress: {
      street: "78 Cầu Giấy",
      ward: "Phường Quan Hoa",
      district: "Quận Cầu Giấy",
      province: "Hà Nội",
      postalCode: "113000",
      country: "VN",
    },
    createdAt: "2026-06-03T09:00:00+07:00",
    handedOverAt: "2026-06-03T17:00:00+07:00",
    estimatedDelivery: "2026-06-06",
    trackingEvents: [
      {
        eventId: "TRK-0080-1",
        shipmentId: "SHP-2026-0080",
        status: "Label Created",
        location: "Kho Hà Nội",
        timestamp: "2026-06-03T09:00:00+07:00",
        source: "system",
      },
      {
        eventId: "TRK-0080-2",
        shipmentId: "SHP-2026-0080",
        status: "Handed Over",
        location: "Điểm tập kết GHTK Đông Anh",
        timestamp: "2026-06-03T17:00:00+07:00",
        source: "carrier-webhook",
      },
    ],
  },
  {
    shipmentId: "SHP-2026-0075",
    shipmentNumber: "SHP-2026-0075",
    orderId: "ORD-2026-0001",
    packageIds: ["PKG-0120-1"],
    warehouseId: "WH-HCM-01",
    carrierId: "CAR-JT",
    service: "express",
    awbNumber: "JT-5566778899",
    status: "In Transit",
    codAmount: 0,
    codCollected: false,
    shippingFee: 48000,
    feeBasis: "realtime",
    weightKg: 1.2,
    recipientName: "Phạm Thu Trang",
    recipientPhone: "+84 977 444 555",
    shippingAddress: {
      street: "302 Nguyễn Văn Cừ",
      ward: "Phường An Hòa",
      district: "Quận Ninh Kiều",
      province: "Cần Thơ",
      postalCode: "940000",
      country: "VN",
    },
    createdAt: "2026-06-02T08:00:00+07:00",
    handedOverAt: "2026-06-02T16:00:00+07:00",
    estimatedDelivery: "2026-06-05",
    trackingEvents: [
      {
        eventId: "TRK-0075-1",
        shipmentId: "SHP-2026-0075",
        status: "Label Created",
        location: "Kho TP.HCM",
        timestamp: "2026-06-02T08:00:00+07:00",
        source: "system",
      },
      {
        eventId: "TRK-0075-2",
        shipmentId: "SHP-2026-0075",
        status: "Handed Over",
        location: "Bưu cục J&T Tân Bình",
        timestamp: "2026-06-02T16:00:00+07:00",
        source: "carrier-webhook",
      },
      {
        eventId: "TRK-0075-3",
        shipmentId: "SHP-2026-0075",
        status: "In Transit",
        location: "Trung tâm phân loại TP.HCM",
        timestamp: "2026-06-02T22:30:00+07:00",
        source: "carrier-webhook",
      },
    ],
  },
  {
    shipmentId: "SHP-2026-0070",
    shipmentNumber: "SHP-2026-0070",
    orderId: "ORD-2026-0007",
    packageIds: ["PKG-0110-1"],
    warehouseId: "WH-HN-01",
    carrierId: "CAR-GHN",
    service: "standard",
    awbNumber: "GHN-1122334455",
    status: "Out for Delivery",
    codAmount: 199000,
    codCollected: false,
    shippingFee: 32000,
    feeBasis: "zone",
    weightKg: 0.6,
    recipientName: "Vũ Đức Long",
    recipientPhone: "+84 966 777 888",
    shippingAddress: {
      street: "15 Quang Trung",
      ward: "Phường Quang Trung",
      district: "Quận Hà Đông",
      province: "Hà Nội",
      postalCode: "121000",
      country: "VN",
    },
    createdAt: "2026-06-04T09:00:00+07:00",
    handedOverAt: "2026-06-04T17:00:00+07:00",
    estimatedDelivery: "2026-06-07",
    trackingEvents: [
      {
        eventId: "TRK-0070-1",
        shipmentId: "SHP-2026-0070",
        status: "Handed Over",
        location: "Bưu cục GHN Hà Đông",
        timestamp: "2026-06-04T17:00:00+07:00",
        source: "carrier-webhook",
      },
      {
        eventId: "TRK-0070-2",
        shipmentId: "SHP-2026-0070",
        status: "In Transit",
        location: "Hà Nội",
        timestamp: "2026-06-06T07:00:00+07:00",
        source: "carrier-webhook",
      },
      {
        eventId: "TRK-0070-3",
        shipmentId: "SHP-2026-0070",
        status: "Out for Delivery",
        location: "Bưu cục GHN Hà Đông",
        timestamp: "2026-06-07T08:00:00+07:00",
        note: "Đang giao — shipper Tuấn",
        source: "carrier-webhook",
      },
    ],
  },
  {
    shipmentId: "SHP-2026-0065",
    shipmentNumber: "SHP-2026-0065",
    orderId: "ORD-2026-0008",
    packageIds: [],
    warehouseId: "WH-HN-01",
    carrierId: "CAR-VTP",
    service: "standard",
    awbNumber: "VTP-7788990011",
    status: "Delivery Failed",
    codAmount: 178000,
    codCollected: false,
    shippingFee: 28000,
    feeBasis: "weight",
    weightKg: 0.9,
    recipientName: "Hoàng Văn Sỹ",
    recipientPhone: "+84 933 222 111",
    shippingAddress: {
      street: "99 Lạch Tray",
      ward: "Phường Lạch Tray",
      district: "Quận Ngô Quyền",
      province: "Hải Phòng",
      postalCode: "043000",
      country: "VN",
    },
    createdAt: "2026-06-05T09:00:00+07:00",
    handedOverAt: "2026-06-05T17:00:00+07:00",
    estimatedDelivery: "2026-06-08",
    trackingEvents: [
      {
        eventId: "TRK-0065-1",
        shipmentId: "SHP-2026-0065",
        status: "In Transit",
        location: "Hải Phòng",
        timestamp: "2026-06-07T06:00:00+07:00",
        source: "carrier-webhook",
      },
      {
        eventId: "TRK-0065-2",
        shipmentId: "SHP-2026-0065",
        status: "Delivery Failed",
        location: "Bưu cục VTP Ngô Quyền",
        timestamp: "2026-06-08T11:00:00+07:00",
        note: "Không liên lạc được người nhận",
        source: "carrier-webhook",
      },
    ],
  },
  {
    shipmentId: "SHP-2026-0060",
    shipmentNumber: "SHP-2026-0060",
    orderId: "ORD-2026-0008",
    packageIds: [],
    warehouseId: "WH-HN-01",
    carrierId: "CAR-VTP",
    service: "standard",
    awbNumber: "VTP-7788990011",
    status: "Returning",
    codAmount: 178000,
    codCollected: false,
    shippingFee: 28000,
    feeBasis: "weight",
    weightKg: 0.9,
    recipientName: "Hoàng Văn Sỹ",
    recipientPhone: "+84 933 222 111",
    shippingAddress: {
      street: "99 Lạch Tray",
      ward: "Phường Lạch Tray",
      district: "Quận Ngô Quyền",
      province: "Hải Phòng",
      postalCode: "043000",
      country: "VN",
    },
    createdAt: "2026-06-05T09:00:00+07:00",
    handedOverAt: "2026-06-05T17:00:00+07:00",
    estimatedDelivery: "2026-06-08",
    rtoReason: "Giao thất bại 2 lần → hoàn về kho (RTO)",
    trackingEvents: [
      {
        eventId: "TRK-0060-1",
        shipmentId: "SHP-2026-0060",
        status: "Delivery Failed",
        location: "Hải Phòng",
        timestamp: "2026-06-08T11:00:00+07:00",
        source: "carrier-webhook",
      },
      {
        eventId: "TRK-0060-2",
        shipmentId: "SHP-2026-0060",
        status: "Returning",
        location: "Trung tâm VTP Hải Phòng",
        timestamp: "2026-06-09T09:00:00+07:00",
        note: "Đang hoàn về kho Hà Nội",
        source: "carrier-webhook",
      },
    ],
  },
  {
    shipmentId: "SHP-2026-0050",
    shipmentNumber: "SHP-2026-0050",
    orderId: "ORD-2026-0000",
    packageIds: ["PKG-0100-1"],
    warehouseId: "WH-HCM-01",
    carrierId: "CAR-GHN",
    service: "same-day",
    awbNumber: "GHN-6677889900",
    status: "Delivered",
    codAmount: 0,
    codCollected: false,
    shippingFee: 55000,
    feeBasis: "realtime",
    weightKg: 0.7,
    recipientName: "Đặng Thuỳ Linh",
    recipientPhone: "+84 918 555 222",
    shippingAddress: {
      street: "210 Điện Biên Phủ",
      ward: "Phường 17",
      district: "Quận Bình Thạnh",
      province: "TP. Hồ Chí Minh",
      postalCode: "723000",
      country: "VN",
    },
    createdAt: "2026-06-01T08:00:00+07:00",
    handedOverAt: "2026-06-01T10:00:00+07:00",
    deliveredAt: "2026-06-01T16:30:00+07:00",
    estimatedDelivery: "2026-06-01",
    trackingEvents: [
      {
        eventId: "TRK-0050-1",
        shipmentId: "SHP-2026-0050",
        status: "Handed Over",
        location: "Bưu cục GHN Bình Thạnh",
        timestamp: "2026-06-01T10:00:00+07:00",
        source: "carrier-webhook",
      },
      {
        eventId: "TRK-0050-2",
        shipmentId: "SHP-2026-0050",
        status: "Out for Delivery",
        location: "Bình Thạnh",
        timestamp: "2026-06-01T13:00:00+07:00",
        source: "carrier-webhook",
      },
      {
        eventId: "TRK-0050-3",
        shipmentId: "SHP-2026-0050",
        status: "Delivered",
        location: "210 Điện Biên Phủ, Bình Thạnh",
        timestamp: "2026-06-01T16:30:00+07:00",
        note: "Người nhận ký xác nhận",
        source: "carrier-webhook",
      },
    ],
  },
  {
    shipmentId: "SHP-2026-0045",
    shipmentNumber: "SHP-2026-0045",
    orderId: "ORD-2026-0008",
    packageIds: [],
    warehouseId: "WH-HN-01",
    carrierId: "CAR-GHTK",
    service: "standard",
    awbNumber: "GHTK-2233445566",
    status: "Returned",
    codAmount: 178000,
    codCollected: false,
    shippingFee: 25000,
    feeBasis: "zone",
    weightKg: 0.9,
    recipientName: "Hoàng Văn Sỹ",
    recipientPhone: "+84 933 222 111",
    shippingAddress: {
      street: "99 Lạch Tray",
      ward: "Phường Lạch Tray",
      district: "Quận Ngô Quyền",
      province: "Hải Phòng",
      postalCode: "043000",
      country: "VN",
    },
    createdAt: "2026-05-28T09:00:00+07:00",
    handedOverAt: "2026-05-28T17:00:00+07:00",
    estimatedDelivery: "2026-05-31",
    rtoReason: "Khách từ chối nhận — hoàn kho, nhập lại tồn",
    trackingEvents: [
      {
        eventId: "TRK-0045-1",
        shipmentId: "SHP-2026-0045",
        status: "Returning",
        location: "Hải Phòng",
        timestamp: "2026-05-30T09:00:00+07:00",
        source: "carrier-webhook",
      },
      {
        eventId: "TRK-0045-2",
        shipmentId: "SHP-2026-0045",
        status: "Returned",
        location: "Kho Hà Nội",
        timestamp: "2026-06-01T14:00:00+07:00",
        note: "Đã nhận hàng hoàn, chờ QC nhập lại tồn",
        source: "carrier-webhook",
      },
    ],
  },
  {
    shipmentId: "SHP-2026-0040",
    shipmentNumber: "SHP-2026-0040",
    orderId: "ORD-2026-0009",
    packageIds: [],
    warehouseId: "WH-HN-01",
    carrierId: "CAR-JT",
    service: "express",
    awbNumber: "JT-4455667788",
    status: "Exception",
    codAmount: 0,
    codCollected: false,
    shippingFee: 42000,
    feeBasis: "realtime",
    weightKg: 0.6,
    recipientName: "Bùi Thanh Hà",
    recipientPhone: "+84 905 333 777",
    shippingAddress: {
      street: "60 Trần Phú",
      ward: "Phường Lộc Thọ",
      district: "Thành phố Nha Trang",
      province: "Khánh Hòa",
      postalCode: "650000",
      country: "VN",
    },
    createdAt: "2026-06-09T09:00:00+07:00",
    handedOverAt: "2026-06-09T17:00:00+07:00",
    estimatedDelivery: "2026-06-12",
    trackingEvents: [
      {
        eventId: "TRK-0040-1",
        shipmentId: "SHP-2026-0040",
        status: "In Transit",
        location: "Khánh Hòa",
        timestamp: "2026-06-11T06:00:00+07:00",
        source: "carrier-webhook",
      },
      {
        eventId: "TRK-0040-2",
        shipmentId: "SHP-2026-0040",
        status: "Exception",
        location: "Bưu cục J&T Nha Trang",
        timestamp: "2026-06-11T15:00:00+07:00",
        note: "Kiện móp méo — mở tra soát bồi thường (E5)",
        source: "carrier-webhook",
      },
    ],
  },
  {
    shipmentId: "SHP-2026-0035",
    shipmentNumber: "SHP-2026-0035",
    orderId: "ORD-2026-0006",
    packageIds: [],
    warehouseId: "WH-HCM-01",
    carrierId: "CAR-GHN",
    service: "standard",
    awbNumber: "GHN-3322114455",
    status: "Cancelled",
    codAmount: 0,
    codCollected: false,
    shippingFee: 30000,
    feeBasis: "zone",
    weightKg: 0.5,
    recipientName: "Ngô Thị Mai",
    recipientPhone: "+84 929 444 666",
    shippingAddress: {
      street: "88 Hùng Vương",
      ward: "Phường 9",
      district: "Quận 5",
      province: "TP. Hồ Chí Minh",
      postalCode: "726000",
      country: "VN",
    },
    createdAt: "2026-06-04T09:00:00+07:00",
    estimatedDelivery: "2026-06-07",
    rtoReason: "Đơn huỷ trước bàn giao → huỷ vận đơn",
    trackingEvents: [
      {
        eventId: "TRK-0035-1",
        shipmentId: "SHP-2026-0035",
        status: "Label Created",
        location: "Kho TP.HCM",
        timestamp: "2026-06-04T09:00:00+07:00",
        source: "system",
      },
      {
        eventId: "TRK-0035-2",
        shipmentId: "SHP-2026-0035",
        status: "Cancelled",
        location: "Kho TP.HCM",
        timestamp: "2026-06-04T15:00:00+07:00",
        note: "Huỷ vận đơn do đơn hàng bị huỷ",
        source: "system",
      },
    ],
  },
];

/* ============================================================================
 * MODULE 10 — INTER-WAREHOUSE TRANSFER (warehouse/10-inter-warehouse-transfer)
 * ==========================================================================*/

/** Vòng đời lệnh chuyển kho giữa các kho (10). */
export type TransferOrderStatus =
  | "Draft"
  | "Pending Approval"
  | "Approved"
  | "Picking"
  | "In Transit"
  | "Partially Received"
  | "Received"
  | "Completed"
  | "Cancelled";
// Ghi chú: docs ghi "Completed / Closed" là một trạng thái cuối — dùng "Completed".

export interface TransferLine {
  lineId: ID;
  transferOrderId: ID;
  skuId: ID;
  requestedQty: Qty;
  shippedQty: Qty;
  receivedQty: Qty;
  uom: Uom;
  lotId?: ID;
}

export interface TransferOrder {
  transferOrderId: ID;
  toNumber: string;
  fromWarehouseId: WarehouseId;
  toWarehouseId: WarehouseId;
  status: TransferOrderStatus;
  reason: string; // "Cân bằng tồn", "Điều phối theo khu vực"
  requestedBy: string;
  approvedBy?: string;
  createdAt: ISODateTime;
  shippedAt?: ISODateTime;
  receivedAt?: ISODateTime;
  /** Tồn in-transit KHÔNG tính vào ATP kho đích tới khi nhận (C4). */
  inTransitQty: Qty;
  carrierShipmentId?: ID;
  lines: TransferLine[];
  notes?: string;
}

export const transferOrders: TransferOrder[] = [
  {
    transferOrderId: "TO-2026-0009",
    toNumber: "TO-2026-0009",
    fromWarehouseId: "WH-HN-01",
    toWarehouseId: "WH-DN-01",
    status: "Draft",
    reason: "Cân bằng tồn khu vực miền Trung",
    requestedBy: "Đỗ Hồng Nhung",
    createdAt: "2026-06-12T10:00:00+07:00",
    inTransitQty: 0,
    lines: [
      {
        lineId: "TOL-0009-1",
        transferOrderId: "TO-2026-0009",
        skuId: "SKU-001-BLK-L",
        requestedQty: 100,
        shippedQty: 0,
        receivedQty: 0,
        uom: "pcs",
      },
    ],
  },
  {
    transferOrderId: "TO-2026-0008",
    toNumber: "TO-2026-0008",
    fromWarehouseId: "WH-HCM-01",
    toWarehouseId: "WH-HN-01",
    status: "Pending Approval",
    reason: "Kho HN sắp hết SKU cốc sứ",
    requestedBy: "Đỗ Hồng Nhung",
    createdAt: "2026-06-11T09:00:00+07:00",
    inTransitQty: 0,
    lines: [
      {
        lineId: "TOL-0008-1",
        transferOrderId: "TO-2026-0008",
        skuId: "SKU-002-WHT",
        requestedQty: 150,
        shippedQty: 0,
        receivedQty: 0,
        uom: "pcs",
      },
    ],
    notes: "Vượt ngưỡng duyệt → chờ Warehouse Manager (A2).",
  },
  {
    transferOrderId: "TO-2026-0007",
    toNumber: "TO-2026-0007",
    fromWarehouseId: "WH-HN-01",
    toWarehouseId: "WH-HCM-01",
    status: "Approved",
    reason: "Điều phối phôi áo cho xưởng in HCM",
    requestedBy: "Đỗ Hồng Nhung",
    approvedBy: "Trần Minh Quang",
    createdAt: "2026-06-10T08:00:00+07:00",
    inTransitQty: 0,
    lines: [
      {
        lineId: "TOL-0007-1",
        transferOrderId: "TO-2026-0007",
        skuId: "SKU-001-BLK-M",
        requestedQty: 200,
        shippedQty: 0,
        receivedQty: 0,
        uom: "pcs",
      },
    ],
  },
  {
    transferOrderId: "TO-2026-0006",
    toNumber: "TO-2026-0006",
    fromWarehouseId: "WH-HN-01",
    toWarehouseId: "WH-DN-01",
    status: "Picking",
    reason: "Mở rộng bán khu vực Đà Nẵng",
    requestedBy: "Đỗ Hồng Nhung",
    approvedBy: "Trần Minh Quang",
    createdAt: "2026-06-09T08:00:00+07:00",
    inTransitQty: 0,
    lines: [
      {
        lineId: "TOL-0006-1",
        transferOrderId: "TO-2026-0006",
        skuId: "SKU-001-BLK-L",
        requestedQty: 80,
        shippedQty: 0,
        receivedQty: 0,
        uom: "pcs",
      },
    ],
  },
  {
    transferOrderId: "TO-2026-0005",
    toNumber: "TO-2026-0005",
    fromWarehouseId: "WH-HCM-01",
    toWarehouseId: "WH-HN-01",
    status: "In Transit",
    reason: "Cân bằng tồn áo thun trắng",
    requestedBy: "Đỗ Hồng Nhung",
    approvedBy: "Trần Minh Quang",
    createdAt: "2026-06-06T08:00:00+07:00",
    shippedAt: "2026-06-08T17:00:00+07:00",
    inTransitQty: 120,
    carrierShipmentId: "SHP-TO-0005",
    lines: [
      {
        lineId: "TOL-0005-1",
        transferOrderId: "TO-2026-0005",
        skuId: "SKU-001-WHT-L",
        requestedQty: 120,
        shippedQty: 120,
        receivedQty: 0,
        uom: "pcs",
      },
    ],
  },
  {
    transferOrderId: "TO-2026-0004",
    toNumber: "TO-2026-0004",
    fromWarehouseId: "WH-HN-01",
    toWarehouseId: "WH-HCM-01",
    status: "Partially Received",
    reason: "Điều phối tồn theo sức mua",
    requestedBy: "Đỗ Hồng Nhung",
    approvedBy: "Trần Minh Quang",
    createdAt: "2026-06-02T08:00:00+07:00",
    shippedAt: "2026-06-03T17:00:00+07:00",
    inTransitQty: 50,
    carrierShipmentId: "SHP-TO-0004",
    lines: [
      {
        lineId: "TOL-0004-1",
        transferOrderId: "TO-2026-0004",
        skuId: "SKU-001-BLK-M",
        requestedQty: 250,
        shippedQty: 250,
        receivedQty: 200,
        uom: "pcs",
      },
    ],
  },
  {
    transferOrderId: "TO-2026-0003",
    toNumber: "TO-2026-0003",
    fromWarehouseId: "WH-HCM-01",
    toWarehouseId: "WH-DN-01",
    status: "Received",
    reason: "Cân bằng tồn cốc sứ",
    requestedBy: "Đỗ Hồng Nhung",
    approvedBy: "Trần Minh Quang",
    createdAt: "2026-05-28T08:00:00+07:00",
    shippedAt: "2026-05-29T17:00:00+07:00",
    receivedAt: "2026-06-01T10:00:00+07:00",
    inTransitQty: 0,
    carrierShipmentId: "SHP-TO-0003",
    lines: [
      {
        lineId: "TOL-0003-1",
        transferOrderId: "TO-2026-0003",
        skuId: "SKU-002-WHT",
        requestedQty: 90,
        shippedQty: 90,
        receivedQty: 90,
        uom: "pcs",
      },
    ],
  },
  {
    transferOrderId: "TO-2026-0002",
    toNumber: "TO-2026-0002",
    fromWarehouseId: "WH-HN-01",
    toWarehouseId: "WH-HCM-01",
    status: "Completed",
    reason: "Điều phối phôi in",
    requestedBy: "Đỗ Hồng Nhung",
    approvedBy: "Trần Minh Quang",
    createdAt: "2026-05-20T08:00:00+07:00",
    shippedAt: "2026-05-21T17:00:00+07:00",
    receivedAt: "2026-05-24T10:00:00+07:00",
    inTransitQty: 0,
    carrierShipmentId: "SHP-TO-0002",
    lines: [
      {
        lineId: "TOL-0002-1",
        transferOrderId: "TO-2026-0002",
        skuId: "SKU-003-WHT-L",
        requestedQty: 300,
        shippedQty: 300,
        receivedQty: 300,
        uom: "pcs",
      },
    ],
  },
  {
    transferOrderId: "TO-2026-0001",
    toNumber: "TO-2026-0001",
    fromWarehouseId: "WH-DN-01",
    toWarehouseId: "WH-HN-01",
    status: "Cancelled",
    reason: "Huỷ — kho nguồn không đủ tồn khả dụng",
    requestedBy: "Đỗ Hồng Nhung",
    createdAt: "2026-05-15T08:00:00+07:00",
    inTransitQty: 0,
    lines: [
      {
        lineId: "TOL-0001-1",
        transferOrderId: "TO-2026-0001",
        skuId: "SKU-001-BLK-L",
        requestedQty: 50,
        shippedQty: 0,
        receivedQty: 0,
        uom: "pcs",
      },
    ],
  },
];

/* ============================================================================
 * MODULE 11 — INTRA-WAREHOUSE TRANSFER (warehouse/11-intra-warehouse-transfer)
 * ==========================================================================*/

/** Vòng đời nhiệm vụ di dời trong kho (11). */
export type MoveTaskStatus =
  | "Suggested"
  | "Pending"
  | "Assigned"
  | "In Progress"
  | "On Hold"
  | "Discrepancy"
  | "Completed"
  | "Cancelled"
  | "Rejected";
// Ghi chú: docs ghi "Cancelled / Rejected" — tách 2 giá trị để demo đủ badge.

export type MoveReason =
  | "re-slotting"
  | "replenish-pick-face"
  | "consolidation"
  | "cycle-count-fix"
  | "damage-segregation";

export interface MoveTask {
  moveTaskId: ID;
  moveNumber: string;
  warehouseId: WarehouseId;
  skuId: ID;
  fromLocationId: ID;
  toLocationId: ID;
  quantity: Qty;
  uom: Uom;
  reason: MoveReason;
  status: MoveTaskStatus;
  suggestedBy?: string; // "Slotting Engine" | tên người
  assignedTo?: string;
  createdAt: ISODateTime;
  startedAt?: ISODateTime;
  completedAt?: ISODateTime;
  discrepancyNote?: string;
  overrideReason?: string;
}

export const moveTasks: MoveTask[] = [
  {
    moveTaskId: "MOV-2026-0060",
    moveNumber: "MOV-2026-0060",
    warehouseId: "WH-HN-01",
    skuId: "SKU-001-BLK-M",
    fromLocationId: "LOC-HN-B03-03-01-A",
    toLocationId: "LOC-HN-A01-01-01-A",
    quantity: 50,
    uom: "pcs",
    reason: "replenish-pick-face",
    status: "Suggested",
    suggestedBy: "Slotting Engine",
    createdAt: "2026-06-12T06:00:00+07:00",
  },
  {
    moveTaskId: "MOV-2026-0059",
    moveNumber: "MOV-2026-0059",
    warehouseId: "WH-HN-01",
    skuId: "SKU-001-BLK-L",
    fromLocationId: "LOC-HN-B02-03-01-A",
    toLocationId: "LOC-HN-A02-01-02-A",
    quantity: 40,
    uom: "pcs",
    reason: "re-slotting",
    status: "Pending",
    suggestedBy: "Slotting Engine",
    createdAt: "2026-06-11T06:00:00+07:00",
  },
  {
    moveTaskId: "MOV-2026-0058",
    moveNumber: "MOV-2026-0058",
    warehouseId: "WH-HCM-01",
    skuId: "SKU-002-WHT",
    fromLocationId: "LOC-HCM-C02-04-02-A",
    toLocationId: "LOC-HCM-C02-04-01-A",
    quantity: 30,
    uom: "pcs",
    reason: "consolidation",
    status: "Assigned",
    assignedTo: "Trương Văn Lâm",
    createdAt: "2026-06-11T07:00:00+07:00",
  },
  {
    moveTaskId: "MOV-2026-0057",
    moveNumber: "MOV-2026-0057",
    warehouseId: "WH-HCM-01",
    skuId: "SKU-003-WHT-L",
    fromLocationId: "LOC-HCM-STAGE-01",
    toLocationId: "LOC-HCM-A01-02-03-B",
    quantity: 100,
    uom: "pcs",
    reason: "re-slotting",
    status: "In Progress",
    assignedTo: "Trương Văn Lâm",
    createdAt: "2026-06-11T08:00:00+07:00",
    startedAt: "2026-06-11T08:30:00+07:00",
  },
  {
    moveTaskId: "MOV-2026-0056",
    moveNumber: "MOV-2026-0056",
    warehouseId: "WH-HN-01",
    skuId: "SKU-001-WHT-L",
    fromLocationId: "LOC-HN-A01-01-02-A",
    toLocationId: "LOC-HN-QTN-01",
    quantity: 5,
    uom: "pcs",
    reason: "damage-segregation",
    status: "On Hold",
    assignedTo: "Nguyễn Văn Đạt",
    createdAt: "2026-06-10T13:00:00+07:00",
    startedAt: "2026-06-10T13:30:00+07:00",
    discrepancyNote: "Chờ QC xác nhận tình trạng hàng trước khi chuyển vùng cách ly",
  },
  {
    moveTaskId: "MOV-2026-0055",
    moveNumber: "MOV-2026-0055",
    warehouseId: "WH-HN-01",
    skuId: "SKU-001-BLK-M",
    fromLocationId: "LOC-HN-A01-01-02-A",
    toLocationId: "LOC-HN-B03-03-01-A",
    quantity: 12,
    uom: "pcs",
    reason: "cycle-count-fix",
    status: "Discrepancy",
    assignedTo: "Nguyễn Văn Đạt",
    createdAt: "2026-06-09T15:00:00+07:00",
    startedAt: "2026-06-09T15:20:00+07:00",
    discrepancyNote: "Đếm thực tế 10 ≠ hệ thống 12 — lập biên bản chênh lệch, chờ kiểm kê lại",
  },
  {
    moveTaskId: "MOV-2026-0050",
    moveNumber: "MOV-2026-0050",
    warehouseId: "WH-HCM-01",
    skuId: "SKU-002-WHT",
    fromLocationId: "LOC-HCM-C02-04-03-A",
    toLocationId: "LOC-HCM-C02-04-01-A",
    quantity: 60,
    uom: "pcs",
    reason: "consolidation",
    status: "Completed",
    assignedTo: "Trương Văn Lâm",
    createdAt: "2026-06-05T09:00:00+07:00",
    startedAt: "2026-06-05T09:20:00+07:00",
    completedAt: "2026-06-05T10:00:00+07:00",
  },
  {
    moveTaskId: "MOV-2026-0048",
    moveNumber: "MOV-2026-0048",
    warehouseId: "WH-HN-01",
    skuId: "SKU-001-BLK-L",
    fromLocationId: "LOC-HN-A02-01-02-A",
    toLocationId: "LOC-HN-B02-03-01-A",
    quantity: 25,
    uom: "pcs",
    reason: "re-slotting",
    status: "Cancelled",
    suggestedBy: "Slotting Engine",
    createdAt: "2026-06-04T06:00:00+07:00",
  },
  {
    moveTaskId: "MOV-2026-0046",
    moveNumber: "MOV-2026-0046",
    warehouseId: "WH-HN-01",
    skuId: "SKU-003-WHT-L",
    fromLocationId: "LOC-HN-B03-01-02-A",
    toLocationId: "LOC-HN-B02-03-01-A",
    quantity: 80,
    uom: "pcs",
    reason: "replenish-pick-face",
    status: "Rejected",
    suggestedBy: "Slotting Engine",
    createdAt: "2026-06-03T06:00:00+07:00",
    overrideReason: "Manager từ chối — vị trí đích đang reserve cho đơn ưu tiên",
  },
];

/* ============================================================================
 * MODULE 12 — PRODUCT DESIGN 2D/3D (ecommerce/12-product-design)
 * ==========================================================================*/

/** Vòng đời thiết kế (12). */
export type DesignStatus = "Draft" | "Ready" | "Confirmed" | "Locked" | "Superseded" | "Cancelled";

/** Kết quả preflight (12) — Pass/Warning/Fail. */
export type PreflightStatus = "Pass" | "Warning" | "Fail";

export type DesignElementType = "image" | "text" | "clipart" | "shape";

export interface DesignElement {
  elementId: ID;
  type: DesignElementType;
  /** Với text. */
  text?: string;
  fontFamily?: string; // chỉ phông trong danh sách cho phép
  fontSize?: number;
  textColor?: string;
  align?: "left" | "center" | "right";
  effect?: "none" | "outline" | "shadow" | "curve";
  /** Với image/clipart. */
  src?: string;
  dpi?: number; // validate DPI → cảnh báo "ảnh mờ" nếu thấp
  /** Transform chung. */
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zOrder: number;
  printAreaId: ID;
}

export interface PreflightIssue {
  issueId: ID;
  severity: PreflightStatus;
  elementId?: ID;
  code:
    | "low-dpi"
    | "out-of-print-area"
    | "overlap-forbidden"
    | "color-profile"
    | "min-font-size"
    | "content-policy";
  message: string;
}

export interface PreflightReport {
  reportId: ID;
  designVersionId: ID;
  status: PreflightStatus;
  checkedAt: ISODateTime;
  issues: PreflightIssue[];
}

export interface DesignVersion {
  versionId: ID;
  designId: ID;
  versionNo: number;
  elements: DesignElement[];
  variant: Record<string, string>; // { Color: "Đen", Size: "L" }
  thumbnailUrl: string;
  createdAt: ISODateTime;
  createdBy: string;
  preflightStatus: PreflightStatus;
  superseded: boolean;
}

export interface Design {
  designId: ID;
  productId: ID;
  customerId: ID;
  status: DesignStatus;
  currentVersionId: ID;
  printAreaIds: ID[];
  /** Disclaimer bắt buộc (12): màu hiển thị có thể sai lệch. */
  disclaimerAcknowledged: boolean;
  confirmedAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  versions: DesignVersion[];
  preflightReports: PreflightReport[];
  /** Nội dung tải lên đã qua kiểm duyệt (B6). */
  contentModeration: "pending" | "approved" | "flagged";
  /** Yêu cầu thay đổi sau đặt hàng (B5): chỉ tới khi bắt đầu sản xuất. */
  linkedOrderId?: ID;
  lockedForProduction: boolean;
}

export const designs: Design[] = [
  {
    designId: "DSN-2026-0031",
    productId: "PRD-001",
    customerId: "CUS-0012",
    status: "Draft",
    currentVersionId: "DSV-0031-1",
    printAreaIds: ["PA-001-F"],
    disclaimerAcknowledged: false,
    createdAt: "2026-06-12T20:10:00+07:00",
    updatedAt: "2026-06-12T20:35:00+07:00",
    contentModeration: "approved",
    lockedForProduction: false,
    versions: [
      {
        versionId: "DSV-0031-1",
        designId: "DSN-2026-0031",
        versionNo: 1,
        elements: [
          {
            elementId: "EL-0031-1",
            type: "text",
            text: "SAI GON 1975",
            fontFamily: "Be Vietnam Pro",
            fontSize: 48,
            textColor: "#A9682F",
            align: "center",
            effect: "outline",
            x: 60,
            y: 120,
            width: 160,
            height: 40,
            rotation: 0,
            zOrder: 1,
            printAreaId: "PA-001-F",
          },
        ],
        variant: { Color: "Trắng", Size: "L" },
        thumbnailUrl: "/mock/design/dsn-0031-v1.png",
        createdAt: "2026-06-12T20:10:00+07:00",
        createdBy: "Trần Thị Bích",
        preflightStatus: "Pass",
        superseded: false,
      },
    ],
    preflightReports: [
      {
        reportId: "PRE-0031-1",
        designVersionId: "DSV-0031-1",
        status: "Pass",
        checkedAt: "2026-06-12T20:36:00+07:00",
        issues: [],
      },
    ],
  },
  {
    designId: "DSN-2026-0030",
    productId: "PRD-002",
    customerId: "CUS-0010",
    status: "Ready",
    currentVersionId: "DSV-0030-2",
    printAreaIds: ["PA-002"],
    disclaimerAcknowledged: true,
    createdAt: "2026-06-11T19:00:00+07:00",
    updatedAt: "2026-06-11T19:50:00+07:00",
    contentModeration: "approved",
    lockedForProduction: false,
    versions: [
      {
        versionId: "DSV-0030-1",
        designId: "DSN-2026-0030",
        versionNo: 1,
        elements: [
          {
            elementId: "EL-0030-1",
            type: "image",
            src: "/mock/upload/cus0010-photo.jpg",
            dpi: 110,
            x: 40,
            y: 30,
            width: 120,
            height: 60,
            rotation: 0,
            zOrder: 1,
            printAreaId: "PA-002",
          },
        ],
        variant: { Color: "Trắng" },
        thumbnailUrl: "/mock/design/dsn-0030-v1.png",
        createdAt: "2026-06-11T19:00:00+07:00",
        createdBy: "Nguyễn Hoài Nam",
        preflightStatus: "Warning",
        superseded: true,
      },
      {
        versionId: "DSV-0030-2",
        designId: "DSN-2026-0030",
        versionNo: 2,
        elements: [
          {
            elementId: "EL-0030-2",
            type: "image",
            src: "/mock/upload/cus0010-photo-hd.jpg",
            dpi: 300,
            x: 40,
            y: 30,
            width: 120,
            height: 60,
            rotation: 0,
            zOrder: 1,
            printAreaId: "PA-002",
          },
          {
            elementId: "EL-0030-3",
            type: "text",
            text: "Happy Birthday Mom",
            fontFamily: "Inter",
            fontSize: 24,
            textColor: "#2A211A",
            align: "center",
            effect: "none",
            x: 50,
            y: 95,
            width: 100,
            height: 20,
            rotation: 0,
            zOrder: 2,
            printAreaId: "PA-002",
          },
        ],
        variant: { Color: "Trắng" },
        thumbnailUrl: "/mock/design/dsn-0030-v2.png",
        createdAt: "2026-06-11T19:45:00+07:00",
        createdBy: "Nguyễn Hoài Nam",
        preflightStatus: "Pass",
        superseded: false,
      },
    ],
    preflightReports: [
      {
        reportId: "PRE-0030-1",
        designVersionId: "DSV-0030-1",
        status: "Warning",
        checkedAt: "2026-06-11T19:05:00+07:00",
        issues: [
          {
            issueId: "ISS-0030-1",
            severity: "Warning",
            elementId: "EL-0030-1",
            code: "low-dpi",
            message: "Ảnh 110 DPI < 200 DPI tối thiểu — thành phẩm có thể mờ",
          },
        ],
      },
      {
        reportId: "PRE-0030-2",
        designVersionId: "DSV-0030-2",
        status: "Pass",
        checkedAt: "2026-06-11T19:50:00+07:00",
        issues: [],
      },
    ],
  },
  {
    designId: "DSN-2026-0028",
    productId: "PRD-001",
    customerId: "CUS-0008",
    status: "Confirmed",
    currentVersionId: "DSV-0028-1",
    printAreaIds: ["PA-001-F", "PA-001-B"],
    disclaimerAcknowledged: true,
    confirmedAt: "2026-06-10T21:00:00+07:00",
    createdAt: "2026-06-10T20:00:00+07:00",
    updatedAt: "2026-06-10T21:00:00+07:00",
    contentModeration: "approved",
    lockedForProduction: false,
    linkedOrderId: "ORD-2026-0010",
    versions: [
      {
        versionId: "DSV-0028-1",
        designId: "DSN-2026-0028",
        versionNo: 1,
        elements: [
          {
            elementId: "EL-0028-1",
            type: "image",
            src: "/mock/upload/cus0008-logo.png",
            dpi: 400,
            x: 70,
            y: 110,
            width: 140,
            height: 140,
            rotation: 0,
            zOrder: 1,
            printAreaId: "PA-001-F",
          },
          {
            elementId: "EL-0028-2",
            type: "text",
            text: "TEAM BUILDING 2026",
            fontFamily: "Inter Tight",
            fontSize: 36,
            textColor: "#1A1B18",
            align: "center",
            effect: "none",
            x: 50,
            y: 300,
            width: 180,
            height: 30,
            rotation: 0,
            zOrder: 1,
            printAreaId: "PA-001-B",
          },
        ],
        variant: { Color: "Đen", Size: "L" },
        thumbnailUrl: "/mock/design/dsn-0028-v1.png",
        createdAt: "2026-06-10T20:00:00+07:00",
        createdBy: "Phạm Thu Trang",
        preflightStatus: "Pass",
        superseded: false,
      },
    ],
    preflightReports: [
      {
        reportId: "PRE-0028-1",
        designVersionId: "DSV-0028-1",
        status: "Pass",
        checkedAt: "2026-06-10T20:55:00+07:00",
        issues: [],
      },
    ],
  },
  {
    designId: "DSN-2026-0025",
    productId: "PRD-004",
    customerId: "CUS-0005",
    status: "Locked",
    currentVersionId: "DSV-0025-1",
    printAreaIds: ["PA-004-F"],
    disclaimerAcknowledged: true,
    confirmedAt: "2026-06-08T15:00:00+07:00",
    createdAt: "2026-06-08T14:00:00+07:00",
    updatedAt: "2026-06-09T08:00:00+07:00",
    contentModeration: "approved",
    lockedForProduction: true,
    linkedOrderId: "ORD-2026-0007",
    versions: [
      {
        versionId: "DSV-0025-1",
        designId: "DSN-2026-0025",
        versionNo: 1,
        elements: [
          {
            elementId: "EL-0025-1",
            type: "clipart",
            src: "/mock/clipart/bear-hoodie.svg",
            x: 80,
            y: 120,
            width: 100,
            height: 100,
            rotation: 0,
            zOrder: 1,
            printAreaId: "PA-004-F",
          },
        ],
        variant: { Color: "Đen", Size: "L" },
        thumbnailUrl: "/mock/design/dsn-0025-v1.png",
        createdAt: "2026-06-08T14:00:00+07:00",
        createdBy: "Vũ Đức Long",
        preflightStatus: "Pass",
        superseded: false,
      },
    ],
    preflightReports: [
      {
        reportId: "PRE-0025-1",
        designVersionId: "DSV-0025-1",
        status: "Pass",
        checkedAt: "2026-06-08T14:55:00+07:00",
        issues: [],
      },
    ],
  },
  {
    designId: "DSN-2026-0022",
    productId: "PRD-001",
    customerId: "CUS-0011",
    status: "Ready",
    currentVersionId: "DSV-0022-1",
    printAreaIds: ["PA-001-F"],
    disclaimerAcknowledged: true,
    createdAt: "2026-06-09T20:00:00+07:00",
    updatedAt: "2026-06-09T20:40:00+07:00",
    contentModeration: "flagged",
    lockedForProduction: false,
    versions: [
      {
        versionId: "DSV-0022-1",
        designId: "DSN-2026-0022",
        versionNo: 1,
        elements: [
          {
            elementId: "EL-0022-1",
            type: "image",
            src: "/mock/upload/cus0011-art.png",
            dpi: 200,
            x: 30,
            y: 90,
            width: 220,
            height: 220,
            rotation: 0,
            zOrder: 1,
            printAreaId: "PA-001-F",
          },
        ],
        variant: { Color: "Trắng", Size: "M" },
        thumbnailUrl: "/mock/design/dsn-0022-v1.png",
        createdAt: "2026-06-09T20:00:00+07:00",
        createdBy: "Ngô Thị Mai",
        preflightStatus: "Fail",
        superseded: false,
      },
    ],
    preflightReports: [
      {
        reportId: "PRE-0022-1",
        designVersionId: "DSV-0022-1",
        status: "Fail",
        checkedAt: "2026-06-09T20:40:00+07:00",
        issues: [
          {
            issueId: "ISS-0022-1",
            severity: "Fail",
            elementId: "EL-0022-1",
            code: "out-of-print-area",
            message: "Phần tử tràn khỏi vùng in trước ngực (280×380mm)",
          },
          {
            issueId: "ISS-0022-2",
            severity: "Fail",
            elementId: "EL-0022-1",
            code: "content-policy",
            message: "Ảnh chờ rà nội dung bản quyền (B6) — chưa được duyệt",
          },
        ],
      },
    ],
  },
  {
    designId: "DSN-2026-0018",
    productId: "PRD-002",
    customerId: "CUS-0003",
    status: "Superseded",
    currentVersionId: "DSV-0018-2",
    printAreaIds: ["PA-002"],
    disclaimerAcknowledged: true,
    createdAt: "2026-06-05T10:00:00+07:00",
    updatedAt: "2026-06-06T09:00:00+07:00",
    contentModeration: "approved",
    lockedForProduction: false,
    versions: [
      {
        versionId: "DSV-0018-1",
        designId: "DSN-2026-0018",
        versionNo: 1,
        elements: [],
        variant: { Color: "Trắng" },
        thumbnailUrl: "/mock/design/dsn-0018-v1.png",
        createdAt: "2026-06-05T10:00:00+07:00",
        createdBy: "Đặng Thuỳ Linh",
        preflightStatus: "Warning",
        superseded: true,
      },
      {
        versionId: "DSV-0018-2",
        designId: "DSN-2026-0018",
        versionNo: 2,
        elements: [],
        variant: { Color: "Trắng" },
        thumbnailUrl: "/mock/design/dsn-0018-v2.png",
        createdAt: "2026-06-05T11:00:00+07:00",
        createdBy: "Đặng Thuỳ Linh",
        preflightStatus: "Pass",
        superseded: true,
      },
    ],
    preflightReports: [
      {
        reportId: "PRE-0018-1",
        designVersionId: "DSV-0018-1",
        status: "Warning",
        checkedAt: "2026-06-05T10:30:00+07:00",
        issues: [
          {
            issueId: "ISS-0018-1",
            severity: "Warning",
            code: "min-font-size",
            message: "Cỡ chữ nhỏ hơn mức khuyến nghị để in rõ",
          },
        ],
      },
    ],
  },
  {
    designId: "DSN-2026-0015",
    productId: "PRD-001",
    customerId: "CUS-0007",
    status: "Cancelled",
    currentVersionId: "DSV-0015-1",
    printAreaIds: ["PA-001-F"],
    disclaimerAcknowledged: false,
    createdAt: "2026-06-02T20:00:00+07:00",
    updatedAt: "2026-06-03T08:00:00+07:00",
    contentModeration: "approved",
    lockedForProduction: false,
    versions: [
      {
        versionId: "DSV-0015-1",
        designId: "DSN-2026-0015",
        versionNo: 1,
        elements: [],
        variant: { Color: "Xám", Size: "M" },
        thumbnailUrl: "/mock/design/dsn-0015-v1.png",
        createdAt: "2026-06-02T20:00:00+07:00",
        createdBy: "Bùi Thanh Hà",
        preflightStatus: "Pass",
        superseded: false,
      },
    ],
    preflightReports: [
      {
        reportId: "PRE-0015-1",
        designVersionId: "DSV-0015-1",
        status: "Pass",
        checkedAt: "2026-06-02T20:30:00+07:00",
        issues: [],
      },
    ],
  },
];

/* ============================================================================
 * MODULE 13 — CATALOG (ecommerce/13-catalog)
 * ==========================================================================*/

/** Trạng thái hiển thị catalog (13). */
export type CatalogVisibility =
  | "Visible – In stock"
  | "Visible – Low stock"
  | "Visible – Out of stock"
  | "Visible – Pre-order"
  | "Hidden"
  | "Unpublished";
// Nhãn giữ đúng dấu "–" (en dash) như docs; khi so khớp dùng nguyên chuỗi.

export type CatalogChannel = "storefront" | "pos" | "b2b";

export interface CatalogListing {
  listingId: ID;
  productId: ID;
  /** Lớp hiển thị tiêu thụ dữ liệu từ 01 (G1). */
  displayTitle: string;
  displayDescription: string;
  heroImage: string;
  gallery: string[];
  seoSlug: string;
  metaTitle: string;
  metaDescription: string;
  visibility: CatalogVisibility;
  channel: CatalogChannel;
  /** Giá hiển thị storefront (có thể khác basePrice). */
  displayPrice: VND;
  compareAtPrice?: VND; // giá gạch
  promotionId?: ID;
  categoryIds: ID[];
  /** ATP theo C3: mặc định tổng toàn hệ thống. */
  stockView: "all-warehouses" | "by-region";
  totalAvailable: Qty;
  lowStockThreshold: Qty;
  allowPreorder: boolean;
  ratingAvg: number; // 0–5
  ratingCount: number;
  publishedAt?: ISODateTime;
  hiddenAt?: ISODateTime;
  isCustomizable: boolean; // true → CTA "Bắt đầu thiết kế"
  relatedProductIds: ID[];
}

export type PromotionType = "percentage" | "fixed-amount" | "free-shipping" | "gift" | "bundle";

export interface Promotion {
  promotionId: ID;
  code: string;
  name: string;
  type: PromotionType;
  value: number; // % hoặc số tiền
  minOrderValue?: VND;
  maxDiscount?: VND;
  usageLimit?: number;
  usedCount: number;
  appliesTo: "all" | "category" | "product";
  applicableIds: ID[];
  startsAt: ISODateTime;
  endsAt: ISODateTime;
  stackable: boolean;
  // ASSUMPTION (open-question D7): quy tắc stacking voucher chưa chốt.
  active: boolean;
}

export interface Review {
  reviewId: ID;
  productId: ID;
  customerId: ID;
  orderId?: ID;
  rating: number; // 1–5
  title: string;
  body: string;
  images: string[];
  verifiedPurchase: boolean;
  createdAt: ISODateTime;
  helpfulCount: number;
  reply?: string;
  replyAt?: ISODateTime;
  status: "published" | "pending" | "hidden";
}

export interface CatalogFacet {
  facetId: ID;
  label: BilingualLabel;
  type: "category" | "color" | "material" | "price" | "rating";
  options: { value: string; label: string; hex?: string; count: number }[];
  priceRange?: { min: VND; max: VND };
}

export const catalogListings: CatalogListing[] = [
  {
    listingId: "LST-001",
    productId: "PRD-001",
    displayTitle: "Áo Thun Cotton Cao Cấp — In Theo Thiết Kế",
    displayDescription:
      "Cotton 100% co giãn 4 chiều, in DTG sắc nét. Tự thiết kế 2D, xem trước 3D.",
    heroImage: "/mock/img/prd-001-1.jpg",
    gallery: ["/mock/img/prd-001-1.jpg", "/mock/img/prd-001-2.jpg", "/mock/img/prd-001-3.jpg"],
    seoSlug: "ao-thun-cotton-in-theo-thiet-ke",
    metaTitle: "Áo thun cotton in theo yêu cầu | StockFlow",
    metaDescription: "Thiết kế áo thun cotton cao cấp theo ý bạn, xem trước 3D.",
    visibility: "Visible – In stock",
    channel: "storefront",
    displayPrice: 149000,
    compareAtPrice: 199000,
    promotionId: "PROMO-2026-01",
    categoryIds: ["CAT-01", "CAT-01-01"],
    stockView: "all-warehouses",
    totalAvailable: 351,
    lowStockThreshold: 50,
    allowPreorder: false,
    ratingAvg: 4.7,
    ratingCount: 218,
    publishedAt: "2026-03-14T12:00:00+07:00",
    isCustomizable: true,
    relatedProductIds: ["PRD-004", "PRD-006"],
  },
  {
    listingId: "LST-002",
    productId: "PRD-002",
    displayTitle: "Cốc Sứ In Ảnh 350ml",
    displayDescription: "Cốc sứ trắng in thăng hoa toàn thân, món quà ý nghĩa.",
    heroImage: "/mock/img/prd-002-1.jpg",
    gallery: ["/mock/img/prd-002-1.jpg", "/mock/img/prd-002-2.jpg"],
    seoSlug: "coc-su-in-anh-350ml",
    metaTitle: "Cốc sứ in ảnh 350ml | StockFlow",
    metaDescription: "In ảnh lên cốc sứ, quà tặng cá nhân hoá.",
    visibility: "Visible – In stock",
    channel: "storefront",
    displayPrice: 89000,
    categoryIds: ["CAT-02", "CAT-02-01"],
    stockView: "all-warehouses",
    totalAvailable: 302,
    lowStockThreshold: 60,
    allowPreorder: false,
    ratingAvg: 4.5,
    ratingCount: 96,
    publishedAt: "2026-03-19T10:00:00+07:00",
    isCustomizable: true,
    relatedProductIds: ["PRD-005"],
  },
  {
    listingId: "LST-004",
    productId: "PRD-004",
    displayTitle: "Áo Hoodie Nỉ Cao Cấp — Thêu/In",
    displayDescription: "Nỉ bông 320gsm ấm áp, thêu hoặc in trước ngực.",
    heroImage: "/mock/img/prd-004-1.jpg",
    gallery: ["/mock/img/prd-004-1.jpg", "/mock/img/prd-004-2.jpg"],
    seoSlug: "ao-hoodie-ni-cao-cap",
    metaTitle: "Áo hoodie nỉ cao cấp | StockFlow",
    metaDescription: "Hoodie nỉ 320gsm, thêu/in theo thiết kế.",
    visibility: "Visible – Low stock",
    channel: "storefront",
    displayPrice: 289000,
    compareAtPrice: 349000,
    categoryIds: ["CAT-01", "CAT-01-02"],
    stockView: "all-warehouses",
    totalAvailable: 12,
    lowStockThreshold: 30,
    allowPreorder: true,
    ratingAvg: 4.8,
    ratingCount: 54,
    publishedAt: "2026-05-21T09:00:00+07:00",
    isCustomizable: true,
    relatedProductIds: ["PRD-001"],
  },
  {
    listingId: "LST-005",
    productId: "PRD-005",
    displayTitle: "Túi Tote Canvas In Hình",
    displayDescription: "Canvas 12oz bền bỉ, in một hoặc hai mặt.",
    heroImage: "/mock/img/prd-005-1.jpg",
    gallery: ["/mock/img/prd-005-1.jpg"],
    seoSlug: "tui-tote-canvas-in-hinh",
    metaTitle: "Túi tote canvas in hình | StockFlow",
    metaDescription: "Tote canvas in theo thiết kế riêng.",
    visibility: "Visible – Out of stock",
    channel: "storefront",
    displayPrice: 79000,
    categoryIds: ["CAT-02"],
    stockView: "all-warehouses",
    totalAvailable: 0,
    lowStockThreshold: 20,
    allowPreorder: false,
    ratingAvg: 4.3,
    ratingCount: 12,
    isCustomizable: true,
    relatedProductIds: ["PRD-002"],
  },
  {
    listingId: "LST-006",
    productId: "PRD-006",
    displayTitle: "Mũ Lưỡi Trai Thêu Logo",
    displayDescription: "Mũ 6 panel thêu logo tinh tế.",
    heroImage: "/mock/img/prd-006-1.jpg",
    gallery: ["/mock/img/prd-006-1.jpg"],
    seoSlug: "mui-luoi-trai-theu-logo",
    metaTitle: "Mũ lưỡi trai thêu logo | StockFlow",
    metaDescription: "Mũ thêu logo theo yêu cầu.",
    visibility: "Hidden",
    channel: "storefront",
    displayPrice: 119000,
    categoryIds: ["CAT-02"],
    stockView: "all-warehouses",
    totalAvailable: 45,
    lowStockThreshold: 20,
    allowPreorder: false,
    ratingAvg: 4.1,
    ratingCount: 8,
    publishedAt: "2026-02-11T14:00:00+07:00",
    hiddenAt: "2026-05-01T09:00:00+07:00",
    isCustomizable: true,
    relatedProductIds: [],
  },
  {
    listingId: "LST-007",
    productId: "PRD-007",
    displayTitle: "Áo Polo Thêu Doanh Nghiệp",
    displayDescription: "Polo cá sấu thêu logo doanh nghiệp.",
    heroImage: "/mock/img/prd-007-1.jpg",
    gallery: ["/mock/img/prd-007-1.jpg"],
    seoSlug: "ao-polo-theu-doanh-nghiep",
    metaTitle: "Áo polo thêu doanh nghiệp | StockFlow",
    metaDescription: "Polo thêu logo công ty.",
    visibility: "Unpublished",
    channel: "storefront",
    displayPrice: 199000,
    categoryIds: ["CAT-01", "CAT-01-01"],
    stockView: "all-warehouses",
    totalAvailable: 22,
    lowStockThreshold: 10,
    allowPreorder: false,
    ratingAvg: 4.0,
    ratingCount: 5,
    isCustomizable: true,
    relatedProductIds: [],
  },
  {
    listingId: "LST-008",
    productId: "PRD-001",
    displayTitle: "Áo Thun Cotton — Đặt trước mùa lễ",
    displayDescription: "Nhận đặt trước, giao sau 15 ngày.",
    heroImage: "/mock/img/prd-001-2.jpg",
    gallery: ["/mock/img/prd-001-2.jpg"],
    seoSlug: "ao-thun-cotton-preorder",
    metaTitle: "Áo thun cotton đặt trước | StockFlow",
    metaDescription: "Đặt trước áo thun in theo yêu cầu.",
    visibility: "Visible – Pre-order",
    channel: "storefront",
    displayPrice: 139000,
    categoryIds: ["CAT-01", "CAT-01-01"],
    stockView: "by-region",
    totalAvailable: 0,
    lowStockThreshold: 0,
    allowPreorder: true,
    ratingAvg: 4.7,
    ratingCount: 218,
    publishedAt: "2026-06-01T09:00:00+07:00",
    isCustomizable: true,
    relatedProductIds: ["PRD-004"],
  },
];

export const promotions: Promotion[] = [
  {
    promotionId: "PROMO-2026-01",
    code: "HE2026",
    name: "Hè rực rỡ — giảm 15%",
    type: "percentage",
    value: 0.15,
    minOrderValue: 200000,
    maxDiscount: 100000,
    usageLimit: 1000,
    usedCount: 412,
    appliesTo: "all",
    applicableIds: [],
    startsAt: "2026-06-01T00:00:00+07:00",
    endsAt: "2026-06-30T23:59:59+07:00",
    stackable: false,
    active: true,
  },
  {
    promotionId: "PROMO-2026-02",
    code: "FREESHIP",
    name: "Miễn phí vận chuyển đơn 300k",
    type: "free-shipping",
    value: 0,
    minOrderValue: 300000,
    usageLimit: 2000,
    usedCount: 1890,
    appliesTo: "all",
    applicableIds: [],
    startsAt: "2026-06-01T00:00:00+07:00",
    endsAt: "2026-06-30T23:59:59+07:00",
    stackable: true,
    active: true,
  },
  {
    promotionId: "PROMO-2026-03",
    code: "NEW50K",
    name: "Giảm 50k cho khách mới",
    type: "fixed-amount",
    value: 50000,
    minOrderValue: 150000,
    usageLimit: 500,
    usedCount: 500,
    appliesTo: "all",
    applicableIds: [],
    startsAt: "2026-05-01T00:00:00+07:00",
    endsAt: "2026-06-30T23:59:59+07:00",
    stackable: false,
    active: false,
  },
];

export const reviews: Review[] = [
  {
    reviewId: "REV-0011",
    productId: "PRD-001",
    customerId: "CUS-0010",
    orderId: "ORD-2026-0001",
    rating: 5,
    title: "In rất nét, vải mát",
    body: "Áo cotton mát, hình in DTG sắc nét đúng như xem trước 3D. Sẽ mua lại.",
    images: ["/mock/review/rev-0011-1.jpg"],
    verifiedPurchase: true,
    createdAt: "2026-06-02T20:00:00+07:00",
    helpfulCount: 24,
    reply: "Cảm ơn bạn đã tin tưởng StockFlow!",
    replyAt: "2026-06-03T09:00:00+07:00",
    status: "published",
  },
  {
    reviewId: "REV-0010",
    productId: "PRD-001",
    customerId: "CUS-0012",
    orderId: "ORD-2026-0004",
    rating: 4,
    title: "Form đẹp",
    body: "Form unisex dễ mặc, size L hơi rộng so với mình.",
    images: [],
    verifiedPurchase: true,
    createdAt: "2026-06-05T19:00:00+07:00",
    helpfulCount: 11,
    status: "published",
  },
  {
    reviewId: "REV-0009",
    productId: "PRD-002",
    customerId: "CUS-0003",
    rating: 5,
    title: "Quà tặng tuyệt vời",
    body: "Cốc in ảnh mẹ rất đẹp, đóng gói cẩn thận.",
    images: ["/mock/review/rev-0009-1.jpg"],
    verifiedPurchase: true,
    createdAt: "2026-06-04T12:00:00+07:00",
    helpfulCount: 18,
    status: "published",
  },
  {
    reviewId: "REV-0008",
    productId: "PRD-004",
    customerId: "CUS-0008",
    rating: 5,
    title: "Nỉ dày dặn",
    body: "Hoodie ấm, thêu logo sắc sảo.",
    images: [],
    verifiedPurchase: true,
    createdAt: "2026-06-06T21:00:00+07:00",
    helpfulCount: 7,
    status: "published",
  },
  {
    reviewId: "REV-0007",
    productId: "PRD-001",
    customerId: "CUS-0007",
    rating: 2,
    title: "Giao hơi lâu",
    body: "Chất lượng ổn nhưng giao mất 5 ngày.",
    images: [],
    verifiedPurchase: false,
    createdAt: "2026-06-01T10:00:00+07:00",
    helpfulCount: 3,
    status: "pending",
  },
];

export const catalogFacets: CatalogFacet[] = [
  {
    facetId: "FACET-CAT",
    label: { vi: "Danh mục", en: "Category" },
    type: "category",
    options: [
      { value: "CAT-01-01", label: "Áo thun", count: 3 },
      { value: "CAT-01-02", label: "Áo hoodie", count: 1 },
      { value: "CAT-02-01", label: "Cốc & bình", count: 1 },
      { value: "CAT-02", label: "Phụ kiện", count: 2 },
    ],
  },
  {
    facetId: "FACET-COLOR",
    label: { vi: "Màu sắc", en: "Color" },
    type: "color",
    options: [
      { value: "Đen", label: "Đen", hex: "#1A1B18", count: 5 },
      { value: "Trắng", label: "Trắng", hex: "#FFFFFF", count: 5 },
      { value: "Xám", label: "Xám", hex: "#9A9C95", count: 2 },
      { value: "Navy", label: "Navy", hex: "#1F2A44", count: 2 },
      { value: "Be", label: "Be", hex: "#E6DCCC", count: 2 },
    ],
  },
  {
    facetId: "FACET-MATERIAL",
    label: { vi: "Chất liệu", en: "Material" },
    type: "material",
    options: [
      { value: "cotton", label: "Cotton 100%", count: 3 },
      { value: "fleece", label: "Nỉ bông", count: 1 },
      { value: "ceramic", label: "Sứ", count: 1 },
      { value: "canvas", label: "Canvas", count: 1 },
    ],
  },
  {
    facetId: "FACET-PRICE",
    label: { vi: "Giá", en: "Price" },
    type: "price",
    options: [
      { value: "0-100000", label: "Dưới 100.000₫", count: 2 },
      { value: "100000-200000", label: "100.000₫ – 200.000₫", count: 3 },
      { value: "200000-500000", label: "Trên 200.000₫", count: 1 },
    ],
    priceRange: { min: 79000, max: 289000 },
  },
  {
    facetId: "FACET-RATING",
    label: { vi: "Đánh giá", en: "Rating" },
    type: "rating",
    options: [
      { value: "5", label: "5 sao", count: 1 },
      { value: "4", label: "4 sao trở lên", count: 5 },
      { value: "3", label: "3 sao trở lên", count: 6 },
    ],
  },
];

/* ============================================================================
 * MODULE 14 — CART & ORDER (ecommerce/14-cart-and-order)
 * ==========================================================================*/

/** Vòng đời giỏ hàng (14). */
export type CartStatus = "Active" | "Abandoned" | "Converted" | "Merged";

/** Vòng đời đơn hàng (14 §5.2 — tập con tổng quát; 17 là nguồn đầy đủ hơn, xem MODULE 17). */
export type OrderStatus =
  | "Pending Payment"
  | "Payment Failed"
  | "Confirmed"
  | "In Production"
  | "Ready to Fulfill"
  | "Picking"
  | "Packed"
  | "Shipped"
  | "In Transit"
  | "Delivered"
  | "Completed"
  | "Cancelled"
  | "Returned"
  | "Refunded"
  | "Partially Refunded"
  // Các trạng thái mở rộng chỉ xuất hiện ở 17 — mock dùng cho demo đầy đủ, UI của 14 hiển thị qua cùng StatusDot:
  | "On Hold"
  | "Partially Fulfilled"
  | "Delivery Failed"
  | "Return Requested"
  | "Closed";

export type CustomerType = "individual" | "business";

export interface CartLine {
  lineId: ID;
  cartId: ID;
  skuId: ID;
  productId: ID;
  quantity: Qty;
  unitPrice: VND;
  /** Thiết kế đính kèm (12) — chỉ sản phẩm tùy chỉnh. */
  designId?: ID;
  designThumbnail?: string;
  lineTotal: VND;
  addedAt: ISODateTime;
  inStock: boolean; // edge case 14: dòng hết tồn → chặn checkout
}

export interface Cart {
  cartId: ID;
  customerId: ID; // "guest-xxx" nếu khách vãng lai (D6: 1 giỏ Active/khách)
  isGuest: boolean;
  status: CartStatus;
  lines: CartLine[];
  subtotal: VND;
  itemCount: Qty;
  appliedVoucherCode?: string;
  currency: Currency;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  expiresAt?: ISODateTime; // reservation (D5)
  mergedIntoCartId?: ID;
  convertedToOrderId?: ID;
}

export interface OrderLine {
  lineId: ID;
  orderId: ID;
  skuId: ID;
  productId: ID;
  productName: string;
  variantLabel: string;
  quantity: Qty;
  unitPrice: VND;
  designId?: ID;
  designSnapshotUrl?: string; // bất biến sau confirmed (00 §6 nguyên tắc 5)
  lineTotal: VND;
  fulfillmentStatus:
    | "pending"
    | "in-production"
    | "picking"
    | "picked"
    | "packed"
    | "shipped"
    | "delivered"
    | "completed"
    | "returned";
}

export interface ShippingMethodOption {
  methodId: ID;
  carrierId: ID;
  service: CarrierService;
  label: string;
  fee: VND;
  estimatedDays: number;
  selected: boolean;
}

export interface Order {
  orderId: ID;
  orderNumber: string;
  customerId: ID;
  cartId: ID;
  status: OrderStatus;
  /** Mốc thời gian. */
  placedAt: ISODateTime;
  confirmedAt?: ISODateTime;
  productionStartedAt?: ISODateTime; // B1: đơn in qua In Production trước picking
  shippedAt?: ISODateTime;
  deliveredAt?: ISODateTime;
  completedAt?: ISODateTime; // D12: tự động sau giao + hết hạn đổi/trả
  cancelledAt?: ISODateTime;
  /** Tài chính. */
  subtotal: VND;
  shippingFee: VND;
  taxTotal: VND; // D8: VAT theo cấu hình
  discountTotal: VND;
  grandTotal: VND;
  amountPaid: VND;
  currency: Currency;
  appliedVoucherCode?: string;
  /** Giao hàng. */
  shippingAddress: AddressVN;
  recipientName: string;
  recipientPhone: string;
  selectedShippingMethodId?: ID;
  shippingOptions: ShippingMethodOption[];
  /** Thanh toán. */
  paymentMethodType: PaymentMethodType;
  paymentTransactionId?: ID;
  /** Fulfillment. */
  fulfillmentWarehouseId: WarehouseId;
  shipmentIds: ID[];
  isMixedOrder: boolean; // hàng thường + in ấn (D9 split shipment)
  lines: OrderLine[];
  cancelReason?: string;
  /** Sale tạo đơn hộ (00: Sales Staff). */
  createdById?: string;
  /** Treo chờ duyệt ưu đãi vượt hạn mức Sale (14 edge case, F4). */
  pendingDiscountApproval: boolean;
  notes?: string;
}

export const carts: Cart[] = [
  {
    cartId: "CART-0034",
    customerId: "CUS-0005",
    isGuest: false,
    status: "Converted",
    subtotal: 298000,
    itemCount: 2,
    currency: "VND",
    createdAt: "2026-05-26T10:00:00+07:00",
    updatedAt: "2026-05-26T10:00:00+07:00",
    convertedToOrderId: "ORD-2026-0019",
    lines: [
      {
        lineId: "CARTL-0019-1",
        cartId: "CART-0034",
        skuId: "SKU-001-BLK-M",
        productId: "PRD-001",
        quantity: 2,
        unitPrice: 149000,
        lineTotal: 298000,
        addedAt: "2026-05-26T10:00:00+07:00",
        inStock: true,
      },
    ],
  },
  {
    cartId: "CART-0035",
    customerId: "CUS-0010",
    isGuest: false,
    status: "Converted",
    subtotal: 447000,
    itemCount: 4,
    currency: "VND",
    createdAt: "2026-06-08T14:00:00+07:00",
    updatedAt: "2026-06-08T14:00:00+07:00",
    convertedToOrderId: "ORD-2026-0018",
    lines: [
      {
        lineId: "CARTL-0018-1",
        cartId: "CART-0035",
        skuId: "SKU-002-WHT",
        productId: "PRD-002",
        quantity: 3,
        unitPrice: 89000,
        lineTotal: 267000,
        addedAt: "2026-06-08T14:00:00+07:00",
        inStock: true,
      },
      {
        lineId: "CARTL-0018-2",
        cartId: "CART-0035",
        skuId: "SKU-001-WHT-L",
        productId: "PRD-001",
        quantity: 1,
        unitPrice: 180000,
        lineTotal: 180000,
        addedAt: "2026-06-08T14:00:00+07:00",
        inStock: true,
      },
    ],
  },
  {
    cartId: "CART-0036",
    customerId: "CUS-0009",
    isGuest: false,
    status: "Converted",
    subtotal: 636000,
    itemCount: 2,
    currency: "VND",
    createdAt: "2026-06-11T09:00:00+07:00",
    updatedAt: "2026-06-11T09:00:00+07:00",
    convertedToOrderId: "ORD-2026-0017",
    lines: [
      {
        lineId: "CARTL-0017-1",
        cartId: "CART-0036",
        skuId: "SKU-004-BLK-L",
        productId: "PRD-004",
        quantity: 1,
        unitPrice: 499000,
        lineTotal: 499000,
        addedAt: "2026-06-11T09:00:00+07:00",
        inStock: true,
      },
      {
        lineId: "CARTL-0017-2",
        cartId: "CART-0036",
        skuId: "SKU-001-BLK-M",
        productId: "PRD-001",
        quantity: 1,
        unitPrice: 137000,
        lineTotal: 137000,
        addedAt: "2026-06-11T09:00:00+07:00",
        inStock: true,
      },
    ],
  },
  {
    cartId: "CART-0033",
    customerId: "CUS-0007",
    isGuest: false,
    status: "Converted",
    subtotal: 89000,
    itemCount: 1,
    currency: "VND",
    createdAt: "2026-06-01T09:00:00+07:00",
    updatedAt: "2026-06-01T09:00:00+07:00",
    convertedToOrderId: "ORD-2026-0016",
    lines: [
      {
        lineId: "CARTL-0016-1",
        cartId: "CART-0033",
        skuId: "SKU-002-WHT",
        productId: "PRD-002",
        quantity: 1,
        unitPrice: 89000,
        lineTotal: 89000,
        addedAt: "2026-06-01T09:00:00+07:00",
        inStock: true,
      },
    ],
  },
  {
    cartId: "CART-0032",
    customerId: "CUS-0004",
    isGuest: false,
    status: "Converted",
    subtotal: 149000,
    itemCount: 1,
    currency: "VND",
    createdAt: "2026-06-09T10:00:00+07:00",
    updatedAt: "2026-06-09T10:00:00+07:00",
    convertedToOrderId: "ORD-2026-0015",
    lines: [
      {
        lineId: "CARTL-0015-1",
        cartId: "CART-0032",
        skuId: "SKU-001-WHT-L",
        productId: "PRD-001",
        quantity: 1,
        unitPrice: 149000,
        lineTotal: 149000,
        addedAt: "2026-06-09T10:00:00+07:00",
        inStock: true,
      },
    ],
  },
  {
    cartId: "CART-0031",
    customerId: "CUS-0012",
    isGuest: false,
    status: "Converted",
    subtotal: 298000,
    itemCount: 3,
    currency: "VND",
    createdAt: "2026-06-12T21:00:00+07:00",
    updatedAt: "2026-06-12T21:00:00+07:00",
    convertedToOrderId: "ORD-2026-0014",
    lines: [
      {
        lineId: "CARTL-0014-1",
        cartId: "CART-0031",
        skuId: "SKU-001-BLK-L",
        productId: "PRD-001",
        quantity: 2,
        unitPrice: 149000,
        designId: "DSN-2026-0031",
        designThumbnail: "/mock/design/dsn-0031-v1.png",
        lineTotal: 298000,
        addedAt: "2026-06-12T21:00:00+07:00",
        inStock: true,
      },
      {
        lineId: "CARTL-0014-2",
        cartId: "CART-0031",
        skuId: "SKU-002-WHT",
        productId: "PRD-002",
        quantity: 1,
        unitPrice: 89000,
        designId: "DSN-2026-0030",
        designThumbnail: "/mock/design/dsn-0030-v2.png",
        lineTotal: 89000,
        addedAt: "2026-06-12T21:00:00+07:00",
        inStock: true,
      },
    ],
  },
  {
    cartId: "CART-0026",
    customerId: "CUS-0009",
    isGuest: false,
    status: "Converted",
    subtotal: 745000,
    itemCount: 5,
    appliedVoucherCode: "FREESHIP",
    currency: "VND",
    createdAt: "2026-06-12T08:00:00+07:00",
    updatedAt: "2026-06-12T08:00:00+07:00",
    convertedToOrderId: "ORD-2026-0013",
    lines: [
      {
        lineId: "CARTL-0013-1",
        cartId: "CART-0026",
        skuId: "SKU-001-BLK-M",
        productId: "PRD-001",
        quantity: 5,
        unitPrice: 149000,
        lineTotal: 745000,
        addedAt: "2026-06-12T08:00:00+07:00",
        inStock: true,
      },
    ],
  },
  {
    cartId: "CART-0025",
    customerId: "CUS-0004",
    isGuest: false,
    status: "Converted",
    subtotal: 89000,
    itemCount: 1,
    currency: "VND",
    createdAt: "2026-06-11T22:00:00+07:00",
    updatedAt: "2026-06-11T22:00:00+07:00",
    convertedToOrderId: "ORD-2026-0012",
    lines: [
      {
        lineId: "CARTL-0012-1",
        cartId: "CART-0025",
        skuId: "SKU-002-WHT",
        productId: "PRD-002",
        quantity: 1,
        unitPrice: 89000,
        lineTotal: 89000,
        addedAt: "2026-06-11T22:00:00+07:00",
        inStock: true,
      },
    ],
  },
  {
    cartId: "CART-0024",
    customerId: "CUS-0008",
    isGuest: false,
    status: "Converted",
    subtotal: 267000,
    itemCount: 3,
    currency: "VND",
    createdAt: "2026-06-11T10:00:00+07:00",
    updatedAt: "2026-06-11T10:00:00+07:00",
    convertedToOrderId: "ORD-2026-0011",
    lines: [
      {
        lineId: "CARTL-0011-1",
        cartId: "CART-0024",
        skuId: "SKU-002-WHT",
        productId: "PRD-002",
        quantity: 3,
        unitPrice: 89000,
        designId: "DSN-2026-0028",
        designThumbnail: "/mock/design/dsn-0028-v1.png",
        lineTotal: 267000,
        addedAt: "2026-06-11T10:00:00+07:00",
        inStock: true,
      },
    ],
  },
  {
    cartId: "CART-0029",
    customerId: "CUS-0008",
    isGuest: false,
    status: "Converted",
    subtotal: 447000,
    itemCount: 14,
    appliedVoucherCode: "HE2026",
    currency: "VND",
    createdAt: "2026-06-11T09:00:00+07:00",
    updatedAt: "2026-06-11T09:00:00+07:00",
    convertedToOrderId: "ORD-2026-0010",
    lines: [
      {
        lineId: "CARTL-0010-1",
        cartId: "CART-0029",
        skuId: "SKU-002-WHT",
        productId: "PRD-002",
        quantity: 4,
        unitPrice: 89000,
        designId: "DSN-2026-0028",
        designThumbnail: "/mock/design/dsn-0028-v1.png",
        lineTotal: 356000,
        addedAt: "2026-06-11T09:00:00+07:00",
        inStock: true,
      },
      {
        lineId: "CARTL-0010-2",
        cartId: "CART-0029",
        skuId: "SKU-003-WHT-L",
        productId: "PRD-003",
        quantity: 10,
        unitPrice: 42000,
        lineTotal: 420000,
        addedAt: "2026-06-11T09:00:00+07:00",
        inStock: true,
      },
    ],
  },
  {
    cartId: "CART-0023",
    customerId: "CUS-0011",
    isGuest: false,
    status: "Converted",
    subtotal: 894000,
    itemCount: 6,
    currency: "VND",
    createdAt: "2026-06-10T15:00:00+07:00",
    updatedAt: "2026-06-10T15:00:00+07:00",
    convertedToOrderId: "ORD-2026-0009",
    lines: [
      {
        lineId: "CARTL-0009-1",
        cartId: "CART-0023",
        skuId: "SKU-001-WHT-L",
        productId: "PRD-001",
        quantity: 6,
        unitPrice: 149000,
        designId: "DSN-2026-0022",
        designThumbnail: "/mock/design/dsn-0022-v1.png",
        lineTotal: 894000,
        addedAt: "2026-06-10T15:00:00+07:00",
        inStock: true,
      },
    ],
  },
  {
    cartId: "CART-0022",
    customerId: "CUS-0006",
    isGuest: false,
    status: "Converted",
    subtotal: 178000,
    itemCount: 2,
    currency: "VND",
    createdAt: "2026-06-10T08:00:00+07:00",
    updatedAt: "2026-06-10T08:00:00+07:00",
    convertedToOrderId: "ORD-2026-0008",
    lines: [
      {
        lineId: "CARTL-0008-1",
        cartId: "CART-0022",
        skuId: "SKU-002-WHT",
        productId: "PRD-002",
        quantity: 2,
        unitPrice: 89000,
        lineTotal: 178000,
        addedAt: "2026-06-10T08:00:00+07:00",
        inStock: true,
      },
    ],
  },
  {
    cartId: "CART-0021",
    customerId: "CUS-0005",
    isGuest: false,
    status: "Converted",
    subtotal: 578000,
    itemCount: 4,
    currency: "VND",
    createdAt: "2026-06-08T07:00:00+07:00",
    updatedAt: "2026-06-08T07:00:00+07:00",
    convertedToOrderId: "ORD-2026-0007",
    lines: [
      {
        lineId: "CARTL-0007-1",
        cartId: "CART-0021",
        skuId: "SKU-001-BLK-L",
        productId: "PRD-001",
        quantity: 3,
        unitPrice: 149000,
        designId: "DSN-2026-0025",
        designThumbnail: "/mock/design/dsn-0025-v1.png",
        lineTotal: 447000,
        addedAt: "2026-06-08T07:00:00+07:00",
        inStock: true,
      },
      {
        lineId: "CARTL-0007-2",
        cartId: "CART-0021",
        skuId: "SKU-002-WHT",
        productId: "PRD-002",
        quantity: 1,
        unitPrice: 131000,
        lineTotal: 131000,
        addedAt: "2026-06-08T07:00:00+07:00",
        inStock: true,
      },
    ],
  },
  {
    cartId: "CART-0020",
    customerId: "CUS-0007",
    isGuest: false,
    status: "Converted",
    subtotal: 79000,
    itemCount: 1,
    currency: "VND",
    createdAt: "2026-06-04T09:00:00+07:00",
    updatedAt: "2026-06-04T09:00:00+07:00",
    convertedToOrderId: "ORD-2026-0006",
    lines: [
      {
        lineId: "CARTL-0006-1",
        cartId: "CART-0020",
        skuId: "SKU-002-WHT",
        productId: "PRD-002",
        quantity: 1,
        unitPrice: 79000,
        lineTotal: 79000,
        addedAt: "2026-06-04T09:00:00+07:00",
        inStock: true,
      },
    ],
  },
  {
    cartId: "CART-0019",
    customerId: "CUS-0003",
    isGuest: false,
    status: "Converted",
    subtotal: 298000,
    itemCount: 2,
    currency: "VND",
    createdAt: "2026-06-06T08:00:00+07:00",
    updatedAt: "2026-06-06T08:00:00+07:00",
    convertedToOrderId: "ORD-2026-0005",
    lines: [
      {
        lineId: "CARTL-0005-1",
        cartId: "CART-0019",
        skuId: "SKU-001-BLK-L",
        productId: "PRD-001",
        quantity: 2,
        unitPrice: 149000,
        lineTotal: 298000,
        addedAt: "2026-06-06T08:00:00+07:00",
        inStock: true,
      },
    ],
  },
  {
    cartId: "CART-0018",
    customerId: "CUS-0002",
    isGuest: false,
    status: "Converted",
    subtotal: 447000,
    itemCount: 3,
    currency: "VND",
    createdAt: "2026-06-05T13:00:00+07:00",
    updatedAt: "2026-06-05T13:00:00+07:00",
    convertedToOrderId: "ORD-2026-0004",
    lines: [
      {
        lineId: "CARTL-0004-1",
        cartId: "CART-0018",
        skuId: "SKU-001-BLK-M",
        productId: "PRD-001",
        quantity: 3,
        unitPrice: 149000,
        lineTotal: 447000,
        addedAt: "2026-06-05T13:00:00+07:00",
        inStock: true,
      },
    ],
  },
  {
    cartId: "CART-0017",
    customerId: "CUS-0013",
    isGuest: false,
    status: "Converted",
    subtotal: 199000,
    itemCount: 1,
    currency: "VND",
    createdAt: "2026-05-28T09:00:00+07:00",
    updatedAt: "2026-05-28T09:00:00+07:00",
    convertedToOrderId: "ORD-2026-0003",
    lines: [
      {
        lineId: "CARTL-0003-1",
        cartId: "CART-0017",
        skuId: "SKU-001-BLK-L",
        productId: "PRD-001",
        quantity: 1,
        unitPrice: 199000,
        lineTotal: 199000,
        addedAt: "2026-05-28T09:00:00+07:00",
        inStock: true,
      },
    ],
  },
  {
    cartId: "CART-0016",
    customerId: "CUS-0001",
    isGuest: false,
    status: "Converted",
    subtotal: 149000,
    itemCount: 1,
    currency: "VND",
    createdAt: "2026-06-01T10:00:00+07:00",
    updatedAt: "2026-06-01T10:00:00+07:00",
    convertedToOrderId: "ORD-2026-0002",
    lines: [
      {
        lineId: "CARTL-0002-1",
        cartId: "CART-0016",
        skuId: "SKU-001-BLK-L",
        productId: "PRD-001",
        quantity: 1,
        unitPrice: 149000,
        lineTotal: 149000,
        addedAt: "2026-06-01T10:00:00+07:00",
        inStock: true,
      },
    ],
  },
  {
    cartId: "CART-0030",
    customerId: "CUS-0010",
    isGuest: false,
    status: "Converted",
    subtotal: 89000,
    itemCount: 1,
    currency: "VND",
    createdAt: "2026-06-01T19:30:00+07:00",
    updatedAt: "2026-06-01T19:30:00+07:00",
    convertedToOrderId: "ORD-2026-0001",
    lines: [
      {
        lineId: "CARTL-0001-1",
        cartId: "CART-0030",
        skuId: "SKU-002-WHT",
        productId: "PRD-002",
        quantity: 1,
        unitPrice: 89000,
        designId: "DSN-2026-0030",
        designThumbnail: "/mock/design/dsn-0030-v2.png",
        lineTotal: 89000,
        addedAt: "2026-06-01T19:30:00+07:00",
        inStock: true,
      },
    ],
  },
  {
    cartId: "CART-0015",
    customerId: "CUS-0003",
    isGuest: false,
    status: "Converted",
    subtotal: 267000,
    itemCount: 3,
    currency: "VND",
    createdAt: "2026-05-30T11:00:00+07:00",
    updatedAt: "2026-05-30T11:00:00+07:00",
    convertedToOrderId: "ORD-2026-0000",
    lines: [
      {
        lineId: "CARTL-0000-1",
        cartId: "CART-0015",
        skuId: "SKU-002-WHT",
        productId: "PRD-002",
        quantity: 3,
        unitPrice: 89000,
        lineTotal: 267000,
        addedAt: "2026-05-30T11:00:00+07:00",
        inStock: true,
      },
    ],
  },
  {
    // Active + voucher + dòng hết tồn → chặn checkout (14 edge case)
    cartId: "CART-0037",
    customerId: "CUS-0008",
    isGuest: false,
    status: "Active",
    subtotal: 447000,
    itemCount: 4,
    appliedVoucherCode: "HE2026",
    currency: "VND",
    createdAt: "2026-06-12T21:05:00+07:00",
    updatedAt: "2026-06-12T21:20:00+07:00",
    expiresAt: "2026-06-15T21:05:00+07:00",
    lines: [
      {
        lineId: "CARTL-0037-1",
        cartId: "CART-0037",
        skuId: "SKU-001-BLK-L",
        productId: "PRD-001",
        quantity: 2,
        unitPrice: 149000,
        designId: "DSN-2026-0028",
        designThumbnail: "/mock/design/dsn-0028-v1.png",
        lineTotal: 298000,
        addedAt: "2026-06-12T21:05:00+07:00",
        inStock: true,
      },
      {
        lineId: "CARTL-0037-2",
        cartId: "CART-0037",
        skuId: "SKU-002-WHT",
        productId: "PRD-002",
        quantity: 1,
        unitPrice: 89000,
        lineTotal: 89000,
        addedAt: "2026-06-12T21:15:00+07:00",
        inStock: true,
      },
      {
        lineId: "CARTL-0037-3",
        cartId: "CART-0037",
        skuId: "SKU-001-NVY-XL",
        productId: "PRD-001",
        quantity: 1,
        unitPrice: 60000,
        lineTotal: 60000,
        addedAt: "2026-06-12T21:18:00+07:00",
        inStock: false,
      },
    ],
  },
  {
    // Abandoned — quá hạn không thao tác (14)
    cartId: "CART-0038",
    customerId: "CUS-0006",
    isGuest: false,
    status: "Abandoned",
    subtotal: 289000,
    itemCount: 1,
    currency: "VND",
    createdAt: "2026-05-28T20:00:00+07:00",
    updatedAt: "2026-05-28T20:10:00+07:00",
    expiresAt: "2026-05-31T20:00:00+07:00",
    lines: [
      {
        lineId: "CARTL-0038-1",
        cartId: "CART-0038",
        skuId: "SKU-004-BLK-L",
        productId: "PRD-004",
        quantity: 1,
        unitPrice: 289000,
        lineTotal: 289000,
        addedAt: "2026-05-28T20:00:00+07:00",
        inStock: true,
      },
    ],
  },
  {
    // Guest cart Merged vào cart tài khoản sau đăng nhập (14 / D6)
    cartId: "CART-0039",
    customerId: "guest-7f3a",
    isGuest: true,
    status: "Merged",
    subtotal: 79000,
    itemCount: 1,
    currency: "VND",
    createdAt: "2026-06-09T18:00:00+07:00",
    updatedAt: "2026-06-09T18:30:00+07:00",
    mergedIntoCartId: "CART-0040",
    lines: [
      {
        lineId: "CARTL-0039-1",
        cartId: "CART-0039",
        skuId: "SKU-002-WHT",
        productId: "PRD-002",
        quantity: 1,
        unitPrice: 79000,
        lineTotal: 79000,
        addedAt: "2026-06-09T18:00:00+07:00",
        inStock: true,
      },
    ],
  },
  {
    // Cart tài khoản nhận gộp từ guest (Active)
    cartId: "CART-0040",
    customerId: "CUS-0011",
    isGuest: false,
    status: "Active",
    subtotal: 79000,
    itemCount: 1,
    currency: "VND",
    createdAt: "2026-06-09T18:30:00+07:00",
    updatedAt: "2026-06-09T18:31:00+07:00",
    expiresAt: "2026-06-12T18:30:00+07:00",
    lines: [
      {
        lineId: "CARTL-0040-1",
        cartId: "CART-0040",
        skuId: "SKU-002-WHT",
        productId: "PRD-002",
        quantity: 1,
        unitPrice: 79000,
        lineTotal: 79000,
        addedAt: "2026-06-09T18:30:00+07:00",
        inStock: true,
      },
    ],
  },
];

export const orders: Order[] = [
  {
    orderId: "ORD-2026-0019",
    orderNumber: "ORD-2026-0019",
    customerId: "CUS-0005",
    cartId: "CART-0034",
    status: "Completed",
    placedAt: "2026-05-26T10:00:00+07:00",
    confirmedAt: "2026-05-26T10:05:00+07:00",
    shippedAt: "2026-05-27T10:00:00+07:00",
    deliveredAt: "2026-05-29T14:00:00+07:00",
    completedAt: "2026-06-05T14:00:00+07:00",
    subtotal: 298000,
    shippingFee: 25000,
    taxTotal: 25840,
    discountTotal: 0,
    grandTotal: 348840,
    amountPaid: 348840,
    currency: "VND",
    shippingAddress: {
      street: "15 Quang Trung",
      ward: "Phường Quang Trung",
      district: "Quận Hà Đông",
      province: "Hà Nội",
      postalCode: "121000",
      country: "VN",
    },
    recipientName: "Vũ Đức Long",
    recipientPhone: "+84 966 777 888",
    selectedShippingMethodId: "SHIPM-GHN-STD",
    shippingOptions: [
      {
        methodId: "SHIPM-GHN-STD",
        carrierId: "CAR-GHN",
        service: "standard",
        label: "GHN Tiêu chuẩn",
        fee: 25000,
        estimatedDays: 3,
        selected: true,
      },
    ],
    paymentMethodType: "Credit Card",
    paymentTransactionId: "PAY-2026-0041",
    fulfillmentWarehouseId: "WH-HN-01",
    shipmentIds: ["SHP-2026-0090"],
    isMixedOrder: false,
    lines: [
      {
        lineId: "ORDL-0019-1",
        orderId: "ORD-2026-0019",
        skuId: "SKU-001-BLK-M",
        productId: "PRD-001",
        productName: "Áo Thun Cotton Cao Cấp",
        variantLabel: "Đen / M",
        quantity: 2,
        unitPrice: 149000,
        lineTotal: 298000,
        fulfillmentStatus: "completed",
      },
    ],
    pendingDiscountApproval: false,
  },
  {
    orderId: "ORD-2026-0018",
    orderNumber: "ORD-2026-0018",
    customerId: "CUS-0010",
    cartId: "CART-0035",
    status: "In Transit",
    placedAt: "2026-06-08T14:00:00+07:00",
    confirmedAt: "2026-06-08T14:05:00+07:00",
    shippedAt: "2026-06-09T09:00:00+07:00",
    subtotal: 447000,
    shippingFee: 30000,
    taxTotal: 38160,
    discountTotal: 0,
    grandTotal: 515160,
    amountPaid: 515160,
    currency: "VND",
    shippingAddress: {
      street: "22 Trần Hưng Đạo",
      ward: "Phường Phạm Ngũ Lão",
      district: "Quận 1",
      province: "TP. Hồ Chí Minh",
      postalCode: "710000",
      country: "VN",
    },
    recipientName: "Nguyễn Hoài Nam",
    recipientPhone: "+84 908 111 222",
    selectedShippingMethodId: "SHIPM-VTP-EXP",
    shippingOptions: [
      {
        methodId: "SHIPM-VTP-EXP",
        carrierId: "CAR-VTP",
        service: "express",
        label: "Viettel Post Nhanh",
        fee: 30000,
        estimatedDays: 2,
        selected: true,
      },
    ],
    paymentMethodType: "VNPay",
    paymentTransactionId: "PAY-2026-0042",
    fulfillmentWarehouseId: "WH-HCM-01",
    shipmentIds: ["SHP-2026-0092"],
    isMixedOrder: false,
    lines: [
      {
        lineId: "ORDL-0018-1",
        orderId: "ORD-2026-0018",
        skuId: "SKU-002-WHT",
        productId: "PRD-002",
        productName: "Cốc Sứ In Ảnh 350ml",
        variantLabel: "Trắng",
        quantity: 3,
        unitPrice: 89000,
        lineTotal: 267000,
        fulfillmentStatus: "shipped",
      },
      {
        lineId: "ORDL-0018-2",
        orderId: "ORD-2026-0018",
        skuId: "SKU-001-WHT-L",
        productId: "PRD-001",
        productName: "Áo Thun Cotton Cao Cấp",
        variantLabel: "Trắng / M",
        quantity: 1,
        unitPrice: 180000,
        lineTotal: 180000,
        fulfillmentStatus: "shipped",
      },
    ],
    pendingDiscountApproval: false,
  },
  {
    orderId: "ORD-2026-0017",
    orderNumber: "ORD-2026-0017",
    customerId: "CUS-0009",
    cartId: "CART-0036",
    status: "Picking",
    placedAt: "2026-06-11T09:00:00+07:00",
    confirmedAt: "2026-06-11T09:05:00+07:00",
    subtotal: 636000,
    shippingFee: 25000,
    taxTotal: 52880,
    discountTotal: 0,
    grandTotal: 713880,
    amountPaid: 713880,
    currency: "VND",
    shippingAddress: {
      street: "12 Lê Trọng Tấn",
      ward: "Phường Khương Mai",
      district: "Quận Thanh Xuân",
      province: "Hà Nội",
      postalCode: "115000",
      country: "VN",
    },
    recipientName: "Nguyễn Văn Đạt",
    recipientPhone: "+84 916 123 456",
    selectedShippingMethodId: "SHIPM-GHN-STD",
    shippingOptions: [
      {
        methodId: "SHIPM-GHN-STD",
        carrierId: "CAR-GHN",
        service: "standard",
        label: "GHN Tiêu chuẩn",
        fee: 25000,
        estimatedDays: 3,
        selected: true,
      },
    ],
    paymentMethodType: "MoMo",
    paymentTransactionId: "PAY-2026-0043",
    fulfillmentWarehouseId: "WH-HN-01",
    shipmentIds: [],
    isMixedOrder: false,
    lines: [
      {
        lineId: "ORDL-0017-1",
        orderId: "ORD-2026-0017",
        skuId: "SKU-004-BLK-L",
        productId: "PRD-004",
        productName: "Hoodie Thêu Logo Cao Cấp",
        variantLabel: "Đen / L",
        quantity: 1,
        unitPrice: 499000,
        lineTotal: 499000,
        fulfillmentStatus: "picking",
      },
      {
        lineId: "ORDL-0017-2",
        orderId: "ORD-2026-0017",
        skuId: "SKU-001-BLK-M",
        productId: "PRD-001",
        productName: "Áo Thun Cotton Cao Cấp",
        variantLabel: "Đen / M",
        quantity: 1,
        unitPrice: 137000,
        lineTotal: 137000,
        fulfillmentStatus: "picking",
      },
    ],
    pendingDiscountApproval: false,
  },
  {
    orderId: "ORD-2026-0016",
    orderNumber: "ORD-2026-0016",
    customerId: "CUS-0007",
    cartId: "CART-0033",
    status: "Delivered",
    placedAt: "2026-06-01T09:00:00+07:00",
    confirmedAt: "2026-06-01T09:05:00+07:00",
    shippedAt: "2026-06-02T09:00:00+07:00",
    deliveredAt: "2026-06-04T15:00:00+07:00",
    subtotal: 89000,
    shippingFee: 30000,
    taxTotal: 9520,
    discountTotal: 0,
    grandTotal: 128520,
    amountPaid: 128520,
    currency: "VND",
    shippingAddress: {
      street: "60 Trần Phú",
      ward: "Phường Lộc Thọ",
      district: "Thành phố Nha Trang",
      province: "Khánh Hòa",
      postalCode: "650000",
      country: "VN",
    },
    recipientName: "Bùi Thanh Hà",
    recipientPhone: "+84 905 333 777",
    selectedShippingMethodId: "SHIPM-GHN-STD",
    shippingOptions: [
      {
        methodId: "SHIPM-GHN-STD",
        carrierId: "CAR-GHN",
        service: "standard",
        label: "GHN Tiêu chuẩn",
        fee: 30000,
        estimatedDays: 3,
        selected: true,
      },
    ],
    paymentMethodType: "Credit Card",
    paymentTransactionId: "PAY-2026-0026",
    fulfillmentWarehouseId: "WH-HCM-01",
    shipmentIds: ["SHP-2026-0085"],
    isMixedOrder: false,
    lines: [
      {
        lineId: "ORDL-0016-1",
        orderId: "ORD-2026-0016",
        skuId: "SKU-002-WHT",
        productId: "PRD-002",
        productName: "Cốc Sứ In Ảnh 350ml",
        variantLabel: "Trắng",
        quantity: 1,
        unitPrice: 89000,
        lineTotal: 89000,
        fulfillmentStatus: "delivered",
      },
    ],
    pendingDiscountApproval: false,
  },
  {
    orderId: "ORD-2026-0015",
    orderNumber: "ORD-2026-0015",
    customerId: "CUS-0004",
    cartId: "CART-0032",
    status: "Cancelled",
    placedAt: "2026-06-09T10:00:00+07:00",
    confirmedAt: "2026-06-09T10:05:00+07:00",
    cancelledAt: "2026-06-09T16:00:00+07:00",
    subtotal: 149000,
    shippingFee: 25000,
    taxTotal: 13920,
    discountTotal: 0,
    grandTotal: 187920,
    amountPaid: 0,
    currency: "VND",
    shippingAddress: {
      street: "9 Quang Trung",
      ward: "Phường 10",
      district: "Quận Gò Vấp",
      province: "TP. Hồ Chí Minh",
      postalCode: "714000",
      country: "VN",
    },
    recipientName: "Lê Thị Mai",
    recipientPhone: "+84 934 567 890",
    selectedShippingMethodId: "SHIPM-GHN-STD",
    shippingOptions: [
      {
        methodId: "SHIPM-GHN-STD",
        carrierId: "CAR-GHN",
        service: "standard",
        label: "GHN Tiêu chuẩn",
        fee: 25000,
        estimatedDays: 3,
        selected: true,
      },
    ],
    paymentMethodType: "COD",
    fulfillmentWarehouseId: "WH-HCM-01",
    shipmentIds: [],
    isMixedOrder: false,
    notes: "Khách gọi huỷ trước khi kho xử lý — hoàn COD về 0 (17: Cancelled)",
    lines: [
      {
        lineId: "ORDL-0015-1",
        orderId: "ORD-2026-0015",
        skuId: "SKU-001-WHT-L",
        productId: "PRD-001",
        productName: "Áo Thun Cotton Cao Cấp",
        variantLabel: "Trắng / L",
        quantity: 1,
        unitPrice: 149000,
        lineTotal: 149000,
        fulfillmentStatus: "pending",
      },
    ],
    pendingDiscountApproval: false,
  },
  {
    orderId: "ORD-2026-0014",
    orderNumber: "ORD-2026-0014",
    customerId: "CUS-0012",
    cartId: "CART-0031",
    status: "Pending Payment",
    placedAt: "2026-06-12T21:00:00+07:00",
    subtotal: 298000,
    shippingFee: 30000,
    taxTotal: 23840,
    discountTotal: 0,
    grandTotal: 351840,
    amountPaid: 0,
    currency: "VND",
    shippingAddress: {
      street: "45 Nguyễn Trãi",
      ward: "Phường Bến Thành",
      district: "Quận 1",
      province: "TP. Hồ Chí Minh",
      postalCode: "710000",
      country: "VN",
    },
    recipientName: "Trần Thị Bích",
    recipientPhone: "+84 909 222 333",
    selectedShippingMethodId: "SHIPM-GHN-STD",
    shippingOptions: [
      {
        methodId: "SHIPM-GHN-STD",
        carrierId: "CAR-GHN",
        service: "standard",
        label: "GHN Tiêu chuẩn (2–3 ngày)",
        fee: 30000,
        estimatedDays: 3,
        selected: true,
      },
      {
        methodId: "SHIPM-GHN-EXP",
        carrierId: "CAR-GHN",
        service: "express",
        label: "GHN Nhanh (1 ngày)",
        fee: 48000,
        estimatedDays: 1,
        selected: false,
      },
    ],
    paymentMethodType: "VNPay",
    paymentTransactionId: "PAY-2026-0040",
    fulfillmentWarehouseId: "WH-HN-01",
    shipmentIds: [],
    isMixedOrder: true,
    lines: [
      {
        lineId: "ORDL-0014-1",
        orderId: "ORD-2026-0014",
        skuId: "SKU-001-BLK-L",
        productId: "PRD-001",
        productName: "Áo Thun Cotton Cao Cấp",
        variantLabel: "Đen / L",
        quantity: 2,
        unitPrice: 149000,
        designId: "DSN-2026-0031",
        designSnapshotUrl: "/mock/design/dsn-0031-v1.png",
        lineTotal: 298000,
        fulfillmentStatus: "pending",
      },
      {
        lineId: "ORDL-0014-2",
        orderId: "ORD-2026-0014",
        skuId: "SKU-002-WHT",
        productId: "PRD-002",
        productName: "Cốc Sứ In Ảnh 350ml",
        variantLabel: "Trắng",
        quantity: 1,
        unitPrice: 89000,
        designId: "DSN-2026-0030",
        designSnapshotUrl: "/mock/design/dsn-0030-v2.png",
        lineTotal: 89000,
        fulfillmentStatus: "pending",
      },
    ],
    pendingDiscountApproval: false,
    notes: "Đơn mixed (áo in + cốc) — có thể tách kiện (D9).",
  },
  {
    orderId: "ORD-2026-0013",
    orderNumber: "ORD-2026-0013",
    customerId: "CUS-0009",
    cartId: "CART-0026",
    status: "Confirmed",
    placedAt: "2026-06-12T08:00:00+07:00",
    confirmedAt: "2026-06-12T08:05:00+07:00",
    subtotal: 745000,
    shippingFee: 0,
    taxTotal: 59600,
    discountTotal: 0,
    grandTotal: 804600,
    amountPaid: 804600,
    currency: "VND",
    appliedVoucherCode: "FREESHIP",
    shippingAddress: {
      street: "12 Lê Trọng Tấn",
      ward: "Phường Khương Mai",
      district: "Quận Thanh Xuân",
      province: "Hà Nội",
      postalCode: "115000",
      country: "VN",
    },
    recipientName: "Nguyễn Văn Đạt",
    recipientPhone: "+84 916 123 456",
    selectedShippingMethodId: "SHIPM-GHTK-ECO",
    shippingOptions: [
      {
        methodId: "SHIPM-GHTK-ECO",
        carrierId: "CAR-GHTK",
        service: "economy",
        label: "GHTK Tiết kiệm",
        fee: 0,
        estimatedDays: 4,
        selected: true,
      },
    ],
    paymentMethodType: "Credit Card",
    paymentTransactionId: "PAY-2026-0038",
    fulfillmentWarehouseId: "WH-HN-01",
    shipmentIds: [],
    isMixedOrder: false,
    lines: [
      {
        lineId: "ORDL-0013-1",
        orderId: "ORD-2026-0013",
        skuId: "SKU-001-BLK-M",
        productId: "PRD-001",
        productName: "Áo Thun Cotton Cao Cấp",
        variantLabel: "Đen / M",
        quantity: 5,
        unitPrice: 149000,
        lineTotal: 745000,
        fulfillmentStatus: "pending",
      },
    ],
    pendingDiscountApproval: false,
  },
  {
    orderId: "ORD-2026-0012",
    orderNumber: "ORD-2026-0012",
    customerId: "CUS-0004",
    cartId: "CART-0025",
    status: "Payment Failed",
    placedAt: "2026-06-11T22:00:00+07:00",
    subtotal: 89000,
    shippingFee: 25000,
    taxTotal: 7120,
    discountTotal: 0,
    grandTotal: 121120,
    amountPaid: 0,
    currency: "VND",
    shippingAddress: {
      street: "9 Quang Trung",
      ward: "Phường 10",
      district: "Quận Gò Vấp",
      province: "TP. Hồ Chí Minh",
      postalCode: "714000",
      country: "VN",
    },
    recipientName: "Lê Thị Mai",
    recipientPhone: "+84 934 567 890",
    shippingOptions: [
      {
        methodId: "SHIPM-GHN-STD",
        carrierId: "CAR-GHN",
        service: "standard",
        label: "GHN Tiêu chuẩn",
        fee: 25000,
        estimatedDays: 3,
        selected: true,
      },
    ],
    paymentMethodType: "MoMo",
    paymentTransactionId: "PAY-2026-0037",
    fulfillmentWarehouseId: "WH-HCM-01",
    shipmentIds: [],
    isMixedOrder: false,
    lines: [
      {
        lineId: "ORDL-0012-1",
        orderId: "ORD-2026-0012",
        skuId: "SKU-002-WHT",
        productId: "PRD-002",
        productName: "Cốc Sứ In Ảnh 350ml",
        variantLabel: "Trắng",
        quantity: 1,
        unitPrice: 89000,
        lineTotal: 89000,
        fulfillmentStatus: "pending",
      },
    ],
    pendingDiscountApproval: false,
    notes: "MoMo từ chối — chờ khách thử lại.",
  },
  {
    orderId: "ORD-2026-0011",
    orderNumber: "ORD-2026-0011",
    customerId: "CUS-0008",
    cartId: "CART-0024",
    status: "In Production",
    placedAt: "2026-06-11T10:00:00+07:00",
    confirmedAt: "2026-06-11T10:05:00+07:00",
    productionStartedAt: "2026-06-11T13:00:00+07:00",
    subtotal: 267000,
    shippingFee: 32000,
    taxTotal: 21360,
    discountTotal: 0,
    grandTotal: 320360,
    amountPaid: 320360,
    currency: "VND",
    shippingAddress: {
      street: "302 Nguyễn Văn Cừ",
      ward: "Phường An Hòa",
      district: "Quận Ninh Kiều",
      province: "Cần Thơ",
      postalCode: "940000",
      country: "VN",
    },
    recipientName: "Phạm Thu Trang",
    recipientPhone: "+84 977 444 555",
    selectedShippingMethodId: "SHIPM-VTP-STD",
    shippingOptions: [
      {
        methodId: "SHIPM-VTP-STD",
        carrierId: "CAR-VTP",
        service: "standard",
        label: "Viettel Post Tiêu chuẩn",
        fee: 32000,
        estimatedDays: 3,
        selected: true,
      },
    ],
    paymentMethodType: "COD",
    fulfillmentWarehouseId: "WH-HCM-01",
    shipmentIds: [],
    isMixedOrder: false,
    lines: [
      {
        lineId: "ORDL-0011-1",
        orderId: "ORD-2026-0011",
        skuId: "SKU-002-WHT",
        productId: "PRD-002",
        productName: "Cốc Sứ In Ảnh 350ml",
        variantLabel: "Trắng",
        quantity: 3,
        unitPrice: 89000,
        designId: "DSN-2026-0028",
        designSnapshotUrl: "/mock/design/dsn-0028-v1.png",
        lineTotal: 267000,
        fulfillmentStatus: "in-production",
      },
    ],
    pendingDiscountApproval: false,
    notes: "Đang in — B1: QC kiểm thành phẩm trước fulfill.",
  },
  {
    orderId: "ORD-2026-0010",
    orderNumber: "ORD-2026-0010",
    customerId: "CUS-0008",
    cartId: "CART-0029",
    status: "Ready to Fulfill",
    placedAt: "2026-06-11T09:00:00+07:00",
    confirmedAt: "2026-06-11T09:05:00+07:00",
    productionStartedAt: "2026-06-11T09:30:00+07:00",
    subtotal: 447000,
    shippingFee: 0,
    taxTotal: 35760,
    discountTotal: 67050,
    grandTotal: 415710,
    amountPaid: 415710,
    currency: "VND",
    appliedVoucherCode: "HE2026",
    shippingAddress: {
      street: "302 Nguyễn Văn Cừ",
      ward: "Phường An Hòa",
      district: "Quận Ninh Kiều",
      province: "Cần Thơ",
      postalCode: "940000",
      country: "VN",
    },
    recipientName: "Phạm Thu Trang",
    recipientPhone: "+84 977 444 555",
    selectedShippingMethodId: "SHIPM-GHN-STD",
    shippingOptions: [
      {
        methodId: "SHIPM-GHN-STD",
        carrierId: "CAR-GHN",
        service: "standard",
        label: "GHN Tiêu chuẩn",
        fee: 0,
        estimatedDays: 3,
        selected: true,
      },
    ],
    paymentMethodType: "VNPay",
    paymentTransactionId: "PAY-2026-0035",
    fulfillmentWarehouseId: "WH-HCM-01",
    shipmentIds: [],
    isMixedOrder: true,
    lines: [
      {
        lineId: "ORDL-0010-1",
        orderId: "ORD-2026-0010",
        skuId: "SKU-002-WHT",
        productId: "PRD-002",
        productName: "Cốc Sứ In Ảnh 350ml",
        variantLabel: "Trắng",
        quantity: 4,
        unitPrice: 89000,
        designId: "DSN-2026-0028",
        designSnapshotUrl: "/mock/design/dsn-0028-v1.png",
        lineTotal: 356000,
        fulfillmentStatus: "pending",
      },
      {
        lineId: "ORDL-0010-2",
        orderId: "ORD-2026-0010",
        skuId: "SKU-003-WHT-L",
        productId: "PRD-003",
        productName: "Phôi Áo Thun Trơn Gildan 64000",
        variantLabel: "Trắng / L",
        quantity: 10,
        unitPrice: 42000,
        lineTotal: 420000,
        fulfillmentStatus: "pending",
      },
    ],
    pendingDiscountApproval: false,
  },
  {
    orderId: "ORD-2026-0009",
    orderNumber: "ORD-2026-0009",
    customerId: "CUS-0011",
    cartId: "CART-0023",
    status: "Partially Fulfilled",
    placedAt: "2026-06-10T15:00:00+07:00",
    confirmedAt: "2026-06-10T15:05:00+07:00",
    subtotal: 894000,
    shippingFee: 30000,
    taxTotal: 71520,
    discountTotal: 0,
    grandTotal: 995520,
    amountPaid: 995520,
    currency: "VND",
    shippingAddress: {
      street: "60 Trần Phú",
      ward: "Phường Lộc Thọ",
      district: "Thành phố Nha Trang",
      province: "Khánh Hòa",
      postalCode: "650000",
      country: "VN",
    },
    recipientName: "Bùi Thanh Hà",
    recipientPhone: "+84 905 333 777",
    selectedShippingMethodId: "SHIPM-GHN-STD",
    shippingOptions: [
      {
        methodId: "SHIPM-GHN-STD",
        carrierId: "CAR-GHN",
        service: "standard",
        label: "GHN Tiêu chuẩn",
        fee: 30000,
        estimatedDays: 3,
        selected: true,
      },
    ],
    paymentMethodType: "Credit Card",
    paymentTransactionId: "PAY-2026-0033",
    fulfillmentWarehouseId: "WH-HN-01",
    shipmentIds: ["SHP-2026-0040"],
    isMixedOrder: false,
    lines: [
      {
        lineId: "ORDL-0009-1",
        orderId: "ORD-2026-0009",
        skuId: "SKU-001-WHT-L",
        productId: "PRD-001",
        productName: "Áo Thun Cotton Cao Cấp",
        variantLabel: "Trắng / L",
        quantity: 6,
        unitPrice: 149000,
        designId: "DSN-2026-0022",
        designSnapshotUrl: "/mock/design/dsn-0022-v1.png",
        lineTotal: 894000,
        fulfillmentStatus: "picked",
      },
    ],
    pendingDiscountApproval: false,
    notes: "Pick Short 2 — chờ kiểm kê (PICK-2026-0205).",
  },
  {
    orderId: "ORD-2026-0008",
    orderNumber: "ORD-2026-0008",
    customerId: "CUS-0006",
    cartId: "CART-0022",
    status: "Delivery Failed",
    placedAt: "2026-06-10T08:00:00+07:00",
    confirmedAt: "2026-06-10T08:05:00+07:00",
    subtotal: 178000,
    shippingFee: 28000,
    taxTotal: 14240,
    discountTotal: 0,
    grandTotal: 220240,
    amountPaid: 0,
    currency: "VND",
    shippingAddress: {
      street: "99 Lạch Tray",
      ward: "Phường Lạch Tray",
      district: "Quận Ngô Quyền",
      province: "Hải Phòng",
      postalCode: "043000",
      country: "VN",
    },
    recipientName: "Hoàng Văn Sỹ",
    recipientPhone: "+84 933 222 111",
    selectedShippingMethodId: "SHIPM-VTP-STD",
    shippingOptions: [
      {
        methodId: "SHIPM-VTP-STD",
        carrierId: "CAR-VTP",
        service: "standard",
        label: "Viettel Post Tiêu chuẩn",
        fee: 28000,
        estimatedDays: 3,
        selected: true,
      },
    ],
    paymentMethodType: "COD",
    fulfillmentWarehouseId: "WH-HN-01",
    shipmentIds: ["SHP-2026-0065", "SHP-2026-0060", "SHP-2026-0045"],
    isMixedOrder: false,
    lines: [
      {
        lineId: "ORDL-0008-1",
        orderId: "ORD-2026-0008",
        skuId: "SKU-002-WHT",
        productId: "PRD-002",
        productName: "Cốc Sứ In Ảnh 350ml",
        variantLabel: "Trắng",
        quantity: 2,
        unitPrice: 89000,
        lineTotal: 178000,
        fulfillmentStatus: "packed",
      },
    ],
    pendingDiscountApproval: false,
  },
  {
    orderId: "ORD-2026-0007",
    orderNumber: "ORD-2026-0007",
    customerId: "CUS-0005",
    cartId: "CART-0021",
    status: "Shipped",
    placedAt: "2026-06-08T07:00:00+07:00",
    confirmedAt: "2026-06-08T07:05:00+07:00",
    shippedAt: "2026-06-08T10:00:00+07:00",
    subtotal: 578000,
    shippingFee: 32000,
    taxTotal: 46240,
    discountTotal: 0,
    grandTotal: 656240,
    amountPaid: 656240,
    currency: "VND",
    shippingAddress: {
      street: "15 Quang Trung",
      ward: "Phường Quang Trung",
      district: "Quận Hà Đông",
      province: "Hà Nội",
      postalCode: "121000",
      country: "VN",
    },
    recipientName: "Vũ Đức Long",
    recipientPhone: "+84 966 777 888",
    selectedShippingMethodId: "SHIPM-GHN-STD",
    shippingOptions: [
      {
        methodId: "SHIPM-GHN-STD",
        carrierId: "CAR-GHN",
        service: "standard",
        label: "GHN Tiêu chuẩn",
        fee: 32000,
        estimatedDays: 3,
        selected: true,
      },
    ],
    paymentMethodType: "Credit Card",
    paymentTransactionId: "PAY-2026-0029",
    fulfillmentWarehouseId: "WH-HN-01",
    shipmentIds: ["SHP-2026-0070"],
    isMixedOrder: false,
    lines: [
      {
        lineId: "ORDL-0007-1",
        orderId: "ORD-2026-0007",
        skuId: "SKU-001-BLK-L",
        productId: "PRD-001",
        productName: "Áo Thun Cotton Cao Cấp",
        variantLabel: "Đen / L",
        quantity: 3,
        unitPrice: 149000,
        designId: "DSN-2026-0025",
        designSnapshotUrl: "/mock/design/dsn-0025-v1.png",
        lineTotal: 447000,
        fulfillmentStatus: "shipped",
      },
      {
        lineId: "ORDL-0007-2",
        orderId: "ORD-2026-0007",
        skuId: "SKU-002-WHT",
        productId: "PRD-002",
        productName: "Cốc Sứ In Ảnh 350ml",
        variantLabel: "Trắng",
        quantity: 1,
        unitPrice: 131000,
        lineTotal: 131000,
        fulfillmentStatus: "shipped",
      },
    ],
    pendingDiscountApproval: false,
  },
  {
    orderId: "ORD-2026-0006",
    orderNumber: "ORD-2026-0006",
    customerId: "CUS-0007",
    cartId: "CART-0020",
    status: "On Hold",
    placedAt: "2026-06-04T09:00:00+07:00",
    subtotal: 79000,
    shippingFee: 30000,
    taxTotal: 6320,
    discountTotal: 0,
    grandTotal: 115320,
    amountPaid: 0,
    currency: "VND",
    shippingAddress: {
      street: "88 Hùng Vương",
      ward: "Phường 9",
      district: "Quận 5",
      province: "TP. Hồ Chí Minh",
      postalCode: "726000",
      country: "VN",
    },
    recipientName: "Ngô Thị Mai",
    recipientPhone: "+84 929 444 666",
    shippingOptions: [
      {
        methodId: "SHIPM-GHN-STD",
        carrierId: "CAR-GHN",
        service: "standard",
        label: "GHN Tiêu chuẩn",
        fee: 30000,
        estimatedDays: 3,
        selected: true,
      },
    ],
    paymentMethodType: "Bank Transfer",
    fulfillmentWarehouseId: "WH-HCM-01",
    shipmentIds: ["SHP-2026-0035"],
    isMixedOrder: false,
    cancelReason: "Khách huỷ trước thanh toán",
    lines: [
      {
        lineId: "ORDL-0006-1",
        orderId: "ORD-2026-0006",
        skuId: "SKU-002-WHT",
        productId: "PRD-002",
        productName: "Cốc Sứ In Ảnh 350ml",
        variantLabel: "Trắng",
        quantity: 1,
        unitPrice: 79000,
        lineTotal: 79000,
        fulfillmentStatus: "pending",
      },
    ],
    pendingDiscountApproval: false,
  },
  {
    orderId: "ORD-2026-0005",
    orderNumber: "ORD-2026-0005",
    customerId: "CUS-0003",
    cartId: "CART-0019",
    status: "Packed",
    placedAt: "2026-06-06T08:00:00+07:00",
    confirmedAt: "2026-06-06T08:05:00+07:00",
    subtotal: 298000,
    shippingFee: 45000,
    taxTotal: 23840,
    discountTotal: 0,
    grandTotal: 366840,
    amountPaid: 0,
    currency: "VND",
    shippingAddress: {
      street: "120 Lê Duẩn",
      ward: "Phường Hải Châu 1",
      district: "Quận Hải Châu",
      province: "Đà Nẵng",
      postalCode: "511000",
      country: "VN",
    },
    recipientName: "Lê Minh Châu",
    recipientPhone: "+84 912 888 999",
    selectedShippingMethodId: "SHIPM-VTP-EXP",
    shippingOptions: [
      {
        methodId: "SHIPM-VTP-EXP",
        carrierId: "CAR-VTP",
        service: "express",
        label: "Viettel Post Nhanh",
        fee: 45000,
        estimatedDays: 2,
        selected: true,
      },
    ],
    paymentMethodType: "COD",
    fulfillmentWarehouseId: "WH-HN-01",
    shipmentIds: ["SHP-2026-0087"],
    isMixedOrder: false,
    lines: [
      {
        lineId: "ORDL-0005-1",
        orderId: "ORD-2026-0005",
        skuId: "SKU-001-BLK-L",
        productId: "PRD-001",
        productName: "Áo Thun Cotton Cao Cấp",
        variantLabel: "Đen / L",
        quantity: 2,
        unitPrice: 149000,
        lineTotal: 298000,
        fulfillmentStatus: "packed",
      },
    ],
    pendingDiscountApproval: false,
  },
  {
    orderId: "ORD-2026-0004",
    orderNumber: "ORD-2026-0004",
    customerId: "CUS-0002",
    cartId: "CART-0018",
    status: "Return Requested",
    placedAt: "2026-06-05T13:00:00+07:00",
    confirmedAt: "2026-06-05T13:05:00+07:00",
    shippedAt: "2026-06-05T15:00:00+07:00",
    deliveredAt: "2026-06-07T16:00:00+07:00",
    subtotal: 447000,
    shippingFee: 25000,
    taxTotal: 35760,
    discountTotal: 0,
    grandTotal: 507760,
    amountPaid: 507760,
    currency: "VND",
    shippingAddress: {
      street: "78 Cầu Giấy",
      ward: "Phường Quan Hoa",
      district: "Quận Cầu Giấy",
      province: "Hà Nội",
      postalCode: "113000",
      country: "VN",
    },
    recipientName: "Nguyễn Hoài Nam",
    recipientPhone: "+84 908 111 222",
    selectedShippingMethodId: "SHIPM-GHN-STD",
    shippingOptions: [
      {
        methodId: "SHIPM-GHN-STD",
        carrierId: "CAR-GHN",
        service: "standard",
        label: "GHN Tiêu chuẩn",
        fee: 25000,
        estimatedDays: 3,
        selected: true,
      },
    ],
    paymentMethodType: "Credit Card",
    paymentTransactionId: "PAY-2026-0022",
    fulfillmentWarehouseId: "WH-HN-01",
    shipmentIds: ["SHP-2026-0088"],
    isMixedOrder: false,
    lines: [
      {
        lineId: "ORDL-0004-1",
        orderId: "ORD-2026-0004",
        skuId: "SKU-001-BLK-M",
        productId: "PRD-001",
        productName: "Áo Thun Cotton Cao Cấp",
        variantLabel: "Đen / M",
        quantity: 3,
        unitPrice: 149000,
        lineTotal: 447000,
        fulfillmentStatus: "delivered",
      },
    ],
    pendingDiscountApproval: false,
  },
  {
    orderId: "ORD-2026-0003",
    orderNumber: "ORD-2026-0003",
    customerId: "CUS-0013",
    cartId: "CART-0017",
    status: "Closed",
    placedAt: "2026-05-28T09:00:00+07:00",
    confirmedAt: "2026-05-28T09:05:00+07:00",
    shippedAt: "2026-05-28T17:00:00+07:00",
    deliveredAt: "2026-05-30T14:00:00+07:00",
    completedAt: "2026-06-06T14:00:00+07:00",
    subtotal: 199000,
    shippingFee: 32000,
    taxTotal: 15920,
    discountTotal: 0,
    grandTotal: 246920,
    amountPaid: 246920,
    currency: "VND",
    shippingAddress: {
      street: "210 Điện Biên Phủ",
      ward: "Phường 17",
      district: "Quận Bình Thạnh",
      province: "TP. Hồ Chí Minh",
      postalCode: "723000",
      country: "VN",
    },
    recipientName: "Đặng Thuỳ Linh",
    recipientPhone: "+84 918 555 222",
    selectedShippingMethodId: "SHIPM-GHN-STD",
    shippingOptions: [
      {
        methodId: "SHIPM-GHN-STD",
        carrierId: "CAR-GHN",
        service: "standard",
        label: "GHN Tiêu chuẩn",
        fee: 32000,
        estimatedDays: 3,
        selected: true,
      },
    ],
    paymentMethodType: "VNPay",
    paymentTransactionId: "PAY-2026-0015",
    fulfillmentWarehouseId: "WH-HCM-01",
    shipmentIds: [],
    isMixedOrder: false,
    lines: [
      {
        lineId: "ORDL-0003-1",
        orderId: "ORD-2026-0003",
        skuId: "SKU-001-BLK-L",
        productId: "PRD-001",
        productName: "Áo Thun Cotton Cao Cấp",
        variantLabel: "Đen / L",
        quantity: 1,
        unitPrice: 199000,
        lineTotal: 199000,
        fulfillmentStatus: "delivered",
      },
    ],
    pendingDiscountApproval: false,
    notes: "Tự động Completed sau 7 ngày giao + hết hạn đổi/trả (D12).",
  },
  {
    orderId: "ORD-2026-0002",
    orderNumber: "ORD-2026-0002",
    customerId: "CUS-0001",
    cartId: "CART-0016",
    status: "Returned",
    placedAt: "2026-06-01T10:00:00+07:00",
    confirmedAt: "2026-06-01T10:05:00+07:00",
    shippedAt: "2026-06-03T17:00:00+07:00",
    deliveredAt: "2026-06-05T11:00:00+07:00",
    subtotal: 149000,
    shippingFee: 25000,
    taxTotal: 11920,
    discountTotal: 0,
    grandTotal: 185920,
    amountPaid: 185920,
    currency: "VND",
    shippingAddress: {
      street: "5 Lê Lợi",
      ward: "Phường Vĩnh Ninh",
      district: "Thành phố Huế",
      province: "Thừa Thiên Huế",
      postalCode: "471000",
      country: "VN",
    },
    recipientName: "Trịnh Công Sơn",
    recipientPhone: "+84 917 000 111",
    selectedShippingMethodId: "SHIPM-GHTK-ECO",
    shippingOptions: [
      {
        methodId: "SHIPM-GHTK-ECO",
        carrierId: "CAR-GHTK",
        service: "economy",
        label: "GHTK Tiết kiệm",
        fee: 25000,
        estimatedDays: 4,
        selected: true,
      },
    ],
    paymentMethodType: "Credit Card",
    paymentTransactionId: "PAY-2026-0010",
    fulfillmentWarehouseId: "WH-HN-01",
    shipmentIds: ["SHP-2026-0080"],
    isMixedOrder: false,
    lines: [
      {
        lineId: "ORDL-0002-1",
        orderId: "ORD-2026-0002",
        skuId: "SKU-001-BLK-L",
        productId: "PRD-001",
        productName: "Áo Thun Cotton Cao Cấp",
        variantLabel: "Đen / L",
        quantity: 1,
        unitPrice: 149000,
        lineTotal: 149000,
        fulfillmentStatus: "returned",
      },
    ],
    pendingDiscountApproval: false,
    notes: "RMA-2026-0004 — lỗi sản xuất, khách hoàn (B4).",
  },
  {
    orderId: "ORD-2026-0001",
    orderNumber: "ORD-2026-0001",
    customerId: "CUS-0010",
    cartId: "CART-0030",
    status: "Refunded",
    placedAt: "2026-06-01T19:30:00+07:00",
    confirmedAt: "2026-06-01T19:35:00+07:00",
    shippedAt: "2026-06-02T16:00:00+07:00",
    deliveredAt: "2026-06-04T10:00:00+07:00",
    subtotal: 89000,
    shippingFee: 30000,
    taxTotal: 7120,
    discountTotal: 0,
    grandTotal: 126120,
    amountPaid: 0,
    currency: "VND",
    shippingAddress: {
      street: "22 Trần Hưng Đạo",
      ward: "Phường Phạm Ngũ Lão",
      district: "Quận 1",
      province: "TP. Hồ Chí Minh",
      postalCode: "710000",
      country: "VN",
    },
    recipientName: "Nguyễn Hoài Nam",
    recipientPhone: "+84 908 111 222",
    selectedShippingMethodId: "SHIPM-JT-STD",
    shippingOptions: [
      {
        methodId: "SHIPM-JT-STD",
        carrierId: "CAR-JT",
        service: "standard",
        label: "J&T Tiêu chuẩn",
        fee: 30000,
        estimatedDays: 3,
        selected: true,
      },
    ],
    paymentMethodType: "MoMo",
    paymentTransactionId: "PAY-2026-0005",
    fulfillmentWarehouseId: "WH-HCM-01",
    shipmentIds: ["SHP-2026-0075"],
    isMixedOrder: false,
    lines: [
      {
        lineId: "ORDL-0001-1",
        orderId: "ORD-2026-0001",
        skuId: "SKU-002-WHT",
        productId: "PRD-002",
        productName: "Cốc Sứ In Ảnh 350ml",
        variantLabel: "Trắng",
        quantity: 1,
        unitPrice: 89000,
        designId: "DSN-2026-0030",
        designSnapshotUrl: "/mock/design/dsn-0030-v2.png",
        lineTotal: 89000,
        fulfillmentStatus: "delivered",
      },
    ],
    pendingDiscountApproval: false,
    notes: "Hoàn tiền toàn bộ do cốc vỡ khi giao — PAY-2026-0005 Refunded.",
  },
  {
    orderId: "ORD-2026-0000",
    orderNumber: "ORD-2026-0000",
    customerId: "CUS-0003",
    cartId: "CART-0015",
    status: "Partially Refunded",
    placedAt: "2026-05-30T11:00:00+07:00",
    confirmedAt: "2026-05-30T11:05:00+07:00",
    shippedAt: "2026-06-01T10:00:00+07:00",
    deliveredAt: "2026-06-01T16:30:00+07:00",
    subtotal: 267000,
    shippingFee: 55000,
    taxTotal: 21360,
    discountTotal: 0,
    grandTotal: 343360,
    amountPaid: 89000,
    currency: "VND",
    shippingAddress: {
      street: "210 Điện Biên Phủ",
      ward: "Phường 17",
      district: "Quận Bình Thạnh",
      province: "TP. Hồ Chí Minh",
      postalCode: "723000",
      country: "VN",
    },
    recipientName: "Đặng Thuỳ Linh",
    recipientPhone: "+84 918 555 222",
    selectedShippingMethodId: "SHIPM-GHN-SAMEDAY",
    shippingOptions: [
      {
        methodId: "SHIPM-GHN-SAMEDAY",
        carrierId: "CAR-GHN",
        service: "same-day",
        label: "GHN Trong ngày",
        fee: 55000,
        estimatedDays: 0,
        selected: true,
      },
    ],
    paymentMethodType: "ZaloPay",
    paymentTransactionId: "PAY-2026-0003",
    fulfillmentWarehouseId: "WH-HCM-01",
    shipmentIds: ["SHP-2026-0050"],
    isMixedOrder: false,
    lines: [
      {
        lineId: "ORDL-0000-1",
        orderId: "ORD-2026-0000",
        skuId: "SKU-002-WHT",
        productId: "PRD-002",
        productName: "Cốc Sứ In Ảnh 350ml",
        variantLabel: "Trắng",
        quantity: 3,
        unitPrice: 89000,
        lineTotal: 267000,
        fulfillmentStatus: "delivered",
      },
    ],
    pendingDiscountApproval: false,
    notes: "1/3 cốc vỡ → hoàn một phần 89.000₫ (PAY-2026-0003 Partially Refunded).",
  },
];

/* ============================================================================
 * MODULE 15 — PAYMENT (ecommerce/15-payment)
 * ==========================================================================*/

/** Vòng đời giao dịch thanh toán (15). */
export type PaymentTransactionStatus =
  | "Initiated"
  | "Awaiting Confirmation"
  | "Authorized"
  | "Captured"
  | "Failed"
  | "Cancelled"
  | "Voided"
  | "Refunded"
  | "Partially Refunded";

/** Trạng thái nghĩa vụ thanh toán của đơn (15 — góc nhìn Order). */
export type PaymentObligationStatus =
  | "Unpaid"
  | "Pending (COD)"
  | "Partially Paid"
  | "Paid"
  | "Refunded"
  | "Partially Refunded"
  | "Failed";

/** Phương thức thanh toán. */
// ASSUMPTION (open-question D1): danh sách phương thức cụ thể chưa chốt; mock tập phổ biến VN.
export type PaymentMethodType =
  "Credit Card" | "Debit Card" | "VNPay" | "MoMo" | "ZaloPay" | "Bank Transfer" | "COD" | "Deposit";

/** Luồng authorize–capture (D2). */
export type PaymentFlow = "authorize-capture" | "direct-capture";

export interface PaymentTransaction {
  transactionId: ID; // PAY-2026-xxxx
  orderId: ID;
  customerId: ID;
  methodType: PaymentMethodType;
  gatewayRef?: string; // mã giao dịch cổng
  status: PaymentTransactionStatus;
  flow: PaymentFlow;
  amount: VND;
  currency: Currency;
  /** COD (D3). */
  codCollected?: boolean;
  /** Đặt cọc (D4): % cọc, phần còn lại thu khi nào. */
  depositPercent?: number;
  remainingDue?: VND;
  initiatedAt?: ISODateTime;
  authorizedAt?: ISODateTime;
  capturedAt?: ISODateTime;
  refundedAt?: ISODateTime;
  refundedAmount?: VND;
  failureReason?: string;
  /** Chuyển khoản thủ công: thông tin tài khoản + nội dung = mã đơn. */
  bankAccount?: { bankName: string; accountNumber: string; accountName: string; content: string };
  /** PCI-DSS: chỉ 4 số cuối + brand, KHÔNG lưu full PAN. */
  cardBrand?: "Visa" | "Mastercard" | "JCB" | "Napas";
  cardLast4?: string;
  /** Tham chiếu phương thức đã lưu (SavedPaymentMethod) dùng cho giao dịch. */
  savedMethodId?: ID;
  /** Mã tham chiếu phía nhà cung cấp (ví/cổng) — phân biệt gatewayRef. */
  providerRef?: string;
  obligationStatus: PaymentObligationStatus;
}

export interface SavedPaymentMethod {
  savedMethodId: ID;
  customerId: ID;
  type: PaymentMethodType;
  cardBrand?: "Visa" | "Mastercard" | "JCB" | "Napas";
  cardLast4?: string;
  expiry?: string; // MM/YY
  walletLabel?: string; // "MoMo 0909***222"
  isDefault: boolean;
  addedAt: ISODateTime;
}

export const paymentTransactions: PaymentTransaction[] = [
  {
    transactionId: "PAY-2026-0041",
    orderId: "ORD-2026-0019",
    customerId: "CUS-0005",
    methodType: "Credit Card",
    status: "Captured",
    flow: "authorize-capture",
    amount: 348840,
    currency: "VND",
    savedMethodId: "SPM-0005-1",
    providerRef: "VNPAY-20260526-33001",
    authorizedAt: "2026-05-26T10:05:00+07:00",
    capturedAt: "2026-05-26T10:06:00+07:00",
    obligationStatus: "Paid",
  },
  {
    transactionId: "PAY-2026-0042",
    orderId: "ORD-2026-0018",
    customerId: "CUS-0010",
    methodType: "VNPay",
    status: "Captured",
    flow: "direct-capture",
    amount: 515160,
    currency: "VND",
    providerRef: "VNPAY-20260608-55020",
    initiatedAt: "2026-06-08T14:05:00+07:00",
    capturedAt: "2026-06-08T14:06:00+07:00",
    obligationStatus: "Paid",
  },
  {
    transactionId: "PAY-2026-0043",
    orderId: "ORD-2026-0017",
    customerId: "CUS-0009",
    methodType: "MoMo",
    status: "Captured",
    flow: "direct-capture",
    amount: 713880,
    currency: "VND",
    providerRef: "MOMO-20260611-70031",
    initiatedAt: "2026-06-11T09:05:00+07:00",
    capturedAt: "2026-06-11T09:05:30+07:00",
    obligationStatus: "Paid",
  },
  {
    transactionId: "PAY-2026-0026",
    orderId: "ORD-2026-0016",
    customerId: "CUS-0007",
    methodType: "Credit Card",
    status: "Captured",
    flow: "authorize-capture",
    amount: 128520,
    currency: "VND",
    savedMethodId: "SPM-0007-1",
    providerRef: "VNPAY-20260601-88112",
    authorizedAt: "2026-06-01T09:05:00+07:00",
    capturedAt: "2026-06-01T09:06:00+07:00",
    obligationStatus: "Paid",
  },
  {
    transactionId: "PAY-2026-0040",
    orderId: "ORD-2026-0014",
    customerId: "CUS-0012",
    methodType: "VNPay",
    gatewayRef: "VNP-20260612-889001",
    status: "Initiated",
    flow: "direct-capture",
    amount: 351840,
    currency: "VND",
    initiatedAt: "2026-06-12T21:00:00+07:00",
    obligationStatus: "Unpaid",
  },
  {
    transactionId: "PAY-2026-0039",
    orderId: "ORD-2026-0013",
    customerId: "CUS-0009",
    methodType: "Bank Transfer",
    status: "Awaiting Confirmation",
    flow: "direct-capture",
    amount: 804600,
    currency: "VND",
    initiatedAt: "2026-06-12T08:00:00+07:00",
    bankAccount: {
      bankName: "Vietcombank",
      accountNumber: "1018293746",
      accountName: "CONG TY CP STOCKFLOWCOMMERCE",
      content: "ORD-2026-0013",
    },
    obligationStatus: "Unpaid",
  },
  {
    transactionId: "PAY-2026-0038",
    orderId: "ORD-2026-0013",
    customerId: "CUS-0009",
    methodType: "Credit Card",
    gatewayRef: "VNPAY-CC-778213",
    status: "Captured",
    flow: "authorize-capture",
    amount: 804600,
    currency: "VND",
    initiatedAt: "2026-06-12T08:00:00+07:00",
    authorizedAt: "2026-06-12T08:01:00+07:00",
    capturedAt: "2026-06-12T08:05:00+07:00",
    cardBrand: "Visa",
    cardLast4: "4242",
    obligationStatus: "Paid",
  },
  {
    transactionId: "PAY-2026-0037",
    orderId: "ORD-2026-0012",
    customerId: "CUS-0004",
    methodType: "MoMo",
    gatewayRef: "MOMO-20260611-334",
    status: "Failed",
    flow: "direct-capture",
    amount: 121120,
    currency: "VND",
    initiatedAt: "2026-06-11T22:00:00+07:00",
    failureReason: "Số dư ví không đủ",
    obligationStatus: "Failed",
  },
  {
    transactionId: "PAY-2026-0036",
    orderId: "ORD-2026-0011",
    customerId: "CUS-0008",
    methodType: "COD",
    status: "Initiated",
    flow: "direct-capture",
    amount: 320360,
    currency: "VND",
    codCollected: false,
    initiatedAt: "2026-06-11T10:00:00+07:00",
    obligationStatus: "Pending (COD)",
  },
  {
    transactionId: "PAY-2026-0035",
    orderId: "ORD-2026-0010",
    customerId: "CUS-0008",
    methodType: "VNPay",
    gatewayRef: "VNP-20260611-776002",
    status: "Captured",
    flow: "direct-capture",
    amount: 415710,
    currency: "VND",
    initiatedAt: "2026-06-11T09:00:00+07:00",
    capturedAt: "2026-06-11T09:05:00+07:00",
    obligationStatus: "Paid",
  },
  {
    transactionId: "PAY-2026-0034",
    orderId: "ORD-2026-0009",
    customerId: "CUS-0011",
    methodType: "Deposit",
    status: "Authorized",
    flow: "authorize-capture",
    amount: 995520,
    currency: "VND",
    depositPercent: 0.5,
    remainingDue: 497760,
    initiatedAt: "2026-06-10T15:00:00+07:00",
    authorizedAt: "2026-06-10T15:05:00+07:00",
    obligationStatus: "Partially Paid",
  },
  {
    transactionId: "PAY-2026-0033",
    orderId: "ORD-2026-0009",
    customerId: "CUS-0011",
    methodType: "Credit Card",
    gatewayRef: "VNPAY-CC-778210",
    status: "Captured",
    flow: "authorize-capture",
    amount: 995520,
    currency: "VND",
    initiatedAt: "2026-06-10T15:00:00+07:00",
    authorizedAt: "2026-06-10T15:01:00+07:00",
    capturedAt: "2026-06-10T15:05:00+07:00",
    cardBrand: "Mastercard",
    cardLast4: "8888",
    obligationStatus: "Paid",
  },
  {
    transactionId: "PAY-2026-0030",
    orderId: "ORD-2026-0008",
    customerId: "CUS-0006",
    methodType: "COD",
    status: "Initiated",
    flow: "direct-capture",
    amount: 220240,
    currency: "VND",
    codCollected: false,
    initiatedAt: "2026-06-10T08:00:00+07:00",
    obligationStatus: "Pending (COD)",
  },
  {
    transactionId: "PAY-2026-0029",
    orderId: "ORD-2026-0007",
    customerId: "CUS-0005",
    methodType: "Credit Card",
    gatewayRef: "VNPAY-CC-778199",
    status: "Captured",
    flow: "authorize-capture",
    amount: 656240,
    currency: "VND",
    initiatedAt: "2026-06-08T07:00:00+07:00",
    authorizedAt: "2026-06-08T07:01:00+07:00",
    capturedAt: "2026-06-08T10:00:00+07:00",
    cardBrand: "Visa",
    cardLast4: "1881",
    obligationStatus: "Paid",
  },
  {
    transactionId: "PAY-2026-0022",
    orderId: "ORD-2026-0004",
    customerId: "CUS-0002",
    methodType: "Credit Card",
    gatewayRef: "VNPAY-CC-778150",
    status: "Captured",
    flow: "direct-capture",
    amount: 507760,
    currency: "VND",
    initiatedAt: "2026-06-05T13:00:00+07:00",
    capturedAt: "2026-06-05T13:05:00+07:00",
    cardBrand: "Napas",
    cardLast4: "2025",
    obligationStatus: "Paid",
  },
  {
    transactionId: "PAY-2026-0015",
    orderId: "ORD-2026-0003",
    customerId: "CUS-0013",
    methodType: "VNPay",
    gatewayRef: "VNP-20260528-665001",
    status: "Captured",
    flow: "direct-capture",
    amount: 246920,
    currency: "VND",
    initiatedAt: "2026-05-28T09:00:00+07:00",
    capturedAt: "2026-05-28T09:05:00+07:00",
    obligationStatus: "Paid",
  },
  {
    transactionId: "PAY-2026-0010",
    orderId: "ORD-2026-0002",
    customerId: "CUS-0001",
    methodType: "Credit Card",
    gatewayRef: "VNPAY-CC-778120",
    status: "Voided",
    flow: "authorize-capture",
    amount: 185920,
    currency: "VND",
    initiatedAt: "2026-06-01T10:00:00+07:00",
    authorizedAt: "2026-06-01T10:01:00+07:00",
    cardBrand: "Visa",
    cardLast4: "0010",
    obligationStatus: "Refunded",
    failureReason: "Void authorize trước capture do đơn hoàn",
  },
  {
    transactionId: "PAY-2026-0005",
    orderId: "ORD-2026-0001",
    customerId: "CUS-0010",
    methodType: "MoMo",
    gatewayRef: "MOMO-20260601-221",
    status: "Refunded",
    flow: "direct-capture",
    amount: 126120,
    currency: "VND",
    initiatedAt: "2026-06-01T19:30:00+07:00",
    capturedAt: "2026-06-01T19:35:00+07:00",
    refundedAt: "2026-06-06T09:00:00+07:00",
    refundedAmount: 126120,
    obligationStatus: "Refunded",
  },
  {
    transactionId: "PAY-2026-0003",
    orderId: "ORD-2026-0000",
    customerId: "CUS-0003",
    methodType: "ZaloPay",
    gatewayRef: "ZP-20260530-118",
    status: "Partially Refunded",
    flow: "direct-capture",
    amount: 343360,
    currency: "VND",
    initiatedAt: "2026-05-30T11:00:00+07:00",
    capturedAt: "2026-05-30T11:05:00+07:00",
    refundedAt: "2026-06-03T10:00:00+07:00",
    refundedAmount: 89000,
    obligationStatus: "Partially Refunded",
  },
  {
    transactionId: "PAY-2026-0002",
    orderId: "ORD-2026-0006",
    customerId: "CUS-0007",
    methodType: "Bank Transfer",
    status: "Cancelled",
    flow: "direct-capture",
    amount: 115320,
    currency: "VND",
    initiatedAt: "2026-06-04T09:00:00+07:00",
    obligationStatus: "Unpaid",
    failureReason: "Đơn huỷ trước khi chuyển khoản",
  },
];

export const savedPaymentMethods: SavedPaymentMethod[] = [
  {
    savedMethodId: "SPM-0001",
    customerId: "CUS-0010",
    type: "Credit Card",
    cardBrand: "Visa",
    cardLast4: "4242",
    expiry: "08/28",
    isDefault: true,
    addedAt: "2026-01-10T09:00:00+07:00",
  },
  {
    savedMethodId: "SPM-0002",
    customerId: "CUS-0010",
    type: "MoMo",
    walletLabel: "MoMo 0909***222",
    isDefault: false,
    addedAt: "2026-02-15T14:00:00+07:00",
  },
  {
    savedMethodId: "SPM-0003",
    customerId: "CUS-0008",
    type: "Credit Card",
    cardBrand: "Mastercard",
    cardLast4: "8888",
    expiry: "11/27",
    isDefault: true,
    addedAt: "2026-03-01T10:00:00+07:00",
  },
  {
    savedMethodId: "SPM-0004",
    customerId: "CUS-0011",
    type: "Debit Card",
    cardBrand: "Napas",
    cardLast4: "2025",
    expiry: "05/29",
    isDefault: true,
    addedAt: "2026-04-20T16:00:00+07:00",
  },
];

/* ============================================================================
 * MODULE 16 — SALES CHAT (ecommerce/16-sales-chat)
 * ==========================================================================*/

/** Vòng đời hội thoại (16). */
export type ConversationStatus =
  | "New"
  | "Queued"
  | "Assigned"
  | "Active"
  | "Waiting on Customer"
  | "Waiting on Internal"
  | "Escalated"
  | "Resolved"
  | "Reopened"
  | "Closed";

export type ConversationChannel = "storefront" | "product-page" | "order-page";

/** Loại bong bóng chat (16 — rich bubble card). */
export type MessageKind =
  "text" | "product-link" | "design-link" | "payment-link" | "quote" | "internal-note" | "system";

export interface Message {
  messageId: ID;
  conversationId: ID;
  senderType: "customer" | "sales" | "system";
  senderName: string;
  kind: MessageKind;
  body: string;
  /** Rich card payload (16 §5.6). */
  richPayload?: {
    productId?: ID;
    designId?: ID;
    orderId?: ID;
    quoteAmount?: VND;
    title: string;
    subtitle?: string;
    imageUrl?: string;
    ctaLabel?: string;
    ctaHref?: string;
  };
  /** Internal note chỉ Sale thấy — KHÔNG render phía khách (16 §5.6). */
  internalOnly: boolean;
  createdAt: ISODateTime;
  masked?: boolean; // che thông tin nhạy cảm trong input
  readByCustomer: boolean;
}

export interface Conversation {
  conversationId: ID;
  customerId: ID;
  assignedSalesId?: ID;
  assignedSalesName?: string;
  status: ConversationStatus;
  channel: ConversationChannel;
  subject: string;
  /** Liên kết ngữ cảnh (đơn/sản phẩm đang bàn). */
  contextOrderId?: ID;
  contextProductId?: ID;
  /** SLA (16 — quá hạn sort lên đầu hàng đợi). */
  firstResponseTargetMin: number;
  firstRespondedAt?: ISODateTime;
  lastMessageAt: ISODateTime;
  slaBreached: boolean;
  unreadBySales: number;
  unreadByCustomer: number;
  csatScore?: number; // 1–5 sau Resolved
  csatComment?: string;
  escalatedReason?: string;
  startedAt: ISODateTime;
  closedAt?: ISODateTime;
  isOffline: boolean; // ngoài giờ → hiện thời gian phản hồi dự kiến + form thu email
  offlineEmailCaptured?: string;
}

export const conversations: Conversation[] = [
  {
    conversationId: "CONV-2026-0120",
    customerId: "CUS-0012",
    assignedSalesId: "SALE-01",
    assignedSalesName: "Phan Thị Ngọc",
    status: "Active",
    channel: "product-page",
    subject: "Tư vấn in áo thun nhóm",
    contextProductId: "PRD-001",
    firstResponseTargetMin: 5,
    firstRespondedAt: "2026-06-12T20:02:00+07:00",
    lastMessageAt: "2026-06-12T20:40:00+07:00",
    slaBreached: false,
    unreadBySales: 1,
    unreadByCustomer: 0,
    startedAt: "2026-06-12T20:00:00+07:00",
    isOffline: false,
  },
  {
    conversationId: "CONV-2026-0119",
    customerId: "CUS-0011",
    assignedSalesId: "SALE-02",
    assignedSalesName: "Đỗ Quốc Huy",
    status: "Waiting on Customer",
    channel: "order-page",
    subject: "Xác nhận thiết kế đơn ORD-2026-0009",
    contextOrderId: "ORD-2026-0009",
    firstResponseTargetMin: 5,
    firstRespondedAt: "2026-06-10T15:10:00+07:00",
    lastMessageAt: "2026-06-10T15:30:00+07:00",
    slaBreached: false,
    unreadBySales: 0,
    unreadByCustomer: 2,
    startedAt: "2026-06-10T15:05:00+07:00",
    isOffline: false,
  },
  {
    conversationId: "CONV-2026-0118",
    customerId: "CUS-0007",
    status: "Queued",
    channel: "storefront",
    subject: "Hỏi về thời gian giao hàng",
    firstResponseTargetMin: 5,
    lastMessageAt: "2026-06-12T18:55:00+07:00",
    slaBreached: true,
    unreadBySales: 3,
    unreadByCustomer: 0,
    startedAt: "2026-06-12T18:50:00+07:00",
    isOffline: false,
  },
  {
    conversationId: "CONV-2026-0117",
    customerId: "CUS-0006",
    status: "New",
    channel: "product-page",
    subject: "Tư vấn hoodie thêu",
    contextProductId: "PRD-004",
    firstResponseTargetMin: 5,
    lastMessageAt: "2026-06-12T19:30:00+07:00",
    slaBreached: false,
    unreadBySales: 1,
    unreadByCustomer: 0,
    startedAt: "2026-06-12T19:30:00+07:00",
    isOffline: false,
  },
  {
    conversationId: "CONV-2026-0116",
    customerId: "CUS-0005",
    assignedSalesId: "SALE-01",
    assignedSalesName: "Phan Thị Ngọc",
    status: "Assigned",
    channel: "order-page",
    subject: "Hỗ trợ đơn ORD-2026-0007",
    contextOrderId: "ORD-2026-0007",
    firstResponseTargetMin: 5,
    lastMessageAt: "2026-06-12T17:10:00+07:00",
    slaBreached: false,
    unreadBySales: 0,
    unreadByCustomer: 1,
    startedAt: "2026-06-12T17:05:00+07:00",
    isOffline: false,
  },
  {
    conversationId: "CONV-2026-0115",
    customerId: "CUS-0008",
    assignedSalesId: "SALE-03",
    assignedSalesName: "Trần Bảo Khánh",
    status: "Waiting on Internal",
    channel: "order-page",
    subject: "Xin duyệt ưu đãi vượt hạn mức",
    contextOrderId: "ORD-2026-0010",
    firstResponseTargetMin: 5,
    firstRespondedAt: "2026-06-11T09:10:00+07:00",
    lastMessageAt: "2026-06-11T09:40:00+07:00",
    slaBreached: false,
    unreadBySales: 0,
    unreadByCustomer: 1,
    startedAt: "2026-06-11T09:05:00+07:00",
    isOffline: false,
    // F4: hạn mức ưu đãi Sale tự áp chưa chốt.
  },
  {
    conversationId: "CONV-2026-0114",
    customerId: "CUS-0001",
    assignedSalesId: "SALE-02",
    assignedSalesName: "Đỗ Quốc Huy",
    status: "Escalated",
    channel: "order-page",
    subject: "Khiếu nại áo lỗi — ORD-2026-0002",
    contextOrderId: "ORD-2026-0002",
    firstResponseTargetMin: 5,
    firstRespondedAt: "2026-06-05T11:10:00+07:00",
    lastMessageAt: "2026-06-05T11:45:00+07:00",
    slaBreached: false,
    unreadBySales: 0,
    unreadByCustomer: 0,
    escalatedReason: "Khách yêu cầu hoàn tiền — vượt quyền Sale, escalate lên Quản trị sàn",
    startedAt: "2026-06-05T11:05:00+07:00",
    isOffline: false,
  },
  {
    conversationId: "CONV-2026-0110",
    customerId: "CUS-0010",
    assignedSalesId: "SALE-01",
    assignedSalesName: "Phan Thị Ngọc",
    status: "Resolved",
    channel: "product-page",
    subject: "Tư vấn cốc in ảnh",
    contextProductId: "PRD-002",
    firstResponseTargetMin: 5,
    firstRespondedAt: "2026-06-01T18:52:00+07:00",
    lastMessageAt: "2026-06-01T19:10:00+07:00",
    slaBreached: false,
    unreadBySales: 0,
    unreadByCustomer: 0,
    csatScore: 5,
    csatComment: "Sale tư vấn nhiệt tình",
    startedAt: "2026-06-01T18:50:00+07:00",
    isOffline: false,
  },
  {
    conversationId: "CONV-2026-0108",
    customerId: "CUS-0003",
    assignedSalesId: "SALE-03",
    assignedSalesName: "Trần Bảo Khánh",
    status: "Reopened",
    channel: "order-page",
    subject: "Hỏi lại vận đơn ORD-2026-0000",
    contextOrderId: "ORD-2026-0000",
    firstResponseTargetMin: 5,
    firstRespondedAt: "2026-05-30T10:10:00+07:00",
    lastMessageAt: "2026-06-02T09:20:00+07:00",
    slaBreached: false,
    unreadBySales: 1,
    unreadByCustomer: 0,
    startedAt: "2026-05-30T10:05:00+07:00",
    isOffline: false,
  },
  {
    conversationId: "CONV-2026-0100",
    customerId: "CUS-0004",
    assignedSalesId: "SALE-02",
    assignedSalesName: "Đỗ Quốc Huy",
    status: "Closed",
    channel: "storefront",
    subject: "Tư vấn chung",
    firstResponseTargetMin: 5,
    firstRespondedAt: "2026-05-20T14:10:00+07:00",
    lastMessageAt: "2026-05-20T14:30:00+07:00",
    slaBreached: false,
    unreadBySales: 0,
    unreadByCustomer: 0,
    startedAt: "2026-05-20T14:05:00+07:00",
    closedAt: "2026-05-20T14:35:00+07:00",
    isOffline: false,
  },
  {
    conversationId: "CONV-2026-0099",
    customerId: "guest-7f3a",
    status: "Queued",
    channel: "storefront",
    subject: "Hỏi ngoài giờ làm việc",
    firstResponseTargetMin: 5,
    lastMessageAt: "2026-06-12T22:30:00+07:00",
    slaBreached: false,
    unreadBySales: 2,
    unreadByCustomer: 0,
    startedAt: "2026-06-12T22:30:00+07:00",
    isOffline: true,
    offlineEmailCaptured: "khach.le@example.vn",
    // F3: ngoài giờ → offline message + form thu email.
  },
];

export const messages: Message[] = [
  // CONV-2026-0120 — Active
  {
    messageId: "MSG-0120-1",
    conversationId: "CONV-2026-0120",
    senderType: "customer",
    senderName: "Trần Thị Bích",
    kind: "text",
    body: "Chào shop, mình muốn in áo cho team 20 người thì giá thế nào ạ?",
    internalOnly: false,
    createdAt: "2026-06-12T20:00:00+07:00",
    readByCustomer: true,
  },
  {
    messageId: "MSG-0120-2",
    conversationId: "CONV-2026-0120",
    senderType: "sales",
    senderName: "Phan Thị Ngọc",
    kind: "text",
    body: "Chào chị Bích! Với số lượng 20 áo, bên em áp giá sỉ và miễn phí thiết kế ạ. Chị xem mẫu áo thun cotton nhé:",
    internalOnly: false,
    createdAt: "2026-06-12T20:02:00+07:00",
    readByCustomer: true,
  },
  {
    messageId: "MSG-0120-3",
    conversationId: "CONV-2026-0120",
    senderType: "sales",
    senderName: "Phan Thị Ngọc",
    kind: "product-link",
    body: "",
    internalOnly: false,
    createdAt: "2026-06-12T20:03:00+07:00",
    readByCustomer: true,
    richPayload: {
      productId: "PRD-001",
      title: "Áo Thun Cotton Cao Cấp",
      subtitle: "149.000₫ · In DTG theo thiết kế",
      imageUrl: "/mock/img/prd-001-1.jpg",
      ctaLabel: "Xem sản phẩm",
      ctaHref: "/product/ao-thun-cotton-cao-cap",
    },
  },
  {
    messageId: "MSG-0120-4",
    conversationId: "CONV-2026-0120",
    senderType: "sales",
    senderName: "Phan Thị Ngọc",
    kind: "internal-note",
    body: "Khách doanh nghiệp tiềm năng — đề xuất giảm 10% nếu chốt ≥20 áo (cần duyệt vì vượt hạn mức F4).",
    internalOnly: true,
    createdAt: "2026-06-12T20:05:00+07:00",
    readByCustomer: false,
  },
  {
    messageId: "MSG-0120-5",
    conversationId: "CONV-2026-0120",
    senderType: "customer",
    senderName: "Trần Thị Bích",
    kind: "text",
    body: "Đẹp ạ. Chị gửi mẫu thiết kế giúp em nhé.",
    internalOnly: false,
    createdAt: "2026-06-12T20:40:00+07:00",
    readByCustomer: true,
  },

  // CONV-2026-0115 — Waiting on Internal (xin duyệt ưu đãi)
  {
    messageId: "MSG-0115-1",
    conversationId: "CONV-2026-0115",
    senderType: "customer",
    senderName: "Phạm Thu Trang",
    kind: "text",
    body: "Đơn của mình có voucher HE2026 mà sao chưa thấy giảm thêm?",
    internalOnly: false,
    createdAt: "2026-06-11T09:05:00+07:00",
    readByCustomer: true,
  },
  {
    messageId: "MSG-0115-2",
    conversationId: "CONV-2026-0115",
    senderType: "sales",
    senderName: "Trần Bảo Khánh",
    kind: "quote",
    body: "",
    internalOnly: false,
    createdAt: "2026-06-11T09:20:00+07:00",
    readByCustomer: false,
    richPayload: {
      orderId: "ORD-2026-0010",
      title: "Báo giá đơn ORD-2026-0010",
      subtitle: "Tạm tính 447.000₫ · Giảm HE2026 −67.050₫",
      quoteAmount: 415710,
      ctaLabel: "Xem đơn",
      ctaHref: "/orders/ORD-2026-0010",
    },
  },
  {
    messageId: "MSG-0115-3",
    conversationId: "CONV-2026-0115",
    senderType: "sales",
    senderName: "Trần Bảo Khánh",
    kind: "internal-note",
    body: "Khách xin thêm free-ship — đã gửi Quản trị sàn duyệt (vượt hạn mức Sale).",
    internalOnly: true,
    createdAt: "2026-06-11T09:40:00+07:00",
    readByCustomer: false,
  },

  // CONV-2026-0114 — Escalated (khiếu nại)
  {
    messageId: "MSG-0114-1",
    conversationId: "CONV-2026-0114",
    senderType: "customer",
    senderName: "Trịnh Công Sơn",
    kind: "text",
    body: "Áo nhận bị lệch đường in, mình muốn hoàn tiền.",
    internalOnly: false,
    createdAt: "2026-06-05T11:05:00+07:00",
    readByCustomer: true,
  },
  {
    messageId: "MSG-0114-2",
    conversationId: "CONV-2026-0114",
    senderType: "sales",
    senderName: "Đỗ Quốc Huy",
    kind: "text",
    body: "Rất xin lỗi anh! Đây là lỗi sản xuất, bên em hỗ trợ hoàn 100%. Em chuyển bộ phận xử lý ngay ạ.",
    internalOnly: false,
    createdAt: "2026-06-05T11:10:00+07:00",
    readByCustomer: true,
  },
  {
    messageId: "MSG-0114-3",
    conversationId: "CONV-2026-0114",
    senderType: "system",
    senderName: "Hệ thống",
    kind: "system",
    body: "Hội thoại được escalate lên Quản trị sàn — lý do: yêu cầu hoàn tiền vượt quyền Sale.",
    internalOnly: false,
    createdAt: "2026-06-05T11:45:00+07:00",
    readByCustomer: true,
  },

  // CONV-2026-0099 — Offline
  {
    messageId: "MSG-0099-1",
    conversationId: "CONV-2026-0099",
    senderType: "customer",
    senderName: "Khách vãng lai",
    kind: "text",
    body: "Shop còn làm việc không ạ?",
    internalOnly: false,
    createdAt: "2026-06-12T22:30:00+07:00",
    readByCustomer: true,
  },
  {
    messageId: "MSG-0099-2",
    conversationId: "CONV-2026-0099",
    senderType: "system",
    senderName: "Hệ thống",
    kind: "system",
    body: "Ngoài giờ làm việc (08:00–21:00). Chúng tôi sẽ phản hồi trước 09:00 ngày mai. Để lại email để nhận thông báo.",
    internalOnly: false,
    createdAt: "2026-06-12T22:30:00+07:00",
    readByCustomer: true,
  },
];

/* ============================================================================
 * MODULE 17 — ORDER MANAGEMENT (ecommerce/17-order-management)
 * ==========================================================================*/

/** Vòng đời đơn hàng đầy đủ (17 — nguồn đầy đủ, bao gồm nhánh fulfillment). */
export type OrderManagementStatus =
  | "Pending Payment"
  | "Payment Failed"
  | "Confirmed"
  | "In Production"
  | "On Hold"
  | "Ready to Fulfill"
  | "Picking"
  | "Partially Fulfilled"
  | "Packed"
  | "Shipped"
  | "In Transit"
  | "Delivery Failed"
  | "Delivered"
  | "Return Requested"
  | "Returned"
  | "Refunded"
  | "Partially Refunded"
  | "Completed"
  | "Cancelled"
  | "Closed";

/** Trạng thái yêu cầu đổi/trả (RMA — 17, D10). */
export type RmaStatus =
  | "Requested"
  | "Approved"
  | "Rejected"
  | "Item Received"
  | "Refund Issued"
  | "Exchange Shipped"
  | "Closed"
  | "Cancelled";

export type RmaType = "return-refund" | "exchange" | "warranty";
export type RmaReason =
  "manufacturing-defect" | "wrong-item" | "damaged-in-transit" | "change-of-mind";
// B4: sản phẩm cá nhân hoá KHÔNG đổi/trả vì đổi ý — chỉ lỗi sản xuất.

export interface OrderEvent {
  eventId: ID;
  orderId: ID;
  type: "status-change" | "amendment" | "note" | "payment" | "fulfillment" | "rma";
  fromStatus?: OrderManagementStatus;
  toStatus?: OrderManagementStatus;
  description: string;
  actor: string; // tên người hoặc "Hệ thống"
  createdAt: ISODateTime;
}

export interface OrderAmendment {
  amendmentId: ID;
  orderId: ID;
  type: "address-change" | "quantity-change" | "design-change" | "cancel";
  requestedBy: "customer" | "sales";
  status: "pending" | "approved" | "rejected" | "applied";
  beforeValue: string;
  afterValue: string;
  /** Thu thêm / hoàn bớt khi sửa đơn (17 amendment gating). */
  adjustmentAmount: VND;
  reason: string;
  createdAt: ISODateTime;
  // B5: đổi thiết kế chỉ tới khi bắt đầu sản xuất.
}

export interface RmaRequest {
  rmaId: ID;
  rmaNumber: string;
  orderId: ID;
  orderLineId: ID;
  customerId: ID;
  type: RmaType;
  reason: RmaReason;
  status: RmaStatus;
  quantity: Qty;
  customerNote: string;
  evidenceImages: string[];
  /** B4: cá nhân hoá chỉ nhận khi lỗi sản xuất. */
  isCustomizedItem: boolean;
  approvedBy?: string;
  rejectionReason?: string;
  refundAmount?: VND;
  refundTransactionId?: ID;
  exchangeShipmentId?: ID;
  returnShipmentId?: ID;
  createdAt: ISODateTime;
  resolvedAt?: ISODateTime;
}

/** Order Timeline (17 — <OrderTimeline> + <TrackingProgress>). */
export interface OrderTimelineView {
  orderId: ID;
  currentStatus: OrderManagementStatus;
  milestones: {
    label: string;
    status: "done" | "current" | "upcoming";
    at?: ISODateTime;
  }[];
  events: OrderEvent[];
}

export const orderEvents: OrderEvent[] = [
  {
    eventId: "OE-0007-1",
    orderId: "ORD-2026-0007",
    type: "status-change",
    fromStatus: "Pending Payment",
    toStatus: "Confirmed",
    description: "Thanh toán thành công (PAY-2026-0029) → đơn xác nhận",
    actor: "Hệ thống",
    createdAt: "2026-06-08T07:05:00+07:00",
  },
  {
    eventId: "OE-0007-2",
    orderId: "ORD-2026-0007",
    type: "fulfillment",
    toStatus: "Picking",
    description: "Release phiếu lấy hàng PICK-2026-0200 cho kho HN-01",
    actor: "Điều phối đơn hàng",
    createdAt: "2026-06-08T08:00:00+07:00",
  },
  {
    eventId: "OE-0007-3",
    orderId: "ORD-2026-0007",
    type: "fulfillment",
    toStatus: "Packed",
    description: "Đóng gói PACK-2026-0140, kiểm 100% đạt",
    actor: "Lý Thị Hoa",
    createdAt: "2026-06-08T09:45:00+07:00",
  },
  {
    eventId: "OE-0007-4",
    orderId: "ORD-2026-0007",
    type: "status-change",
    toStatus: "Shipped",
    description: "Bàn giao vận đơn SHP-2026-0070 (GHN)",
    actor: "Hệ thống",
    createdAt: "2026-06-08T10:00:00+07:00",
  },
  {
    eventId: "OE-0011-1",
    orderId: "ORD-2026-0011",
    type: "status-change",
    fromStatus: "Confirmed",
    toStatus: "In Production",
    description: "Bắt đầu in thành phẩm cốc (B1)",
    actor: "Xưởng in",
    createdAt: "2026-06-11T13:00:00+07:00",
  },
  {
    eventId: "OE-0009-1",
    orderId: "ORD-2026-0009",
    type: "fulfillment",
    toStatus: "Picking",
    description: "Pick Short 2/6 — chờ kiểm kê (PICK-2026-0205)",
    actor: "Nguyễn Văn Đạt",
    createdAt: "2026-06-10T16:15:00+07:00",
  },
  {
    eventId: "OE-0002-1",
    orderId: "ORD-2026-0002",
    type: "rma",
    toStatus: "Returned",
    description: "RMA-2026-0004 duyệt — hoàn tiền lỗi sản xuất",
    actor: "Quản trị sàn",
    createdAt: "2026-06-06T09:00:00+07:00",
  },
  {
    eventId: "OE-0003-1",
    orderId: "ORD-2026-0003",
    type: "status-change",
    fromStatus: "Delivered",
    toStatus: "Completed",
    description: "Tự động hoàn tất sau 7 ngày giao, hết hạn khiếu nại (D12)",
    actor: "Hệ thống",
    createdAt: "2026-06-06T14:00:00+07:00",
  },
  {
    eventId: "OE-0003-2",
    orderId: "ORD-2026-0003",
    type: "status-change",
    fromStatus: "Completed",
    toStatus: "Closed",
    description: "Đóng hoàn toàn — tài chính khớp (17)",
    actor: "Hệ thống",
    createdAt: "2026-06-08T14:00:00+07:00",
  },
];

export const orderAmendments: OrderAmendment[] = [
  {
    amendmentId: "AMD-0014-1",
    orderId: "ORD-2026-0014",
    type: "address-change",
    requestedBy: "customer",
    status: "pending",
    beforeValue: "45 Nguyễn Trãi, Q.1, TP.HCM",
    afterValue: "120 Lê Duẩn, Hải Châu, Đà Nẵng",
    adjustmentAmount: 0,
    reason: "Khách đổi địa chỉ nhận (đơn Pending Payment — sửa tự do)",
    createdAt: "2026-06-12T21:30:00+07:00",
  },
  {
    amendmentId: "AMD-0013-1",
    orderId: "ORD-2026-0013",
    type: "quantity-change",
    requestedBy: "sales",
    status: "approved",
    beforeValue: "5 áo",
    afterValue: "7 áo",
    adjustmentAmount: 298000,
    reason: "Khách đặt thêm — đơn Confirmed, thu thêm 298.000₫",
    createdAt: "2026-06-12T09:00:00+07:00",
  },
  {
    amendmentId: "AMD-0011-1",
    orderId: "ORD-2026-0011",
    type: "design-change",
    requestedBy: "customer",
    status: "rejected",
    beforeValue: "Thiết kế v1",
    afterValue: "Đổi chữ",
    adjustmentAmount: 0,
    reason: "Đã vào sản xuất (In Production) → từ chối đổi thiết kế (B5)",
    createdAt: "2026-06-11T14:00:00+07:00",
  },
  {
    amendmentId: "AMD-0009-1",
    orderId: "ORD-2026-0009",
    type: "quantity-change",
    requestedBy: "sales",
    status: "applied",
    beforeValue: "6 áo",
    afterValue: "4 áo",
    adjustmentAmount: -298000,
    reason: "Pick Short — giảm SL, hoàn bớt 298.000₫",
    createdAt: "2026-06-10T17:00:00+07:00",
  },
];

export const rmaRequests: RmaRequest[] = [
  {
    rmaId: "RMA-2026-0006",
    rmaNumber: "RMA-2026-0006",
    orderId: "ORD-2026-0008",
    orderLineId: "ORDL-0008-1",
    customerId: "CUS-0006",
    type: "return-refund",
    reason: "damaged-in-transit",
    status: "Requested",
    quantity: 1,
    customerNote: "1 cốc bị vỡ khi nhận",
    evidenceImages: ["/mock/rma/rma-0006-1.jpg"],
    isCustomizedItem: true,
    createdAt: "2026-06-09T10:00:00+07:00",
  },
  {
    rmaId: "RMA-2026-0005",
    rmaNumber: "RMA-2026-0005",
    orderId: "ORD-2026-0000",
    orderLineId: "ORDL-0000-1",
    customerId: "CUS-0003",
    type: "return-refund",
    reason: "manufacturing-defect",
    status: "Refund Issued",
    quantity: 1,
    customerNote: "Cốc in bị nhòe màu",
    evidenceImages: ["/mock/rma/rma-0005-1.jpg"],
    isCustomizedItem: true,
    approvedBy: "Quản trị sàn",
    refundAmount: 89000,
    refundTransactionId: "PAY-2026-0003",
    createdAt: "2026-06-02T09:00:00+07:00",
    resolvedAt: "2026-06-03T10:00:00+07:00",
  },
  {
    rmaId: "RMA-2026-0004",
    rmaNumber: "RMA-2026-0004",
    orderId: "ORD-2026-0002",
    orderLineId: "ORDL-0002-1",
    customerId: "CUS-0001",
    type: "return-refund",
    reason: "manufacturing-defect",
    status: "Closed",
    quantity: 1,
    customerNote: "Áo lệch đường in",
    evidenceImages: ["/mock/rma/rma-0004-1.jpg"],
    isCustomizedItem: true,
    approvedBy: "Quản trị sàn",
    refundAmount: 149000,
    returnShipmentId: "SHP-2026-0080",
    createdAt: "2026-06-05T11:00:00+07:00",
    resolvedAt: "2026-06-07T09:00:00+07:00",
  },
  {
    rmaId: "RMA-2026-0003",
    rmaNumber: "RMA-2026-0003",
    orderId: "ORD-2026-0004",
    orderLineId: "ORDL-0004-1",
    customerId: "CUS-0002",
    type: "exchange",
    reason: "wrong-item",
    status: "Approved",
    quantity: 1,
    customerNote: "Nhầm size, muốn đổi M→L",
    evidenceImages: [],
    isCustomizedItem: false,
    approvedBy: "Sales Staff",
    createdAt: "2026-06-08T14:00:00+07:00",
  },
  {
    rmaId: "RMA-2026-0002",
    rmaNumber: "RMA-2026-0002",
    orderId: "ORD-2026-0007",
    orderLineId: "ORDL-0007-1",
    customerId: "CUS-0005",
    type: "return-refund",
    reason: "change-of-mind",
    status: "Rejected",
    quantity: 1,
    customerNote: "Đổi ý không muốn mua nữa",
    evidenceImages: [],
    isCustomizedItem: true,
    approvedBy: "Quản trị sàn",
    rejectionReason: "Sản phẩm cá nhân hoá không đổi/trả vì đổi ý (B4)",
    createdAt: "2026-06-09T09:00:00+07:00",
    resolvedAt: "2026-06-09T11:00:00+07:00",
  },
  {
    rmaId: "RMA-2026-0001",
    rmaNumber: "RMA-2026-0001",
    orderId: "ORD-2026-0003",
    orderLineId: "ORDL-0003-1",
    customerId: "CUS-0013",
    type: "warranty",
    reason: "manufacturing-defect",
    status: "Item Received",
    quantity: 1,
    customerNote: "Đường chỉ may bung",
    evidenceImages: ["/mock/rma/rma-0001-1.jpg"],
    isCustomizedItem: false,
    approvedBy: "Quản trị sàn",
    returnShipmentId: "SHP-2026-0050",
    createdAt: "2026-06-07T10:00:00+07:00",
  },
  {
    rmaId: "RMA-2026-0007",
    rmaNumber: "RMA-2026-0007",
    orderId: "ORD-2026-0005",
    orderLineId: "ORDL-0005-1",
    customerId: "CUS-0003",
    type: "exchange",
    reason: "damaged-in-transit",
    status: "Exchange Shipped",
    quantity: 1,
    customerNote: "Áo bị bẩn khi giao",
    evidenceImages: [],
    isCustomizedItem: false,
    approvedBy: "Sales Staff",
    exchangeShipmentId: "SHP-2026-0087",
    createdAt: "2026-06-07T09:00:00+07:00",
  },
  {
    rmaId: "RMA-2026-0008",
    rmaNumber: "RMA-2026-0008",
    orderId: "ORD-2026-0001",
    orderLineId: "ORDL-0001-1",
    customerId: "CUS-0010",
    type: "return-refund",
    reason: "damaged-in-transit",
    status: "Cancelled",
    quantity: 1,
    customerNote: "Khách huỷ yêu cầu",
    evidenceImages: [],
    isCustomizedItem: true,
    createdAt: "2026-06-05T08:00:00+07:00",
  },
];

export const orderTimelines: OrderTimelineView[] = [
  {
    orderId: "ORD-2026-0007",
    currentStatus: "Shipped",
    milestones: [
      { label: "Đặt hàng", status: "done", at: "2026-06-08T07:00:00+07:00" },
      { label: "Xác nhận", status: "done", at: "2026-06-08T07:05:00+07:00" },
      { label: "Đang xử lý kho", status: "done", at: "2026-06-08T08:00:00+07:00" },
      { label: "Đã giao vận chuyển", status: "current", at: "2026-06-08T10:00:00+07:00" },
      { label: "Đang giao", status: "upcoming" },
      { label: "Giao thành công", status: "upcoming" },
    ],
    events: orderEvents.filter((e) => e.orderId === "ORD-2026-0007"),
  },
  {
    orderId: "ORD-2026-0011",
    currentStatus: "In Production",
    milestones: [
      { label: "Đặt hàng", status: "done", at: "2026-06-11T10:00:00+07:00" },
      { label: "Xác nhận", status: "done", at: "2026-06-11T10:05:00+07:00" },
      { label: "Đang in/sản xuất", status: "current", at: "2026-06-11T13:00:00+07:00" },
      { label: "Sẵn sàng hoàn tất", status: "upcoming" },
      { label: "Đang giao", status: "upcoming" },
      { label: "Giao thành công", status: "upcoming" },
    ],
    events: orderEvents.filter((e) => e.orderId === "ORD-2026-0011"),
  },
];

/* ============================================================================
 * MODULE 18 — CUSTOMER INFORMATION (ecommerce/18-customer-information)
 * ==========================================================================*/

/** Vòng đời khách hàng (18). */
export type CustomerStatus =
  "Guest" | "Pending Verification" | "Active" | "Suspended" | "Closed" | "Anonymized" | "Merged";

export type CustomerSegment = "new" | "returning" | "vip" | "wholesale" | "at-risk" | "dormant";
export type LoyaltyTier = "bronze" | "silver" | "gold" | "platinum";

export interface CustomerAddress {
  addressId: ID;
  customerId: ID;
  label: string; // "Nhà riêng", "Công ty"
  recipientName: string;
  phone: string;
  address: AddressVN;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
}

export interface Customer {
  customerId: ID; // CUS-xxxx hoặc guest-xxxx
  status: CustomerStatus;
  type: CustomerType; // individual | business
  fullName: string;
  email: string; // khoá định danh
  phone: string;
  /** Doanh nghiệp → mã số thuế (18). */
  taxCode?: string;
  companyName?: string;
  avatarUrl?: string;
  /** Dữ liệu phái sinh read-only (18). */
  totalOrders: number;
  totalSpent: VND;
  loyaltyTier: LoyaltyTier;
  loyaltyPoints: number;
  segment: CustomerSegment;
  /** Consent marketing (18 — toggle + lưu mốc). */
  marketingConsent: boolean;
  marketingConsentAt?: ISODateTime;
  /** Security (18). */
  twoFactorEnabled: boolean;
  lastLoginAt?: ISODateTime;
  activeSessions: number;
  createdAt: ISODateTime;
  /** Privacy actions (A6: ẩn danh khi có yêu cầu xoá). */
  dataExportRequestedAt?: ISODateTime;
  deletionRequestedAt?: ISODateTime;
  mergedFromCustomerId?: ID;
  addresses: CustomerAddress[];
}

export const customers: Customer[] = [
  {
    customerId: "CUS-0010",
    status: "Active",
    type: "individual",
    fullName: "Nguyễn Hoài Nam",
    email: "nam.nguyen@example.vn",
    phone: "+84 908 111 222",
    avatarUrl: "/mock/avatar/cus-0010.jpg",
    totalOrders: 12,
    totalSpent: 3480000,
    loyaltyTier: "gold",
    loyaltyPoints: 3480,
    segment: "returning",
    marketingConsent: true,
    marketingConsentAt: "2026-01-10T09:00:00+07:00",
    twoFactorEnabled: true,
    lastLoginAt: "2026-06-11T19:00:00+07:00",
    activeSessions: 2,
    createdAt: "2026-01-10T09:00:00+07:00",
    addresses: [
      {
        addressId: "ADDR-0010-1",
        customerId: "CUS-0010",
        label: "Nhà riêng",
        recipientName: "Nguyễn Hoài Nam",
        phone: "+84 908 111 222",
        address: {
          street: "22 Trần Hưng Đạo",
          ward: "Phường Phạm Ngũ Lão",
          district: "Quận 1",
          province: "TP. Hồ Chí Minh",
          postalCode: "710000",
          country: "VN",
        },
        isDefaultShipping: true,
        isDefaultBilling: true,
      },
    ],
  },
  {
    customerId: "CUS-0012",
    status: "Active",
    type: "individual",
    fullName: "Trần Thị Bích",
    email: "bich.tran@example.vn",
    phone: "+84 909 222 333",
    avatarUrl: "/mock/avatar/cus-0012.jpg",
    totalOrders: 3,
    totalSpent: 890000,
    loyaltyTier: "silver",
    loyaltyPoints: 890,
    segment: "returning",
    marketingConsent: true,
    marketingConsentAt: "2026-04-02T10:00:00+07:00",
    twoFactorEnabled: false,
    lastLoginAt: "2026-06-12T20:00:00+07:00",
    activeSessions: 1,
    createdAt: "2026-04-02T10:00:00+07:00",
    addresses: [
      {
        addressId: "ADDR-0012-1",
        customerId: "CUS-0012",
        label: "Nhà riêng",
        recipientName: "Trần Thị Bích",
        phone: "+84 909 222 333",
        address: {
          street: "45 Nguyễn Trãi",
          ward: "Phường Bến Thành",
          district: "Quận 1",
          province: "TP. Hồ Chí Minh",
          postalCode: "710000",
          country: "VN",
        },
        isDefaultShipping: true,
        isDefaultBilling: true,
      },
    ],
  },
  {
    customerId: "CUS-0008",
    status: "Active",
    type: "business",
    fullName: "Phạm Thu Trang",
    email: "trang.pham@teambuilding.vn",
    phone: "+84 977 444 555",
    companyName: "Công ty TNHH Sự kiện Kết Nối",
    taxCode: "0309876543",
    avatarUrl: "/mock/avatar/cus-0008.jpg",
    totalOrders: 25,
    totalSpent: 18750000,
    loyaltyTier: "platinum",
    loyaltyPoints: 18750,
    segment: "vip",
    marketingConsent: false,
    twoFactorEnabled: true,
    lastLoginAt: "2026-06-11T09:00:00+07:00",
    activeSessions: 3,
    createdAt: "2025-12-01T08:00:00+07:00",
    addresses: [
      {
        addressId: "ADDR-0008-1",
        customerId: "CUS-0008",
        label: "Công ty",
        recipientName: "Phạm Thu Trang",
        phone: "+84 977 444 555",
        address: {
          street: "302 Nguyễn Văn Cừ",
          ward: "Phường An Hòa",
          district: "Quận Ninh Kiều",
          province: "Cần Thơ",
          postalCode: "940000",
          country: "VN",
        },
        isDefaultShipping: true,
        isDefaultBilling: true,
      },
    ],
  },
  {
    customerId: "CUS-0011",
    status: "Pending Verification",
    type: "individual",
    fullName: "Ngô Thị Mai",
    email: "mai.ngo@example.vn",
    phone: "+84 929 444 666",
    totalOrders: 1,
    totalSpent: 894000,
    loyaltyTier: "bronze",
    loyaltyPoints: 89,
    segment: "new",
    marketingConsent: true,
    marketingConsentAt: "2026-06-09T18:00:00+07:00",
    twoFactorEnabled: false,
    activeSessions: 1,
    createdAt: "2026-06-09T18:00:00+07:00",
    addresses: [
      {
        addressId: "ADDR-0011-1",
        customerId: "CUS-0011",
        label: "Nhà riêng",
        recipientName: "Ngô Thị Mai",
        phone: "+84 929 444 666",
        address: {
          street: "60 Trần Phú",
          ward: "Phường Lộc Thọ",
          district: "Thành phố Nha Trang",
          province: "Khánh Hòa",
          postalCode: "650000",
          country: "VN",
        },
        isDefaultShipping: true,
        isDefaultBilling: true,
      },
    ],
  },
  {
    customerId: "CUS-0006",
    status: "Suspended",
    type: "individual",
    fullName: "Hoàng Văn Sỹ",
    email: "sy.hoang@example.vn",
    phone: "+84 933 222 111",
    totalOrders: 5,
    totalSpent: 1250000,
    loyaltyTier: "silver",
    loyaltyPoints: 1250,
    segment: "at-risk",
    marketingConsent: false,
    twoFactorEnabled: false,
    lastLoginAt: "2026-06-01T10:00:00+07:00",
    activeSessions: 0,
    createdAt: "2026-02-20T09:00:00+07:00",
    addresses: [
      {
        addressId: "ADDR-0006-1",
        customerId: "CUS-0006",
        label: "Nhà riêng",
        recipientName: "Hoàng Văn Sỹ",
        phone: "+84 933 222 111",
        address: {
          street: "99 Lạch Tray",
          ward: "Phường Lạch Tray",
          district: "Quận Ngô Quyền",
          province: "Hải Phòng",
          postalCode: "043000",
          country: "VN",
        },
        isDefaultShipping: true,
        isDefaultBilling: true,
      },
    ],
  },
  {
    customerId: "CUS-0003",
    status: "Active",
    type: "individual",
    fullName: "Đặng Thuỳ Linh",
    email: "linh.dang@example.vn",
    phone: "+84 918 555 222",
    avatarUrl: "/mock/avatar/cus-0003.jpg",
    totalOrders: 8,
    totalSpent: 2150000,
    loyaltyTier: "gold",
    loyaltyPoints: 2150,
    segment: "returning",
    marketingConsent: true,
    marketingConsentAt: "2026-03-15T09:00:00+07:00",
    twoFactorEnabled: true,
    lastLoginAt: "2026-06-05T10:00:00+07:00",
    activeSessions: 1,
    createdAt: "2026-03-15T09:00:00+07:00",
    addresses: [
      {
        addressId: "ADDR-0003-1",
        customerId: "CUS-0003",
        label: "Nhà riêng",
        recipientName: "Đặng Thuỳ Linh",
        phone: "+84 918 555 222",
        address: {
          street: "210 Điện Biên Phủ",
          ward: "Phường 17",
          district: "Quận Bình Thạnh",
          province: "TP. Hồ Chí Minh",
          postalCode: "723000",
          country: "VN",
        },
        isDefaultShipping: true,
        isDefaultBilling: true,
      },
    ],
  },
  {
    customerId: "CUS-0001",
    status: "Closed",
    type: "individual",
    fullName: "Trịnh Công Sơn",
    email: "son.trinh@example.vn",
    phone: "+84 917 000 111",
    totalOrders: 1,
    totalSpent: 185920,
    loyaltyTier: "bronze",
    loyaltyPoints: 0,
    segment: "dormant",
    marketingConsent: false,
    twoFactorEnabled: false,
    activeSessions: 0,
    createdAt: "2026-05-25T09:00:00+07:00",
    addresses: [],
  },
  {
    customerId: "CUS-0002",
    status: "Anonymized",
    type: "individual",
    fullName: "[Đã ẩn danh]",
    email: "anonymized+cus0002@anonymized.local",
    phone: "[Đã xoá]",
    // A6: ẩn danh khi có yêu cầu xoá — giữ chứng từ, xoá PII.
    totalOrders: 0,
    totalSpent: 0,
    loyaltyTier: "bronze",
    loyaltyPoints: 0,
    segment: "dormant",
    marketingConsent: false,
    twoFactorEnabled: false,
    activeSessions: 0,
    createdAt: "2026-01-05T09:00:00+07:00",
    deletionRequestedAt: "2026-06-01T09:00:00+07:00",
    addresses: [],
  },
  {
    customerId: "CUS-0005",
    status: "Merged",
    type: "individual",
    fullName: "Vũ Đức Long",
    email: "long.vu@example.vn",
    phone: "+84 966 777 888",
    totalOrders: 4,
    totalSpent: 1310000,
    loyaltyTier: "silver",
    loyaltyPoints: 1310,
    segment: "returning",
    marketingConsent: true,
    marketingConsentAt: "2026-02-10T09:00:00+07:00",
    twoFactorEnabled: false,
    activeSessions: 1,
    createdAt: "2026-02-10T09:00:00+07:00",
    mergedFromCustomerId: "guest-7f3a",
    addresses: [
      {
        addressId: "ADDR-0005-1",
        customerId: "CUS-0005",
        label: "Nhà riêng",
        recipientName: "Vũ Đức Long",
        phone: "+84 966 777 888",
        address: {
          street: "15 Quang Trung",
          ward: "Phường Quang Trung",
          district: "Quận Hà Đông",
          province: "Hà Nội",
          postalCode: "121000",
          country: "VN",
        },
        isDefaultShipping: true,
        isDefaultBilling: true,
      },
    ],
  },
  {
    customerId: "guest-7f3a",
    status: "Guest",
    type: "individual",
    fullName: "Khách vãng lai",
    email: "",
    phone: "",
    totalOrders: 0,
    totalSpent: 0,
    loyaltyTier: "bronze",
    loyaltyPoints: 0,
    segment: "new",
    marketingConsent: false,
    twoFactorEnabled: false,
    activeSessions: 1,
    createdAt: "2026-06-09T18:00:00+07:00",
    addresses: [],
  },
  {
    customerId: "CUS-0004",
    status: "Active",
    type: "individual",
    fullName: "Lê Thị Mai",
    email: "mai.le@example.vn",
    phone: "+84 934 567 890",
    totalOrders: 2,
    totalSpent: 210120,
    loyaltyTier: "bronze",
    loyaltyPoints: 210,
    segment: "returning",
    marketingConsent: true,
    marketingConsentAt: "2026-05-10T09:00:00+07:00",
    twoFactorEnabled: false,
    lastLoginAt: "2026-06-11T22:00:00+07:00",
    activeSessions: 1,
    createdAt: "2026-05-10T09:00:00+07:00",
    addresses: [
      {
        addressId: "ADDR-0004-1",
        customerId: "CUS-0004",
        label: "Nhà riêng",
        recipientName: "Lê Thị Mai",
        phone: "+84 934 567 890",
        address: {
          street: "9 Quang Trung",
          ward: "Phường 10",
          district: "Quận Gò Vấp",
          province: "TP. Hồ Chí Minh",
          postalCode: "714000",
          country: "VN",
        },
        isDefaultShipping: true,
        isDefaultBilling: true,
      },
    ],
  },
  {
    customerId: "CUS-0007",
    status: "Active",
    type: "individual",
    fullName: "Bùi Thanh Hà",
    email: "ha.bui@example.vn",
    phone: "+84 905 333 777",
    totalOrders: 6,
    totalSpent: 1990000,
    loyaltyTier: "silver",
    loyaltyPoints: 1990,
    segment: "returning",
    marketingConsent: false,
    twoFactorEnabled: true,
    lastLoginAt: "2026-06-10T15:00:00+07:00",
    activeSessions: 2,
    createdAt: "2026-02-01T09:00:00+07:00",
    addresses: [
      {
        addressId: "ADDR-0007-1",
        customerId: "CUS-0007",
        label: "Nhà riêng",
        recipientName: "Bùi Thanh Hà",
        phone: "+84 905 333 777",
        address: {
          street: "60 Trần Phú",
          ward: "Phường Lộc Thọ",
          district: "Thành phố Nha Trang",
          province: "Khánh Hòa",
          postalCode: "650000",
          country: "VN",
        },
        isDefaultShipping: true,
        isDefaultBilling: true,
      },
    ],
  },
  {
    customerId: "CUS-0009",
    status: "Active",
    type: "individual",
    fullName: "Nguyễn Văn Đạt",
    email: "dat.nguyen@example.vn",
    phone: "+84 916 123 456",
    totalOrders: 9,
    totalSpent: 4820000,
    loyaltyTier: "gold",
    loyaltyPoints: 4820,
    segment: "vip",
    marketingConsent: true,
    marketingConsentAt: "2026-01-20T09:00:00+07:00",
    twoFactorEnabled: true,
    lastLoginAt: "2026-06-12T08:00:00+07:00",
    activeSessions: 1,
    createdAt: "2026-01-20T09:00:00+07:00",
    addresses: [
      {
        addressId: "ADDR-0009-1",
        customerId: "CUS-0009",
        label: "Nhà riêng",
        recipientName: "Nguyễn Văn Đạt",
        phone: "+84 916 123 456",
        address: {
          street: "12 Lê Trọng Tấn",
          ward: "Phường Khương Mai",
          district: "Quận Thanh Xuân",
          province: "Hà Nội",
          postalCode: "115000",
          country: "VN",
        },
        isDefaultShipping: true,
        isDefaultBilling: true,
      },
    ],
  },
  {
    customerId: "CUS-0013",
    status: "Active",
    type: "individual",
    fullName: "Đặng Thuỳ Linh",
    email: "linh.dang2@example.vn",
    phone: "+84 918 555 223",
    totalOrders: 2,
    totalSpent: 446920,
    loyaltyTier: "bronze",
    loyaltyPoints: 446,
    segment: "new",
    marketingConsent: true,
    marketingConsentAt: "2026-05-28T09:00:00+07:00",
    twoFactorEnabled: false,
    lastLoginAt: "2026-05-28T09:00:00+07:00",
    activeSessions: 1,
    createdAt: "2026-05-28T09:00:00+07:00",
    addresses: [
      {
        addressId: "ADDR-0013-1",
        customerId: "CUS-0013",
        label: "Nhà riêng",
        recipientName: "Đặng Thuỳ Linh",
        phone: "+84 918 555 223",
        address: {
          street: "210 Điện Biên Phủ",
          ward: "Phường 17",
          district: "Quận Bình Thạnh",
          province: "TP. Hồ Chí Minh",
          postalCode: "723000",
          country: "VN",
        },
        isDefaultShipping: true,
        isDefaultBilling: true,
      },
    ],
  },
];

/* ============================================================================
 * STAFF / ROLES (00 — Role Registry) — cho select người thực hiện, phân công
 * ==========================================================================*/

export type RoleName =
  | "System Admin"
  | "Procurement Staff"
  | "Warehouse Staff"
  | "Warehouse Manager"
  | "Inventory Planner"
  | "QC Staff"
  | "Accountant"
  | "E-commerce Admin"
  | "Sales Staff"
  | "Order Coordinator";

export interface StaffUser {
  userId: ID;
  fullName: string;
  email: string;
  roles: RoleName[]; // A2: một tài khoản có thể nhiều vai trò
  warehouseIds: WarehouseId[];
  active: boolean;
}

export const staffUsers: StaffUser[] = [
  {
    userId: "USER-ADMIN-01",
    fullName: "Trần Minh Quang",
    email: "quang.tran@stockflow.vn",
    roles: ["System Admin", "Warehouse Manager"],
    warehouseIds: ["WH-HN-01", "WH-HCM-01", "WH-DN-01"],
    active: true,
  },
  {
    userId: "USER-PROC-01",
    fullName: "Lê Văn Hùng",
    email: "hung.le@stockflow.vn",
    roles: ["Procurement Staff"],
    warehouseIds: ["WH-HN-01", "WH-HCM-01"],
    active: true,
  },
  {
    userId: "USER-PLAN-01",
    fullName: "Đỗ Hồng Nhung",
    email: "nhung.do@stockflow.vn",
    roles: ["Inventory Planner"],
    warehouseIds: ["WH-HN-01", "WH-HCM-01", "WH-DN-01"],
    active: true,
  },
  {
    userId: "USER-WH-01",
    fullName: "Hoàng Anh Tuấn",
    email: "tuan.hoang@stockflow.vn",
    roles: ["Warehouse Staff"],
    warehouseIds: ["WH-HN-01"],
    active: true,
  },
  {
    userId: "USER-WH-02",
    fullName: "Nguyễn Văn Đạt",
    email: "dat.nguyen@stockflow.vn",
    roles: ["Warehouse Staff"],
    warehouseIds: ["WH-HN-01"],
    active: true,
  },
  {
    userId: "USER-WH-03",
    fullName: "Phạm Thị Mai",
    email: "mai.pham@stockflow.vn",
    roles: ["Warehouse Staff"],
    warehouseIds: ["WH-HCM-01"],
    active: true,
  },
  {
    userId: "USER-WH-04",
    fullName: "Trương Văn Lâm",
    email: "lam.truong@stockflow.vn",
    roles: ["Warehouse Staff"],
    warehouseIds: ["WH-HCM-01"],
    active: true,
  },
  {
    userId: "USER-QC-01",
    fullName: "Vũ Thanh Tùng",
    email: "tung.vu@stockflow.vn",
    roles: ["QC Staff"],
    warehouseIds: ["WH-HN-01", "WH-HCM-01"],
    active: true,
  },
  {
    userId: "USER-ACC-01",
    fullName: "Bùi Thu Hà",
    email: "ha.bui@stockflow.vn",
    roles: ["Accountant"],
    warehouseIds: [],
    active: true,
  },
  {
    userId: "USER-ECAD-01",
    fullName: "Quản trị Sàn",
    email: "ecadmin@stockflow.vn",
    roles: ["E-commerce Admin"],
    warehouseIds: [],
    active: true,
  },
  {
    userId: "USER-SALE-01",
    fullName: "Phan Thị Ngọc",
    email: "ngoc.phan@stockflow.vn",
    roles: ["Sales Staff"],
    warehouseIds: [],
    active: true,
  },
  {
    userId: "USER-SALE-02",
    fullName: "Đỗ Quốc Huy",
    email: "huy.do@stockflow.vn",
    roles: ["Sales Staff"],
    warehouseIds: [],
    active: true,
  },
  {
    userId: "USER-SALE-03",
    fullName: "Trần Bảo Khánh",
    email: "khanh.tran@stockflow.vn",
    roles: ["Sales Staff"],
    warehouseIds: [],
    active: true,
  },
  {
    userId: "USER-COORD-01",
    fullName: "Lý Thị Hoa",
    email: "hoa.ly@stockflow.vn",
    roles: ["Order Coordinator", "Warehouse Staff"],
    warehouseIds: ["WH-HN-01"],
    active: true,
  },
];

/* ============================================================================
 * AGGREGATE — export gộp cho preview/demo import một chỗ
 * ==========================================================================*/

export const mockDb = {
  // 01
  categories,
  products,
  skus,
  suppliers,
  // 02
  replenishmentProposals,
  purchaseOrders,
  // 03
  lots,
  serialRecords,
  receipts,
  // 04
  invoices,
  // 05
  putawayTasks,
  // 06
  warehouses,
  zones,
  locations,
  slottingSuggestions,
  warehouseKpis,
  // 07
  pickTasks,
  // 08
  packingTasks,
  // 09
  carriers,
  shipments,
  // 10
  transferOrders,
  // 11
  moveTasks,
  // 12
  designs,
  // 13
  catalogListings,
  promotions,
  reviews,
  catalogFacets,
  // 14
  carts,
  orders,
  // 15
  paymentTransactions,
  savedPaymentMethods,
  // 16
  conversations,
  messages,
  // 17
  orderEvents,
  orderAmendments,
  rmaRequests,
  orderTimelines,
  // 18
  customers,
  // staff
  staffUsers,
} as const;

export default mockDb;

/** Hàm delay giả lập loading cho <Skeleton> (FRONTEND-AI-RULES §8 — tuỳ chọn). */
export function mockDelay(ms = 600): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
