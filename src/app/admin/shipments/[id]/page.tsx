import { LoadingScreen } from "@/features/shipping/components/LoadingScreen";
import { ShippingGate } from "@/features/shipping/components/ShippingGate";

export default async function LoadingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ShippingGate>
      <LoadingScreen id={id} />
    </ShippingGate>
  );
}
