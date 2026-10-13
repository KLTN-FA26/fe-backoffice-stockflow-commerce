import {
  SalesOrderSummary,
  TimelineMilestone,
  StockReservationSession,
  RmaRequest,
  CustomizationPricingParams,
  PriceCalculationResult,
  DieCutDesignSession,
  ChatMessage,
  SalesOrderStatus,
} from "./types";

// ============================================================================
// Initial Mock Fixtures
// ============================================================================

const INITIAL_SALES_ORDERS: SalesOrderSummary[] = [
  {
    id: "so-01",
    orderCode: "SO-2026-0412",
    customerName: "Tập đoàn F&B Golden Spoon",
    customerEmail: "purchasing@goldenspoon.vn",
    totalAmount: 48500000,
    currentStatus: "IN_PRODUCTION",
    createdAt: "2026-10-06 09:15",
    deliveryAddress: "Kho Tổng Cầu Giấy, Số 12 Dịch Vọng Hậu, Hà Nội",
    carrierName: "StockFlow Nội Bộ Đội Xe 03",
    timeline: [
      {
        id: "ev-1",
        orderId: "so-01",
        status: "PENDING_PAYMENT",
        title: "Tạo đơn hàng & Chờ đặt cọc",
        description:
          "Khách hàng xác nhận đơn hàng từ báo giá QT-2026-0089. Yêu cầu đặt cọc 50% theo BR-PRD-09.",
        actor: "Hệ thống B2B Portal",
        actorRole: "SYSTEM",
        timestamp: "2026-10-06 09:15",
      },
      {
        id: "ev-2",
        orderId: "so-01",
        status: "PAID",
        title: "Xác nhận thanh toán tiền cọc",
        description:
          "Kế toán ghi nhận thanh toán tiền cọc 24,250,000 đ qua Vietcombank. Tiền cọc đã khớp 100%.",
        actor: "Nguyễn Thị Mai (Kế toán công nợ)",
        actorRole: "SALES",
        timestamp: "2026-10-06 11:30",
      },
      {
        id: "ev-3",
        orderId: "so-01",
        status: "CONFIRMED",
        title: "Điều phối đơn hàng phát hành LSX",
        description:
          "Order Coordinator kiểm tra mẫu thử SMP-2026-0104 đã Approved. Đơn hàng chính thức phát hành lệnh sản xuất LSX-2026-1002.",
        actor: "Võ Hoàng Minh (Điều phối viên)",
        actorRole: "SALES",
        timestamp: "2026-10-06 14:00",
      },
      {
        id: "ev-4",
        orderId: "so-01",
        status: "IN_PRODUCTION",
        title: "Bắt đầu in ấn tại Xưởng in Flexo",
        description:
          "Kỹ thuật viên Prepress duyệt file in đạt checksum. Thủ kho đã quét xuất 5,000 phôi tô Kraft vào máy FLEXO-02.",
        actor: "Trần Văn Cường (Trưởng ca in)",
        actorRole: "WORKSHOP",
        timestamp: "2026-10-07 08:30",
      },
    ],
  },
  {
    id: "so-02",
    orderCode: "SO-2026-0419",
    customerName: "Chuỗi Cà phê The Daily Bean",
    customerEmail: "supply@dailybean.coffee",
    totalAmount: 32000000,
    currentStatus: "SHIPPED",
    createdAt: "2026-10-05 10:00",
    deliveryAddress: "45 Lê Lợi, Quận 1, TP. Hồ Chí Minh",
    carrierName: "Giao Hàng Tiết Kiệm (GHTK-B2B)",
    timeline: [
      {
        id: "ev-201",
        orderId: "so-02",
        status: "PENDING_PAYMENT",
        title: "Khởi tạo đơn đặt hàng",
        description:
          "Đơn hàng tạo từ hợp đồng cung ứng định kỳ. Điều khoản thanh toán: Công nợ 30 ngày (Net 30).",
        actor: "Lê Minh Tuấn (Sales B2B)",
        actorRole: "SALES",
        timestamp: "2026-10-05 10:00",
      },
      {
        id: "ev-202",
        orderId: "so-02",
        status: "CONFIRMED",
        title: "Duyệt hạn mức công nợ",
        description:
          "Khách hàng còn hạn mức 150,000,000 đ. Đơn hàng được phê duyệt tự động sang sản xuất.",
        actor: "Hệ thống Risk Check",
        actorRole: "SYSTEM",
        timestamp: "2026-10-05 10:05",
      },
      {
        id: "ev-203",
        orderId: "so-02",
        status: "IN_PRODUCTION",
        title: "Hoàn tất in ấn 10,000 ly giấy Kraft",
        description: "Xưởng in hoàn tất in và kiểm tra QC đạt 100% dung sai màu Delta E < 2.0.",
        actor: "Nguyễn Văn Hùng (Thợ in chính)",
        actorRole: "WORKSHOP",
        timestamp: "2026-10-06 16:45",
      },
      {
        id: "ev-204",
        orderId: "so-02",
        status: "PICKING",
        title: "Soạn hàng xuất kho",
        description: "Thủ kho nhặt hàng theo danh sách Wave 08 tại Khu vực Đóng gói PACKING-A.",
        actor: "Phạm Văn Tài (Thủ kho)",
        actorRole: "WAREHOUSE",
        timestamp: "2026-10-07 09:10",
      },
      {
        id: "ev-205",
        orderId: "so-02",
        status: "PACKED",
        title: "Đóng thùng carton tiêu chuẩn",
        description:
          "Đóng gói 20 thùng carton (500 cái/thùng), dán nhãn tem vận chuyển và seal niêm phong.",
        actor: "Tổ đóng gói 01",
        actorRole: "WAREHOUSE",
        timestamp: "2026-10-07 14:00",
      },
      {
        id: "ev-206",
        orderId: "so-02",
        status: "SHIPPED",
        title: "Bàn giao vận chuyển GHTK",
        description:
          "Đã bàn giao cho tài xế xe tải GHTK (Biển số: 29C-892.41). Mã vận đơn nội bộ: BK-2026-0994.",
        actor: "Nguyễn Văn Nam (Điều phối kho)",
        actorRole: "LOGISTICS",
        timestamp: "2026-10-08 08:30",
      },
    ],
  },
];

