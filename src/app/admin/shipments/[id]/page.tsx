import { ShipmentScreen } from "@/features/shipping/components/ShipmentScreen";

export default async function ShipmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ShipmentScreen id={id} />;
}
