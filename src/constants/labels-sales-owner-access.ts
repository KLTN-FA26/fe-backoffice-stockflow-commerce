/**
 * Sale phụ trách khách — câu chữ phần "ai được làm gì" (KE-HOACH sales-owner 2026-11-27, BR-S05, BR-S08, BR-S12, BR-S14;
 * hợp đồng API `HOP-DONG-API.md`) cho báo giá, hợp đồng, chat, hộp yêu cầu báo giá, khoá tài khoản và form tạo khách.
 * Import qua `@/constants`. Mã quyền, mã lỗi, đường dẫn API, enum và route ở MỘT chỗ: `@/constants/sales-owner`.
 */

/** Câu chữ — ngắn, không thuật ngữ. */
export const SALES_OWNER_ACCESS_LABELS = {
  /** BR-S12: người không được làm (không phải chủ, không phải người thay, không phải quản lý). */
  ownedByOther: (name: string) => `Khách này do ${name} phụ trách. Nhờ ${name} hoặc Sales Manager.`,
  /** BE không nêu tên và màn chưa biết tên. */
  ownedByOtherUnnamed: "Khách này do Sale khác phụ trách. Nhờ người đó hoặc Sales Manager.",
  /** Người đang lo thay (BR-S07). */
  coveringFor: (name: string, until: string | null) =>
    until ? `Bạn đang lo thay cho ${name} tới ${until}` : `Bạn đang lo thay cho ${name}`,
  /** BR-S05, tình huống 18: "Nhận" hội thoại của khách đã có chủ. */
  claimOwned: (name: string) =>
    `Khách này do ${name} phụ trách nên không nhận được hội thoại. Nhờ ${name} hoặc Sales Manager.`,
  claimOwnedUnnamed:
    "Khách này đã có Sale phụ trách nên không nhận được hội thoại. Nhờ người đó hoặc Sales Manager.",
  /** BR-S05: nhận hội thoại của khách chưa có chủ thì thành người phụ trách. */
  claimMakesOwner: "Nhận hội thoại thì bạn thành Sale phụ trách của khách này.",
  /** Dòng "Sale phụ trách" ở hộp thư chat, hộp yêu cầu báo giá. */
  owner: (name: string) => `Sale phụ trách: ${name}`,
  ownerCover: (name: string, cover: string) => `Sale phụ trách: ${name} (${cover} lo thay)`,
  unassigned: "Chưa có Sale phụ trách",
  needsAssignment: (former: string | null) =>
    former ? `Cần giao người phụ trách (trước đây: ${former})` : "Cần giao người phụ trách",
  /** BR-S08: hộp xác nhận khoá / vô hiệu hoá tài khoản. */
  handover: {
    title: "Việc đang phụ trách",
    summary: (
      customers: number,
      conversations: number | null,
      leads: number | null,
      after: string,
    ) => {
      const parts = [`${customers} khách`];
      if (conversations !== null) parts.push(`${conversations} hội thoại mở`);
      if (leads !== null) parts.push(`${leads} khách tiềm năng`);
      return `Sale này đang phụ trách ${parts.join(", ")}; sau khi ${after} sẽ chuyển sang chờ giao.`;
    },
    afterLock: "khoá",
    afterDisable: "vô hiệu hoá",
    link: "Mở màn Phân công khách",
  },
} as const;

/** Form tạo khách (BR-S14, BR-S02, lead → khách §10.7). */
export const CUSTOMER_CREATE_OWNER_LABELS = {
  taxCodeHint: "10 số, 10-3 số, hoặc 12 số CCCD của chủ hộ kinh doanh.",
  taxCodeRequired: "Nhập mã số thuế (hộ kinh doanh: số CCCD của chủ hộ).",
  exemption: "Miễn MST (hộ kinh doanh / ngoại lệ)",
  exemptionHint: "Chỉ Sales Manager. Ghi rõ vì sao khách chưa có mã số thuế.",
  exemptionReason: "Lý do miễn MST",
  exemptionReasonRequired: "Nhập lý do miễn MST",
  ownerSection: "Sale phụ trách",
  ownerLabel: "Người phụ trách",
  ownerNone: "Để trống (Sales Manager giao sau)",
  ownerHint: "Để trống thì khách vào danh sách cần giao người phụ trách.",
  ownerSelf: "Bạn sẽ là Sale phụ trách của khách này.",
  fromLead: "Tạo từ khách tiềm năng — người phụ trách là Sale được giao khách tiềm năng đó.",
  duplicates: {
    title: "Có thể đã có khách này",
    description: "Kiểm tra trước khi tạo, tránh tạo trùng hồ sơ.",
    matchedOn: { taxCode: "MST", phone: "SĐT", email: "email", name: "tên" } as Record<
      string,
      string
    >,
    matchedPrefix: "Trùng",
    owner: (name: string) => `do ${name} phụ trách`,
    noOwner: "chưa có người phụ trách",
    open: "Xem khách",
  },
} as const;
