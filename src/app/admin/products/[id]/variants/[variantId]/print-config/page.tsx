import { PRODUCT_PERMISSIONS } from "@/constants/permissions";

import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";

import { VariantPrintConfig } from "@/components/backoffice/VariantPrintConfig";

export default async function VariantPrintConfigPage({
  params,
}: {
  params: Promise<{ id: string; variantId: string }>;
}) {
  const { id, variantId } = await params;
  return (
    // Quyền sửa do chính màn cấu hình in xét (`can`); trang chỉ cần quyền xem sản phẩm như trang chi tiết.
    <PermissionBoundary permissions={[PRODUCT_PERMISSIONS.viewPage, PRODUCT_PERMISSIONS.read]}>
      <VariantPrintConfig productId={id} variantId={variantId} />
    </PermissionBoundary>
  );
}
