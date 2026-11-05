import { ReceiptDetail } from "@/features/receipt/components/ReceiptDetail";

export default async function ReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReceiptDetail id={id} />;
}
