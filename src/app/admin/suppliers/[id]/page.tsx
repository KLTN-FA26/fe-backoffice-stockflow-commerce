import { SupplierDetail } from "@/features/supplier/components/SupplierDetail";

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SupplierDetail id={id} />;
}
