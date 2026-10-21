import { PurchaseOrderEdit } from "@/features/purchase-order/components/PurchaseOrderEdit";

export default async function PurchaseOrderEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PurchaseOrderEdit id={id} />;
}
