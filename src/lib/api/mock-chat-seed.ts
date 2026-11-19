/**
 * Seed của mock chat Sale (WF-02, chỉ USE_MOCK=true) — chép từ seed demo của BE origin/develop (ebbe960e), không bịa:
 * - `db/demo/V20261124000500__demo_chat.sql`: hai hội thoại của `demo.sales.chat` (đủ loại thẻ, ghi chú nội bộ, CSAT 5),
 *   câu trả lời mẫu "Chào khách". Chứng từ sau các thẻ này KHÔNG có trong DB (seed nói rõ) → không vào hồ sơ khách.
 * - `db/demo/V20261124000600__demo_wf02.sql`: hai hội thoại của `demo.sales` (DS-02a về thiết kế, DS-02b về đơn + hợp
 *   đồng, thẻ CONTRACT), báo giá / đơn / hợp đồng / thiết kế của "Khách hàng demo".
 * - `db/demo/V20261203000100__demo_wf02_ds02b_overdue_customer.sql` + `V20261128000200__demo_history.sql`: hội thoại
 *   "Hợp đồng SO-20261202-900002" của Trà Sữa Mây và đợt O01 còn nợ quá hạn của khách này.
 * Id `md5('demo:...')::uuid` đã tính sẵn (ghi khoá bên cạnh). Mốc giờ `NOW() - INTERVAL` tính lại theo `now`.
 */

import type { ChatConversationStatus } from "@/constants";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const VN_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });

export interface MockChatCard {
  kind: string;
  state: string;
  payload: Record<string, unknown>;
  updatedAt: string | null;
}

export interface MockChatAttachment {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  url: string | null;
}

export interface MockChatMessage {
  id: string;
  conversationId: string;
  seq: number;
  kind: "TEXT" | "ATTACHMENT" | "CARD" | "INTERNAL_NOTE";
  visibility: "CUSTOMER" | "STAFF";
  senderType: "CUSTOMER" | "AGENT" | "SYSTEM";
  senderId: string | null;
  body: string | null;
  clientMessageId: string | null;
  contextId: string | null;
  card: MockChatCard | null;
  attachments: MockChatAttachment[];
  mentions: string[];
  sentAt: string;
}

export interface MockConversation {
  id: string;
  customerId: string;
  subject: string;
  status: ChatConversationStatus;
  assignedAgentId: string | null;
  escalationReason: string | null;
  firstResponseDueAt: string | null;
  firstRespondedAt: string | null;
  resolutionDueAt: string | null;
  resolvedAt: string | null;
  reopenUntil: string | null;
  csatScore: number | null;
  csatComment: string | null;
  csatSubmittedAt: string | null;
  createdAt: string;
  lastMessageSeq: number;
  lastMessageAt: string | null;
}

export interface MockChatContext {
  id: string;
  conversationId: string;
  kind: string;
  refId: string;
  primary: boolean;
  attachedAt: string;
}

/** `CustomerDocument` (order/api) hoặc bản thiết kế (`kind: DESIGN`, `number` = tên). */
export interface MockChatDocument {
  kind: "QUOTE" | "ORDER" | "CONTRACT" | "PRODUCTION_ORDER" | "DESIGN";
  id: string;
  customerId: string;
  number: string;
  status: string;
  responsibleUserId: string | null;
  amount: number | null;
  currency: string | null;
  createdAt: string | null;
}

export interface MockChatInstallment {
  id: string;
  customerId: string;
  contractId: string;
  contractNumber: string;
  orderId: string;
  orderNumber: string;
  seq: number;
  name: string;
  amount: number;
  paidAmount: number;
  currency: string;
  dueDate: string | null;
  status: string;
}

export interface MockChatCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
}

export interface MockCannedResponse {
  id: string;
  ownerId: string | null;
  title: string;
  body: string;
  shortcut: string | null;
  category: string | null;
  version: number;
}

export interface MockReadMarker {
  conversationId: string;
  userId: string;
  seq: number;
  at: string;
}

export interface MockChatSeed {
  conversations: MockConversation[];
  messages: MockChatMessage[];
  contexts: MockChatContext[];
  markers: MockReadMarker[];
  canned: MockCannedResponse[];
  customers: MockChatCustomer[];
  documents: MockChatDocument[];
  installments: MockChatInstallment[];
}

