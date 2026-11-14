import { CartonCheckStation } from "@/features/fulfillment/components/CartonCheckStation";

export default async function PackingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CartonCheckStation id={id} />;
}
