import { RelatedConversationLink } from "@/components/backoffice/RelatedConversationLink";
import { CustomerDetail } from "@/features/customer";

export default async function CustomerDetailPage({ params }: PageProps<"/admin/customers/[id]">) {
  const { id } = await params;
  return (
    <>
      <RelatedConversationLink target={{ kind: "CUSTOMER", id }} />
      <CustomerDetail id={id} />
    </>
  );
}