const INITIAL_RESERVATION: StockReservationSession = {
  reservationId: "RES-2026-90412",
  orderNumber: "ORD-TEMP-883",
  createdAt: Date.now() - 300 * 1000, // 5 mins ago
  expiresAt: Date.now() + 600 * 1000, // 10 mins remaining
  ttlSeconds: 900, // 15 mins total
  status: "ACTIVE",
  items: [
    {
      sku: "LY-GIAY-500-KRAFT",
      name: "Ly giấy Kraft 500ml 2 lớp cách nhiệt",
      quantity: 2000,
      unitPrice: 1650,
      imageUrl:
        "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&auto=format&fit=crop&q=80",
      lotAllocated: "LOT-2026-02-C (Kho A01)",
      isCustomPrint: false,
    },
    {
      sku: "TO-GIAY-750-KRAFT",
      name: "Tô giấy Kraft 750ml chống thấm PE",
      quantity: 1500,
      unitPrice: 2400,
      imageUrl:
        "https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=400&auto=format&fit=crop&q=80",
      lotAllocated: "LOT-2026-03-A (Kho B04)",
      isCustomPrint: false,
    },
  ],
};

const INITIAL_RMAS: RmaRequest[] = [
  {
    id: "rma-01",
    rmaCode: "RMA-2026-0045",
    orderCode: "SO-2026-0380",
    customerName: "Trà sữa Đô Đô Hà Nội",
    customerPhone: "0912 345 678",
    type: "REFUND",
    status: "PENDING",
    submittedAt: "2026-10-08 15:20",
    lines: [
      {
        orderLineId: "line-01",
        sku: "LY-NHUA-PP-500",
        productName: "Ly nhựa PP mờ sần 500ml in logo Đô Đô",
        deliveredQty: 4000,
        returnQty: 500,
        reason: "PRINT_DEFECT",
        reasonDetail:
          "Khoảng 500 ly bị lem mực viền đáy và lệch logo so với mẫu thử đã duyệt SMP-2026-0089.",
        photoUrls: [
          "https://images.unsplash.com/photo-1558877085-7835154371bb?w=600&auto=format&fit=crop&q=80",
        ],
      },
    ],
  },
  {
    id: "rma-02",
    rmaCode: "RMA-2026-0038",
    orderCode: "SO-2026-0345",
    customerName: "Chuỗi Bánh Mì Phố Cổ",
    customerPhone: "0988 765 432",
    type: "EXCHANGE",
    status: "APPROVED",
    submittedAt: "2026-10-06 10:15",
    reviewedAt: "2026-10-06 16:30",
    reviewedBy: "Trần Bảo An (Trưởng phòng CSKH)",
    adminNote:
      "Đã xác nhận lỗi móp góc do khâu vận chuyển bên thứ ba. Duyệt gửi đổi mới 1,000 hộp không thu thêm phí.",
    returnAuthCode: "RMA-AUTH-2026-038",
    returnShippingLabelUrl: "https://stockflow.vn/labels/rma-auth-2026-038.pdf",
    lines: [
      {
        orderLineId: "line-02",
        sku: "HOP-COM-1000-KRAFT",
        productName: "Hộp giấy Kraft đựng bánh mì sandwich 1000ml",
        deliveredQty: 5000,
        returnQty: 1000,
        reason: "SHIPPING_DAMAGE",
        reasonDetail:
          "Bao bì ngoài rách, 2 thùng hàng bên trong bị móp méo không thể đựng bánh bán mang về.",
        photoUrls: [
          "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80",
        ],
      },
    ],
  },
];

