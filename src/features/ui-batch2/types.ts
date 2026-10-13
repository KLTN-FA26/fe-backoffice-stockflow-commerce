// ============================================================================
// Types for Batch 2 Deliverables (UI-only Mock Architecture)
// SCRUM-248: Sales Order Timeline
// SCRUM-212: Storefront Checkout Stock Reservation
// SCRUM-257 & SCRUM-258: RMA Customer Portal & Backoffice Approval
// SCRUM-304: Live Customization Price Calculator
// SCRUM-299 & SCRUM-300: 2D Packaging Die-Cut Designer
// SCRUM-320: Storefront Floating Chat Widget
// ============================================================================

// ----------------------------------------------------------------------------
// SCRUM-248: Sales Order Lifecycle Timeline
// ----------------------------------------------------------------------------
export type SalesOrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "CONFIRMED"
  | "IN_PRODUCTION"
  | "PICKING"
  | "PACKED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURNED";

export interface TimelineMilestone {
  id: string;
  orderId: string;
  status: SalesOrderStatus;
  title: string;
  description: string;
  actor: string;
  actorRole: "CUSTOMER" | "SALES" | "PREPRESS" | "WORKSHOP" | "WAREHOUSE" | "LOGISTICS" | "SYSTEM";
  timestamp: string;
  metadata?: Record<string, string | number>;
}

export interface SalesOrderSummary {
  id: string;
  orderCode: string;
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  currentStatus: SalesOrderStatus;
  createdAt: string;
  deliveryAddress: string;
  carrierName?: string;
  timeline: TimelineMilestone[];
}

// ----------------------------------------------------------------------------
// SCRUM-212: Checkout Stock Reservation
// ----------------------------------------------------------------------------
export interface ReservedCartItem {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  imageUrl: string;
  lotAllocated?: string;
  isCustomPrint: boolean;
}

export interface StockReservationSession {
  reservationId: string;
  orderNumber: string;
  createdAt: number; // timestamp ms
  expiresAt: number; // timestamp ms
  ttlSeconds: number; // typically 900s (15 min)
  status: "ACTIVE" | "EXPIRED" | "EXTENDED" | "RELEASED" | "CONVERTED_TO_ORDER";
  items: ReservedCartItem[];
}

// ----------------------------------------------------------------------------
// SCRUM-257 & SCRUM-258: Customer RMA & Backoffice Approval
// ----------------------------------------------------------------------------
export type RmaReason =
  | "PRINT_DEFECT" // Lỗi lem màu, sai màu in so với mẫu duyệt
  | "SHIPPING_DAMAGE" // Móp méo, rách bao bì trong lúc vận chuyển
  | "WRONG_QUANTITY" // Giao thiếu hoặc thừa số lượng
  | "WRONG_SPEC" // Sai dung tích hoặc loại màng chống thấm
  | "OTHER";

export type RmaStatus = "PENDING" | "APPROVED" | "REJECTED" | "RECEIVED" | "REFUNDED";

export interface RmaRequestLine {
  orderLineId: string;
  sku: string;
  productName: string;
  deliveredQty: number;
  returnQty: number;
  reason: RmaReason;
  reasonDetail: string;
  photoUrls: string[];
}

export interface RmaRequest {
  id: string;
  rmaCode: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  type: "REFUND" | "EXCHANGE";
  status: RmaStatus;
  lines: RmaRequestLine[];
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  adminNote?: string;
  returnAuthCode?: string; // Mã ủy quyền trả hàng (VD: RMA-AUTH-2026-091)
  returnShippingLabelUrl?: string;
}

// ----------------------------------------------------------------------------
// SCRUM-304: Live Customization Price Calculator
// ----------------------------------------------------------------------------
export type PrintTechnology = "FLEXO" | "SILKSCREEN" | "OFFSET" | "UV";
export type SurfaceFinish =
  "NONE" | "GLOSS_LAMINATION" | "MATTE_LAMINATION" | "FOIL_GOLD" | "EMBOSSING";

export interface CustomizationPricingParams {
  basePackagingSku: string;
  basePackagingName: string;
  baseUnitPrice: number;
  quantity: number;
  printTechnology: PrintTechnology;
  colorCount: number; // 1 to 6 colors
  surfaceFinish: SurfaceFinish;
  isDoubleSided: boolean;
}

export interface PriceCalculationResult {
  plateCylinderFee: number; // Phí khuôn in/bản Flexo (1 lần)
  baseMaterialCost: number; // Tiền phôi ly/hộp
  runChargePrint: number; // Chi phí lượt in
  finishCost: number; // Phí gia công bề mặt (cán màng/ép kim)
  subtotal: number;
  volumeDiscountPercent: number;
  volumeDiscountAmount: number;
  finalTotal: number;
  effectiveUnitPrice: number; // Đơn giá bình quân mỗi cái
}

// ----------------------------------------------------------------------------
// SCRUM-299 & SCRUM-300: 2D Packaging Die-Cut Canvas Designer
// ----------------------------------------------------------------------------
export type PackagingType = "CUP_ROUND" | "BOWL_KRAFT" | "BOX_TAKEAWAY";

export interface PackagingDimensions {
  mouthDiameterMm: number; // Đường kính miệng (ly/tô)
  bottomDiameterMm: number; // Đường kính đáy
  heightMm: number; // Chiều cao
  bleedMarginMm: number; // Vùng tràn viền an toàn (thường 3mm)
  printableWidthMm: number; // Chu vi trải phẳng = PI * miệng
}

export interface ArtworkElement {
  id: string;
  name: string;
  type: "LOGO" | "TEXT" | "BARCODE" | "SLOGAN";
  x: number; // percent 0..100
  y: number; // percent 0..100
  scale: number; // 0.5 to 2.5
  rotation: number; // deg -180..180
  colorHex?: string;
}

export interface DieCutDesignSession {
  id: string;
  packagingType: PackagingType;
  dimensions: PackagingDimensions;
  artworkElements: ArtworkElement[];
  notes: string;
  isLockedForPrepress: boolean;
}

// ----------------------------------------------------------------------------
// SCRUM-320: Storefront Floating Chat Widget
// ----------------------------------------------------------------------------
export interface ChatMessage {
  id: string;
  sender: "CUSTOMER" | "CONSULTANT";
  senderName: string;
  text: string;
  timestamp: string;
  quickChips?: string[];
}
