import { ReceiptDetail } from "@/features/receipt/components/ReceiptDetail";

export default function ReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <ReceiptDetail params={params} />;
}
