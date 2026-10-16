import { ManifestScreen } from "@/features/shipping/components/ManifestScreen";
import { ShippingGate } from "@/features/shipping/components/ShippingGate";

export default async function ManifestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ShippingGate>
      <ManifestScreen id={id} />
    </ShippingGate>
  );
}
