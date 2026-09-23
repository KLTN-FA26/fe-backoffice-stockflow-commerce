"use client";

import { Card } from "@/components/shared/Card";

import { SupplierAddressSection } from "./SupplierAddressSection";
import { SupplierContactSection } from "./SupplierContactSection";
import { SupplierProfileSection } from "./SupplierProfileSection";
import { SupplierTermsSection } from "./SupplierTermsSection";
import { ReviewChecklist } from "./ReviewChecklist";
import { ReviewSummary } from "./ReviewSummary";
import { SectionTitle } from "./wizard-constants";

import type { useSupplierWizard } from "./useSupplierWizard";

export function SupplierFormSteps({ w }: { w: ReturnType<typeof useSupplierWizard> }) {
  if (w.currentStep === "profile")
    return (
      <Card>
        <SectionTitle
          title="Hồ sơ nhà cung cấp"
          description="Mã NCC (BE code), tên hiển thị và mã số thuế — MST phải 10 số hoặc 13 số 0301234567-001."
        />
        <SupplierProfileSection register={w.register} errors={w.errors} />
      </Card>
    );
  if (w.currentStep === "contact")
    return (
      <Card>
        <SectionTitle
          title="Liên hệ"
          description="Người liên hệ chính, số điện thoại VN (0/+84 + 9-10 số) và email."
        />
        <SupplierContactSection register={w.register} errors={w.errors} />
      </Card>
    );
  if (w.currentStep === "address")
    return (
      <Card>
        <SectionTitle
          title="Địa chỉ (VN)"
          description="Địa chỉ 3 cấp tỉnh/huyện/xã của nhà cung cấp — dùng khi in chứng từ và đối soát."
        />
        <SupplierAddressSection register={w.register} errors={w.errors} />
      </Card>
    );
  return (
    <>
      <Card>
        <SectionTitle
          title="Điều khoản & lead time"
          description="Điều khoản thanh toán, thời gian giao hàng dự kiến và đơn vị tiền tệ (BR-07 theo NCC)."
        />
        <SupplierTermsSection
          register={w.register}
          control={w.control}
          setValue={w.setValue}
          errors={w.errors}
        />
      </Card>
      <ReviewSummary watchedValues={w.watchedValues} watchedCurrency={w.watchedCurrency} />
      <Card>
        <SectionTitle
          title="Kiểm tra theo bước"
          description="Mỗi bước phải không còn lỗi mới tạo được NCC."
        />
        <ReviewChecklist getIssues={(k) => w.validationByStep.get(k) ?? []} />
        {!w.isEdit && (
          <p className="text-ink-tertiary mt-3 text-xs">
            Chỉnh sửa sẽ cập nhật hồ sơ hiện tại, không tạo bản ghi mới.
          </p>
        )}
      </Card>
    </>
  );
}
