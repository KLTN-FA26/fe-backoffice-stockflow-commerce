import { InvoiceDetail } from "@/features/invoice/components/InvoiceDetail";

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <InvoiceDetail params={params} />;
}
