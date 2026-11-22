import { RelatedConversationLink } from "@/components/backoffice/RelatedConversationLink";
import { QuoteDetail } from "@/features/quote";

export default async function QuoteDetailPage({ params }: PageProps<"/admin/quotes/[id]">) {
  const { id } = await params;
  return (
    <>
      <RelatedConversationLink target={{ kind: "QUOTE", id }} />
      <QuoteDetail id={id} />
    </>
  );
}
