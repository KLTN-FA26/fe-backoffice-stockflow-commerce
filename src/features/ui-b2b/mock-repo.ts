import { B2BQuote, B2BCustomer } from "./types";

const INITIAL_QUOTES: B2BQuote[] = [
  {
    id: "quote-01",
    code: "BG-2026-0088",
    version: 1,
    customerName: "Công ty Cổ phần Cà phê Highland Heritage",
    customerTaxCode: "0312998811",
    customerEmail: "procurement@highlandheritage.vn",
    contactPerson: "Chị Lê Mỹ Hạnh (Trưởng phòng Thu mua)",
    validUntil: "2026-10-25",
    paymentTerm: "NET_30",
    status: "SENT",
    lines: [
      {
        id: "line-01",
        blankSku: "LY-GIAY-350-TRANG",
        blankName: "Ly giấy trơn hai lớp 350ml PE",
        designName: "Logo Mùa Thu Highland Gold 2026",
        designSnapshotUrl:
          "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80",
        isNewDesign: true,
        sampleApproved: false, // Thiết kế mới chưa được duyệt mẫu -> Block duyệt báo giá
        printTechnology: "In Flexo UV 4 màu",
        selectedQuantity: 10000,
        unitPrice: 1100,
        lineTotal: 11000000,
        tiers: [
          { minQuantity: 5000, maxQuantity: 9999, unitPrice: 1250, discountPercent: 0 },
          { minQuantity: 10000, maxQuantity: 19999, unitPrice: 1100, discountPercent: 12 },
          { minQuantity: 20000, unitPrice: 980, discountPercent: 21 },
        ],
      },
    ],
    subtotal: 11000000,
    taxAmount: 1100000,
    grandTotal: 12100000,
    notes: "Báo giá áp dụng thời hạn 30 ngày. Đơn giá đã bao gồm khuôn in Flexo.",
    createdAt: "2026-10-06",
    sentAt: "2026-10-06 14:30",
  },
  {
    id: "quote-02",
    code: "BG-2026-0092",
    version: 2,
    customerName: "Tập đoàn F&B Golden Spoon",
    customerTaxCode: "0103445566",
    customerEmail: "order@goldenspoon.vn",
    contactPerson: "Anh Hoàng Bách (Quản lý Chuỗi)",
    validUntil: "2026-10-30",
    paymentTerm: "NET_15",
    status: "SENT",
    lines: [
      {
        id: "line-02",
        blankSku: "TO-GIAY-750-KRAFT",
        blankName: "Tô giấy Kraft 750ml chống thấm",
        designName: "Nhãn Tô Kraft Takeaway Golden",
        designSnapshotUrl:
          "https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=600&auto=format&fit=crop&q=80",
        isNewDesign: true,
        sampleApproved: true, // Mẫu SMP-2026-003 đã được duyệt -> Cho phép chấp thuận báo giá
        printTechnology: "In Offset 4 màu",
        selectedQuantity: 20000,
        unitPrice: 1650,
        lineTotal: 33000000,
        tiers: [
          { minQuantity: 10000, maxQuantity: 19999, unitPrice: 1800, discountPercent: 0 },
          { minQuantity: 20000, maxQuantity: 49999, unitPrice: 1650, discountPercent: 8 },
          { minQuantity: 50000, unitPrice: 1450, discountPercent: 19 },
        ],
      },
    ],
    subtotal: 33000000,
    taxAmount: 3300000,
    grandTotal: 36300000,
    notes: "Đã chiết khấu 8% theo chính sách khách hàng thân thiết B2B Gold Partner.",
    createdAt: "2026-10-07",
    sentAt: "2026-10-08 09:15",
  },
  {
    id: "quote-03",
    code: "BG-2026-0075",
    version: 1,
    customerName: "Hệ thống Trà sữa Toco Cloud",
    customerTaxCode: "0315778899",
    customerEmail: "design@tococloud.com",
    contactPerson: "Chị Thảo My",
    validUntil: "2026-10-05",
    paymentTerm: "COD",
    status: "EXPIRED",
    lines: [
      {
        id: "line-03",
        blankSku: "LY-NHUA-PP-500",
        blankName: "Ly nhựa PP mờ sần 500ml",
        designName: "Mẫu Thỏ Trăng Tết Trung Thu",
        designSnapshotUrl:
          "https://images.unsplash.com/photo-1558877085-7835154371bb?w=600&auto=format&fit=crop&q=80",
        isNewDesign: false,
        sampleApproved: true,
        printTechnology: "In Lưới trực tiếp",
        selectedQuantity: 5000,
        unitPrice: 1350,
        lineTotal: 6750000,
        tiers: [{ minQuantity: 5000, unitPrice: 1350, discountPercent: 0 }],
      },
    ],
    subtotal: 6750000,
    taxAmount: 675000,
    grandTotal: 7425000,
    createdAt: "2026-09-20",
    sentAt: "2026-09-20 10:00",
  },
];

