import { Card } from "@/components/shared/Card";

import { SectionTitle, SummaryItem } from "./wizard-constants";

import type { SupplierFormValues } from "@/features/supplier/types";

const CHANNEL_SUMMARY = { EMAIL: "Email", API: "API" } as const;

export function ReviewSummary({ values }: { values: SupplierFormValues }) {
  return (
    <Card>
      <SectionTitle
        title="Rà soát trước khi lưu"
        description="Kiểm tra lại hồ sơ trước khi lưu — mọi lỗi sẽ được đánh dấu theo bước."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryItem label="Mã NCC" value={values.code || "—"} mono />
        <SummaryItem label="Tên NCC" value={values.name || "—"} />
        <SummaryItem label="Mã số thuế" value={values.taxCode || "—"} mono />
        <SummaryItem label="Người liên hệ" value={values.contactName || "—"} />
        <SummaryItem label="Email" value={values.email || "—"} />
        <SummaryItem label="Điện thoại" value={values.phone || "—"} mono />
        <SummaryItem
          label="Thời hạn thanh toán"
          value={Number.isFinite(values.paymentTermDays) ? `${values.paymentTermDays} ngày` : "—"}
          mono
        />
        <SummaryItem
          label="Thời gian giao hàng"
          value={Number.isFinite(values.leadTimeDays) ? `${values.leadTimeDays} ngày` : "—"}
          mono
        />
        <SummaryItem
          label="Kênh gửi PO"
          value={
            values.communicationChannel === "API"
              ? `${CHANNEL_SUMMARY.API} — ${values.apiEndpoint || "chưa nhập endpoint"}`
              : CHANNEL_SUMMARY.EMAIL
          }
        />
      </div>
    </Card>
  );
}
