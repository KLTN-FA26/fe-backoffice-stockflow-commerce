import { SupplierDetail } from "@/features/supplier/components/SupplierDetail";

export default function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <SupplierDetail params={params} />;
}
