/** Đề nghị mẫu theo hình dạng BE `CreditRequestResponse` (PR #490). */
export const CUSTOMER_ID = "11111111-0000-4000-8000-0000000000c1";
export const REQUEST_ID = "22222222-0000-4000-8000-0000000000c2";

export const review = {
  settledContracts: 1,
  paidInstallments: 8,
  onTimeInstallments: 7,
  onTimeRatio: 0.875,
  averageDaysLate: 3.5,
  paidLast12Months: 420_000_000,
  outstanding: 60_000_000,
  hasOverdue: false,
  overdueAmount: 0,
  currentCreditLimit: 100_000_000,
  currentCreditTermDays: 30,
  creditTermsVersion: 4,
  suggestedLimit: 35_000_000,
  warnings: ["SHORT_HISTORY", "ABOVE_SUGGESTED"],
  minSettledContracts: 2,
  suggestedMonths: 1,
};

export const submitted = {
  id: REQUEST_ID,
  customerId: CUSTOMER_ID,
  customerName: "Công ty Ly Giấy Xanh",
  customerCode: "KH-0001",
  source: "PORTAL",
  status: "SUBMITTED",
  requestedLimit: 500_000_000,
  requestedTermDays: 45,
  currency: "VND",
  reason: "Mở rộng đơn hàng quý 1.",
  submittedBy: "33333333-0000-4000-8000-0000000000aa",
  submittedByName: "Khách Ly Giấy Xanh",
  submittedAt: "2026-11-26T02:00:00Z",
  version: 0,
  files: [],
  review,
};

export const pendingApproval = {
  ...submitted,
  status: "PENDING_APPROVAL",
  salesNote: "Khách mua đều, đề xuất 300 triệu.",
  salesRecommendedLimit: 300_000_000,
  recommendedBy: "44444444-0000-4000-8000-0000000000bb",
  recommendedByName: "Sale A",
  recommendedAt: "2026-11-26T04:00:00Z",
  version: 1,
};