const INITIAL_DIE_CUT: DieCutDesignSession = {
  id: "diecut-01",
  packagingType: "CUP_ROUND",
  dimensions: {
    mouthDiameterMm: 90,
    bottomDiameterMm: 60,
    heightMm: 135,
    bleedMarginMm: 3,
    printableWidthMm: Math.round(Math.PI * 90), // ~283mm
  },
  artworkElements: [
    {
      id: "art-1",
      name: "Logo Thương Hiệu (Mặt chính)",
      type: "LOGO",
      x: 30,
      y: 40,
      scale: 1.2,
      rotation: 0,
      colorHex: "#1e3a8a",
    },
    {
      id: "art-2",
      name: "Slogan & QR Tra Cứu (Mặt phụ)",
      type: "SLOGAN",
      x: 75,
      y: 45,
      scale: 0.9,
      rotation: 0,
      colorHex: "#047857",
    },
  ],
  notes:
    "Khuôn in ly giấy 500ml vát hình nón. Cần tràn viền 3mm phần đáy để dập nhiệt màng PE không bị hụt mép.",
  isLockedForPrepress: false,
};

const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: "msg-1",
    sender: "CONSULTANT",
    senderName: "Minh Anh (Chuyên viên Tư vấn In ấn StockFlow)",
    text: "Xin chào Quý khách! Em là Minh Anh phụ trách tư vấn kỹ thuật in ly, hộp giấy và bao bì theo yêu cầu. Em có thể hỗ trợ gì cho đơn vị mình ạ?",
    timestamp: "10:00",
    quickChips: [
      "Báo giá in ly giấy 500ml",
      "Tư vấn số lượng tối thiểu (MOQ)",
      "Quy cách làm mẫu thử",
      "Tiến độ đơn hàng của tôi",
    ],
  },
];

// ============================================================================
// In-Memory Repository Implementation
// ============================================================================

class InMemoryBatch2Repo {
  private salesOrders: SalesOrderSummary[] = [...INITIAL_SALES_ORDERS];
  private reservation: StockReservationSession = { ...INITIAL_RESERVATION };
  private rmas: RmaRequest[] = [...INITIAL_RMAS];
  private dieCut: DieCutDesignSession = { ...INITIAL_DIE_CUT };
  private chatMessages: ChatMessage[] = [...INITIAL_CHAT_MESSAGES];

  // --------------------------------------------------------------------------
  // SCRUM-248: Sales Order Timeline
  // --------------------------------------------------------------------------
  getSalesOrders(): SalesOrderSummary[] {
    return this.salesOrders;
  }

  getSalesOrderById(id: string): SalesOrderSummary | undefined {
    return this.salesOrders.find((o) => o.id === id || o.orderCode === id);
  }

  addTimelineEvent(
    orderId: string,
    status: SalesOrderStatus,
    title: string,
    description: string,
    actor: string,
  ): SalesOrderSummary {
    const order = this.getSalesOrderById(orderId);
    if (!order) throw new Error("Sales Order not found");

    const newMilestone: TimelineMilestone = {
      id: `ev-${Date.now()}`,
      orderId: order.id,
      status,
      title,
      description,
      actor,
      actorRole: "WORKSHOP",
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 16),
    };

