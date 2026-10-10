import { VariantAttributes } from "@/features/product/components/VariantAttributes";
import { VariantAttributesGate } from "@/features/product/components/VariantAttributesGate";

export default function VariantAttributesPage() {
  return (
    <VariantAttributesGate>
      <VariantAttributes />
    </VariantAttributesGate>
  );
}
