import { PickingDetail } from "@/features/fulfillment/components/PickingDetail";

export default async function PickingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PickingDetail id={id} />;
}