    order.timeline.push(newMilestone);
    order.currentStatus = status;
    return order;
  }

  // --------------------------------------------------------------------------
  // SCRUM-212: Stock Reservation
  // --------------------------------------------------------------------------
  getReservationSession(): StockReservationSession {
    const now = Date.now();
    if (this.reservation.status === "ACTIVE" && now > this.reservation.expiresAt) {
      this.reservation.status = "EXPIRED";
    }
    return this.reservation;
  }

  extendReservation(): StockReservationSession {
    if (this.reservation.status === "RELEASED") {
      throw new Error("Không thể gia hạn phiên giữ hàng đã hủy");
    }
    // Add 5 more minutes (300,000 ms)
    this.reservation.expiresAt += 300 * 1000;
    this.reservation.status = "EXTENDED";
    return this.reservation;
  }

  releaseReservation(): StockReservationSession {
    this.reservation.status = "RELEASED";
    return this.reservation;
  }

  resetReservation(): StockReservationSession {
    this.reservation = {
      ...INITIAL_RESERVATION,
      createdAt: Date.now(),
      expiresAt: Date.now() + 900 * 1000,
      status: "ACTIVE",
    };
    return this.reservation;
  }

  // --------------------------------------------------------------------------
  // SCRUM-257 & SCRUM-258: RMA Portal & Approval
  // --------------------------------------------------------------------------
  getRmaRequests(): RmaRequest[] {
    return this.rmas;
  }

  getRmaById(id: string): RmaRequest | undefined {
    return this.rmas.find((r) => r.id === id || r.rmaCode === id);
  }

  createRmaRequest(
    orderCode: string,
    customerName: string,
    customerPhone: string,
    type: "REFUND" | "EXCHANGE",
    lines: RmaRequest["lines"],
  ): RmaRequest {
    const newRma: RmaRequest = {
      id: `rma-${Date.now()}`,
      rmaCode: `RMA-2026-00${this.rmas.length + 10}`,
      orderCode,
      customerName,
      customerPhone,
      type,
      status: "PENDING",
      lines,
      submittedAt: new Date().toISOString().replace("T", " ").substring(0, 16),
    };
    this.rmas.unshift(newRma);
    return newRma;
  }

  approveRma(rmaId: string, reviewerName: string, note?: string): RmaRequest {
    const rma = this.getRmaById(rmaId);
    if (!rma) throw new Error("RMA not found");

    rma.status = "APPROVED";
    rma.reviewedAt = new Date().toISOString().replace("T", " ").substring(0, 16);
    rma.reviewedBy = reviewerName;
    rma.adminNote = note || "Đã kiểm duyệt chứng từ hình ảnh. Phê duyệt nhận hàng kiểm tra.";
    rma.returnAuthCode = `RMA-AUTH-2026-${Math.floor(100 + Math.random() * 900)}`;
    rma.returnShippingLabelUrl = `https://stockflow.vn/labels/${rma.returnAuthCode.toLowerCase()}.pdf`;
    return rma;
  }

  rejectRma(rmaId: string, reviewerName: string, reason: string): RmaRequest {
    const rma = this.getRmaById(rmaId);
    if (!rma) throw new Error("RMA not found");

    if (!reason?.trim()) {
      throw new Error("Bắt buộc phải nhập lý do từ chối yêu cầu đổi trả");
    }

    rma.status = "REJECTED";
    rma.reviewedAt = new Date().toISOString().replace("T", " ").substring(0, 16);
    rma.reviewedBy = reviewerName;
    rma.adminNote = reason;
    return rma;
  }

  // --------------------------------------------------------------------------
  // SCRUM-304: Live Customization Price Calculator Engine
  // --------------------------------------------------------------------------
  calculateCustomizationPrice(params: CustomizationPricingParams): PriceCalculationResult {
    const { quantity, baseUnitPrice, printTechnology, colorCount, surfaceFinish, isDoubleSided } =
      params;

    // 1. Phí bản in / Trục khuôn Flexo / Bản kẽm Offset (Fixed 1-time setup fee)
    let plateCostPerColor = 300000;
    if (printTechnology === "FLEXO") plateCostPerColor = 450000;
    else if (printTechnology === "SILKSCREEN") plateCostPerColor = 150000;
    else if (printTechnology === "OFFSET") plateCostPerColor = 500000;
    else if (printTechnology === "UV") plateCostPerColor = 600000;

    const plateCylinderFee =
      plateCostPerColor * Math.max(1, colorCount) * (isDoubleSided ? 1.6 : 1.0);

    // 2. Tiền phôi sản phẩm
    const baseMaterialCost = quantity * baseUnitPrice;

    // 3. Phí lượt in chạy máy (Run charge per unit)
    let runRatePerUnit = 60 * colorCount;
    if (printTechnology === "UV") runRatePerUnit = 120 * colorCount;
    if (isDoubleSided) runRatePerUnit *= 1.5;
    const runChargePrint = quantity * runRatePerUnit;

    // 4. Phí gia công bề mặt (Surface Finish)
    let finishRatePerUnit = 0;
    if (surfaceFinish === "GLOSS_LAMINATION") finishRatePerUnit = 120;
    else if (surfaceFinish === "MATTE_LAMINATION") finishRatePerUnit = 150;
    else if (surfaceFinish === "FOIL_GOLD") finishRatePerUnit = 350;
    else if (surfaceFinish === "EMBOSSING") finishRatePerUnit = 280;
    const finishCost = quantity * finishRatePerUnit;

    const subtotal = plateCylinderFee + baseMaterialCost + runChargePrint + finishCost;

    // 5. Chiết khấu theo bậc sản lượng (Volume Break Discount)
    let discountPercent = 0;
    if (quantity >= 20000) discountPercent = 12;
    else if (quantity >= 10000) discountPercent = 8;
    else if (quantity >= 5000) discountPercent = 5;

    const volumeDiscountAmount = Math.round((subtotal * discountPercent) / 100);
    const finalTotal = subtotal - volumeDiscountAmount;
    const effectiveUnitPrice = Math.round(finalTotal / Math.max(1, quantity));

    return {
      plateCylinderFee,
      baseMaterialCost,
      runChargePrint,
      finishCost,
      subtotal,
      volumeDiscountPercent: discountPercent,
      volumeDiscountAmount,
      finalTotal,
      effectiveUnitPrice,
    };
  }

  // --------------------------------------------------------------------------
  // SCRUM-299 & SCRUM-300: 2D Die-Cut Canvas Designer
  // --------------------------------------------------------------------------
  getDieCutSession(): DieCutDesignSession {
    return this.dieCut;
  }

  updateDieCutDimensions(
    mouthMm: number,
    bottomMm: number,
    heightMm: number,
    bleedMm: number,
  ): DieCutDesignSession {
    this.dieCut.dimensions = {
      mouthDiameterMm: mouthMm,
      bottomDiameterMm: bottomMm,
      heightMm: heightMm,
      bleedMarginMm: bleedMm,
      printableWidthMm: Math.round(Math.PI * mouthMm),
    };
    return this.dieCut;
  }

  updateArtworkPosition(
    elementId: string,
    x: number,
    y: number,
    scale?: number,
    rotation?: number,
  ): DieCutDesignSession {
    const el = this.dieCut.artworkElements.find((e) => e.id === elementId);
    if (el) {
      el.x = Math.max(0, Math.min(100, x));
      el.y = Math.max(0, Math.min(100, y));
      if (scale !== undefined) el.scale = scale;
      if (rotation !== undefined) el.rotation = rotation;
    }
    return this.dieCut;
  }

  // --------------------------------------------------------------------------
  // SCRUM-320: Storefront Chat Widget
  // --------------------------------------------------------------------------
  getChatMessages(): ChatMessage[] {
    return this.chatMessages;
  }

  sendCustomerMessage(text: string): { userMsg: ChatMessage; botReply?: ChatMessage } {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: "CUSTOMER",
      senderName: "Quý khách",
      text,
      timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    };
    this.chatMessages.push(userMsg);

    // Automated Consultant Simulated Reply
    let replyText =
      "Dạ StockFlow đã nhận được yêu cầu của anh/chị. Chuyên viên kỹ thuật in sẽ liên hệ qua điện thoại/Zalo để gửi bảng test màu trong ít phút ạ!";
    const lower = text.toLowerCase();
    if (lower.includes("ly giấy") || lower.includes("500ml") || lower.includes("báo giá")) {
      replyText =
        "Dạ với ly giấy 500ml in Flexo, đơn giá phôi khoảng 1.650 đ/cái. Khi anh/chị đặt từ 5,000 cái sẽ được miễn phí 50% chi phí trục in Flexo và nhận mẫu thử tận nơi ạ!";
    } else if (lower.includes("mẫu") || lower.includes("sample")) {
      replyText =
        "Dạ quy trình StockFlow bắt buộc phải in mẫu thử (Sample Request) và gửi khách ký duyệt màu trước khi đưa vào sản xuất hàng loạt (BR-PRD-08), thời gian làm mẫu thử là 2-3 ngày làm việc ạ.";
    } else if (lower.includes("tiến độ") || lower.includes("đơn hàng")) {
      replyText =
        "Dạ anh/chị vui lòng nhập mã đơn hàng (VD: SO-2026-0412), em sẽ tra cứu trực tiếp lịch in trên bảng Kanban xưởng in cho mình ngay ạ!";
    }

    const botReply: ChatMessage = {
      id: `msg-${Date.now() + 1}`,
      sender: "CONSULTANT",
      senderName: "Minh Anh (Tư vấn viên)",
      text: replyText,
      timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    };
    this.chatMessages.push(botReply);

    return { userMsg, botReply };
  }
}

export const batch2Repo = new InMemoryBatch2Repo();
