import { Card } from "@/components/shared/Card";

import { SectionTitle, SummaryItem } from "./wizard-constants";

import type { SupplierCreateInput } from "@/features/supplier/types";

export function ReviewSummary({
  watchedValues,
  watchedCurrency,
}: {
  watchedValues: SupplierCreateInput;
  watchedCurrency: string;
}) {
  return (
    <Card>
      <SectionTitle
        title="Rà soát trước khi lưu"
        description="Kiểm tra lại hồ sơ trước khi tạo — mọi lỗi sẽ được đánh dấu theo bước."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryItem label="Tên NCC" value={watchedValues.name || "—"} />
        <SummaryItem label="Mã số thuế" value={watchedValues.taxCode || "—"} mono />
        <SummaryItem label="Email" value={watchedValues.contactEmail || "—"} />
        <SummaryItem label="Điện thoại" value={watchedValues.contactPhone || "—"} mono />
        <SummaryItem label="Địa chỉ" value={watchedValues.address?.street || "—"} />
        <SummaryItem label="Tỉnh/TP" value={watchedValues.address?.province || "—"} />
        <SummaryItem label="Điều khoản" value={watchedValues.paymentTerms || "—"} />
        <SummaryItem label="Lead time" value={`${watchedValues.leadTimeDays ?? "—"} ngày`} mono />
        <SummaryItem label="Tiền tệ" value={watchedCurrency} mono />
      </div>
    </Card>
  );
}
