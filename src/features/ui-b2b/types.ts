export type QuoteStatus = 
  | "DRAFT"
  | "SENT"
  | "ACCEPTED"
  | "CHANGES_REQUESTED"
  | "EXPIRED";

export interface QuantityTier {
  minQuantity: number;
  maxQuantity?: number;
  unitPrice: number;
  discountPercent?: number;
}

export interface QuoteLine {
  id: string;
  blankSku: string;
  blankName: string;
  designName: string;
  designSnapshotUrl: string;
  isNewDesign: boolean;
  sampleApproved: boolean; // Phải có sampleApproved mới được chấp thuận báo giá chuyển đơn
  printTechnology: string;
  selectedQuantity: number;
  unitPrice: number;
  lineTotal: number;
  tiers: QuantityTier[];
}

export interface B2BQuote {
  id: string;
  code: string; // BG-2026-xxxx
  version: number;
  customerName: string;
  customerTaxCode: string;
  customerEmail: string;
  contactPerson: string;
  validUntil: string;
  paymentTerm: "NET_15" | "NET_30" | "NET_60" | "COD";
  status: QuoteStatus;
  lines: QuoteLine[];
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  notes?: string;
  customerComment?: string;
  createdAt: string;
  sentAt?: string;
  acceptedAt?: string;
}

export interface B2BCustomer {
  id: string;
  code: string;
  companyName: string;
  taxCode: string;
  email: string;
  phone: string;
  address: string;
  contactPerson: string;
  contactPhone: string;
  paymentTerm: "NET_15" | "NET_30" | "NET_60" | "COD";
  creditLimit: number;
  portalStatus: "INVITED" | "ACTIVE" | "EXPIRED" | "NOT_INVITED";
  inviteToken?: string;
  inviteSentAt?: string;
  activatedAt?: string;
}