/** Id của seed (khoá md5 ghi bên cạnh khi là `md5(...)::uuid`). */
export const CHAT_SEED = {
  /** `demo.sales.chat` — tài khoản không đăng nhập, DISABLED (V20261124000500). */
  salesChat: "c4a70000-0000-4000-8000-000000000001",
  customerChatUser: "c4a70000-0000-4000-8000-000000000002",
  /** md5('demo:wf02:user:demo.sales') — SALES_STAFF, ACTIVE: phụ trách DS-02a / DS-02b. */
  sales: "aa40c7cb-70b4-2d3a-f730-e2b5a217c662",
  /** md5('demo:wf02:user:demo.khachhang') */
  khachHang: "82c2b7d7-c0ae-51e1-4414-23e2e625febb",
  /** md5('demo:history:user:demo.kh.trasuamay') */
  traSuaMayUser: "0fcea640-771a-22a6-4ab9-eef1e9e2016a",
  demoCustomer: "c0000000-0000-4000-8000-000000000001",
  /** md5('demo:history:customer:TSM') */
  traSuaMay: "d0938090-20ac-ae0d-e6ce-aae90663ac33",
  chatInProgress: "c4a70000-0000-4000-8000-000000000101",
  chatResolved: "c4a70000-0000-4000-8000-000000000102",
  /** md5('demo:wf02:conversation:ds02a') */
  ds02a: "a97346f3-dc31-a8e2-d4b1-82ac9318f29b",
  /** md5('demo:wf02:conversation:ds02b') */
  ds02b: "431df6f8-1ee2-4a01-441a-0c469fe24c5a",
  /** md5('demo:wf02b:conversation') */
  tsm: "fc0af634-b2ae-aba0-a385-b8cd63a4b4ea",
  /** md5('demo:wf02:context:ds02a:design') */
  ds02aDesignContext: "572cc557-7930-f031-409f-bed5c6b67c82",
  /** md5('demo:wf02:context:ds02b:order') / ('…:contract') */
  ds02bOrderContext: "9dd8ecda-b214-904c-6a19-8a7f33bf34b6",
  ds02bContractContext: "b8371ad1-bb6f-f9a3-bd83-74f04119e415",
  /** md5('demo:wf02b:context:order') */
  tsmOrderContext: "631677b6-27a5-51a0-5ee4-d41d3f2e8b84",
  /** md5('demo:wf02:design') — "Ly giấy 12oz logo xanh", APPROVED, SKU riêng LY-GIAY-DEMO-12OZ-XANH. */
  design: "54692c35-4eeb-3557-9a8d-ebb3e33e4181",
  /** md5('demo:wf02:quote') QT-20261120-9001 / md5('demo:wf02:order') / md5('demo:wf02:contract') */
  quote: "1600be93-80dd-a049-8727-200af2bff2b2",
  quoteNumber: "QT-20261120-9001",
  order: "18a05a36-cbcf-93d9-afb5-7b69d242383d",
  contract: "63f3ad57-98ab-c65e-aea2-f3f6bbd589fb",
  /** md5('demo:wf02b:quote') / ('demo:wf02b:order') / ('demo:wf02b:contract') */
  tsmQuote: "7a274b2e-a638-5f4d-9054-6f1cf706b719",
  tsmOrder: "1785be93-d755-21a3-9225-b7976f32012c",
  tsmContract: "863cc69b-1bf9-83ec-828d-9d6cab9a565f",
  /** md5('demo:history:order:O01') / ('…:contract:O01') / ('…:installment:O01:2') */
  o01Order: "9ae14247-0729-d58d-080c-a366f90121af",
  o01Contract: "5891d8de-3971-144f-6dd9-cbd5557c4738",
  o01Installment: "26074c9e-228d-5ff7-1367-991d62c33b4a",
  cannedGreeting: "c4a70000-0000-4000-8000-000000000601",
  /** Thẻ PAYMENT_INFO / PAYMENT_REMINDER của seed chat: đợt 307 / 308 không có trong DB (S18 trả 404). */
  paymentInfoMessage: "c4a70000-0000-4000-8000-000000000207",
  quoteRequestMessage: "c4a70000-0000-4000-8000-000000000202",
} as const;

/** Tên hiển thị (`identity.app_user.full_name`) của các tài khoản seed. */
export const CHAT_SEED_PEOPLE: Readonly<Record<string, string>> = {
  [CHAT_SEED.salesChat]: "Nguyễn Văn Sale (demo)",
  [CHAT_SEED.customerChatUser]: "Khách hàng demo",
  [CHAT_SEED.sales]: "Trần Văn Sales (demo)",
  [CHAT_SEED.khachHang]: "Nguyễn Thị Khách (demo)",
  [CHAT_SEED.traSuaMayUser]: "Trần Thị Mây (demo)",
};

/** Tài khoản cổng khách hàng (bên CUSTOMER của dấu đọc). */
export const CHAT_SEED_CUSTOMER_ACCOUNTS: readonly string[] = [
  CHAT_SEED.customerChatUser,
  CHAT_SEED.khachHang,
  CHAT_SEED.traSuaMayUser,
];

