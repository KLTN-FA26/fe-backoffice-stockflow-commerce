import { SUPPLIER_CHANNEL_LABELS, SUPPLIER_FIELD_LABELS } from "@/constants";
import { Card } from "@/components/shared/Card";

import { SectionTitle, SummaryItem } from "./wizard-constants";

import type { SupplierFormValues } from "@/features/supplier/types";

const L = SUPPLIER_FIELD_LABELS;

export function ReviewSummary({ values }: { values: SupplierFormValues }) {
  return (
    <Card>
      <SectionTitle
        title="Rà soát trước khi lưu"
        description="Kiểm tra lại hồ sơ trước khi lưu — mọi lỗi sẽ được đánh dấu theo bước."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryItem label={L.codeShort} value={values.code || "—"} mono />
        <SummaryItem label={L.name} value={values.name || "—"} />
        <SummaryItem label={L.taxCode} value={values.taxCode || "—"} mono />
        <SummaryItem label={L.contactName} value={values.contactName || "—"} />
        <SummaryItem label={L.email} value={values.email || "—"} />
        <SummaryItem label={L.phone} value={values.phone || "—"} mono />
        <SummaryItem
          label={L.paymentTermDays}
          value={Number.isFinite(values.paymentTermDays) ? `${values.paymentTermDays} ngày` : "—"}
          mono
        />
        <SummaryItem
          label={L.leadTimeDays}
          value={Number.isFinite(values.leadTimeDays) ? `${values.leadTimeDays} ngày` : "—"}
          mono
        />
        <SummaryItem
          label={L.communicationChannel}
          value={
            values.communicationChannel === "API"
              ? `${SUPPLIER_CHANNEL_LABELS.API} — ${values.apiEndpoint || "chưa nhập endpoint"}`
              : SUPPLIER_CHANNEL_LABELS.EMAIL
          }
        />
      </div>
    </Card>
  );
}
