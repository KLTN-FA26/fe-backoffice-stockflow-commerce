import { CreditRequestDetail } from "@/features/credit-request";

/** Link thông báo BE trỏ đúng route này: `/admin/payment/credit-requests/{id}`. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CreditRequestDetail id={id} />;
}