const INITIAL_CUSTOMERS: B2BCustomer[] = [
  {
    id: "cust-01",
    code: "B2B-CUST-001",
    companyName: "Công ty Cổ phần Cà phê Highland Heritage",
    taxCode: "0312998811",
    email: "procurement@highlandheritage.vn",
    phone: "028 3822 9900",
    address: "Tầng 8, Tòa nhà Bitexco, Q. 1, TP. HCM",
    contactPerson: "Lê Mỹ Hạnh",
    contactPhone: "0909 888 777",
    paymentTerm: "NET_30",
    creditLimit: 500000000,
    portalStatus: "ACTIVE",
    inviteToken: "token-active-hlh",
    activatedAt: "2026-10-01 10:00",
  },
  {
    id: "cust-02",
    code: "B2B-CUST-002",
    companyName: "Tập đoàn F&B Golden Spoon",
    taxCode: "0103445566",
    email: "order@goldenspoon.vn",
    phone: "024 3974 6688",
    address: "Số 77 Phố Trần Hưng Đạo, Hoàn Kiếm, Hà Nội",
    contactPerson: "Hoàng Bách",
    contactPhone: "0918 333 222",
    paymentTerm: "NET_15",
    creditLimit: 800000000,
    portalStatus: "INVITED",
    inviteToken: "token-invite-gsp",
    inviteSentAt: "2026-10-08 14:00",
  },
  {
    id: "cust-03",
    code: "B2B-CUST-003",
    companyName: "Chuỗi Bánh mì Kẹp Phố Cổ",
    taxCode: "0109887733",
    email: "banhmi@phoco.vn",
    phone: "024 3828 1122",
    address: "Số 12 Phố Hàng Bạc, Hoàn Kiếm, Hà Nội",
    contactPerson: "Nguyễn Văn Hưng",
    contactPhone: "0934 112 233",
    paymentTerm: "COD",
    creditLimit: 50000000,
    portalStatus: "EXPIRED",
    inviteToken: "token-expired-bmk",
    inviteSentAt: "2026-09-25 09:00",
  },
];

class InMemoryB2BRepo {
  private quotes: B2BQuote[] = [...INITIAL_QUOTES];
  private customers: B2BCustomer[] = [...INITIAL_CUSTOMERS];

  // QUOTES
  getQuotes(params?: { status?: string; search?: string }): B2BQuote[] {
    let list = [...this.quotes];
    if (params?.status && params.status !== "ALL") {
      list = list.filter((q) => q.status === params.status);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter(
        (item) =>
          item.code.toLowerCase().includes(q) ||
          item.customerName.toLowerCase().includes(q) ||
          item.customerTaxCode.includes(q),
      );
    }
    return list;
  }

  getQuoteById(id: string): B2BQuote | undefined {
    return this.quotes.find((q) => q.id === id || q.code === id);
  }

  createQuote(data: Omit<B2BQuote, "id" | "code" | "version" | "status" | "createdAt">): B2BQuote {
    const count = this.quotes.length + 90;
    const code = `BG-2026-0${count}`;
    const newQuote: B2BQuote = {
      ...data,
      id: `quote-${Date.now()}`,
      code,
      version: 1,
      status: "DRAFT",
      createdAt: new Date().toISOString().substring(0, 10),
    };
    this.quotes.unshift(newQuote);
    return newQuote;
  }

  sendQuote(id: string): B2BQuote {
    const quote = this.getQuoteById(id);
    if (!quote) throw new Error("Quote not found");
    quote.status = "SENT";
    quote.sentAt = new Date().toISOString().replace("T", " ").substring(0, 16);
    return quote;
  }

