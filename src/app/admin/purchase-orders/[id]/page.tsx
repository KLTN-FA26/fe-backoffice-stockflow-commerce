import { PurchaseOrderDetail } from "@/features/purchase-order/components/PurchaseOrderDetail";

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PurchaseOrderDetail id={id} />;
}
