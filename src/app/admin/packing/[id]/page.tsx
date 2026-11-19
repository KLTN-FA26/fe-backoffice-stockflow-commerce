import { CartonCheckStationWithLpnLabels } from "@/components/backoffice/CartonCheckStationWithLpnLabels";

export default async function PackingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CartonCheckStationWithLpnLabels id={id} />;
}
