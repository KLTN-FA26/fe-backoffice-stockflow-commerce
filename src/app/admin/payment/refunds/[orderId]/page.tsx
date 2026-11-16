import { RefundDetail } from "@/features/payment";

export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <RefundDetail orderId={orderId} />;
}
