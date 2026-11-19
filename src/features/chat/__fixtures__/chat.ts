/**
 * Hội thoại / tin đúng hình JSON BE (`ChatConversationView`, `ChatMessageView`, origin/develop 438fe6fb) cho seed
 * DS-02a "Báo giá ly logo xanh". Trường null bị BỎ như Jackson `non_null`.
 */

export const CONVERSATION_ID = "d0d0d0d0-0000-4000-8000-000000000001";
export const CUSTOMER_ID = "c0000000-0000-4000-8000-000000000001";
export const QUOTE_ID = "6f3b5c1e-2d4a-4b8f-9c0d-1e2f3a4b5c6d";

export const conversation = {
  id: CONVERSATION_ID,
  customerId: CUSTOMER_ID,
  customerName: "Khách hàng demo",
  subject: "Báo giá ly logo xanh",
  status: "ACTIVE",
  nextStatuses: ["WAITING_ON_CUSTOMER", "WAITING_ON_INTERNAL", "ESCALATED", "RESOLVED"],
  assignedAgentId: "a1a1a1a1-0000-4000-8000-000000000005",
  assignedAgentName: "Sale demo",
  agentOnline: true,
  firstResponseOverdue: false,
  resolutionOverdue: false,
  createdAt: "2026-11-18T02:00:00Z",
  lastMessageAt: "2026-11-18T03:00:00Z",
  lastSeq: 3,
  unread: 0,
  contexts: [
    { id: "ctx-1", kind: "DESIGN", refId: "d1", primary: true, label: "Ly giấy 12oz logo xanh" },
  ],
  withinBusinessHours: true,
  canRate: false,
};

const base = {
  conversationId: CONVERSATION_ID,
  attachments: [],
  mentions: [],
  deleted: false,
};

export const quoteRequestCard = (staffActions: string[], designStatus = "APPROVED") => ({
  ...base,
  id: "m-card",
  seq: 1,
  kind: "CARD",
  visibility: "CUSTOMER",
  senderType: "SYSTEM",
  body: "Yêu cầu báo giá: Ly giấy 12oz logo xanh",
  card: {
    kind: "QUOTE_REQUEST",
    state: "OPEN",
    payload: {
      scope: "DESIGN",
      requestId: "r1",
      designId: "d1",
      designName: "Ly giấy 12oz logo xanh",
      designStatus,
      sku: "LY-GIAY-12OZ",
      customerSku: designStatus === "APPROVED" ? "LY-GIAY-DEMO-12OZ-XANH" : null,
      returnReason: null,
      cartons: 60,
      desiredDeliveryDate: "2026-12-09",
      requestStatus: "OPEN",
      requestedAt: "2026-11-18T02:00:00Z",
    },
    customerActions: [],
    staffActions,
  },
  sentAt: "2026-11-18T02:00:00Z",
});

export const internalNote = {
  ...base,
  id: "m-note",
  seq: 2,
  kind: "INTERNAL_NOTE",
  visibility: "STAFF",
  senderType: "AGENT",
  senderName: "Sale demo",
  body: "Khách quen, ưu tiên giao sớm",
  sentAt: "2026-11-18T02:30:00Z",
};

export const customerText = {
  ...base,
  id: "m-text",
  seq: 3,
  kind: "TEXT",
  visibility: "CUSTOMER",
  senderType: "CUSTOMER",
  senderName: "Khách hàng demo",
  body: "Em cần 60 thùng ạ",
  sentAt: "2026-11-18T03:00:00Z",
};

export const messagePage = (items: unknown[]) => ({ items, lastSeq: items.length });

export const overview = {
  customerId: CUSTOMER_ID,
  code: "KH-DEMO",
  name: "Khách hàng demo",
  email: "demo.customer@stockflow.local",
  orders: [],
  quotes: [],
  contracts: [],
  productionOrders: [],
  installments: [
    {
      id: "i-1",
      contractId: "c1",
      contractNumber: "HD-20261120-900001-1",
      orderId: "o1",
      orderNumber: "SO-20261120-900001",
      seq: 1,
      name: "Đặt cọc khi ký",
      amount: 23_265_000,
      paidAmount: 0,
      currency: "VND",
      dueDate: "2026-11-21",
      status: "DUE",
      overdue: false,
    },
  ],
  designs: [],
  conversations: [],
};