/** Người trả lời khách trong seed (ACTIVE + SALES_STAFF); `demo.sales.chat` DISABLED nên không có. */
export const CHAT_SEED_AGENTS: readonly string[] = [CHAT_SEED.sales];

/** Tài khoản công ty cấu hình ở `application-{dev,local,test}.yml` (`COMPANY_BANK_*` mặc định). */
export const CHAT_COMPANY_BANK = {
  bankName: "DEMO BANK (not a real bank)",
  bankBin: "970000",
  accountNumber: "0000000000",
  accountName: "DEMO STOCKFLOW CO LTD",
} as const;

/** Thẻ yêu cầu báo giá trên thiết kế của DS-02a (A-1 của khách) — dữ liệu thiết kế từ V20261124000600 §4. */
export const DS02A_DESIGN_REQUEST = {
  designName: "Ly giấy 12oz logo xanh",
  sku: "LY-GIAY-DEMO-12OZ",
  customerSku: "LY-GIAY-DEMO-12OZ-XANH",
} as const;

const vnDate = (ms: number) => VN_DATE.format(new Date(ms));
/** `today - days` (ngày VN) dạng YYYY-MM-DD. */
const vnDayAgo = (now: number, days: number) => {
  const [y, m, d] = vnDate(now).split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) - days)).toISOString().slice(0, 10);
};

function text(
  id: string,
  conversationId: string,
  seq: number,
  sender: { type: "CUSTOMER" | "AGENT"; id: string },
  body: string,
  sentAt: string,
  contextId: string | null = null,
): MockChatMessage {
  return {
    id,
    conversationId,
    seq,
    kind: "TEXT",
    visibility: "CUSTOMER",
    senderType: sender.type,
    senderId: sender.id,
    body,
    clientMessageId: null,
    contextId,
    card: null,
    attachments: [],
    mentions: [],
    sentAt,
  };
}

function card(
  base: Omit<
    MockChatMessage,
    "kind" | "visibility" | "clientMessageId" | "attachments" | "mentions"
  >,
): MockChatMessage {
  return {
    ...base,
    kind: "CARD",
    visibility: "CUSTOMER",
    clientMessageId: null,
    attachments: [],
    mentions: [],
  };
}

export function chatSeed(now: number): MockChatSeed {
  const at = (offset: number) => new Date(now + offset).toISOString();
  const S = CHAT_SEED;
  return {
    conversations: [...chatSeedConversations(at), ...wf02Conversations(at)],
    messages: [...chatSeedMessages(at), ...wf02Messages(at)],
    contexts: [
      ctx(S.ds02aDesignContext, S.ds02a, "DESIGN", S.design, true, at(-2 * HOUR)),
      ctx(S.ds02bOrderContext, S.ds02b, "ORDER", S.order, true, at(-2 * DAY)),
      ctx(S.ds02bContractContext, S.ds02b, "CONTRACT", S.contract, false, at(-2 * DAY)),
      ctx(S.tsmOrderContext, S.tsm, "ORDER", S.tsmOrder, true, at(-20 * HOUR)),
    ],
    markers: [
      { conversationId: S.chatInProgress, userId: S.salesChat, seq: 11, at: at(-2 * HOUR) },
      {
        conversationId: S.chatResolved,
        userId: S.customerChatUser,
        seq: 3,
        at: at(-3 * DAY + HOUR),
      },
      { conversationId: S.ds02a, userId: S.sales, seq: 2, at: at(-2 * HOUR + 8 * MINUTE) },
      { conversationId: S.ds02b, userId: S.khachHang, seq: 3, at: at(-DAY) },
      { conversationId: S.tsm, userId: S.traSuaMayUser, seq: 2, at: at(-18 * HOUR) },
    ],
    canned: [
      {
        id: S.cannedGreeting,
        ownerId: null,
        title: "Chào khách",
        body: "Chào {customerName}, em là {agentName} bên StockFlow. Em có thể hỗ trợ gì cho anh/chị ạ?",
        shortcut: "chao-khach",
        category: "Mở đầu",
        version: 0,
      },
    ],
    customers: [
      {
        id: S.demoCustomer,
        name: "Khách hàng demo",
        email: "demo.customer@stockflow.local",
        phone: "0900000001",
        status: "ACTIVE",
      },
      {
        id: S.traSuaMay,
        name: "Công ty CP Trà Sữa Mây",
        email: "muahang.tsm@stockflow.local",
        phone: "0901110012",
        status: "ACTIVE",
      },
    ],
    documents: documents(now, at),
    installments: [o01Installment(now)],
  };
}

