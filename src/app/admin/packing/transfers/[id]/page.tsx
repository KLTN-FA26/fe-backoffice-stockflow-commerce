import { TransferPackStation } from "@/features/fulfillment/components/TransferPackStation";

export default async function TransferPackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TransferPackStation transferId={id} />;
}
