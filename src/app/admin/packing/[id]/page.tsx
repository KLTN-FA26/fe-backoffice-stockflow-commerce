import { PackingStation } from "@/features/fulfillment/components/PackingStation";

export default async function PackingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PackingStation id={id} />;
}