function ctx(
  id: string,
  conversationId: string,
  kind: string,
  refId: string,
  primary: boolean,
  attachedAt: string,
): MockChatContext {
  return { id, conversationId, kind, refId, primary, attachedAt };
}

function conversation(
  base: Pick<
    MockConversation,
    "id" | "customerId" | "subject" | "status" | "assignedAgentId" | "createdAt" | "lastMessageSeq"
  > &
    Partial<MockConversation>,
): MockConversation {
  return {
    escalationReason: null,
    firstResponseDueAt: null,
    firstRespondedAt: null,
    resolutionDueAt: null,
    resolvedAt: null,
    reopenUntil: null,
    csatScore: null,
    csatComment: null,
    csatSubmittedAt: null,
    lastMessageAt: null,
    ...base,
  };
}

function chatSeedConversations(at: (offset: number) => string): MockConversation[] {
  const S = CHAT_SEED;
  return [
    conversation({
      id: S.chatInProgress,
      customerId: S.demoCustomer,
      subject: "Đặt in cốc giấy 12oz",
      status: "ACTIVE",
      assignedAgentId: S.salesChat,
      firstResponseDueAt: at(-2 * DAY + 15 * MINUTE),
      firstRespondedAt: at(-2 * DAY + 10 * MINUTE),
      createdAt: at(-2 * DAY),
      lastMessageSeq: 12,
      lastMessageAt: at(-HOUR),
    }),
    conversation({
      id: S.chatResolved,
      customerId: S.demoCustomer,
      subject: "Hỏi lịch giao hàng",
      status: "RESOLVED",
      assignedAgentId: S.salesChat,
      firstResponseDueAt: at(-3 * DAY + 15 * MINUTE),
      firstRespondedAt: at(-3 * DAY + 8 * MINUTE),
      resolvedAt: at(-3 * DAY + 30 * MINUTE),
      reopenUntil: at(-3 * DAY + 30 * MINUTE + 14 * DAY),
      csatScore: 5,
      csatComment: "Trả lời nhanh, rõ ràng.",
      csatSubmittedAt: at(-3 * DAY + HOUR),
      createdAt: at(-3 * DAY),
      lastMessageSeq: 3,
      lastMessageAt: at(-3 * DAY + 30 * MINUTE),
    }),
  ];
}

function wf02Conversations(at: (offset: number) => string): MockConversation[] {
  const S = CHAT_SEED;
  return [
    conversation({
      id: S.ds02a,
      customerId: S.demoCustomer,
      subject: "Báo giá ly logo xanh",
      status: "ACTIVE",
      assignedAgentId: S.sales,
      firstResponseDueAt: at(-2 * HOUR + 15 * MINUTE),
      firstRespondedAt: at(-2 * HOUR + 8 * MINUTE),
      resolutionDueAt: at(2 * DAY),
      createdAt: at(-2 * HOUR),
      lastMessageSeq: 2,
      lastMessageAt: at(-2 * HOUR + 8 * MINUTE),
    }),
    conversation({
      id: S.ds02b,
      customerId: S.demoCustomer,
      subject: "Hợp đồng SO-20261120-900001",
      status: "ACTIVE",
      assignedAgentId: S.sales,
      firstResponseDueAt: at(-2 * DAY + 15 * MINUTE),
      firstRespondedAt: at(-2 * DAY),
      resolutionDueAt: at(DAY),
      createdAt: at(-2 * DAY),
      lastMessageSeq: 3,
      lastMessageAt: at(-DAY),
    }),
    conversation({
      id: S.tsm,
      customerId: S.traSuaMay,
      subject: "Hợp đồng SO-20261202-900002",
      status: "ACTIVE",
      assignedAgentId: S.sales,
      firstResponseDueAt: at(-20 * HOUR + 15 * MINUTE),
      firstRespondedAt: at(-20 * HOUR),
      resolutionDueAt: at(DAY),
      createdAt: at(-20 * HOUR),
      lastMessageSeq: 2,
      lastMessageAt: at(-18 * HOUR),
    }),
  ];
}

const DEMO_BANK = { ...CHAT_COMPANY_BANK };

