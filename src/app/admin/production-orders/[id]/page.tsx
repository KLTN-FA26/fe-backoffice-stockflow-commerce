import { ProductionDetailView } from "@/features/production-order";

export default async function ProductionOrderDetailPage({
  params,
}: PageProps<"/admin/production-orders/[id]">) {
  const { id } = await params;
  return <ProductionDetailView id={id} />;
}
