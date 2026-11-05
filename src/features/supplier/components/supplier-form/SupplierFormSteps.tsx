"use client";

import { Card } from "@/components/shared/Card";

import { ReviewChecklist } from "./ReviewChecklist";
import { ReviewSummary } from "./ReviewSummary";
import { SupplierContactSection } from "./SupplierContactSection";
import { SupplierProfileSection } from "./SupplierProfileSection";
import { SupplierTermsSection } from "./SupplierTermsSection";
import { SectionTitle } from "./wizard-constants";

import type { SupplierWizard } from "./useSupplierWizard";

export function SupplierFormSteps({ w }: { w: SupplierWizard }) {
  if (w.currentStep === "profile")
    return (
      <Card>
        <SectionTitle
          title="Hồ sơ nhà cung cấp"
          description="Mã NCC, tên hiển thị và mã số thuế (nhận cả mã số thuế nước ngoài)."
        />
        <SupplierProfileSection register={w.register} errors={w.errors} isEdit={w.isEdit} />
      </Card>
    );
  if (w.currentStep === "contact")
    return (
      <Card>
        <SectionTitle
          title="Liên hệ"
          description="Người liên hệ, số điện thoại và email. Email bắt buộc nếu gửi PO qua kênh Email."
        />
        <SupplierContactSection register={w.register} errors={w.errors} />
      </Card>
    );
  return (
    <>
      <Card>
        <SectionTitle
          title="Điều khoản & kênh gửi PO"
          description="Thời hạn thanh toán, thời gian giao hàng và cách gửi đơn đặt hàng cho NCC."
        />
        <SupplierTermsSection
          register={w.register}
          control={w.control}
          setValue={w.setValue}
          errors={w.errors}
        />
      </Card>
      <ReviewSummary values={w.watchedValues} />
      <Card>
        <SectionTitle
          title="Kiểm tra theo bước"
          description="Mỗi bước phải không còn lỗi mới lưu được nhà cung cấp."
        />
        <ReviewChecklist getIssues={(k) => w.validationByStep.get(k) ?? []} />
        {w.isEdit && (
          <p className="text-ink-tertiary mt-3 text-xs">
            Chỉnh sửa sẽ cập nhật hồ sơ hiện tại, không tạo bản ghi mới.
          </p>
        )}
      </Card>
    </>
  );
}