function chatSeedMessages(at: (offset: number) => string): MockChatMessage[] {
  const S = CHAT_SEED;
  const C = S.chatInProgress;
  const id = (n: number) => `c4a70000-0000-4000-8000-000000000${n}`;
  const customer = { type: "CUSTOMER" as const, id: S.customerChatUser };
  const agent = { type: "AGENT" as const, id: S.salesChat };
  const system = { senderType: "SYSTEM" as const, senderId: null, contextId: null };
  const byAgent = { senderType: "AGENT" as const, senderId: S.salesChat, contextId: null };
  return [
    text(
      id(201),
      C,
      1,
      customer,
      "Chào Sale, bên mình muốn đặt in 500 thùng cốc giấy 12oz theo mẫu đã duyệt.",
      at(-2 * DAY),
    ),
    card({
      id: id(202),
      conversationId: C,
      seq: 2,
      ...system,
      body: "Yêu cầu báo giá: Cốc giấy logo xanh",
      sentAt: at(-2 * DAY + MINUTE),
      card: {
        kind: "QUOTE_REQUEST",
        state: "ACTED",
        updatedAt: at(-2 * DAY + 20 * MINUTE),
        payload: {
          scope: "DESIGN",
          requestId: id(301),
          designId: id(302),
          designName: "Cốc giấy logo xanh",
          designStatus: "APPROVED",
          sku: "CUP-12OZ",
          customerSku: "KH-DEMO-CUP-01",
          returnReason: null,
          cartons: 500,
          desiredDeliveryDate: "2026-12-15",
          requestStatus: "CLOSED",
          quoteId: id(303),
          quoteNumber: "QT-DEMO-0001",
        },
      },
    }),
    text(
      id(203),
      C,
      3,
      agent,
      "Chào anh/chị, em đã nhận yêu cầu và sẽ gửi báo giá trong hôm nay ạ.",
      at(-2 * DAY + 10 * MINUTE),
    ),
    {
      ...text(
        id(204),
        C,
        4,
        agent,
        "Khách quen, chiết khấu tối đa 3% - quá mức thì escalate Quản lý kinh doanh.",
        at(-2 * DAY + 12 * MINUTE),
      ),
      kind: "INTERNAL_NOTE",
      visibility: "STAFF",
    },
    card({
      id: id(205),
      conversationId: C,
      seq: 5,
      ...byAgent,
      body: "Báo giá QT-DEMO-0001",
      sentAt: at(-2 * DAY + 3 * HOUR),
      card: {
        kind: "QUOTE",
        state: "ACTED",
        updatedAt: at(-DAY),
        payload: {
          quoteId: id(303),
          number: "QT-DEMO-0001",
          status: "ACCEPTED",
          revision: 1,
          validUntil: "2026-12-01T10:00:00Z",
          requestedDeliveryDate: "2026-12-15",
          lines: [
            {
              id: id(304),
              lineNo: 1,
              sku: "KH-DEMO-CUP-01",
              cartons: 500,
              unitsPerCarton: 50,
              units: 25000,
              unitPrice: 1500,
              lineTotal: 37500000,
              acceptedCartons: 500,
            },
          ],
          proposedTotal: 40500000,
          acceptedTotal: 40500000,
          currency: "VND",
          version: 3,
        },
      },
    }),
    card({
      id: id(206),
      conversationId: C,
      seq: 6,
      ...byAgent,
      body: "Hợp đồng HD-DEMO-0001-1",
      sentAt: at(-DAY),
      card: {
        kind: "CONTRACT",
        state: "ACTED",
        updatedAt: at(-20 * HOUR),
        payload: {
          contractId: id(305),
          number: "HD-DEMO-0001-1",
          orderId: id(306),
          orderNumber: "SO-DEMO-0001",
          status: "SIGNED",
          totalAmount: 40500000,
          currency: "VND",
          freeSampleRounds: 2,
          paymentPlan: [
            {
              seq: 1,
              name: "Đợt 1 - đặt cọc",
              milestone: "ON_SIGNING",
              amount: 15000000,
              percent: null,
              dueDays: 3,
              deliveryBatchSeq: null,
            },
            {
              seq: 2,
              name: "Đợt 2 - sau giao hàng",
              milestone: "AFTER_DELIVERY",
              amount: 25500000,
              percent: null,
              dueDays: 30,
              deliveryBatchSeq: null,
            },
          ],
          documentPath: `/api/v1/orders/me/${id(306)}/contract/document`,
        },
      },
    }),
    card({
      id: id(207),
      conversationId: C,
      seq: 7,
      ...system,
      body: "Thông tin chuyển khoản HD-DEMO-0001-1 DOT1",
      sentAt: at(-20 * HOUR),
      card: {
        kind: "PAYMENT_INFO",
        state: "OPEN",
        updatedAt: null,
        payload: {
          installmentId: id(307),
          contractId: id(305),
          contractNumber: "HD-DEMO-0001-1",
          orderId: id(306),
          orderNumber: "SO-DEMO-0001",
          seq: 1,
          name: "Đợt 1 - đặt cọc",
          amount: 15000000,
          installmentAmount: 15000000,
          currency: "VND",
          dueDate: "2026-11-16",
          overdue: false,
          status: "DUE",
          transferContent: "HD-DEMO-0001-1 DOT1",
          reminder: false,
          bank: DEMO_BANK,
          vietQr:
            "00020101021238540010A00000072701240006970000011000000000000208QRIBFTTA53037045408150000005802VN62230819HD-DEMO-0001-1 DOT163044EDE",
        },
      },
    }),
    card({
      id: id(208),
      conversationId: C,
      seq: 8,
      ...byAgent,
      body: "Nhắc thanh toán HD-DEMO-0001-1 DOT2",
      sentAt: at(-19 * HOUR),
      card: {
        kind: "PAYMENT_REMINDER",
        state: "OPEN",
        updatedAt: null,
        payload: {
          installmentId: id(308),
          contractId: id(305),
          contractNumber: "HD-DEMO-0001-1",
          orderId: id(306),
          orderNumber: "SO-DEMO-0001",
          seq: 2,
          name: "Đợt 2 - sau giao hàng",
          amount: 35000000,
          installmentAmount: 35000000,
          currency: "VND",
          dueDate: "2026-11-10",
          overdue: true,
          status: "DUE",
          transferContent: "HD-DEMO-0001-1 DOT2",
          reminder: true,
          bank: DEMO_BANK,
          vietQr:
            "00020101021238540010A00000072701240006970000011000000000000208QRIBFTTA53037045408350000005802VN62230819HD-DEMO-0001-1 DOT26304186B",
        },
      },
    }),
    card({
      id: id(209),
      conversationId: C,
      seq: 9,
      ...system,
      body: "Duyệt mẫu in vòng 1 - PO-DEMO-0001",
      sentAt: at(-6 * HOUR),
      card: {
        kind: "SAMPLE_APPROVAL",
        state: "OPEN",
        updatedAt: null,
        payload: {
          roundId: id(309),
          roundNo: 1,
          productionOrderId: id(310),
          productionOrderCode: "PO-DEMO-0001",
          productionOrderStatus: "SAMPLE_PENDING",
          salesOrderId: id(306),
          status: "WAITING",
          physicalSampleSentOn: null,
          skus: ["KH-DEMO-CUP-01"],
          media: [
            {
              id: id(311),
              fileName: "mau-in-vong-1.jpg",
              contentType: "image/jpeg",
              video: false,
            },
          ],
          earlier: [],
          mediaPath: `/api/v1/customer/production-samples/${id(309)}/media/{mediaId}/view-url`,
        },
      },
    }),
    card({
      id: id(210),
      conversationId: C,
      seq: 10,
      ...system,
      body: "Hoá đơn C26TAA 0000123",
      sentAt: at(-3 * HOUR),
      card: {
        kind: "INVOICE",
        state: "OPEN",
        updatedAt: null,
        payload: {
          id: id(312),
          code: "INV-DEMO-0001",
          status: "ISSUED",
          orderId: id(306),
          orderNumber: "SO-DEMO-0001",
          templateCode: "1",
          symbol: "C26TAA",
          invoiceNumber: 123,
          issueDate: "2026-11-12",
          currency: "VND",
          subtotal: 37500000,
          taxTotal: 3000000,
          grandTotal: 40500000,
          hasXml: true,
          hasPdf: true,
          files: {
            XML: `/api/v1/einvoices/me/${id(312)}/files/XML`,
            PDF: `/api/v1/einvoices/me/${id(312)}/files/PDF`,
          },
        },
      },
    }),
    card({
      id: id(211),
      conversationId: C,
      seq: 11,
      ...system,
      body: "Đơn SO-DEMO-0001: DELIVERED",
      sentAt: at(-2 * HOUR),
      card: {
        kind: "ORDER_STATUS",
        state: "OPEN",
        updatedAt: null,
        payload: {
          eventKey: id(313),
          orderId: id(306),
          orderNumber: "SO-DEMO-0001",
          shipmentId: id(314),
          shipmentCode: "SH-DEMO-0001",
          status: "DELIVERED",
          failureReasonCode: null,
          carrierName: "Xe tải Minh Phát",
          packageCount: 500,
          occurredAt: "2026-11-12T08:30:00Z",
        },
      },
    }),
    text(id(212), C, 12, customer, "Mẫu in đẹp, mình xem kỹ rồi duyệt trên thẻ nhé.", at(-HOUR)),
    text(
      id(221),
      S.chatResolved,
      1,
      customer,
      "Cho mình hỏi đơn tuần sau giao ngày nào?",
      at(-3 * DAY),
    ),
    text(
      id(222),
      S.chatResolved,
      2,
      agent,
      "Dạ đơn giao thứ Ba tuần sau, buổi sáng ạ.",
      at(-3 * DAY + 8 * MINUTE),
    ),
    card({
      id: id(223),
      conversationId: S.chatResolved,
      seq: 3,
      ...system,
      body: "Anh/chị hài lòng với hỗ trợ lần này chứ?",
      sentAt: at(-3 * DAY + 30 * MINUTE),
      card: {
        kind: "CSAT_SURVEY",
        state: "ACTED",
        updatedAt: at(-3 * DAY + HOUR),
        payload: { conversationId: S.chatResolved, scale: 5, score: 5 },
      },
    }),
  ];
}