  reviseQuote(id: string): B2BQuote {
    const quote = this.getQuoteById(id);
    if (!quote) throw new Error("Quote not found");
    quote.version += 1;
    quote.status = "DRAFT";
    return quote;
  }

  // SCRUM-449: Customer Portal Acceptance Guard (BR-PRD-08)
  customerAcceptQuote(id: string): { success: boolean; message: string; quote?: B2BQuote } {
    const quote = this.getQuoteById(id);
    if (!quote) return { success: false, message: "Không tìm thấy báo giá" };

    // BR-PRD-08 Guard: Check if any new design line has not approved sample
    const unapprovedNewLine = quote.lines.find((l) => l.isNewDesign && !l.sampleApproved);
    if (unapprovedNewLine) {
      return {
        success: false,
        message: `KHÔNG THỂ CHẤP THUẬN BÁO GIÁ: Dòng sản phẩm "${unapprovedNewLine.designName}" là thiết kế mới và chưa được phê duyệt mẫu in thử nghiệm (Sample Approval Required - BR-PRD-08). Khách hàng phải duyệt mẫu trước khi chuyển thành đơn hàng chính thức.`,
      };
    }

    quote.status = "ACCEPTED";
    quote.acceptedAt = new Date().toISOString().replace("T", " ").substring(0, 16);
    return {
      success: true,
      message: `Đã chấp thuận báo giá ${quote.code} thành công! Hệ thống tự động chuyển thành Đơn Bán Hàng (Sales Order) theo điều khoản ${quote.paymentTerm}.`,
      quote,
    };
  }

  customerRequestQuoteChanges(id: string, comment: string): B2BQuote {
    const quote = this.getQuoteById(id);
    if (!quote) throw new Error("Quote not found");
    quote.status = "CHANGES_REQUESTED";
    quote.customerComment = comment;
    return quote;
  }

  // CUSTOMERS (SCRUM-451)
  getCustomers(search?: string): B2BCustomer[] {
    let list = [...this.customers];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.companyName.toLowerCase().includes(q) ||
          c.taxCode.includes(q) ||
          c.email.toLowerCase().includes(q),
      );
    }
    return list;
  }

  createCustomer(data: Omit<B2BCustomer, "id" | "code" | "portalStatus">): B2BCustomer {
    const count = this.customers.length + 1;
    const code = `B2B-CUST-00${count}`;
    const newCust: B2BCustomer = {
      ...data,
      id: `cust-${Date.now()}`,
      code,
      portalStatus: "NOT_INVITED",
    };
    this.customers.unshift(newCust);
    return newCust;
  }

  sendCustomerInvite(id: string): B2BCustomer {
    const cust = this.customers.find((c) => c.id === id);
    if (!cust) throw new Error("Customer not found");
    cust.portalStatus = "INVITED";
    cust.inviteToken = `token-inv-${Date.now()}`;
    cust.inviteSentAt = new Date().toISOString().replace("T", " ").substring(0, 16);
    return cust;
  }

  activateCustomer(
    token: string,
    _password: string,
  ): { success: boolean; message: string; customer?: B2BCustomer } {
    if (token === "token-expired-bmk") {
      return {
        success: false,
        message:
          "Liên kết kích hoạt đã HẾT HẠN (quá thời hạn 7 ngày). Vui lòng liên hệ nhân viên Sales StockFlow để nhận liên kết mới.",
      };
    }
    if (token === "token-active-hlh") {
      return {
        success: false,
        message:
          "Liên kết này ĐÃ ĐƯỢC SỬ DỤNG. Tài khoản doanh nghiệp đã kích hoạt trước đó. Vui lòng đăng nhập trực tiếp.",
      };
    }

    const cust = this.customers.find((c) => c.inviteToken === token) || this.customers[1]; // fallback for demo
    cust.portalStatus = "ACTIVE";
    cust.activatedAt = new Date().toISOString().replace("T", " ").substring(0, 16);

    return {
      success: true,
      message: `Chúc mừng! Tài khoản B2B cho doanh nghiệp "${cust.companyName}" đã được kích hoạt thành công với hạn mức công nợ ${(cust.creditLimit / 1000000).toLocaleString()} triệu VNĐ.`,
      customer: cust,
    };
  }
}

export const b2bRepo = new InMemoryB2BRepo();