function wf02Messages(at: (offset: number) => string): MockChatMessage[] {
  const S = CHAT_SEED;
  const sales = { type: "AGENT" as const, id: S.sales };
  const sentAt = at(-2 * DAY).replace(/\.\d{3}Z$/, "Z");
  return [
    text(
      // md5('demo:wf02:message:ds02a:1')
      "431a6792-730c-d4b1-0b7b-191651f5fe48",
      S.ds02a,
      1,
      { type: "CUSTOMER", id: S.khachHang },
      "Chào Sale, mẫu ly logo xanh đã được duyệt rồi. Bên mình muốn đặt in khoảng 60 thùng, gửi báo giá giúp mình nhé.",
      at(-2 * HOUR),
    ),
    text(
      // md5('demo:wf02:message:ds02a:2')
      "d8247e99-2c98-35e6-dfd8-8638feeb3981",
      S.ds02a,
      2,
      sales,
      'Dạ chào anh/chị. Anh/chị bấm "Yêu cầu báo giá" trên thiết kế, em lên báo giá ngay ạ.',
      at(-2 * HOUR + 8 * MINUTE),
    ),
    text(
      // md5('demo:wf02:message:ds02b:1')
      "6679d7e0-d09c-6398-333b-0a2f416f979c",
      S.ds02b,
      1,
      sales,
      "Em gửi anh/chị hợp đồng HD-20261120-900001-1: giao 2 đợt, mỗi đợt 30 thùng; đặt cọc 30% khi ký.",
      at(-2 * DAY),
    ),
    card({
      // md5('demo:wf02:message:ds02b:2') — payload dựng từ hợp đồng đã SENT (V20261124000600 §7, §8)
      id: "b2be2aba-9f69-694e-16c2-1f2e29ad6358",
      conversationId: S.ds02b,
      seq: 2,
      senderType: "AGENT",
      senderId: S.sales,
      contextId: S.ds02bContractContext,
      body: "Hợp đồng HD-20261120-900001-1",
      sentAt: at(-2 * DAY + MINUTE),
      card: {
        kind: "CONTRACT",
        state: "OPEN",
        updatedAt: null,
        payload: {
          id: S.contract,
          contractId: S.contract,
          number: "HD-20261120-900001-1",
          orderId: S.order,
          orderNumber: "SO-20261120-900001",
          status: "SENT",
          totalAmount: 77550000,
          currency: "VND",
          freeSampleRounds: 2,
          paymentPlan: [
            {
              seq: 1,
              name: "Đặt cọc khi ký",
              milestone: "ON_SIGNING",
              amount: 23265000,
              percent: 30,
              dueDays: 3,
            },
            {
              seq: 2,
              name: "Thanh toán trước giao đợt 1",
              milestone: "BEFORE_DELIVERY",
              amount: 27142500,
              deliveryBatchSeq: 1,
            },
            {
              seq: 3,
              name: "Thanh toán sau giao đợt 2",
              milestone: "AFTER_DELIVERY",
              amount: 27142500,
              dueDays: 30,
              deliveryBatchSeq: 2,
            },
          ],
          sentAt,
          version: 1,
          documentPath: `/api/v1/orders/me/${S.order}/contract/document`,
        },
      },
    }),
    text(
      // md5('demo:wf02:message:ds02b:3')
      "8299df35-220e-de28-1caf-2b6ac6501108",
      S.ds02b,
      3,
      { type: "CUSTOMER", id: S.khachHang },
      "Mình nhận được hợp đồng rồi. Cho mình hỏi đợt 2 giao khoảng ngày nào?",
      at(-DAY),
    ),
    text(
      // md5('demo:wf02b:message:1')
      "0b1c26e1-3b8b-0e18-466c-1cb1eba49eec",
      S.tsm,
      1,
      sales,
      "Em đã tạo đơn SO-20261202-900002 (60 thùng ly logo Trà Sữa Mây) và đang soạn hợp đồng: giao 2 đợt, mỗi đợt 30 thùng; đặt cọc 30% khi ký, đợt 1 thanh toán trước khi giao, đợt 2 thanh toán sau khi giao 15 ngày.",
      at(-20 * HOUR),
      S.tsmOrderContext,
    ),
    text(
      // md5('demo:wf02b:message:2')
      "b4e8b203-ffa0-70e6-8497-4a9d466d2ca0",
      S.tsm,
      2,
      { type: "CUSTOMER", id: S.traSuaMayUser },
      "Ok em, gửi hợp đồng cho chị ký nhé.",
      at(-18 * HOUR),
    ),
  ];
}

function documents(now: number, at: (offset: number) => string): MockChatDocument[] {
  const S = CHAT_SEED;
  const doc = (
    d: Omit<MockChatDocument, "amount" | "currency" | "responsibleUserId"> &
      Partial<MockChatDocument>,
  ): MockChatDocument => ({ amount: null, currency: null, responsibleUserId: null, ...d });
  // V20261203000100: thuế STANDARD của ngày dựng DB — 8% hết 2026 (Nghị định 174/2025), sau đó 10%.
  const vat = vnDate(now) <= "2026-12-31" ? 8 : 10;
  const o01Day = vnDayAgo(now, 130).replaceAll("-", "");
  return [
    doc({
      kind: "QUOTE",
      id: S.quote,
      customerId: S.demoCustomer,
      number: S.quoteNumber,
      status: "CONVERTED",
      responsibleUserId: S.sales,
      createdAt: at(-6 * DAY),
    }),
    doc({
      kind: "ORDER",
      id: S.order,
      customerId: S.demoCustomer,
      number: "SO-20261120-900001",
      status: "PENDING_CONTRACT",
      responsibleUserId: S.sales,
      amount: 77550000,
      currency: "VND",
      createdAt: at(-4 * DAY),
    }),
    doc({
      kind: "CONTRACT",
      id: S.contract,
      customerId: S.demoCustomer,
      number: "HD-20261120-900001-1",
      status: "SENT",
      responsibleUserId: S.sales,
      createdAt: at(-3 * DAY),
    }),
    doc({
      kind: "DESIGN",
      id: S.design,
      customerId: S.demoCustomer,
      number: DS02A_DESIGN_REQUEST.designName,
      status: "APPROVED",
      createdAt: at(-26 * DAY),
    }),
    doc({
      kind: "QUOTE",
      id: S.tsmQuote,
      customerId: S.traSuaMay,
      number: "QT-20261202-9002",
      status: "CONVERTED",
      responsibleUserId: S.sales,
      createdAt: at(-3 * DAY),
    }),
    doc({
      kind: "ORDER",
      id: S.tsmOrder,
      customerId: S.traSuaMay,
      number: "SO-20261202-900002",
      status: "DRAFT",
      responsibleUserId: S.sales,
      amount: 72000000 + Math.round((72000000 * vat) / 100),
      currency: "VND",
      createdAt: at(-DAY),
    }),
    doc({
      kind: "CONTRACT",
      id: S.tsmContract,
      customerId: S.traSuaMay,
      number: "HD-20261202-900002-1",
      status: "DRAFT",
      createdAt: at(-20 * HOUR),
    }),
    // V20261128000200 O01: 40 thùng × 1.300 + phí bản in 1.500.000, VAT 10% → 58.850.000; ký 125 ngày trước, giao 108.
    doc({
      kind: "ORDER",
      id: S.o01Order,
      customerId: S.traSuaMay,
      number: `SO-${o01Day}-910001`,
      status: "DELIVERED",
      responsibleUserId: S.sales,
      amount: 58850000,
      currency: "VND",
      createdAt: null,
    }),
    doc({
      kind: "CONTRACT",
      id: S.o01Contract,
      customerId: S.traSuaMay,
      number: `HD-${o01Day}-910001-1`,
      status: "SIGNED",
      responsibleUserId: S.sales,
      createdAt: null,
    }),
  ];
}

/** O01 đợt 2 (sau giao, 15 ngày): 58.850.000 − cọc 30% 17.655.000 = 41.195.000, đến hạn 93 ngày trước, chưa trả. */
function o01Installment(now: number): MockChatInstallment {
  const S = CHAT_SEED;
  const o01Day = vnDayAgo(now, 130).replaceAll("-", "");
  return {
    id: S.o01Installment,
    customerId: S.traSuaMay,
    contractId: S.o01Contract,
    contractNumber: `HD-${o01Day}-910001-1`,
    orderId: S.o01Order,
    orderNumber: `SO-${o01Day}-910001`,
    seq: 2,
    name: "Thanh toán sau giao hàng",
    amount: 41195000,
    paidAmount: 0,
    currency: "VND",
    dueDate: vnDayAgo(now, 93),
    status: "DUE",
  };
}

/** Ngày VN hôm nay (YYYY-MM-DD) — đợt quá hạn khi `dueDate` trước hôm nay. */
export const chatToday = (now: number): string => vnDate(now);
